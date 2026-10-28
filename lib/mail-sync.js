import { createHash } from 'node:crypto';
import { StoreConflict } from './inquiry-store.js';
import { inquiryMailSubject } from './naverworks-mail.js';
import { saveMailReference } from './mail-delivery.js';

const websiteId = /^\[TEYVAT:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/i;
export function mailRequestId(mailbox, mailId) {
  const bytes = createHash('sha256').update(JSON.stringify(['teyvat/inbox/v1', mailbox.toLowerCase(), String(mailId)])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex'); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function mailText(value) {
  return String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>|<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[entity]))
    .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export async function importReceivedMail(detail, { store, mail, drive }) {
  const message = detail.mail;
  if (!message || !/^\d+$/.test(String(message.mailId)) || message.folderId !== 0 || message.spamType && message.spamType !== 'NORMAL') return null;
  const reference = { provider: 'naverworks', mailbox: mail.mailbox, mailId: String(message.mailId), subject: message.subject, receivedAt: message.receivedTime, url: mail.link(message.mailId) };
  const match = message.subject?.match(websiteId);
  if (match && message.from?.email?.toLowerCase() === mail.mailbox.toLowerCase()) {
    const existing = await store.read(`inquiries/${match[1]}.json`);
    if (existing && message.subject === inquiryMailSubject(existing.value)) return saveMailReference(existing.value, reference, store);
  }
  const requestId = mailRequestId(mail.mailbox, message.mailId), path = `inquiries/${requestId}.json`;
  let stored = await store.read(path);
  if (stored?.value.status === 'received') return stored.value;
  const parts = (detail.attachments || []).filter(file => file.contentDisposition !== 'inline' && file.attachmentId !== -2);
  if (parts.some(file => file.attachmentId === -1 ? !file.bigFileFid : file.attachmentId < 1 || file.size > 25 * 1024 * 1024)) throw new Error('mail_attachment_requires_manual_review');
  const files = [];
  for (const part of parts.filter(file => file.attachmentId > 0)) files.push({ filename: Array.from(part.filename.replace(/[\\/\x00-\x1f]/g, '_')).slice(-180).join(''), content_type: part.contentType || 'application/octet-stream', content: await mail.attachment(message.mailId, part) });
  if (!stored) {
    const allocation = await drive.allocate(files, requestId); let allocatedIndex = 0;
    const attachments = parts.map(part => {
      if (part.attachmentId > 0) return allocation[allocatedIndex++];
      const url = new URL('https://bigfile.mail.worksmobile.com/download'); url.searchParams.set('fid', part.bigFileFid);
      return { provider: 'naverworks-mail-link', filename: part.filename, size: part.size, webViewLink: url.href, expiresAt: part.bigFileExpireTime || null };
    });
    const inquiry = { requestId, consent: false, company: '', name: message.from?.name || message.from?.email || '보낸 사람', email: message.from?.email || '', phone: '',
      items: [], quantity: '', budget: '', due: '', message: mailText(message.body).slice(0, 5000), attachments };
    const value = { version: 1, requestId, source: 'mail', sourceMail: reference, acknowledgement: false, createdAt: message.receivedTime,
      fingerprint: createHash('sha256').update(JSON.stringify([mail.mailbox, message.mailId])).digest('hex'), status: files.length ? 'uploading' : 'received', inquiry };
    try { stored = await store.write(path, value); }
    catch (error) { if (!(error instanceof StoreConflict)) throw error; stored = await store.read(path); }
  }
  if (stored.value.status === 'received') return stored.value;
  const uploaded = []; let fileIndex = 0;
  for (const attachment of stored.value.inquiry.attachments) uploaded.push(attachment.provider === 'naverworks' ? await drive.upload(attachment, files[fileIndex++], requestId) : attachment);
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return (await store.write(path, { ...stored.value, status: 'received', inquiry: { ...stored.value.inquiry, attachments: uploaded } }, stored.etag)).value; }
    catch (error) { if (!(error instanceof StoreConflict)) throw error; stored = await store.read(path); if (stored.value.status === 'received') return stored.value; }
  }
  throw new Error('mail_import_conflict');
}

export async function syncReceivedMail({ store, mail, drive, notify, env = process.env, now = Date.now, budgetMs = 35000, generation }) {
  if (env.MAIL_SYNC_ENABLED !== 'true') return { enabled: false, processed: 0 };
  const since = Date.parse(env.MAIL_SYNC_START_AT || '');
  if (!Number.isFinite(since)) throw new Error('mail_sync_start_required');
  const path = 'operations/mail-cursor.json', checkpoint = await store.read(path), startedAt = now();
  if (checkpoint?.value.leaseUntil > startedAt) return { busy: true, processed: 0 };
  let claimed;
  try { claimed = await store.write(path, { ...checkpoint?.value, leaseUntil: startedAt + 60000 }, checkpoint?.etag); }
  catch (error) { if (error instanceof StoreConflict) return { busy: true, processed: 0 }; throw error; }
  const inboxChanged = generation && generation !== checkpoint?.value.generation;
  let processed = 0, failed = 0, cursor = inboxChanged ? undefined : checkpoint?.value.cursor || undefined, offset = inboxChanged ? 0 : checkpoint?.value.offset || 0, more = false;
  try {
    for (let pageNumber = 0; pageNumber < 50; pageNumber++) {
      const page = await mail.list(cursor);
      if (!Array.isArray(page.mails)) throw new Error('invalid_inbox_list');
      for (let index = offset; index < page.mails.length; index++) {
        const summary = page.mails[index];
        if (Date.parse(summary.receivedTime) >= since) {
          try {
            const record = await importReceivedMail(await mail.read(summary.mailId), { store, mail, drive });
            if (record) {
              const notification = await notify(record); processed++;
              if (notification && !['sent', 'blocked', 'disabled'].includes(notification.slack)) {
                const delivery = await store.read(`delivery/${record.requestId}/slack.json`);
                if (delivery?.value.state !== 'unknown') failed++;
              }
            }
          }
          catch { failed++; }
        }
        if (now() - startedAt >= budgetMs) { offset = index + 1; more = true; return { enabled: true, processed, failed, more }; }
      }
      offset = 0; cursor = page.responseMetaData?.nextCursor || undefined;
      if (!cursor) break;
      more = true;
    }
    more = Boolean(cursor);
    return { enabled: true, processed, failed, more };
  } finally {
    await store.write(path, { cursor: cursor || null, offset, generation: generation || null, leaseUntil: 0, updatedAt: now() }, claimed.etag);
  }
}
