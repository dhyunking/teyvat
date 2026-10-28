import { createMailClient } from './naverworks-mail.js';
import { createDriveClient } from './drive.js';
import { StoreConflict } from './inquiry-store.js';

export async function saveMailReference(record, sourceMail, store) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store.read(`inquiries/${record.requestId}.json`);
    if (!current) throw new Error('Inquiry not found');
    if (current.value.sourceMail?.mailId) return current.value;
    try { return (await store.write(`inquiries/${record.requestId}.json`, { ...current.value, sourceMail }, current.etag)).value; }
    catch (error) { if (!(error instanceof StoreConflict)) throw error; }
  }
  throw new Error('Mail reference conflict');
}

export async function ensureInquiryMail(record, { store, env = process.env, fetcher = fetch, now = Date.now,
  mail = createMailClient(env, fetcher, { store }), drive = createDriveClient(env, fetcher, { store }) }) {
  if (record.sourceMail?.mailId || env.CONTACT_MAIL_ENABLED !== 'true' || record.source === 'mail') return { record, state: record.sourceMail ? 'sent' : 'disabled' };
  const path = `delivery/${record.requestId}/mail.json`, current = await store.read(path), state = current?.value;
  if (state?.leaseUntil > now()) return { record, state: 'busy' };
  if (state?.nextAttemptAt > now()) return { record, state: state.state };
  let claimed;
  try { claimed = await store.write(path, { ...state, state: 'preparing', leaseUntil: now() + 60000 }, current?.etag); }
  catch (error) { if (error instanceof StoreConflict) return { record, state: 'busy' }; throw error; }
  async function finish(value) { claimed = await store.write(path, { ...claimed.value, ...value, leaseUntil: 0, updatedAt: now() }, claimed.etag); return { record, state: value.state }; }
  async function received(sourceMail) {
    record = await saveMailReference(record, sourceMail, store);
    return finish({ state: 'sent', mailId: sourceMail.mailId, nextAttemptAt: 0 });
  }
  let attempted = Boolean(state?.attemptedAt);
  try {
    const found = await mail.findInquiry(record);
    if (found) return received(found);
    // Mail APIs have no idempotency key. Reconcile an uncertain send by reading the inbox, never by sending again.
    if (attempted) return finish({ state: state.state === 'accepted' ? 'accepted' : 'unknown', nextAttemptAt: now() + 60000 });
    const attachments = [];
    for (const file of record.inquiry.attachments) attachments.push({ filename: file.filename, content_type: file.content_type, content: (await drive.download(file)).toString('base64') });
    claimed = await store.write(path, { ...claimed.value, state: 'sending', attemptedAt: now(), leaseUntil: now() + 60000 }, claimed.etag);
    attempted = true;
    await mail.sendInquiry(record, attachments);
    claimed = await store.write(path, { ...claimed.value, state: 'accepted', leaseUntil: now() + 60000 }, claimed.etag);
    for (let attempt = 0; attempt < 4; attempt++) {
      const found = await mail.findInquiry(record);
      if (found) return received(found);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500));
    }
    return finish({ state: 'accepted', nextAttemptAt: now() + 60000 });
  } catch (error) {
    const rejected = [400, 403, 429].includes(error.status), safeRetry = !attempted || rejected;
    return finish({ state: safeRetry ? 'retry' : 'unknown',
      ...(rejected ? { attemptedAt: null } : {}), nextAttemptAt: safeRetry ? now() + 60000 : 0, code: error.code || 'mail_delivery_failed' });
  }
}
