import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createInquiryStore } from '../lib/inquiry-store.js';
import { installWorksTokens } from '../lib/naverworks-auth.js';

export function createOAuthHandler({ env = process.env, store = createInquiryStore(env), fetcher = fetch, now = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    const reply = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(405, { error: 'method_not_allowed' }); }
    try {
      const origin = new URL(env.SITE_URL || 'https://teyvat-pi.vercel.app').origin;
      // Keep the registered OAuth callback stable when the public website changes domains.
      const url = new URL(req.url, origin), redirectUri = env.NAVERWORKS_REDIRECT_URI || origin + '/api/naverworks-oauth';
      const scopes = [...new Set((env.NAVERWORKS_OAUTH_SCOPES || 'file').split(/\s+/).filter(Boolean))];
      if (!scopes.includes('file') || scopes.some(scope => !['file', 'mail', 'mail.read'].includes(scope))) return reply(503, { error: 'invalid_oauth_scopes' });
      const configured = env.NAVERWORKS_CLIENT_ID && env.NAVERWORKS_CLIENT_SECRET && Buffer.from(env.NAVERWORKS_TOKEN_ENCRYPTION_KEY || '', 'base64').length === 32;
      if (url.searchParams.get('action') === 'start') {
        const expected = Buffer.from(`Bearer ${env.CRON_SECRET || ''}`), actual = Buffer.from(req.headers.authorization || '');
        if (!env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(401, { error: 'unauthorized' });
        if (!configured) return reply(503, { error: 'oauth_not_configured' });
        const state = randomBytes(32).toString('base64url'), hash = createHash('sha256').update(state).digest('hex');
        await store.write(`operations/oauth-state-${hash}.json`, { expiresAt: now() + 600000, used: false, redirectUri, scopes });
        const authorize = new URL('https://auth.worksmobile.com/oauth2/v2.0/authorize');
        authorize.search = new URLSearchParams({ client_id: env.NAVERWORKS_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(' '), state }).toString();
        return reply(200, { authorizationUrl: authorize.href, redirectUri });
      }
      const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
      if (!configured || !/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 4096) return reply(400, { error: 'invalid_callback' });
      const path = `operations/oauth-state-${createHash('sha256').update(state).digest('hex')}.json`, pending = await store.read(path);
      if (!pending || pending.value.used || pending.value.expiresAt <= now() || pending.value.redirectUri !== redirectUri) return reply(400, { error: 'invalid_or_expired_state' });
      // Claim this one-time authorization state before exchanging the code.
      await store.write(path, { ...pending.value, used: true }, pending.etag);
      const response = await fetcher('https://auth.worksmobile.com/oauth2/v2.0/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code,
          client_id: env.NAVERWORKS_CLIENT_ID, client_secret: env.NAVERWORKS_CLIENT_SECRET, redirect_uri: redirectUri }) });
      const result = await response.json();
      const granted = String(result?.scope || '').split(' ');
      if (!response.ok || !(pending.value.scopes || ['file']).every(scope => granted.includes(scope))) return reply(400, { error: 'authorization_denied_or_missing_file_scope' });
      await installWorksTokens(env, store, result, now);
      res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TEYVAT 네이버웍스 인증</title></head><body><h1>네이버웍스 사용자 인증을 완료했습니다.</h1><p>대상 공용 드라이브와 폴더 설정 후 첨부 업로드를 확인할 수 있습니다. 이 창을 닫아도 됩니다.</p></body></html>');
    } catch { return reply(503, { error: 'oauth_setup_failed_restart_authorization' }); }
  };
}
export default createOAuthHandler();
