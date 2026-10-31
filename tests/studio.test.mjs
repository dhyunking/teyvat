import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAdminHandler } from '../api/admin.js';
import { createStudioService } from '../lib/studio-service.js';
import { passwordHash, sessionCookie, authenticate, AUTH_PATH } from '../lib/studio-auth.js';
import { saveDraft, initialState, seedCatalog, candidateCatalog, mergeSource } from '../lib/studio-model.js';
import { memoryStore } from './helpers.mjs';
import seed from '../content/works.json' with { type: 'json' };

const timestamp = Date.now();
const environment = () => ({ SITE_URL: 'https://teyvat.kr', VERCEL: '1', ADMIN_SESSION_SECRET: 's'.repeat(48), ADMIN_BOOTSTRAP_SECRET: 'b'.repeat(48), ADMIN_BOOTSTRAP_EXPIRES_AT: new Date(timestamp + 86400000).toISOString() });
async function request(handler, op, body, options = {}) {
  let result; const headers = {};
  const req = { url: '/api/admin?op=' + op, method: body === undefined ? 'GET' : 'POST', body,
    headers: { origin: 'https://teyvat.kr', 'content-type': 'application/json', 'x-vercel-forwarded-for': randomUUID(), ...options.headers } };
  await handler(req, { setHeader(key, value) { headers[key] = value; }, set statusCode(value) { headers.status = value; }, end(value) { result = Buffer.isBuffer(value) ? value : JSON.parse(value); } });
  return { status: headers.status, headers, body: result };
}
const cookieOf = result => result.headers['Set-Cookie'].split(';')[0];

test('Studio setup is single-use; sessions are HttpOnly, CSRF-protected, revocable and expire', async () => {
  const store = memoryStore(), env = environment(), handler = createAdminHandler({ store, env, schedule: () => {}, log: () => {}, now: () => timestamp });
  assert.equal((await request(handler, 'catalog')).status, 401);
  assert.equal((await request(handler, 'setup', { token: 'wrong', password: 'valid-password-123' })).status, 403);
  const login = await request(handler, 'setup', { token: env.ADMIN_BOOTSTRAP_SECRET, password: 'valid-password-123' });
  assert.equal(login.status, 200);
  assert.match(login.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/); assert.match(login.headers['Set-Cookie'], /; Secure/);
  assert.equal((await request(handler, 'setup', { token: env.ADMIN_BOOTSTRAP_SECRET, password: 'replacement-password' })).status, 403);
  assert.equal((await request(handler, 'login', { password: 'wrong' })).status, 401);
  const cookie = cookieOf(login), headers = { cookie, 'x-studio-csrf': login.body.csrf };
  assert.equal((await request(handler, 'catalog', undefined, { headers })).status, 200);
  assert.equal((await request(handler, 'draft', { version: 0, work: {} }, { headers: { cookie } })).status, 403);
  assert.equal((await request(handler, 'draft', { version: 0, work: {} }, { headers: { ...headers, origin: 'https://attacker.example' } })).status, 403);
  assert.equal(await authenticate({ headers: { cookie } }, store, env, timestamp + 12 * 3600000 + 1), null);
  assert.equal(await authenticate({ headers: { cookie: cookie + 'x' } }, store, env, timestamp), null);
  assert.equal((await request(handler, 'logout', {}, { headers })).status, 200);
  assert.equal((await request(handler, 'catalog', undefined, { headers })).status, 401);
});

