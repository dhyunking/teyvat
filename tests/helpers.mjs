import { randomUUID } from 'node:crypto';
import { StoreConflict } from '../lib/inquiry-store.js';

export function fixture(extra = {}) { return { requestId: randomUUID(), company: '테스트 브랜드', name: '홍길동', email: 'sender@example.com', phone: '010-1234-5678', consent: true, message: '쇼핑백 1,000개 제작 문의', items: ['쇼핑백'], attachments: [], ...extra }; }
export function memoryStore() {
  const data = new Map(); let revision = 0;
  return {
    data,
    async read(path) { return structuredClone(data.get(path) || null); },
    async write(path, value, etag) {
      const old = data.get(path);
      if ((old && !etag) || (etag && old?.etag !== etag)) throw new StoreConflict();
      const entry = { value: structuredClone(value), etag: String(++revision) };
      data.set(path, entry); return structuredClone(entry);
    },
    async list() { return { blobs: [...data.keys()].filter(path => path.startsWith('inquiries/')).map(pathname => ({ pathname })), hasMore: false }; },
  };
}
export const noFiles = { async allocate(files) { if (files.length) throw new Error('No Drive setup'); return []; } };
export async function invoke(handler, body, extra = {}) {
  const req = { method: 'POST', headers: { origin: 'https://teyvat.kr', 'content-type': 'application/json' }, socket: { remoteAddress: randomUUID() }, body, ...extra };
  const headers = {}; let result;
  await handler(req, { setHeader(k, v) { headers[k] = v; }, set statusCode(value) { headers.status = value; }, end(value) { result = JSON.parse(value); } });
  return { ...result, status: headers.status, headers };
}
