import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';
import seed from '../content/works.json' with { type: 'json' };
import { createStudioStore, updateRecord } from '../lib/studio-store.js';
import { createStudioProvider } from '../lib/studio-provider.js';
import { createStudioService } from '../lib/studio-service.js';
import { AUTH_PATH, StudioError, authenticate, assertOrigin, equal, csrfFor, passwordHash, checkPassword, sessionCookie, rateLimit } from '../lib/studio-auth.js';

async function readBody(req) {
  const limit = 3 * 1024 * 1024;
  if (Number(req.headers['content-length']) > limit) throw new StudioError(413, '사진 용량이 너무 큽니다. 다시 선택해 주세요.');
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new StudioError(415, '올바른 형식으로 다시 요청해 주세요.');
  let value = req.body;
  if (value === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > limit) throw new StudioError(413, '사진 용량이 너무 큽니다.'); chunks.push(chunk); }
    value = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(value)) value = value.toString();
  if (typeof value === 'string') {
    if (Buffer.byteLength(value) > limit) throw new StudioError(413, '요청 용량이 너무 큽니다.');
    try { value = JSON.parse(value); } catch { throw new StudioError(400, '입력 내용을 확인해 주세요.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > limit) throw new StudioError(400, '입력 내용을 확인해 주세요.');
  return value;
}
export function createAdminHandler({ env = process.env, store = createStudioStore(env), provider = createStudioProvider(env),
  now = Date.now, schedule = waitUntil, log = console.warn, initial = seed } = {}) {
  const service = createStudioService({ store, provider, seed: initial, now });
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Teyvat-Studio', '1');
    const reply = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url || '/api/admin', 'https://teyvat.kr'), op = url.searchParams.get('op') || 'session';
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(405, { message: '지원하지 않는 요청입니다.' }); }
      if (['source-begin', 'source-finish', 'source-abort'].includes(op)) {
        if (req.method !== 'POST') throw new StudioError(405, 'POST 요청만 지원합니다.');
        const token = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '')?.[1];
        if (!token || !await provider.authorize(token)) throw new StudioError(401, '배포 인증이 필요합니다.');
        const body = await readBody(req);
        if (op === 'source-begin') return reply(200, { catalog: await service.sourceBegin(body.owner) });
        if (op === 'source-finish') await service.sourceFinish(body);
        else await service.sourceAbort(body.owner);
        return reply(200, { ok: true });
      }
      if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) throw new StudioError(503, '관리자 연결을 준비하고 있습니다.');
      if (req.method === 'POST') assertOrigin(req, env);
      if (req.method === 'POST' && ['setup', 'login'].includes(op)) {
        const body = await readBody(req);
        await rateLimit(req, store, env, now());
        let record;
        if (op === 'setup') {
          if (!env.ADMIN_BOOTSTRAP_SECRET || !equal(body.token, env.ADMIN_BOOTSTRAP_SECRET) || !Number.isFinite(Date.parse(env.ADMIN_BOOTSTRAP_EXPIRES_AT)) || Date.parse(env.ADMIN_BOOTSTRAP_EXPIRES_AT) < now()) throw new StudioError(403, '비밀번호 설정 링크가 만료됐거나 올바르지 않습니다.');
          if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new StudioError(400, '비밀번호는 12자 이상 128자 이하로 입력해 주세요.');
          const digest = await passwordHash(body.password);
          record = (await updateRecord(store, AUTH_PATH, value => {
            if (value.bootstrapUsed) throw new StudioError(403, '이미 사용한 설정 링크입니다. 비밀번호로 로그인해 주세요.');
            return { ...digest, version: (value.version || 0) + 1, bootstrapUsed: true, revoked: [], updatedAt: now() };
          })).value;
        } else {
          record = (await store.read(AUTH_PATH))?.value;
          if (!record || (!record.bootstrapUsed && record.initialExpiresAt && record.initialExpiresAt <= now()) || !await checkPassword(body.password, record)) throw new StudioError(401, '비밀번호를 확인해 주세요.');
        }
        const result = sessionCookie(record, env, now()); res.setHeader('Set-Cookie', result.cookie);
        return reply(200, { authenticated: true, csrf: csrfFor(result.session, env) });
      }
      const session = await authenticate(req, store, env, now());
      if (req.method === 'GET' && op === 'session') return reply(200, { authenticated: Boolean(session), ...(session ? { csrf: csrfFor(session, env) } : {}) });
      if (!session) throw new StudioError(401, '다시 로그인해 주세요.');
      if (req.method === 'POST' && !equal(req.headers['x-studio-csrf'], csrfFor(session, env))) throw new StudioError(403, '화면을 새로 열고 다시 시도해 주세요.');
      if (req.method === 'GET' && op === 'catalog') return reply(200, await service.overview());
      if (req.method === 'GET' && op === 'job') return reply(200, await service.jobStatus(url.searchParams.get('id')));
      if (req.method === 'GET' && op === 'image') {
        const bytes = await service.image(url.searchParams.get('id'));
        res.statusCode = 200; res.setHeader('Content-Type', 'image/webp'); res.setHeader('Cache-Control', 'private, max-age=60'); return res.end(bytes);
      }
      if (req.method !== 'POST') throw new StudioError(404, '요청을 찾을 수 없습니다.');
      const body = await readBody(req);
      if (op === 'logout') {
        await updateRecord(store, AUTH_PATH, value => ({ ...value, revoked: [...(value.revoked || []).filter(x => x.exp > now()), { sid: session.sid, exp: session.exp }] }));
        res.setHeader('Set-Cookie', 'teyvat_studio=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0' + (env.VERCEL ? '; Secure' : ''));
        return reply(200, { ok: true });
      }
      if (op === 'password') {
        const current = (await store.read(AUTH_PATH))?.value;
        if (!await checkPassword(body.current, current) || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new StudioError(400, '현재 비밀번호와 12자 이상의 새 비밀번호를 확인해 주세요.');
        const digest = await passwordHash(body.password);
        const updated = (await updateRecord(store, AUTH_PATH, value => {
          if (value.version !== current.version) throw new StudioError(409, '비밀번호가 변경됐습니다. 다시 로그인해 주세요.');
          return { ...digest, version: value.version + 1, bootstrapUsed: true, revoked: [], updatedAt: now() };
        })).value;
        const result = sessionCookie(updated, env, now()); res.setHeader('Set-Cookie', result.cookie);
        return reply(200, { csrf: csrfFor(result.session, env) });
      }
      if (op === 'draft') return reply(200, await service.save(body));
      if (op === 'discard') { await service.discard(body); return reply(200, { ok: true }); }
      if (op === 'upload') return reply(201, await service.upload(body));
      if (op === 'publish') {
        const job = await service.publish(body);
        try { schedule((async () => {
          const until = Date.now() + 45000;
          while (Date.now() < until) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const state = await service.jobStatus(job.id);
            if (['ready', 'failed'].includes(state.status)) break;
          }
        })().catch(() => {})); } catch {}
        return reply(202, job);
      }
      throw new StudioError(404, '요청을 찾을 수 없습니다.');
    } catch (error) {
      const reference = randomUUID();
      if (!(error instanceof StudioError)) log(JSON.stringify({ event: 'studio_error', reference, kind: error?.constructor?.name || 'Error' }));
      return reply(error instanceof StudioError ? error.status : 503, { message: error instanceof StudioError ? error.message : '저장 서비스 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', reference });
    }
  };
}
export default createAdminHandler();
