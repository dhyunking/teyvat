import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailClient, MailError, inquiryMailSubject } from '../lib/naverworks-mail.js';
import { ensureInquiryMail } from '../lib/mail-delivery.js';
import { importReceivedMail, mailRequestId, syncReceivedMail } from '../lib/mail-sync.js';
import { processNotifications, slackPayload } from '../lib/notifications.js';
import { createMailSyncHandler } from '../api/sync-mail.js';
import { acceptInquiry } from '../lib/intake.js';
import { validateInquiry } from '../lib/contact.js';
import { memoryStore, fixture, noFiles } from './helpers.mjs';

const env = { CONTACT_MAIL_ENABLED: 'true', NAVERWORKS_MAILBOX: 'inquiry@teyvat.kr', NAVERWORKS_MAIL_URL_TEMPLATE: 'https://mail.worksmobile.com/test/read/{mailId}' };
const recordFor = store => acceptInquiry(validateInquiry(fixture()), { store, drive: noFiles });
const reference = { provider: 'naverworks', mailbox: 'inquiry@teyvat.kr', mailId: '123', subject: '문의', receivedAt: new Date().toISOString(), url: 'https://mail.worksmobile.com/test/read/123' };

test('website copies are delivered only to the configured WORKS inbox with complete original content', async () => {
  const store = memoryStore(), record = await recordFor(store), calls = [];
  const mail = createMailClient(env, async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 202 }); }, { store, auth: { token: async () => 'private-access' } });
  await mail.sendInquiry(record, [{ filename: 'drawing.pdf', content_type: 'application/pdf', content: 'YQ==' }]);
  const call = calls[0], body = JSON.parse(call.init.body);
  assert.match(call.url, /users\/inquiry%40teyvat.kr\/mail$/);
  assert.equal(body.to, 'inquiry@teyvat.kr'); assert.notEqual(body.to, record.inquiry.email);
  assert.ok(body.body.includes(record.inquiry.message)); assert.ok(body.body.includes(record.inquiry.email));
  assert.ok(body.subject.includes(record.requestId)); assert.equal(body.attachments[0].data, 'YQ==');
  assert.equal(mail.link('123'), reference.url); assert.throws(() => createMailClient({ ...env, NAVERWORKS_MAIL_URL_TEMPLATE: 'https://evil.example/{mailId}' }).link('123'));
});
test('inbox lookup rejects a subject or sender mismatch and finds the received copy in folder zero', async () => {
  const store = memoryStore(), record = await recordFor(store);
  const mail = createMailClient(env, async url => {
    assert.ok(url.includes('/mailfolders/0/children'));
    return Response.json({ mails: [
      { mailId: 1, folderId: 1, from: { email: 'inquiry@teyvat.kr' }, subject: inquiryMailSubject(record) },
      { mailId: 2, folderId: 0, from: { email: 'outsider@example.com' }, subject: inquiryMailSubject(record) },
      { mailId: 123, folderId: 0, from: { email: 'inquiry@teyvat.kr' }, subject: inquiryMailSubject(record), receivedTime: reference.receivedAt },
    ] });
  }, { store, auth: { token: async () => 'test-access' } });
  assert.equal((await mail.findInquiry(record)).mailId, '123');
});
test('highlighted search results are reconciled against the exact original mail instead of highlighted subject text', async () => {
  const store = memoryStore(), record = await recordFor(store), original = { mailId: 123, folderId: 0, from: { email: 'inquiry@teyvat.kr' }, subject: inquiryMailSubject(record), receivedTime: reference.receivedAt };
  const mail = createMailClient(env, async url => {
    if (url.includes('/children')) return Response.json({ mails: [] });
    if (url.includes('/search?')) return Response.json({ mails: [{ ...original, subject: original.subject.replace(record.requestId, '<mark>' + record.requestId + '</mark>') }] });
    assert.ok(url.endsWith('/123')); return Response.json({ mail: original, attachments: [] });
  }, { store, auth: { token: async () => 'access' } });
  const found = await mail.findInquiry(record);
  assert.equal(found.mailId, '123'); assert.equal(found.subject, original.subject); assert.ok(!found.subject.includes('<mark>'));
});
test('concurrent website mail deliveries claim one send and persist its actual received mail ID', async () => {
  const store = memoryStore(), record = await recordFor(store); let sends = 0, found = false;
  const mail = { async findInquiry() { return found ? reference : null; }, async sendInquiry() { sends++; found = true; } };
  const options = { store, env, mail, drive: noFiles };
  await Promise.all([ensureInquiryMail(record, options), ensureInquiryMail(record, options)]);
  assert.equal(sends, 1); assert.equal((await store.read(`inquiries/${record.requestId}.json`)).value.sourceMail.mailId, '123');
  await ensureInquiryMail(record, options); assert.equal(sends, 1);
});
test('a lost send response is reconciled from the inbox without resending', async () => {
  const store = memoryStore(), record = await recordFor(store); let sends = 0, found = false;
  const mail = { async findInquiry() { return found ? reference : null; }, async sendInquiry() { sends++; found = true; throw new MailError('timeout', 503, true); } };
  const options = { store, env, mail, drive: noFiles };
  assert.equal((await ensureInquiryMail(record, options)).state, 'unknown');
  assert.equal((await ensureInquiryMail(record, options)).state, 'sent'); assert.equal(sends, 1);
});
test('an uncertain send with no received copy never creates another email', async () => {
  const store = memoryStore(), record = await recordFor(store); let sends = 0, time = Date.now();
  const options = { store, env, drive: noFiles, now: () => time, mail: { async findInquiry() { return null; }, async sendInquiry() { sends++; throw new MailError('timeout', 503, true); } } };
  assert.equal((await ensureInquiryMail(record, options)).state, 'unknown');
  time += 120000; assert.equal((await ensureInquiryMail(record, options)).state, 'unknown'); assert.equal(sends, 1);
});
test('a definitive permission denial can be retried after permission is granted', async () => {
  const store = memoryStore(), record = await recordFor(store); let time = Date.now(), calls = 0, found = false;
  const mail = { async findInquiry() { return found ? reference : null; }, async sendInquiry() { calls++; if (calls === 1) throw new MailError('mail_permission_required', 403); found = true; } };
  const options = { store, env, drive: noFiles, mail, now: () => time };
  assert.equal((await ensureInquiryMail(record, options)).state, 'retry');
  time += 60001; assert.equal((await ensureInquiryMail(record, options)).state, 'sent'); assert.equal(calls, 2);
});
test('Slack waits for an actual received email and a verified original-mail URL', async () => {
  const store = memoryStore(), record = await recordFor(store); let webhooks = 0;
  const options = { store, env, drive: noFiles, mail: { async findInquiry() { return null; }, async sendInquiry() {}, link() { return null; } }, fetcher: async () => { webhooks++; return new Response('ok'); } };
  assert.equal((await processNotifications(record, options)).slack, 'pending_mail'); assert.equal(webhooks, 0);
  const imported = { ...record, sourceMail: reference };
  assert.equal((await processNotifications(imported, options)).slack, 'pending_mail_link'); assert.equal(webhooks, 0);
});
test('Slack uses a readable original-mail button and one distinct link per attachment', async () => {
  const store = memoryStore(), record = await recordFor(store); record.sourceMail = reference;
  record.inquiry.attachments = [{ filename: 'drawing.pdf', size: 512, webViewLink: 'https://works.do/private-file' }];
  const payload = slackPayload(record);
  assert.equal(payload.blocks.find(block => block.type === 'actions').elements[0].url, reference.url);
  assert.equal(payload.blocks.find(block => block.accessory).accessory.url, 'https://works.do/private-file');
  assert.ok(!JSON.stringify(payload).includes('저장 위치')); assert.equal(payload.unfurl_links, false);
});
test('direct incoming mail is stored once and never claims form consent or sends a customer acknowledgement', async () => {
  const store = memoryStore(), detail = { mail: { mailId: 456, folderId: 0, subject: '직접 문의', from: { name: '고객', email: 'customer@example.com' }, body: '<p>첫 줄</p><p>둘째 줄</p>', receivedTime: new Date().toISOString(), spamType: 'NORMAL' }, attachments: [] };
  const mail = { mailbox: 'inquiry@teyvat.kr', link: id => `https://mail.worksmobile.com/test/read/${id}` };
  const first = await importReceivedMail(detail, { store, mail, drive: noFiles }), second = await importReceivedMail(detail, { store, mail, drive: noFiles });
  assert.equal(first.requestId, second.requestId); assert.equal(first.requestId, mailRequestId(mail.mailbox, 456));
  assert.equal(first.inquiry.consent, false); assert.equal(first.acknowledgement, false); assert.equal(first.source, 'mail'); assert.match(first.inquiry.message, /첫 줄\n둘째 줄/);
  assert.equal([...store.data.keys()].filter(path => path.startsWith('inquiries/')).length, 1);
});
test('a website email seen by inbox polling reuses the original form record', async () => {
  const store = memoryStore(), record = await recordFor(store), mail = { mailbox: 'inquiry@teyvat.kr', link: () => reference.url };
  const detail = { mail: { mailId: 123, folderId: 0, subject: inquiryMailSubject(record), from: { email: mail.mailbox }, receivedTime: reference.receivedAt }, attachments: [] };
  const imported = await importReceivedMail(detail, { store, mail, drive: noFiles });
  assert.equal(imported.requestId, record.requestId); assert.equal(imported.sourceMail.mailId, '123');
  assert.equal([...store.data.keys()].filter(path => path.startsWith('inquiries/')).length, 1);
});
test('large mail attachments retain their provider download link without copying or exposing an OAuth token', async () => {
  const store = memoryStore(), mail = { mailbox: 'inquiry@teyvat.kr', link: () => reference.url };
  const detail = { mail: { mailId: 789, folderId: 0, subject: '대용량 첨부 문의', from: { email: 'customer@example.com' }, body: '첨부 확인 부탁드립니다.', receivedTime: reference.receivedAt },
    attachments: [{ attachmentId: -1, filename: 'design.zip', size: 100000000, bigFileFid: 'provider-file&rl=24101', bigFileExpireTime: '2027-01-01T00:00:00Z' }] };
  const record = await importReceivedMail(detail, { store, mail, drive: noFiles });
  assert.equal(record.status, 'received'); assert.equal(record.inquiry.attachments[0].provider, 'naverworks-mail-link');
  const url = new URL(record.inquiry.attachments[0].webViewLink);
  assert.equal(url.origin, 'https://bigfile.mail.worksmobile.com'); assert.equal(url.searchParams.get('fid'), 'provider-file&rl=24101');
});
test('mail scanning excludes historic messages and preserves the cursor when its time budget ends', async () => {
  const store = memoryStore(); let time = Date.now(), reads = 0;
  const start = new Date(time - 1000).toISOString(), summaries = [{ mailId: 1, receivedTime: new Date(time - 100000).toISOString() }, { mailId: 2, receivedTime: new Date(time).toISOString() }];
  const mail = { mailbox: 'inquiry@teyvat.kr', link: () => reference.url, async list() { return { mails: summaries, responseMetaData: { nextCursor: 'next' } }; },
    async read(id) { reads++; time += 40000; return { mail: { mailId: id, folderId: 0, from: { email: 'customer@example.com' }, receivedTime: start, subject: '문의', body: '본문' }, attachments: [] }; } };
  const result = await syncReceivedMail({ store, mail, drive: noFiles, env: { MAIL_SYNC_ENABLED: 'true', MAIL_SYNC_START_AT: start }, now: () => time, notify: async () => {} });
  assert.equal(reads, 1); assert.equal(result.more, true); assert.equal((await store.read('operations/mail-cursor.json')).value.offset, 2);
});
test('mail synchronization requires its own operator secret', async () => {
  const handler = createMailSyncHandler({ env: { MAIL_POLL_SECRET: 'private-poller' }, store: memoryStore() }); let status, body;
  await handler({ method: 'GET', headers: {} }, { setHeader() {}, set statusCode(value) { status = value; }, end(value) { body = JSON.parse(value); } });
  assert.equal(status, 401); assert.deepEqual(body, { error: 'unauthorized' });
});
test('inbox polling keeps pending link work eligible for the next minute instead of waiting for the daily retry', async () => {
  const store = memoryStore(), now = Date.now();
  const mail = { mailbox: 'inquiry@teyvat.kr', link: () => reference.url,
    async list() { return { mails: [{ mailId: 999, receivedTime: new Date(now).toISOString() }] }; },
    async read() { return { mail: { mailId: 999, folderId: 0, receivedTime: new Date(now).toISOString(), subject: '문의', body: '본문', from: { email: 'customer@example.com' } }, attachments: [] }; } };
  const result = await syncReceivedMail({ store, mail, drive: noFiles, env: { MAIL_SYNC_ENABLED: 'true', MAIL_SYNC_START_AT: new Date(now - 1000).toISOString() }, notify: async () => ({ slack: 'pending_mail_link' }) });
  assert.equal(result.processed, 1); assert.equal(result.failed, 1);
});
test('new arrivals restart a partially scanned inbox before its fingerprint can be marked complete', async () => {
  const store = memoryStore(), now = Date.now();
  await store.write('operations/mail-cursor.json', { cursor: 'old-page', offset: 10, generation: 'old', leaseUntil: 0 });
  const mail = { mailbox: 'inquiry@teyvat.kr', link: () => reference.url,
    async list(cursor) { assert.equal(cursor, undefined); return { mails: [{ mailId: 222, receivedTime: new Date(now).toISOString() }] }; },
    async read() { return { mail: { mailId: 222, folderId: 0, receivedTime: new Date(now).toISOString(), subject: '새 문의', body: '본문', from: { email: 'customer@example.com' } }, attachments: [] }; } };
  const result = await syncReceivedMail({ store, mail, drive: noFiles, env: { MAIL_SYNC_ENABLED: 'true', MAIL_SYNC_START_AT: new Date(now - 1000).toISOString() }, generation: 'new', notify: async () => ({ slack: 'sent' }) });
  assert.equal(result.processed, 1); assert.equal(result.more, false); assert.equal((await store.read('operations/mail-cursor.json')).value.generation, 'new');
});
