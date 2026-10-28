const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = text => Uint8Array.from(atob(text), value => value.charCodeAt(0));
async function encryptionKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode('teyvat/mail-poll/v1/' + secret));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function accessToken(env, fetcher, force = false) {
  let key;
  try { key = await encryptionKey(env.MAIL_POLL_SECRET); } catch { throw new Error('token_key_failed'); }
  if (!force) {
    let cached;
    try { cached = await env.MAIL_POLL_STATE.get('oauth-token', 'json'); } catch { throw new Error('token_cache_read_failed'); }
    if (cached) {
      try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(cached.iv) }, key, decode(cached.data))); } catch {}
    }
  }
  const url = new URL(env.SYNC_URL); url.searchParams.set('action', 'token');
  let response;
  try { response = await fetcher(url.href, { headers: { Authorization: 'Bearer ' + env.MAIL_POLL_SECRET }, redirect: 'manual', signal: AbortSignal.timeout(12000) }); } catch { throw new Error('mail_token_fetch_failed'); }
  if (!response.ok) throw new Error('mail_token_unavailable');
  const data = await response.json();
  if (typeof data.accessToken !== 'string' || !data.accessToken) throw new Error('invalid_mail_token');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data.accessToken));
  try { await env.MAIL_POLL_STATE.put('oauth-token', JSON.stringify({ iv: encode(iv), data: encode(encrypted) }), { expirationTtl: 600 }); } catch { throw new Error('token_cache_write_failed'); }
  return data.accessToken;
}
export async function pollMail(env, fetcher = (...args) => globalThis.fetch(...args)) {
  const syncUrl = new URL(env.SYNC_URL);
  if (syncUrl.origin !== 'https://teyvat.kr' || syncUrl.pathname !== '/api/sync-mail' || !env.MAIL_POLL_SECRET || !env.MAIL_POLL_STATE) throw new Error('invalid_poll_configuration');
  const endpoint = 'https://www.worksapis.com/v1.0/users/' + encodeURIComponent(env.MAILBOX) + '/mail/mailfolders/0/children?count=100';
  let token = await accessToken(env, fetcher);
  let response = await fetcher(endpoint, { headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
  if (response.status === 401) {
    token = await accessToken(env, fetcher, true);
    response = await fetcher(endpoint, { headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
  }
  if (!response.ok) throw new Error('inbox_check_failed');
  const inbox = response.status === 204 ? { mails: [] } : await response.json();
  if (!Array.isArray(inbox.mails)) throw new Error('invalid_inbox_response');
  const digest = encode(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(inbox.mails.map(mail => String(mail.mailId))))));
  if (await env.MAIL_POLL_STATE.get('inbox-fingerprint') === digest) return { changed: false };
  syncUrl.searchParams.set('generation', digest);
  const result = await fetcher(syncUrl.href, { headers: { Authorization: 'Bearer ' + env.MAIL_POLL_SECRET }, redirect: 'manual', signal: AbortSignal.timeout(50000) });
  if (!result.ok) throw new Error('mail_sync_failed');
  const summary = await result.json();
  if (summary.enabled !== true) throw new Error('mail_sync_disabled');
  if (!summary.more && !summary.busy && !summary.failed) await env.MAIL_POLL_STATE.put('inbox-fingerprint', digest);
  return { changed: true, processed: summary.processed || 0, failed: summary.failed || 0, more: Boolean(summary.more) };
}
export default {
  async scheduled(controller, env) {
    try { console.log(JSON.stringify({ event: 'teyvat_mail_poll', ...await pollMail(env) })); }
    catch (error) {
      const codes = ['invalid_poll_configuration', 'token_key_failed', 'token_cache_read_failed', 'token_cache_write_failed', 'mail_token_fetch_failed', 'mail_token_unavailable', 'invalid_mail_token', 'inbox_check_failed', 'invalid_inbox_response', 'mail_sync_failed', 'mail_sync_disabled'];
      console.log(JSON.stringify({ event: 'teyvat_mail_poll_failed', code: codes.includes(error.message) ? error.message : 'worker_runtime_failed' }));
      throw new Error('mail_poll_failed');
    }
  },
};
