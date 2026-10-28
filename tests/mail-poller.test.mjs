import test from 'node:test';
import assert from 'node:assert/strict';
import { pollMail } from '../ops/mail-poller/worker.js';

function state() {
  const data = new Map();
  return { data, async get(key, type) { const value = data.get(key); return value && type === 'json' ? JSON.parse(value) : value || null; }, async put(key, value) { data.set(key, value); } };
}
const environment = kv => ({ MAIL_POLL_SECRET: 'a-private-poller-secret', MAIL_POLL_STATE: kv, MAILBOX: 'inquiry@teyvat.kr', SYNC_URL: 'https://teyvat.kr/api/sync-mail' });
test('the minute poller encrypts its cached token and avoids Vercel reads and writes for an unchanged inbox', async () => {
  const kv = state(), env = environment(kv); let tokenReads = 0, syncs = 0, inbox = [{ mailId: 123 }];
  const fetcher = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    if (url.includes('worksapis.com')) { assert.equal(init.headers.Authorization, 'Bearer private-oauth-token'); return Response.json({ mails: inbox }); }
    assert.equal(init.headers.Authorization, 'Bearer ' + env.MAIL_POLL_SECRET);
    if (url.includes('action=token')) { tokenReads++; return Response.json({ accessToken: 'private-oauth-token' }); }
    syncs++; return Response.json({ enabled: true, processed: 1, more: false });
  };
  assert.equal((await pollMail(env, fetcher)).changed, true);
  assert.equal((await pollMail(env, fetcher)).changed, false);
  assert.equal(tokenReads, 1); assert.equal(syncs, 1); assert.ok(![...kv.data.values()].join('').includes('private-oauth-token'));
  inbox = [{ mailId: 124 }, ...inbox]; await pollMail(env, fetcher); assert.equal(syncs, 2); assert.equal(tokenReads, 1);
});
test('the poller preserves pending work and reacquires an expired access token', async () => {
  const kv = state(), env = environment(kv); let tokenReads = 0, inboxCalls = 0, syncs = 0;
  const fetcher = async url => {
    if (url.includes('action=token')) { tokenReads++; return Response.json({ accessToken: 'access-' + tokenReads }); }
    if (url.includes('worksapis.com')) { inboxCalls++; return inboxCalls === 1 ? new Response(null, { status: 401 }) : Response.json({ mails: [{ mailId: 1 }] }); }
    syncs++; return Response.json({ enabled: true, processed: 1, more: syncs === 1 });
  };
  assert.equal((await pollMail(env, fetcher)).more, true); assert.equal(tokenReads, 2);
  await pollMail(env, fetcher); assert.equal(syncs, 2); assert.ok(await kv.get('inbox-fingerprint'));
});
test('no polling secret can be sent to another site', async () => {
  let called = false;
  await assert.rejects(pollMail({ ...environment(state()), SYNC_URL: 'https://evil.example/api/sync-mail' }, () => called = true));
  assert.equal(called, false);
});
