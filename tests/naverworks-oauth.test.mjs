import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createOAuthHandler } from '../api/naverworks-oauth.js';
import { createWorksAuth } from '../lib/naverworks-auth.js';
import { memoryStore } from './helpers.mjs';

const environment = () => ({ SITE_URL: 'https://teyvat-pi.vercel.app', CRON_SECRET: 'operator-secret',
  NAVERWORKS_CLIENT_ID: 'test-client', NAVERWORKS_CLIENT_SECRET: 'test-client-secret', NAVERWORKS_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
async function call(handler, url, headers = {}, method = 'GET') {
  let status, text;
  const responseHeaders = {};
  await handler({ url, method, headers }, { setHeader(key, value) { responseHeaders[key] = value; }, set statusCode(value) { status = value; }, end(value) { text = value; } });
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status, body, headers: responseHeaders };
}
const start = handler => call(handler, '/api/naverworks-oauth?action=start', { authorization: 'Bearer operator-secret' });
test('only the operator can start NAVER WORKS authorization', async () => {
  const handler = createOAuthHandler({ env: environment(), store: memoryStore() });
  assert.equal((await call(handler, '/api/naverworks-oauth?action=start')).status, 401);
  assert.equal((await call(handler, '/api/naverworks-oauth?action=start', {}, 'POST')).status, 405);
  const result = await start(handler), url = new URL(result.body.authorizationUrl);
  assert.equal(result.status, 200); assert.equal(url.origin, 'https://auth.worksmobile.com');
  assert.equal(url.searchParams.get('scope'), 'file');
  assert.equal(url.searchParams.get('redirect_uri'), environment().SITE_URL + '/api/naverworks-oauth');
  assert.ok(!result.body.authorizationUrl.includes('operator-secret'));
});
test('a valid user callback stores encrypted tokens and does not expose them to the browser', async () => {
  const env = environment(), store = memoryStore(); let exchanges = 0;
  const handler = createOAuthHandler({ env, store, fetcher: async (url, init) => {
    exchanges++; assert.equal(init.body.get('grant_type'), 'authorization_code');
    assert.equal(init.body.get('redirect_uri'), env.SITE_URL + '/api/naverworks-oauth');
    return Response.json({ access_token: 'callback-access', refresh_token: 'callback-refresh', expires_in: 3600, scope: 'file' });
  } });
  const state = new URL((await start(handler)).body.authorizationUrl).searchParams.get('state');
  const result = await call(handler, '/api/naverworks-oauth?code=one-time-code&state=' + state);
  assert.equal(result.status, 200); assert.match(result.body, /사용자 인증을 완료/);
  assert.ok(!result.body.includes('callback-access')); assert.ok(!JSON.stringify([...store.data.values()]).includes('callback-refresh'));
  assert.equal(await createWorksAuth(env, { store, fetcher: () => { throw new Error('Unexpected refresh'); } }).token(), 'callback-access');
  assert.equal(exchanges, 1);
  assert.equal((await call(handler, '/api/naverworks-oauth?code=one-time-code&state=' + state)).status, 400);
  assert.equal(exchanges, 1);
});
test('moving the public website preserves the registered OAuth callback through code exchange', async () => {
  const redirectUri = 'https://teyvat-pi.vercel.app/api/naverworks-oauth';
  const env = { ...environment(), SITE_URL: 'https://teyvat.kr', NAVERWORKS_REDIRECT_URI: redirectUri };
  const store = memoryStore(); let exchanges = 0;
  const handler = createOAuthHandler({ env, store, fetcher: async (url, init) => {
    exchanges++; assert.equal(init.body.get('redirect_uri'), redirectUri);
    return Response.json({ access_token: 'callback-access', refresh_token: 'callback-refresh', expires_in: 3600, scope: 'file' });
  } });
  const result = await start(handler), authorize = new URL(result.body.authorizationUrl);
  assert.equal(result.body.redirectUri, redirectUri);
  assert.equal(authorize.searchParams.get('redirect_uri'), redirectUri);
  env.SITE_URL = 'https://www.teyvat.kr';
  const response = await call(handler, redirectUri + '?code=one-time-code&state=' + authorize.searchParams.get('state'));
  assert.equal(response.status, 200); assert.equal(exchanges, 1);
});
test('expired and forged OAuth states cannot exchange a code', async () => {
  let time = Date.now(), calls = 0;
  const handler = createOAuthHandler({ env: environment(), store: memoryStore(), now: () => time, fetcher: () => calls++ });
  const state = new URL((await start(handler)).body.authorizationUrl).searchParams.get('state');
  time += 600001;
  assert.equal((await call(handler, '/api/naverworks-oauth?code=code&state=' + state)).status, 400);
  assert.equal((await call(handler, '/api/naverworks-oauth?code=code&state=' + randomBytes(32).toString('base64url'))).status, 400);
  assert.equal(calls, 0);
});
test('authorization without the required Drive write scope is rejected', async () => {
  const handler = createOAuthHandler({ env: environment(), store: memoryStore(), fetcher: async () => Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'file.read' }) });
  const state = new URL((await start(handler)).body.authorizationUrl).searchParams.get('state');
  assert.equal((await call(handler, '/api/naverworks-oauth?code=code&state=' + state)).status, 400);
});
test('mail integration requests file plus mail and rejects a partial approval before replacing tokens', async () => {
  const env = { ...environment(), NAVERWORKS_OAUTH_SCOPES: 'file mail' }, store = memoryStore();
  const handler = createOAuthHandler({ env, store, fetcher: async () => Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'file' }) });
  const authorize = new URL((await start(handler)).body.authorizationUrl);
  assert.equal(authorize.searchParams.get('scope'), 'file mail');
  assert.equal((await call(handler, '/api/naverworks-oauth?code=code&state=' + authorize.searchParams.get('state'))).status, 400);
  assert.ok(![...store.data.keys()].some(path => path.startsWith('credentials/')));
});
test('concurrent callbacks claim the authorization code only once', async () => {
  let calls = 0;
  const handler = createOAuthHandler({ env: environment(), store: memoryStore(), fetcher: async () => { calls++; return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'file' }); } });
  const state = new URL((await start(handler)).body.authorizationUrl).searchParams.get('state');
  const results = await Promise.all([call(handler, '/api/naverworks-oauth?code=code&state=' + state), call(handler, '/api/naverworks-oauth?code=code&state=' + state)]);
  assert.equal(results.filter(result => result.status === 200).length, 1); assert.equal(calls, 1);
});
