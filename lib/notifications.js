import { createHash } from 'node:crypto';
import { StoreConflict } from './inquiry-store.js';
import { createMailClient } from './naverworks-mail.js';
import { createDriveClient } from './drive.js';
import { ensureInquiryMail } from './mail-delivery.js';

const slackEscape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function slackPayload(record) {
  const inquiry = record.inquiry, originalUrl = record.sourceMail?.url;
  const fields = [['회사 · 브랜드', inquiry.company], ['담당자', inquiry.name], ['이메일', inquiry.email], ['연락처', inquiry.phone]].filter(([, value]) => value);
  const specs = [['제작 품목', inquiry.items.join(', ')], ['수량', inquiry.quantity], ['예산', inquiry.budget], ['희망 납기', inquiry.due]].filter(([, value]) => value);
  const fieldBlock = values => ({ type: 'section', fields: values.map(([label, value]) => ({ type: 'mrkdwn', verbatim: true, text: '*' + label + '*\n' + slackEscape(value) })) });
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(record.createdAt));
  const message = originalUrl && inquiry.message.length > 1000 ? inquiry.message.slice(0, 1000) + '…\n전체 내용은 메일 원문에서 확인하세요.' : inquiry.message;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: record.source === 'mail' ? '📩 새 문의 메일' : '📩 새 홈페이지 문의' } },
    { type: 'context', elements: [{ type: 'plain_text', text: (record.source === 'mail' ? '네이버웍스 수신' : '홈페이지 접수') + ' · ' + date }] },
    { type: 'divider' }, fieldBlock(fields),
    ...(specs.length ? [fieldBlock(specs)] : []),
    ...(record.source === 'mail' && record.sourceMail?.subject ? [{ type: 'section', text: { type: 'plain_text', text: '제목 · ' + record.sourceMail.subject } }] : []),
    ...(message ? [{ type: 'section', text: { type: 'mrkdwn', text: '*문의 내용*' } }, ...[0, 2800].map(start => message.slice(start, start + 2800)).filter(Boolean).map(text => ({ type: 'section', text: { type: 'plain_text', text } }))] : []),
    ...(originalUrl ? [{ type: 'actions', elements: [{ type: 'button', action_id: 'open_original_mail', text: { type: 'plain_text', text: '메일 원문 보기 ↗' }, style: 'primary', url: originalUrl }] }] : []),
    ...(inquiry.attachments.length ? [{ type: 'divider' }, { type: 'section', text: { type: 'mrkdwn', text: '*첨부파일 · ' + inquiry.attachments.length + '개*' } }, ...inquiry.attachments.map((file, index) => ({ type: 'section',
      text: { type: 'plain_text', text: String(index + 1).padStart(2, '0') + '  ' + file.filename + (file.size ? '\n' + (file.size < 1024 * 1024 ? Math.ceil(file.size / 1024) + ' KB' : (file.size / 1024 / 1024).toFixed(1) + ' MB') : '') },
      accessory: { type: 'button', action_id: 'open_attachment_' + index, text: { type: 'plain_text', text: '파일 열기 ↗' }, url: file.webViewLink } }))] : []),
    { type: 'context', elements: [{ type: 'plain_text', text: '접수번호 · ' + record.requestId }] },
  ];
  return { text: 'TEYVAT 새 문의 (' + record.requestId + ')', unfurl_links: false, unfurl_media: false, blocks };
}

export function acknowledgementPayload(record, env) {
  return { from: env.CONTACT_FROM_EMAIL, to: [record.inquiry.email],
    ...(env.CONTACT_REPLY_TO_EMAIL ? { reply_to: [env.CONTACT_REPLY_TO_EMAIL] } : {}),
    subject: 'TEYVAT 문의가 접수되었습니다',
    text: `${record.inquiry.name}님, 문의해 주셔서 감사합니다.\n\n문의가 정상적으로 접수되었습니다. 담당자가 확인 후 남겨주신 연락처로 안내해 드리겠습니다.\n\n접수번호: ${record.requestId}\n\n테바디엔피 TEYVAT D&P`,
    category: 'transactional', advertisement: false, tags: [{ name: 'source', value: 'teyvat_receipt' }] };
}

function configuration(channel, record, env) {
  if (channel === 'ack' && !record.acknowledgement) return { state: 'disabled' };
  if (channel === 'slack') {
    if (!env.SLACK_WEBHOOK_URL) return { state: 'pending' };
    try { const url = new URL(env.SLACK_WEBHOOK_URL); if (url.protocol === 'https:' && url.hostname === 'hooks.slack.com' && url.pathname.startsWith('/services/') && !url.username && !url.password) return { url: url.href }; } catch {}
    return { state: 'blocked' };
  }
  if (!env.MESSAGIO_API_KEY || !env.CONTACT_FROM_EMAIL) return { state: 'pending' };
  try {
    const api = new URL(env.MESSAGIO_BASE_URL || 'https://api.messag.io');
    if (api.protocol !== 'https:' || api.username || api.password || api.pathname !== '/' || api.search || api.hash || /[\r\n]/.test(env.CONTACT_FROM_EMAIL) ||
        (env.CONTACT_REPLY_TO_EMAIL && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.CONTACT_REPLY_TO_EMAIL))) return { state: 'blocked' };
    return { url: api.origin + '/v1/emails' };
  } catch { return { state: 'blocked' }; }
}

