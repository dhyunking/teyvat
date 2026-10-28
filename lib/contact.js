import { createHash } from 'node:crypto';

export const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', ai: 'application/postscript', psd: 'image/vnd.adobe.photoshop', zip: 'application/zip' };
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const limits = { company: 120, name: 80, phone: 40, email: 254, due: 120, message: 5000, quantity: 60, budget: 60 };

export class ContactError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export function validateInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContactError(400, '문의 형식이 올바르지 않습니다.');
  if (body.website) throw new ContactError(422, '문의 내용을 확인해 주세요.');
  if (body.consent !== true) throw new ContactError(400, '개인정보 수집 · 이용에 동의해 주세요.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) throw new ContactError(400, '접수 식별자가 올바르지 않습니다. 페이지를 새로고침해 주세요.');
  const value = { requestId: body.requestId, consent: true };
  for (const [key, max] of Object.entries(limits)) {
    const raw = body[key] ?? '';
    if (typeof raw !== 'string' || raw.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw) || (key !== 'message' && /[\r\n]/.test(raw))) throw new ContactError(400, '입력 내용의 길이와 형식을 확인해 주세요.');
    value[key] = raw.trim();
  }
  if (!value.company || !value.name || !value.phone || !EMAIL.test(value.email)) throw new ContactError(400, '회사명, 담당자, 연락처, 올바른 이메일을 입력해 주세요.');
  if (value.phone.replace(/\D/g, '').length < 7 || !/^[+\d\s().-]+$/.test(value.phone)) throw new ContactError(400, '올바른 연락처를 입력해 주세요.');
  if (!Array.isArray(body.items) || body.items.length > 8 || body.items.some(item => typeof item !== 'string' || item.length > 40 || /[\r\n\x00-\x1f]/.test(item))) throw new ContactError(400, '제작 품목을 확인해 주세요.');
  value.items = [...new Set(body.items)];
  const files = body.attachments ?? [];
  if (!Array.isArray(files) || files.length > 5) throw new ContactError(400, '첨부 파일은 최대 5개까지 가능합니다.');
  let total = 0;
  value.attachments = files.map(file => {
    if (!file || typeof file.filename !== 'string' || file.filename.length > 180 || /[\\/\x00-\x1f]/.test(file.filename)) throw new ContactError(400, '첨부 파일명을 확인해 주세요.');
    const ext = file.filename.split('.').pop().toLowerCase();
    if (!Object.hasOwn(MIME, ext) || typeof file.content !== 'string' || !file.content || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new ContactError(400, '첨부 파일 형식이 올바르지 않습니다.');
    total += Buffer.byteLength(file.content, 'base64');
    if (total > MAX_FILE_BYTES) throw new ContactError(413, '첨부 파일 합계는 2MB까지 가능합니다.');
    return { filename: file.filename, content: file.content, content_type: MIME[ext] };
  });
  return value;
}

export const fingerprint = inquiry => createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
