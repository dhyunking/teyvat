import { timingSafeEqual } from 'node:crypto';
import { createInquiryStore } from '../lib/inquiry-store.js';
import { createMailClient } from '../lib/naverworks-mail.js';
import { createDriveClient } from '../lib/drive.js';
import { syncReceivedMail } from '../lib/mail-sync.js';
import { processNotifications } from '../lib/notifications.js';

export function createMailSyncHandler({ env = process.env, store = createInquiryStore(env), fetcher = fetch,
  mail = createMailClient(env, fetcher, { store }), drive = createDriveClient(env, fetcher, { store }), now = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const reply = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(405, { error: 'method_not_allowed' }); }
    const expected = Buffer.from(`Bearer ${env.MAIL_POLL_SECRET || env.CRON_SECRET || ''}`), actual = Buffer.from(req.headers.authorization || '');
    if (!(env.MAIL_POLL_SECRET || env.CRON_SECRET) || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return reply(401, { error: 'unauthorized' });
    try {
      const query = new URL(req.url || '/api/sync-mail', 'https://teyvat.kr').searchParams, action = query.get('action');
      if (action === 'check') { await mail.check(); return reply(200, { mailbox: mail.mailbox, accessible: true }); }
      if (action === 'token') {
        if (env.MAIL_SYNC_ENABLED !== 'true') return reply(503, { error: 'mail_sync_disabled' });
        return reply(200, { accessToken: await mail.tokenForPoller() });
      }
      const generation = query.get('generation') || undefined;
      if (generation && !/^[A-Za-z0-9+/]{43}=$/.test(generation)) return reply(400, { error: 'invalid_inbox_generation' });
      const result = await syncReceivedMail({ store, mail, drive, env, now, generation,
        notify: record => processNotifications(record, { store, env, fetcher, mail, drive, now }) });
      return reply(200, result);
    } catch (error) { return reply(503, { error: error.code || 'mail_sync_unavailable', ...(error.status ? { providerStatus: error.status } : {}) }); }
  };
}
export default createMailSyncHandler();
