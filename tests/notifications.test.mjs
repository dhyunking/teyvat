import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry } from '../lib/contact.js';
import { acceptInquiry } from '../lib/intake.js';
import { processNotifications, processChannel, acknowledgementPayload } from '../lib/notifications.js';
import { fixture, memoryStore, noFiles } from './helpers.mjs';

const env = { MESSAGIO_API_KEY: 'test-key', CONTACT_FROM_EMAIL: 'TEYVAT <forms@example.com>',
  CONTACT_REPLY_TO_EMAIL: 'inquiry@example.com', SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test/test/test' };
const recordFor = async (store, acknowledgement = true, extra = {}) => acceptInquiry(validateInquiry(fixture(extra)), { store, drive: noFiles, acknowledgement });

test('acknowledgement goes only to the customer, without original message or attachments', async () => {
  const store = memoryStore(), record = await recordFor(store);
  const payload = acknowledgementPayload(record, env);
  assert.deepEqual(payload.to, [record.inquiry.email]); assert.deepEqual(payload.reply_to, ['inquiry@example.com']);
  assert.ok(!payload.text.includes(record.inquiry.message)); assert.ok(!payload.attachments);
  assert.match(payload.text, new RegExp(record.requestId));
});
test('durable delivery claims prevent two workers from sending duplicate Slack and confirmation messages', async () => {
  const store = memoryStore(), record = await recordFor(store), calls = [];
  const options = { store, env, fetcher: async (url, init) => { calls.push({ url, init }); return url.includes('messag.io') ? Response.json({ id: 'em_test' }, { status: 201 }) : new Response('ok'); } };
  await Promise.all([processNotifications(record, options), processNotifications(record, options)]);
  assert.equal(calls.length, 2);
  assert.equal((await store.read(`delivery/${record.requestId}/slack.json`)).value.state, 'sent');
  assert.equal((await store.read(`delivery/${record.requestId}/ack.json`)).value.state, 'sent');
  await processNotifications(record, options); assert.equal(calls.length, 2);
});
test('disabled acknowledgements never call Messageo even when keys exist', async () => {
  const store = memoryStore(), record = await recordFor(store, false); let calls = 0;
  assert.equal(await processChannel('ack', record, { store, env, fetcher: () => calls++ }), 'disabled');
  assert.equal(calls, 0);
});
test('Slack works independently when the optional email provider is unavailable', async () => {
  const store = memoryStore(), record = await recordFor(store);
  const result = await processNotifications(record, { store, env: { SLACK_WEBHOOK_URL: env.SLACK_WEBHOOK_URL }, fetcher: async () => new Response('ok') });
  assert.deepEqual(result, { slack: 'sent', ack: 'pending' });
});
test('rate-limited notification is retried with its original payload and key', async () => {
  const store = memoryStore(), record = await recordFor(store), requests = []; let time = Date.now();
  const options = { store, env, now: () => time, log: () => {}, fetcher: async (url, init) => { requests.push(init); return requests.length === 1 ? new Response('', { status: 429, headers: { 'retry-after': '120' } }) : Response.json({ id: 'em_retried' }, { status: 201 }); } };
  assert.equal(await processChannel('ack', record, options), 'retry');
  await processChannel('ack', record, options); assert.equal(requests.length, 1);
  time += 120001;
  assert.equal(await processChannel('ack', record, options), 'sent');
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers['Idempotency-Key'], `teyvat-receipt-${record.requestId}`);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
});
test('unknown email outcome is never retried beyond the provider idempotency window', async () => {
  const store = memoryStore(), record = await recordFor(store); let time = Date.now(), calls = 0;
  const options = { store, env, now: () => time, log: () => {}, fetcher: async () => { calls++; throw new Error('timeout'); } };
  assert.equal(await processChannel('ack', record, options), 'unknown');
  time += 24 * 3600000;
  assert.equal(await processChannel('ack', record, options), 'unknown'); assert.equal(calls, 1);
});
test('ambiguous Slack outcomes are saved for inspection without blind resend', async () => {
  const store = memoryStore(), record = await recordFor(store); let calls = 0;
  const options = { store, env, log: () => {}, fetcher: async () => { calls++; throw new Error('timeout'); } };
  assert.equal(await processChannel('slack', record, options), 'unknown');
  assert.equal(await processChannel('slack', record, options), 'unknown'); assert.equal(calls, 1);
});
for (const [reply, expected] of [[{ id: 'em_held', status: 'held' }, 'held'], [{ id: 'em_blocked', status: 'suppressed' }, 'blocked'], [null, 'blocked']]) {
  test(`held, suppressed and malformed confirmations stay separate from a saved inquiry (${expected})`, async () => {
    const store = memoryStore(), record = await recordFor(store);
    assert.equal(await processChannel('ack', record, { store, env, log: () => {}, fetcher: async () => Response.json(reply, { status: 202 }) }), expected);
    assert.equal((await store.read(`inquiries/${record.requestId}.json`)).value.status, 'received');
  });
}
test('changing the confirmation payload after a timeout does not resend a different email under the same key', async () => {
  const store = memoryStore(), record = await recordFor(store); let calls = 0;
  const options = { store, env, log: () => {}, fetcher: async () => { calls++; throw new Error('timeout'); } };
  await processChannel('ack', record, options);
  assert.equal(await processChannel('ack', record, { ...options, env: { ...env, CONTACT_FROM_EMAIL: 'changed@example.com' } }), 'blocked');
  assert.equal(calls, 1);
});
test('Slack escapes contact fields, keeps message text literal, and uses verified file links', async () => {
  const store = memoryStore(), record = await recordFor(store, false, { company: '<!channel>', message: '<@U123> *bold*' });
  record.inquiry.attachments = [{ filename: 'drawing.pdf', webViewLink: 'https://drive.worksmobile.com/#/test-folder' }];
  let payload;
  await processChannel('slack', record, { store, env, fetcher: async (url, init) => { payload = JSON.parse(init.body); return new Response('ok'); } });
  assert.ok(!JSON.stringify(payload).includes('<!channel>'));
  assert.ok(payload.blocks.some(block => block.fields?.some(field => field.text.includes('&lt;!channel&gt;'))));
  assert.ok(payload.blocks.some(block => block.text?.type === 'plain_text' && block.text.text === '<@U123> *bold*'));
  assert.equal(payload.unfurl_links, false);
  assert.ok(!JSON.stringify(payload).includes('저장 위치:'));
  assert.equal(payload.blocks.find(block => block.accessory)?.accessory.url, record.inquiry.attachments[0].webViewLink);
});
