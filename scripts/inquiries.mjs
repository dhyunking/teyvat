import { createInquiryStore } from '../lib/inquiry-store.js';
import { processNotifications } from '../lib/notifications.js';

const [command = 'list', id] = process.argv.slice(2);
const store = createInquiryStore();
if (command === 'list') {
  let cursor;
  do {
    const page = await store.list(cursor);
    for (const blob of page.blobs) console.log(blob.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
} else if (['show', 'retry'].includes(command) && /^[0-9a-f-]{36}$/i.test(id || '')) {
  const record = await store.read(`inquiries/${id}.json`);
  if (!record) throw new Error('Inquiry not found');
  if (command === 'show') {
    const channels = Object.fromEntries(await Promise.all(['slack', 'ack'].map(async channel => [channel, (await store.read(`delivery/${id}/${channel}.json`))?.value || null])));
    console.log(JSON.stringify({ ...record.value, delivery: channels }, null, 2));
  } else console.log(JSON.stringify(await processNotifications(record.value, { store, env: process.env }), null, 2));
} else {
  console.error('Usage: node --env-file=.env.local scripts/inquiries.mjs list|show <id>|retry <id>');
  process.exitCode = 1;
}
