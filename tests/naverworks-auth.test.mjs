import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createWorksAuth, sealTokens, openTokens } from '../lib/naverworks-auth.js';
import { memoryStore } from './helpers.mjs';

const configuration = () => ({ NAVERWORKS_CLIENT_ID: 'test-client', NAVERWORKS_CLIENT_SECRET: 'test-client-secret',
  NAVERWORKS_REFRESH_TOKEN: 'initial-secret-refresh', NAVERWORKS_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
test('token vault encrypts credentials and rejects altered ciphertext or another application context', () => {
  const key = randomBytes(32), sealed = sealTokens({ refreshToken: 'private-token' }, key, 'app1');
  assert.ok(!JSON.stringify(sealed).includes('private-token'));
  assert.equal(openTokens(sealed, key, 'app1').refreshToken, 'private-token');
  assert.throws(() => openTokens(sealed, key, 'app2'));
  assert.throws(() => openTokens({ ...sealed, tag: randomBytes(16).toString('base64') }, key, 'app1'));
});
test('rotated refresh tokens survive a new server instance and replace the old seed token', async () => {
  const env = configuration(), store = memoryStore(), requests = []; let time = Date.now();
  const fetcher = async (url, init) => {
    assert.equal(url, 'https://auth.worksmobile.com/oauth2/v2.0/token');
    requests.push(init.body.get('refresh_token'));
    assert.equal(init.body.get('grant_type'), 'refresh_token');
    return Response.json({ access_token: 'new-access-' + requests.length, refresh_token: 'rotated-refresh-' + requests.length, expires_in: '3600' });
  };
  assert.equal(await createWorksAuth(env, { store, fetcher, now: () => time }).token(), 'new-access-1');
  assert.ok(!JSON.stringify([...store.data.values()]).includes('rotated-refresh-1'));
  assert.ok(!JSON.stringify([...store.data.values()]).includes('new-access-1'));
  time += 3600000;
  assert.equal(await createWorksAuth(env, { store, fetcher, now: () => time }).token(), 'new-access-2');
  assert.deepEqual(requests, ['initial-secret-refresh', 'rotated-refresh-1']);
});
test('two instances serialize token refresh instead of rotating credentials twice', async () => {
  const env = configuration(), store = memoryStore(); let calls = 0;
  const fetcher = async () => { calls++; return Response.json({ access_token: 'shared-access', refresh_token: 'rotated-refresh', expires_in: '3600' }); };
  const results = await Promise.all([createWorksAuth(env, { store, fetcher }).token(), createWorksAuth(env, { store, fetcher }).token()]);
  assert.deepEqual(results, ['shared-access', 'shared-access']); assert.equal(calls, 1);
});
test('provider denial, missing credentials and failed rotated-token persistence never return an access token', async () => {
  await assert.rejects(createWorksAuth({}, { store: memoryStore(), fetcher: () => { throw new Error('Should not call provider'); } }).token());
  await assert.rejects(createWorksAuth(configuration(), { store: memoryStore(), fetcher: async () => Response.json({ error: 'invalid_grant' }, { status: 400 }) }).token());
  const store = memoryStore(), originalWrite = store.write; let writes = 0;
  store.write = async (...args) => { if (++writes >= 3) throw new Error('Storage failed'); return originalWrite(...args); };
  await assert.rejects(createWorksAuth(configuration(), { store, fetcher: async () => Response.json({ access_token: 'unpersisted-access', refresh_token: 'new-refresh', expires_in: 3600 }) }).token());
});
