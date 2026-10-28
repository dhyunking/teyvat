import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry } from '../lib/contact.js';
import { acceptInquiry, recordPath } from '../lib/intake.js';
import { createHandler } from '../api/contact.js';
import { createRetryHandler } from '../api/retry-notifications.js';
import { fixture, memoryStore, noFiles, invoke } from './helpers.mjs';

test('inquiries are accepted without any email provider or Slack and remain readable after restart', async () => {
  const store = memoryStore(), jobs = [];
  const handler = createHandler({ env: {}, store, drive: noFiles, schedule: job => jobs.push(job) });
  const payload = fixture(), result = await invoke(handler, payload);
  assert.equal(result.status, 201); assert.equal(result.accepted, true);
  assert.equal((await store.read(recordPath(payload.requestId))).value.inquiry.message, payload.message);
  await Promise.all(jobs);
  assert.equal((await store.read(`delivery/${payload.requestId}/slack.json`)).value.state, 'pending');
  assert.equal((await store.read(`delivery/${payload.requestId}/ack.json`)).value.state, 'disabled');
  const restarted = createHandler({ env: {}, store, drive: noFiles, schedule: job => jobs.push(job) });
  assert.equal((await invoke(restarted, payload)).accepted, true);
  await Promise.all(jobs);
  assert.equal([...store.data.keys()].filter(path => path.startsWith('inquiries/')).length, 1);
});
test('storage failures do not show a receipt or trigger notifications', async () => {
  let scheduled = 0;
  const handler = createHandler({ env: {}, store: { async read() { throw new Error('Storage down'); } }, drive: noFiles, schedule: () => scheduled++, log: () => {} });
  const result = await invoke(handler, fixture());
  assert.equal(result.status, 503); assert.equal(result.accepted, false); assert.equal(scheduled, 0);
});
test('concurrent submissions across separate handlers share a durable record and conflict on changed contents', async () => {
  const store = memoryStore(), jobs = [], payload = fixture();
  const handlers = [1, 2].map(() => createHandler({ env: {}, store, drive: noFiles, schedule: job => jobs.push(job) }));
  const results = await Promise.all(handlers.map(handler => invoke(handler, payload)));
  assert.ok(results.every(result => result.accepted)); await Promise.all(jobs);
  assert.equal([...store.data.keys()].filter(path => path.startsWith('inquiries/')).length, 1);
  assert.equal((await invoke(handlers[0], { ...payload, message: 'Changed' })).status, 409);
});
test('Drive failure keeps a pending record without file bytes and reuses its attachment allocation on retry', async () => {
  const store = memoryStore(); let allocations = 0, fail = true;
  const drive = {
    async allocate(files) { allocations++; return files.map(file => ({ id: 'allocated_file_id', filename: file.filename })); },
    async upload(file) { if (fail) throw new Error('Drive down'); return { ...file, webViewLink: 'https://drive.worksmobile.com/#/test-folder' }; },
  };
  const inquiry = validateInquiry(fixture({ attachments: [{ filename: 'drawing.pdf', content: Buffer.from('%PDF sample').toString('base64') }] }));
  await assert.rejects(acceptInquiry(inquiry, { store, drive }));
  const pending = await store.read(recordPath(inquiry.requestId));
  assert.equal(pending.value.status, 'uploading'); assert.ok(!JSON.stringify(pending).includes('JVBER'));
  fail = false;
  const result = await acceptInquiry(inquiry, { store, drive });
  assert.equal(result.status, 'received'); assert.equal(allocations, 1);
  assert.equal(result.inquiry.attachments[0].id, 'allocated_file_id');
});
test('server validates consent, email, controls, filenames and file limits', () => {
  for (const extra of [{ consent: 'true' }, { email: 'invalid' }, { company: 'bad\r\nheader' }, { phone: 'bad' },
    { attachments: [{ filename: '../file.pdf', content: 'YQ==' }] }, { attachments: [{ filename: 'file.exe', content: 'YQ==' }] },
    { attachments: [{ filename: 'file.pdf', content: '!' }] },
    { attachments: [{ filename: 'file.pdf', content: Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64') }] }]) assert.throws(() => validateInquiry(fixture(extra)));
});
test('HTTP boundaries reject invalid methods, origins, JSON, spam and oversized bodies', async () => {
  const handler = createHandler({ env: {}, store: memoryStore(), drive: noFiles, schedule: () => {} });
  assert.equal((await invoke(handler, {}, { method: 'GET' })).status, 405);
  assert.equal((await invoke(handler, fixture(), { headers: { origin: 'https://evil.example', 'content-type': 'application/json' } })).status, 403);
  assert.equal((await invoke(handler, '{bad')).status, 400);
  assert.equal((await invoke(handler, fixture({ website: 'spam' }))).status, 422);
  assert.equal((await invoke(handler, fixture(), { headers: { origin: 'https://teyvat.kr', 'content-type': 'application/json', 'content-length': '9000000' } })).status, 413);
});
test('retry endpoint requires its own secret and resumes only saved complete inquiries', async () => {
  const store = memoryStore(); const record = await acceptInquiry(validateInquiry(fixture()), { store, drive: noFiles });
  const retry = createRetryHandler({ env: { CRON_SECRET: 'test-cron-secret' }, store });
  assert.equal((await invoke(retry, null, { method: 'GET' })).status, 401);
  const result = await invoke(retry, null, { method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } });
  assert.equal(result.status, 200); assert.equal(result.processed, 1);
  assert.equal((await store.read(`delivery/${record.requestId}/slack.json`)).value.state, 'pending');
});
