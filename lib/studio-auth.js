import { randomBytes, randomUUID, createHmac, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { updateRecord } from './studio-store.js';
import { StudioError } from './studio-error.js';
export { StudioError } from './studio-error.js';

const derive = promisify(scrypt);
export const AUTH_PATH = 'cms/auth.json';
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: (await derive(password, salt, 32)).toString('hex') };
}
export async function checkPassword(password, record) {
  return typeof password === 'string' && password.length <= 128 && equal((await derive(password, record.salt, 32)).toString('hex'), record.hash);
}
export function csrfFor(session, env) {
  return createHmac('sha256', env.ADMIN_SESSION_SECRET).update('csrf:' + session.sid).digest('base64url');
}
export function sessionCookie(record, env, now = Date.now()) {
  const session = { sid: randomUUID(), version: record.version, exp: now + 12 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(session)).toString('base64url');
  const mac = createHmac('sha256', env.ADMIN_SESSION_SECRET).update(data).digest('base64url');
  return { session, cookie: `teyvat_studio=${data}.${mac}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=43200${env.VERCEL ? '; Secure' : ''}` };
}
export async function authenticate(req, store, env, now = Date.now()) {
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) throw new StudioError(503, '관리자 연결을 준비하고 있습니다.');
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('teyvat_studio='))?.slice(14);
  if (!token) return null;
  const [data, mac, extra] = token.split('.');
  if (!data || !mac || extra || !equal(mac, createHmac('sha256', env.ADMIN_SESSION_SECRET).update(data).digest('base64url'))) return null;
  let session;
  try { session = JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
  if (!session.sid || !Number.isFinite(session.exp) || session.exp <= now || session.exp > now + 12 * 60 * 60 * 1000) return null;
  const record = (await store.read(AUTH_PATH))?.value;
  if (!record || record.version !== session.version || record.revoked?.some(x => x.sid === session.sid) || !record.bootstrapUsed && record.initialExpiresAt && record.initialExpiresAt <= now) return null;
  return session;
}
export function assertOrigin(req, env) {
  const allowed = new Set([new URL(env.SITE_URL || 'https://teyvat.kr').origin]);
  if (env.VERCEL_URL) allowed.add('https://' + env.VERCEL_URL);
  if (!env.VERCEL) allowed.add('http://localhost:4173');
  if (!allowed.has(req.headers.origin)) throw new StudioError(403, '관리 화면을 새로 열고 다시 시도해 주세요.');
}
export async function rateLimit(req, store, env, now = Date.now()) {
  const ip = env.VERCEL ? (req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0] : req.socket?.remoteAddress || 'local';
  const key = createHmac('sha256', env.ADMIN_SESSION_SECRET).update(ip + ':' + Math.floor(now / 900000)).digest('hex');
  await updateRecord(store, `cms/login/${key}.json`, value => {
    if ((value.count || 0) >= 8) throw new StudioError(429, '로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');
    return { count: (value.count || 0) + 1, expiresAt: now + 900000 };
  });
}
