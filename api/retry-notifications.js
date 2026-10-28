import { timingSafeEqual } from 'node:crypto';
import { createInquiryStore } from '../lib/inquiry-store.js';
import { processNotifications } from '../lib/notifications.js';

export function createRetryHandler({ env = process.env, store = createInquiryStore(env), fetcher = fetch, now = Date.now, log = console.warn } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const respond = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return respond(405, { error: 'method_not_allowed' }); }
    const expected = Buffer.from(`Bearer ${env.CRON_SECRET || ''}`), actual = Buffer.from(req.headers.authorization || '');
    if (!env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return respond(401, { error: 'unauthorized' });
    const start = now(); let processed = 0;
    try {
      const checkpoint = await store.read('operations/retry-cursor.json');
      const position = checkpoint?.value || {}; let cursor = position.cursor, offset = position.offset || 0;
      while (now() - start < 40000) {
        const page = await store.list(cursor);
        for (let index = offset; index < page.blobs.length; index++) {
          const record = await store.read(page.blobs[index].pathname);
          if (record?.value.status === 'received') { await processNotifications(record.value, { store, env, fetcher, now, log }); processed++; }
          if (now() - start >= 40000) {
            await store.write('operations/retry-cursor.json', { cursor, offset: index + 1 }, checkpoint?.etag);
            return respond(200, { processed, more: true });
          }
        }
        offset = 0; cursor = page.hasMore ? page.cursor : undefined;
        if (!cursor) break;
      }
      await store.write('operations/retry-cursor.json', { cursor: cursor || null, offset: 0 }, checkpoint?.etag);
      return respond(200, { processed, more: Boolean(cursor) });
    } catch { log(JSON.stringify({ event: 'contact_retry_failed' })); return respond(503, { error: 'retry_failed' }); }
  };
}
export default createRetryHandler();
