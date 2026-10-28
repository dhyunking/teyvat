import { createWorksAuth } from './naverworks-auth.js';
import { createInquiryStore } from './inquiry-store.js';

export class MailError extends Error {
  constructor(code, status = 503, ambiguous = false) { super(code); this.code = code; this.status = status; this.ambiguous = ambiguous; }
}
export const mailMarker = id => `[TEYVAT:${id}]`;
export function inquiryMailSubject(record) { return `${mailMarker(record.requestId)} 홈페이지 문의 · ${record.inquiry.company.slice(0, 55)} · ${record.inquiry.name.slice(0, 30)}`; }
export function inquiryMailBody(record) {
  const q = record.inquiry;
  return ['TEYVAT 홈페이지 문의', '', `회사 · 브랜드: ${q.company}`, `담당자: ${q.name}`, `회신할 이메일: ${q.email}`, `연락처: ${q.phone}`,
    `제작 품목: ${q.items.join(', ') || '미선택'}`, `수량: ${q.quantity || '미정'}`, `예산: ${q.budget || '미정'}`, `희망 납기: ${q.due || '미정'}`,
    '', '문의 내용', '────────────────────', q.message || '(내용 없음)', '', `접수번호: ${record.requestId}`, `접수 시각: ${record.createdAt}`, '개인정보 수집 · 이용 동의 완료'].join('\n');
}
export function createMailClient(env = process.env, fetcher = fetch, { store = createInquiryStore(env), auth = createWorksAuth(env, { store, fetcher }) } = {}) {
  const mailbox = env.NAVERWORKS_MAILBOX || 'inquiry@teyvat.kr';
  const base = `https://www.worksapis.com/v1.0/users/${encodeURIComponent(mailbox)}/mail`;
  async function request(path, init = {}) {
    let response;
    try { response = await fetcher(base + path, { ...init, redirect: 'error', headers: { ...init.headers, Authorization: `Bearer ${await auth.token()}` }, signal: AbortSignal.timeout(12000) }); }
    catch { throw new MailError('mail_request_failed', 503, init.method === 'POST'); }
    if (!response.ok && response.status !== 204) throw new MailError(response.status === 403 ? 'mail_permission_required' : 'mail_api_failed', response.status, response.status >= 500 && init.method === 'POST');
    return response;
  }
  async function json(path) { const response = await request(path); return response.status === 204 ? { mails: [] } : response.json(); }
  return {
    mailbox,
    async tokenForPoller() { return auth.token(); },
    async check() { return json('/mailfolders'); },
    link(mailId) {
      if (!/^\d+$/.test(String(mailId)) || !env.NAVERWORKS_MAIL_URL_TEMPLATE?.includes('{mailId}')) return null;
      const url = new URL(env.NAVERWORKS_MAIL_URL_TEMPLATE.replaceAll('{mailId}', encodeURIComponent(String(mailId))));
      if (url.protocol !== 'https:' || url.hostname !== 'mail.worksmobile.com' || url.username || url.password || url.port) throw new MailError('invalid_mail_link');
      return url.href;
    },
    async list(cursor) { return json('/mailfolders/0/children?' + new URLSearchParams({ count: '100', ...(cursor ? { cursor } : {}) })); },
    async read(mailId) { if (!/^\d+$/.test(String(mailId))) throw new MailError('invalid_mail_id', 400); return json('/' + encodeURIComponent(String(mailId))); },
    async attachment(mailId, attachment) {
      if (!/^\d+$/.test(String(mailId)) || !Number.isInteger(attachment.attachmentId) || attachment.attachmentId < 1 || attachment.size > 25 * 1024 * 1024) throw new MailError('unsupported_mail_attachment');
      const value = await json(`/${encodeURIComponent(String(mailId))}/attachments/${attachment.attachmentId}`);
      if (typeof value.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data) || Buffer.byteLength(value.data, 'base64') !== attachment.size) throw new MailError('invalid_mail_attachment');
      return value.data;
    },
    async findInquiry(record) {
      const matches = message => message.folderId === 0 && message.from?.email?.toLowerCase() === mailbox.toLowerCase() && message.subject === inquiryMailSubject(record);
      const reference = found => ({ provider: 'naverworks', mailbox, mailId: String(found.mailId), subject: found.subject, receivedAt: found.receivedTime, url: this.link(found.mailId) });
      // Recent inbox headers avoid both search indexing delay and <mark> highlighting in search results.
      const recent = await this.list();
      const immediate = recent.mails?.find(matches);
      if (immediate) return reference(immediate);
      let cursor;
      do {
        const page = await json('/search?' + new URLSearchParams({ folderId: '0', query: record.requestId, count: '100', ...(cursor ? { cursor } : {}) }));
        if (!Array.isArray(page.mails)) throw new MailError('invalid_mail_search');
        for (const candidate of page.mails.filter(message => message.folderId === 0 && message.from?.email?.toLowerCase() === mailbox.toLowerCase())) {
          const detail = await this.read(candidate.mailId);
          if (matches(detail.mail)) return reference(detail.mail);
        }
        cursor = page.responseMetaData?.nextCursor;
      } while (cursor);
      return null;
    },
    async sendInquiry(record, attachments) {
      await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: mailbox, userName: 'TEYVAT 홈페이지 문의',
        subject: inquiryMailSubject(record), body: inquiryMailBody(record), contentType: 'text', isSaveSentMail: true, isSaveTracking: false,
        attachments: attachments.map(file => ({ filename: file.filename, fileType: file.content_type, data: file.content })) }) });
    },
  };
}
