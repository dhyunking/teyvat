import { ContactError, fingerprint } from './contact.js';
import { StoreConflict } from './inquiry-store.js';

export const recordPath = id => `inquiries/${id}.json`;

export async function acceptInquiry(inquiry, { store, drive, acknowledgement = false, now = Date.now }) {
  const path = recordPath(inquiry.requestId), hash = fingerprint(inquiry);
  let stored = await store.read(path);
  const assertSame = record => {
    if (record.fingerprint !== hash) throw new ContactError(409, '접수 내용이 변경되었습니다. 새 문의로 제출해 주세요.');
  };
  if (!stored) {
    const attachments = await drive.allocate(inquiry.attachments, inquiry.requestId);
    const record = { version: 1, requestId: inquiry.requestId, fingerprint: hash, createdAt: new Date(now()).toISOString(),
      status: attachments.length ? 'uploading' : 'received', acknowledgement,
      inquiry: { ...inquiry, attachments } };
    try { stored = await store.write(path, record); }
    catch (error) {
      if (!(error instanceof StoreConflict)) throw error;
      stored = await store.read(path);
      if (!stored) throw error;
    }
  }
  assertSame(stored.value);
  if (stored.value.status === 'received') return stored.value;
  const uploaded = [];
  for (let index = 0; index < stored.value.inquiry.attachments.length; index++) {
    uploaded.push(await drive.upload(stored.value.inquiry.attachments[index], inquiry.attachments[index], inquiry.requestId));
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = { ...stored.value, status: 'received', inquiry: { ...stored.value.inquiry, attachments: uploaded } };
    try { return (await store.write(path, record, stored.etag)).value; }
    catch (error) {
      if (!(error instanceof StoreConflict)) throw error;
      stored = await store.read(path); assertSame(stored.value);
      if (stored.value.status === 'received') return stored.value;
    }
  }
  throw new ContactError(503, '접수 결과를 확인 중입니다. 잠시 후 같은 내용으로 다시 시도해 주세요.');
}
