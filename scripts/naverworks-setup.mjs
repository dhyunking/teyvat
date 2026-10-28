import { createWorksAuth } from '../lib/naverworks-auth.js';

const [requestedCommand = 'check'] = process.argv.slice(2);
if (requestedCommand === 'authorize') {
  if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET 설정이 필요합니다.');
  const origin = new URL(process.env.SITE_URL || 'https://teyvat-pi.vercel.app').origin;
  const response = await fetch(origin + '/api/naverworks-oauth?action=start', { redirect: 'error',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) { console.error('Vercel의 OAuth 앱 설정을 확인해 주세요. HTTP ' + response.status); process.exitCode = 1; }
  else console.log('아래 주소를 열어 담당자 계정으로 승인해 주세요.\n' + result.authorizationUrl);
} else if (['mail-check', 'sync-mail'].includes(requestedCommand)) {
  const secret = process.env.MAIL_POLL_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error('메일 연동 운영자 인증 설정이 필요합니다.');
  const origin = new URL(process.env.SITE_URL || 'https://teyvat.kr').origin;
  const response = await fetch(origin + '/api/sync-mail' + (requestedCommand === 'mail-check' ? '?action=check' : ''), {
    headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) { console.error(JSON.stringify({ status: response.status, error: result.error, providerStatus: result.providerStatus })); process.exitCode = 1; }
  else console.log(JSON.stringify(result));
} else {
const required = ['NAVERWORKS_CLIENT_ID', 'NAVERWORKS_CLIENT_SECRET', 'NAVERWORKS_TOKEN_ENCRYPTION_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) { console.error('필요한 설정: ' + missing.join(', ')); process.exitCode = 1; }
else {
  const [command = 'check', driveId, folderId] = process.argv.slice(2);
  try {
    const auth = createWorksAuth();
    const endpoint = command === 'folders' && driveId
      ? `/sharedrives/${encodeURIComponent(driveId)}/files${folderId ? '/' + encodeURIComponent(folderId) + '/children' : ''}`
      : '/sharedrives';
    const response = await fetch('https://www.worksapis.com/v1.0' + endpoint, {
      headers: { Authorization: `Bearer ${await auth.token()}` }, redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('NAVER WORKS API: HTTP ' + response.status);
    const data = await response.json();
    if (command === 'check') console.log('네이버웍스 사용자 OAuth와 Drive API 접근이 확인됐습니다.');
    else if (command === 'drives') console.log(JSON.stringify(data.sharedrives || data, null, 2));
    else if (command === 'folders' && driveId) console.log(JSON.stringify((data.files || []).filter(file => file.fileType === 'FOLDER'), null, 2));
    else { console.error('Usage: node --env-file=.env.local scripts/naverworks-setup.mjs check|drives|folders <sharedriveId> [parentFolderId]'); process.exitCode = 1; }
  } catch (error) { console.error(error.message.startsWith('NAVER WORKS API:') ? error.message : '네이버웍스 OAuth 승인, 토큰 및 저장소 설정을 확인해 주세요.'); process.exitCode = 1; }
}
}