async function send(channel, record, config, env, fetcher) {
  const ack = channel === 'ack';
  try {
    const response = await fetcher(config.url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', ...(ack ? { Authorization: `Bearer ${env.MESSAGIO_API_KEY}`, 'Idempotency-Key': `teyvat-receipt-${record.requestId}` } : {}) },
      body: JSON.stringify(ack ? acknowledgementPayload(record, env) : slackPayload(record)) });
    if (response.status === 429) return { state: 'retry', delay: Math.max(60, Math.min(Number(response.headers.get('retry-after')) || 300, 86400)) * 1000 };
    if (!ack) return response.ok && (await response.text()).trim() === 'ok' ? { state: 'sent' } : { state: response.status >= 500 ? 'unknown' : 'blocked' };
    let result;
    try { result = await response.json(); } catch { return { state: 'unknown' }; }
    if (response.status === 409 && result?.code === 'idempotency_in_progress') return { state: 'retry', delay: 60000 };
    if (!response.ok || !/^em_[A-Za-z0-9_-]+$/.test(result?.id || '')) return { state: response.status >= 500 ? 'unknown' : 'blocked' };
    if (result.status === 'held') return { state: 'held', emailId: result.id };
    if (result.status === 'suppressed') return { state: 'blocked', emailId: result.id };
    if (result.status && !['queued', 'accepted'].includes(result.status)) return { state: 'unknown', emailId: result.id };
    return { state: 'sent', emailId: result.id };
  } catch { return { state: 'unknown' }; }
}

export async function processChannel(channel, record, { store, env = process.env, fetcher = fetch, now = Date.now, log = console.warn }) {
  const path = `delivery/${record.requestId}/${channel}.json`;
  const current = await store.read(path), state = current?.value;
  if (state && ['sent', 'held', 'blocked', 'disabled'].includes(state.state)) return state.state;
  const timestamp = now();
  if (state?.state === 'sending' && state.leaseUntil > timestamp) return 'busy';
  if (state?.nextAttemptAt > timestamp) return state.state;
  const ambiguous = state && ['sending', 'unknown'].includes(state.state);
  if (ambiguous && (channel === 'slack' || timestamp - state.firstAttemptAt >= 23 * 3600000)) {
    if (state.state !== 'unknown') await store.write(path, { ...state, state: 'unknown', leaseUntil: 0 }, current.etag);
    return 'unknown';
  }
  const config = configuration(channel, record, env);
  const payloadHash = channel === 'ack' ? createHash('sha256').update(JSON.stringify(acknowledgementPayload(record, env))).digest('hex') : null;
  if (channel === 'ack' && state?.payloadHash && state.payloadHash !== payloadHash) return 'blocked';
  const claim = { ...state, state: config.state || 'sending', updatedAt: timestamp,
    ...(config.state ? {} : { firstAttemptAt: state?.firstAttemptAt || timestamp, leaseUntil: timestamp + 60000, payloadHash }) };
  let claimed;
  try { claimed = await store.write(path, claim, current?.etag); }
  catch (error) { if (error instanceof StoreConflict) return 'busy'; throw error; }
  if (config.state) return config.state;
  const result = await send(channel, record, config, env, fetcher);
  await store.write(path, { ...claim, state: result.state, leaseUntil: 0, updatedAt: now(),
    nextAttemptAt: result.state === 'retry' ? now() + result.delay : 0, ...(result.emailId ? { emailId: result.emailId } : {}) }, claimed.etag);
  if (!['sent', 'disabled'].includes(result.state)) log(JSON.stringify({ event: 'contact_notification_' + result.state, channel, requestId: record.requestId }));
  return result.state;
}

export async function processNotifications(record, options) {
  if (record.status !== 'received') return { skipped: true };
  const channels = ['slack', 'ack'];
  const results = await Promise.allSettled(channels.map(async channel => {
    if (channel !== 'slack') return processChannel(channel, record, options);
    const { store, env = process.env, fetcher = fetch } = options;
    const mail = options.mail || createMailClient(env, fetcher, { store });
    const drive = options.drive || createDriveClient(env, fetcher, { store });
    const archived = await ensureInquiryMail(record, { ...options, mail, drive });
    record = archived.record;
    const path = `delivery/${record.requestId}/slack.json`, current = await store.read(path);
    if (current && ['sent', 'unknown', 'blocked', 'disabled'].includes(current.value.state)) return processChannel('slack', record, options);
    let pending;
    if (env.CONTACT_MAIL_ENABLED === 'true' && !record.sourceMail?.mailId) pending = 'pending_mail';
    if (record.sourceMail?.mailId) {
      const url = mail.link(record.sourceMail.mailId);
      if (!url) pending = 'pending_mail_link';
      else record = { ...record, sourceMail: { ...record.sourceMail, url } };
    }
    if (pending) {
      try { await store.write(path, { state: pending, updatedAt: (options.now || Date.now)() }, current?.etag); } catch (error) { if (!(error instanceof StoreConflict)) throw error; }
      return pending;
    }
    if (env.SLACK_FILE_LINKS_ENABLED === 'true') {
      const attachments = [];
      for (const file of record.inquiry.attachments) {
        if (file.provider === 'naverworks') attachments.push({ ...file, webViewLink: await drive.browserLink(file) });
        else if (file.provider === 'naverworks-mail-link' && new URL(file.webViewLink).origin === 'https://bigfile.mail.worksmobile.com') attachments.push(file);
        else throw new Error('unverified_attachment_link');
      }
      record = { ...record, inquiry: { ...record.inquiry, attachments } };
    }
    return processChannel('slack', record, options);
  }));
  return Object.fromEntries(results.map((result, index) => {
    if (result.status === 'fulfilled') return [channels[index], result.value];
    (options.log || console.warn)(JSON.stringify({ event: 'contact_notification_state_error', channel: channels[index], requestId: record.requestId }));
    return [channels[index], 'unknown'];
  }));
}