test('password changes invalidate other sessions and bootstrap links expire', async () => {
  const store = memoryStore(), env = environment();
  await store.write(AUTH_PATH, { ...await passwordHash('original-password'), version: 1, bootstrapUsed: true, revoked: [] });
  const a = sessionCookie((await store.read(AUTH_PATH)).value, env, timestamp);
  const handler = createAdminHandler({ store, env, now: () => timestamp, schedule: () => {}, log: () => {} });
  const current = await request(handler, 'login', { password: 'original-password' });
  const result = await request(handler, 'password', { current: 'original-password', password: 'new-password-123' }, { headers: { cookie: cookieOf(current), 'x-studio-csrf': current.body.csrf } });
  assert.equal(result.status, 200);
  assert.equal(await authenticate({ headers: { cookie: a.cookie.split(';')[0] } }, store, env, timestamp), null);
  const expired = createAdminHandler({ store: memoryStore(), env: { ...env, ADMIN_BOOTSTRAP_EXPIRES_AT: new Date(timestamp - 1).toISOString() }, now: () => timestamp, log: () => {} });
  assert.equal((await request(expired, 'setup', { token: env.ADMIN_BOOTSTRAP_SECRET, password: 'long-password-123' })).status, 403);
});

test('draft IDs are automatic and concurrent stale saves never overwrite a newer version', () => {
  const state = initialState(), catalog = seedCatalog(seed);
  const key = saveDraft(state, { version: 0, work: { brand: 'Draft' } }, catalog, timestamp);
  assert.equal(state.drafts[key].work.id, '30'); assert.equal(catalog.works.length, 29);
  assert.throws(() => saveDraft(state, { key, version: 0, work: { brand: 'Stale' } }, catalog, timestamp), /다른 창/);
  const other = saveDraft(state, { version: 0, work: {} }, catalog, timestamp);
  assert.equal(state.drafts[other].work.id, '31');
});

function sourceFiles(works) {
  return [...new Set(works.flatMap(w => [w.cover, w.hero, ...(w.chapters || []).flatMap(c => c.imgs.map(i => i.src))]).filter(Boolean))]
    .map(path => ({ file: path.slice(1), sha: 'a'.repeat(40), size: 10 })).concat([{ file: 'content/works.json', sha: 'b'.repeat(40), size: 10 }]);
}
async function serviceFixture() {
  const store = memoryStore(), images = new Map();
  store.image = async path => images.get(path); store.putImage = async (path, bytes) => { images.set(path, bytes); };
  const created = []; let remoteState = 'BUILDING';
  const provider = { async upload() { return 'c'.repeat(40); }, async create(files, meta) { created.push({ files, meta }); return { id: 'dpl_test', url: 'teyvat-test.vercel.app' }; },
    async status() { return { id: 'dpl_test', status: remoteState, meta: { githubCommitSha: 'd'.repeat(40) } }; }, async findJob() { return null; } };
  const service = createStudioService({ store, provider, seed, now: () => timestamp });
  await store.write('cms/source.json', { files: sourceFiles(seed.works), gitSha: 'd'.repeat(40), deploymentId: 'dpl_base' });
  return { store, service, created, provider, setState: value => { remoteState = value; } };
}

test('publishing snapshots one complete work and its photos; a failed build restores the previous catalog', async () => {
  const f = await serviceFixture();
  const saved = await f.service.save({ version: 0, originalId: '01', work: { ...seed.works[0], desc: '새로운 작업 설명' } });
  const before = await f.service.overview(); assert.equal(before.works[0].desc, seed.works[0].desc);
  const id = randomUUID(), job = await f.service.publish({ requestId: id, key: saved.key, version: saved.version });
  assert.equal(job.status, 'building'); assert.equal(f.created.length, 1);
  const manifest = f.created[0].files.find(file => file.file === 'content/works.json');
  assert.equal(JSON.parse(Buffer.from(manifest.data, 'base64')).works[0].desc, '새로운 작업 설명');
  await f.service.publish({ requestId: id, key: saved.key, version: saved.version }); assert.equal(f.created.length, 1);
  await assert.rejects(() => f.service.sourceBegin(randomUUID()), /진행 중/);
  f.setState('ERROR'); assert.equal((await f.service.jobStatus(id)).status, 'failed');
  const after = await f.service.overview(); assert.equal(after.works[0].desc, seed.works[0].desc); assert.equal(after.drafts.length, 1); assert.equal(after.busy, false);
});

