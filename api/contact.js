import { waitUntil } from '@vercel/functions';
import { ContactError, MAX_BODY_BYTES, validateInquiry } from '../lib/contact.js';
import { createInquiryStore } from '../lib/inquiry-store.js';
import { createDriveClient } from '../lib/drive.js';
import { acceptInquiry } from '../lib/intake.js';
import { processNotifications } from '../lib/notifications.js';

export function createHandler({ env = process.env, fetcher = fetch, log = console.warn, now = Date.now,
  store = createInquiryStore(env), drive = createDriveClient(env, fetcher, { store }), schedule = waitUntil } = {}) {
  const throttle = new Map();
  return async function contact(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { accepted: false, message: 'POST 요청만 지원합니다.' }); }
    try {
      const origins = new Set([env.SITE_URL || 'https://teyvat.kr', ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(host => `https://${host}`)].map(url => new URL(url).origin));
      if (!env.VERCEL) origins.add('http://localhost:4173');
      if (!origins.has(req.headers.origin)) throw new ContactError(403, '홈페이지에서 문의를 다시 제출해 주세요.');
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ContactError(415, '지원하지 않는 요청 형식입니다.');
      if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new ContactError(413, '첨부 파일 합계는 2MB까지 가능합니다.');
      let body = req.body;
      if (body === undefined) {
        let length = 0; const chunks = [];
        for await (const chunk of req) { length += chunk.length; if (length > MAX_BODY_BYTES) throw new ContactError(413, '첨부 파일 합계는 2MB까지 가능합니다.'); chunks.push(chunk); }
        body = Buffer.concat(chunks).toString('utf8');
      }
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') { if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new ContactError(413, '요청이 너무 큽니다.'); try { body = JSON.parse(body); } catch { throw new ContactError(400, '문의 형식이 올바르지 않습니다.'); } }
      if (Buffer.byteLength(JSON.stringify(body) || '') > MAX_BODY_BYTES) throw new ContactError(413, '요청이 너무 큽니다.');
      const inquiry = validateInquiry(body), timestamp = now();
      const ip = env.VERCEL ? (req.headers['x-vercel-forwarded-for'] || '').split(',')[0] : req.socket?.remoteAddress || 'local';
      for (const [key, entry] of throttle) if (entry.expires <= timestamp) throttle.delete(key);
      const bucket = throttle.get(ip) || { count: 0, expires: timestamp + 600000 };
      if (bucket.count >= 5 || throttle.size > 2000) { res.setHeader('Retry-After', '600'); throw new ContactError(429, '잠시 후 다시 시도해 주세요. 문의가 많으면 이메일로 연락해 주세요.'); }
      bucket.count += 1; throttle.set(ip, bucket);
      let record;
      try { record = await acceptInquiry(inquiry, { store, drive, acknowledgement: env.CONTACT_ACK_ENABLED === 'true', now }); }
      catch (error) {
        if (error instanceof ContactError) throw error;
        log(JSON.stringify({ event: 'contact_storage_error', requestId: inquiry.requestId }));
        throw new ContactError(503, '문의 저장 결과를 확인하지 못했습니다. 잠시 후 같은 내용으로 다시 시도해 주세요.');
      }
      // Acceptance requires durable storage. Notifications continue independently after the response.
      try { schedule(processNotifications(record, { store, env, fetcher, now, log })); }
      catch { log(JSON.stringify({ event: 'contact_notification_schedule_failed', requestId: inquiry.requestId })); }
      return reply(201, { accepted: true, requestId: inquiry.requestId });
    } catch (error) {
      if (!(error instanceof ContactError)) log(JSON.stringify({ event: 'contact_internal_error' }));
      return reply(error instanceof ContactError ? error.status : 500, { accepted: false, message: error instanceof ContactError ? error.message : '접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  };
}
export default createHandler();
