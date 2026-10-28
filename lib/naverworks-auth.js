import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { ContactError } from './contact.js';
import { createInquiryStore, StoreConflict } from './inquiry-store.js';

const TOKEN_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token';
const unavailable = () => new ContactError(503, '첨부 저장 연동을 확인 중입니다. 잠시 후 다시 시도해 주세요.');

export function vaultLocation(env) {
  const context = 'teyvat/naverworks/oauth/v1/' + (env.NAVERWORKS_CLIENT_ID || '');
  return { context, path: `credentials/naverworks-${createHash('sha256').update(context).digest('hex')}.json` };
}

export async function installWorksTokens(env, store, result, now = Date.now) {
  const key = Buffer.from(env.NAVERWORKS_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32 || !env.NAVERWORKS_CLIENT_ID || typeof result?.access_token !== 'string' || !result.access_token ||
      typeof result.refresh_token !== 'string' || !result.refresh_token || !Number.isFinite(Number(result.expires_in)) || Number(result.expires_in) < 1) throw unavailable();
  const { context, path } = vaultLocation(env), current = await store.read(path);
  if (current?.value.leaseUntil > now()) throw unavailable();
  await store.write(path, { sealed: sealTokens({ refreshToken: result.refresh_token, accessToken: result.access_token,
    expiresAt: now() + Number(result.expires_in) * 1000 }, key, context), leaseUntil: 0 }, current?.etag);
}

export function sealTokens(tokens, key, context) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens)), cipher.final()]).toString('base64');
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data };
}
export function openTokens(envelope, key, context) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
}

export function createWorksAuth(env = process.env, { store = createInquiryStore(env), fetcher = fetch, now = Date.now } = {}) {
  const { context, path } = vaultLocation(env);
  let cached;
  return {
    async token() {
      if (cached && cached.until > now()) return cached.value;
      const key = Buffer.from(env.NAVERWORKS_TOKEN_ENCRYPTION_KEY || '', 'base64');
      if (!env.NAVERWORKS_CLIENT_ID || !env.NAVERWORKS_CLIENT_SECRET || key.length !== 32) throw unavailable();
      for (let attempt = 0; attempt < 12; attempt++) {
        let current = await store.read(path);
        if (!current) {
          if (!env.NAVERWORKS_REFRESH_TOKEN) throw unavailable();
          try { current = await store.write(path, { sealed: sealTokens({ refreshToken: env.NAVERWORKS_REFRESH_TOKEN }, key, context), leaseUntil: 0 }); }
          catch (error) { if (error instanceof StoreConflict) continue; throw error; }
        }
        let tokens;
        try { tokens = openTokens(current.value.sealed, key, context); } catch { throw unavailable(); }
        if (tokens.accessToken && tokens.expiresAt > now() + 60000) {
          cached = { value: tokens.accessToken, until: Math.min(now() + 30000, tokens.expiresAt - 120000) };
          return tokens.accessToken;
        }
        if (current.value.leaseUntil > now()) { await new Promise(resolve => setTimeout(resolve, 200)); continue; }
        let claimed;
        try { claimed = await store.write(path, { ...current.value, owner: randomUUID(), leaseUntil: now() + 30000 }, current.etag); }
        catch (error) { if (error instanceof StoreConflict) continue; throw error; }
        try {
          const response = await fetcher(TOKEN_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
              grant_type: 'refresh_token', client_id: env.NAVERWORKS_CLIENT_ID, client_secret: env.NAVERWORKS_CLIENT_SECRET, refresh_token: tokens.refreshToken,
            }) });
          const result = await response.json();
          if (!response.ok || typeof result?.access_token !== 'string' || !result.access_token ||
              (result.refresh_token !== undefined && (typeof result.refresh_token !== 'string' || !result.refresh_token)) ||
              !Number.isFinite(Number(result.expires_in)) || Number(result.expires_in) < 1) throw unavailable();
          const next = { refreshToken: result.refresh_token || tokens.refreshToken, accessToken: result.access_token,
            expiresAt: now() + Number(result.expires_in) * 1000 };
          // Persist rotated refresh tokens before returning an access token to a caller.
          await store.write(path, { sealed: sealTokens(next, key, context), leaseUntil: 0 }, claimed.etag);
          cached = { value: next.accessToken, until: Math.min(now() + 30000, next.expiresAt - 120000) };
          return next.accessToken;
        } catch {
          // A failed refresh or persistence operation must not expose tokens or overwrite a newer vault.
          try { await store.write(path, { ...claimed.value, leaseUntil: 0 }, claimed.etag); } catch {}
          throw unavailable();
        }
      }
      throw unavailable();
    },
  };
}