test('successful publication removes only its saved draft version and code deployments preserve the CMS catalog', async () => {
  const f = await serviceFixture();
  const saved = await f.service.save({ version: 0, originalId: '01', work: seed.works[0] });
  const job = await f.service.publish({ requestId: randomUUID(), key: saved.key, version: saved.version });
  f.setState('READY'); assert.equal((await f.service.jobStatus(job.id)).status, 'ready');
  assert.equal((await f.service.overview()).drafts.length, 0);
  const lock = randomUUID(), catalog = await f.service.sourceBegin(lock);
  assert.ok(mergeSource(sourceFiles(seed.works), catalog).find(file => file.file === 'content/works.json').data);
  await assert.rejects(() => f.service.publish({ requestId: randomUUID(), key: saved.key, version: saved.version }), /진행 중/);
  await f.service.sourceFinish({ owner: lock, deploymentId: 'dpl_test', gitSha: 'd'.repeat(40), files: sourceFiles(seed.works) });
  assert.equal((await f.service.overview()).busy, false);
});

test('private photo uploads are idempotent and only validated, known images may be published', async () => {
  const f = await serviceFixture();
  const bytes = Buffer.concat([Buffer.from('RIFF'), Buffer.from([8, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([1, 2, 3, 4])]);
  const id = randomUUID(), first = await f.service.upload({ id, data: bytes.toString('base64') });
  assert.equal((await f.service.upload({ id, data: bytes.toString('base64') })).path, first.path);
  assert.deepEqual(await f.service.image(id), bytes);
  await assert.rejects(() => f.service.upload({ id: randomUUID(), data: Buffer.from('not an image').toString('base64') }), /写真|사진/);
  await assert.rejects(() => f.service.image('../inquiries/private.json'), /사진/);
  const saved = await f.service.save({ version: 0, originalId: '01', work: { ...seed.works[0], cover: first.path } });
  await f.service.publish({ requestId: randomUUID(), key: saved.key, version: saved.version });
  assert.ok(f.created[0].files.some(file => file.file === first.path.slice(1) && file.sha === 'c'.repeat(40)));
});

test('unrelated publications can merge with a draft but a same-work change requires explicit reconciliation', () => {
  const state = initialState(), original = seedCatalog(seed), key = saveDraft(state, { version: 0, originalId: '01', work: seed.works[0] }, original, timestamp);
  const changed = structuredClone(original); changed.revision = randomUUID(); changed.works[1].desc = '다른 작업물 수정';
  const source = { files: sourceFiles(seed.works) };
  assert.equal(candidateCatalog(changed, state.drafts[key], state, source, timestamp).works[1].desc, '다른 작업물 수정');
  changed.works[0].desc = '같은 작업물 수정';
  assert.throws(() => candidateCatalog(changed, state.drafts[key], state, source, timestamp), /다른 창/);
});

test('simultaneous retries of a publish request create at most one deployment', async () => {
  const f = await serviceFixture();
  const saved = await f.service.save({ version: 0, originalId: '01', work: seed.works[0] });
  const body = { requestId: randomUUID(), key: saved.key, version: saved.version };
  const results = await Promise.allSettled([f.service.publish(body), f.service.publish(body)]);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  assert.equal(f.created.length, 1);
});

test('code updates wait for preparing publications and can recover an expired pre-publication lease', async () => {
  const f = await serviceFixture(), owner = randomUUID();
  await f.store.write('cms/lease.json', { owner, kind: 'publish', expires: timestamp + 60000 });
  await assert.rejects(() => f.service.sourceBegin(randomUUID()), error => error.status === 409);
  const entry = await f.store.read('cms/lease.json');
  await f.store.write('cms/lease.json', { owner, kind: 'publish', expires: timestamp - 1 }, entry.etag);
  const catalog = await f.service.sourceBegin(randomUUID());
  assert.equal(catalog.revision, 'seed');
});
