import { createHash, randomUUID } from 'node:crypto';
import { ContactError } from './contact.js';
import { createInquiryStore, StoreConflict } from './inquiry-store.js';
import { createWorksAuth } from './naverworks-auth.js';

const API = 'https://www.worksapis.com/v1.0';
const unavailable = () => new ContactError(503, '첨부 파일을 저장하지 못했습니다. 잠시 후 같은 내용으로 다시 시도해 주세요.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = value => typeof value === 'string' && value.length <= 512 && /^[A-Za-z0-9_@+=/-]+$/.test(value);
const healthy = file => Array.isArray(file.statuses) && !file.statuses.some(status => ['IN_PROGRESS', 'MALWARE', 'LOCKED'].includes(status));
const storageUrl = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'apis-storage.worksmobile.com' || url.port || url.username || url.password || url.hash) throw unavailable();
  return url.href;
};
function folderUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['drive.worksmobile.com', 'drive.works.do'].includes(url.hostname) || url.port || url.username || url.password) throw unavailable();
  return url.href;
}

export function createDriveClient(env = process.env, fetcher = fetch, { store = createInquiryStore(env), auth = createWorksAuth(env, { store, fetcher }), now = Date.now } = {}) {
  async function request(url, init = {}) {
    return fetcher(url, { ...init, redirect: 'manual', headers: { ...init.headers, Authorization: `Bearer ${await auth.token()}` }, signal: AbortSignal.timeout(12000) });
  }
  const baseFor = attachment => `${API}/sharedrives/${encodeURIComponent(attachment.driveId)}`;
  const fileUrl = (base, id) => `${base}/files/${encodeURIComponent(id)}`;
  async function json(response) { if (!response.ok) throw unavailable(); return response.json(); }
  async function findChild(base, parentId, name) {
    let cursor, found;
    do {
      const query = new URLSearchParams({ count: '200', ...(cursor ? { cursor } : {}) });
      const page = await json(await request(`${fileUrl(base, parentId)}/children?${query}`));
      if (!Array.isArray(page.files)) throw unavailable();
      for (const file of page.files) if (file.fileName === name) { if (found) throw unavailable(); found = file; }
      cursor = page.responseMetaData?.nextCursor;
    } while (cursor);
    return found;
  }
  async function requestFolder(base, parentId, requestId) {
    let folder = await findChild(base, parentId, requestId);
    if (!folder) {
      try { await json(await request(`${fileUrl(base, parentId)}/createfolder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: requestId }) })); } catch {}
      // Recover a completed folder creation after a lost response without allocating another name.
      folder = await findChild(base, parentId, requestId);
    }
    if (!folder || !validId(folder.fileId) || folder.fileType !== 'FOLDER' || folder.parentFileId !== parentId || !healthy(folder)) throw unavailable();
    return folder.fileId;
  }
  async function checkLink(base, id) {
    const response = await request(`${fileUrl(base, id)}/link`);
    if (response.status === 404) return;
    const sharing = await json(response);
    if (!['ORGANIZATION', 'SPECIFIC_PEOPLE'].includes(sharing.accessType)) throw unavailable();
  }
  async function downloadVerified(base, fileId, attachment, collect = false) {
    const response = await request(`${fileUrl(base, fileId)}/download`);
    if (response.status !== 302) throw unavailable();
    const download = await request(storageUrl(response.headers.get('location')));
    if (!download.ok || !download.body) throw unavailable();
    const hash = createHash('sha256'), chunks = []; let length = 0;
    for await (const chunk of download.body) {
      length += chunk.length;
      if (length > attachment.size) throw unavailable();
      hash.update(chunk); if (collect) chunks.push(Buffer.from(chunk));
    }
    if (length !== attachment.size || hash.digest('hex') !== attachment.sha256) throw unavailable();
    return collect ? Buffer.concat(chunks) : null;
  }
  async function verify(base, folderId, attachment, existingFile) {
    const file = existingFile === undefined ? await findChild(base, folderId, attachment.storedName) : existingFile;
    if (!file) return null;
    if (Array.isArray(file.statuses) && file.statuses.includes('IN_PROGRESS') && !file.statuses.some(status => ['MALWARE', 'LOCKED'].includes(status))) return null;
    if (!validId(file.fileId) || file.parentFileId !== folderId || Number(file.fileSize) !== attachment.size || !healthy(file) || file.fileType === 'FOLDER') throw unavailable();
    await downloadVerified(base, file.fileId, attachment);
    return { ...attachment, id: file.fileId, folderId, webViewLink: attachment.folderUrl };
  }
  return {
    async browserLink(attachment) {
      if (attachment?.provider !== 'naverworks' || !validId(attachment.id) || !validId(attachment.driveId)) throw unavailable();
      const base = baseFor(attachment), endpoint = `${fileUrl(base, attachment.id)}/link`;
      let response = await request(endpoint);
      if (response.status === 404) {
        const drive = await json(await request(base));
        // The existing drive already grants access to the company. Never broaden a members-only drive.
        if (drive.permissionType !== 'WRITE' || !['DOMAIN', 'TENANT'].includes(drive.accessibleRange)) throw unavailable();
        try { await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessType: 'ORGANIZATION', linkPermissionType: 'DOWNLOAD', expirationTime: null }) }); } catch {}
        response = await request(endpoint);
      }
      const link = await json(response);
      if (!['ORGANIZATION', 'SPECIFIC_PEOPLE'].includes(link.accessType) || !['DOWNLOAD', 'UPLOAD_DOWNLOAD', 'EDIT', 'PREVIEW'].includes(link.linkPermissionType)) throw unavailable();
      const url = new URL(link.linkUrl);
      if (url.protocol !== 'https:' || !['works.do', 'drive.worksmobile.com', 'drive.works.do'].includes(url.hostname) || url.username || url.password || url.port) throw unavailable();
      return url.href;
    },
    async download(attachment) {
      if (attachment?.provider !== 'naverworks' || !validId(attachment.id) || !validId(attachment.driveId) || !validId(attachment.folderId) ||
          !Number.isInteger(attachment.size) || attachment.size < 1 || attachment.size > 25 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(attachment.sha256 || '')) throw unavailable();
      const base = baseFor(attachment), file = await json(await request(fileUrl(base, attachment.id)));
      if (file.fileId !== attachment.id || file.parentFileId !== attachment.folderId || file.fileType === 'FOLDER' || Number(file.fileSize) !== attachment.size || !healthy(file)) throw unavailable();
      return downloadVerified(base, attachment.id, attachment, true);
    },
    async allocate(files, requestId) {
      if (!files.length) return [];
      if (!uuid.test(requestId) || !validId(env.NAVERWORKS_SHARED_DRIVE_ID) || !validId(env.NAVERWORKS_DRIVE_PARENT_ID)) throw unavailable();
      const link = folderUrl(env.NAVERWORKS_DRIVE_FOLDER_URL);
      return files.map((file, index) => {
        const bytes = Buffer.from(file.content, 'base64'), sha256 = createHash('sha256').update(bytes).digest('hex');
        const suffix = Array.from(file.filename).slice(-180).join('');
        return { provider: 'naverworks', filename: file.filename, content_type: file.content_type, size: bytes.length, sha256,
          storedName: `${String(index + 1).padStart(2, '0')}_${suffix}`, requestId,
          driveId: env.NAVERWORKS_SHARED_DRIVE_ID, parentId: env.NAVERWORKS_DRIVE_PARENT_ID, folderUrl: link };
      });
    },
    async upload(attachment, file, requestId) {
      if (attachment.provider !== 'naverworks' || attachment.requestId !== requestId || !uuid.test(requestId)) throw unavailable();
      const lockPath = `operations/drive-${requestId}.json`, previous = await store.read(lockPath);
      if (previous?.value.leaseUntil > now()) throw new ContactError(409, '첨부 파일을 저장하고 있습니다. 잠시 후 같은 내용으로 다시 시도해 주세요.');
      let claimed;
      try { claimed = await store.write(lockPath, { owner: randomUUID(), leaseUntil: now() + 120000 }, previous?.etag); }
      catch (error) { if (error instanceof StoreConflict) throw new ContactError(409, '첨부 파일 처리 중입니다. 잠시 후 다시 시도해 주세요.'); throw error; }
      try {
        const base = baseFor(attachment);
        const drive = await json(await request(base));
        if (drive.permissionType !== 'WRITE' || !['MEMBER', 'DOMAIN', 'TENANT'].includes(drive.accessibleRange)) throw unavailable();
        const parent = await json(await request(fileUrl(base, attachment.parentId)));
        if (parent.fileType !== 'FOLDER' || !healthy(parent)) throw unavailable();
        await checkLink(base, attachment.parentId);
        const folderId = await requestFolder(base, attachment.parentId, requestId);
        await checkLink(base, folderId);
        const target = await findChild(base, folderId, attachment.storedName);
        const existing = await verify(base, folderId, attachment, target || null);
        if (existing) return existing;
        const upload = await json(await request(fileUrl(base, folderId), { method: 'POST', headers: { 'Content-Type': 'application/json' },
          // WORKS rejects a resume upload when no partial resource exists, even with offset 0.
          body: JSON.stringify({ fileName: attachment.storedName, fileSize: attachment.size, overwrite: false, suffixOnDuplicate: false, resume: Boolean(target) }) }));
        const offset = upload.offset ?? 0;
        if (!Number.isInteger(offset) || offset < 0 || offset >= attachment.size) throw unavailable();
        const form = new FormData(); form.set('resourceName', attachment.storedName);
        form.set('Filedata', new Blob([Buffer.from(file.content, 'base64').subarray(offset)], { type: attachment.content_type }), attachment.storedName);
        try {
          const response = await request(storageUrl(upload.uploadUrl), { method: 'POST', body: form,
            headers: offset ? { 'Content-Range': `${offset}-${attachment.size - 1}/${attachment.size}` } : {} });
          if (!response.ok) throw unavailable();
        } catch { /* Read back the deterministic name before deciding whether upload failed. */ }
        const result = await verify(base, folderId, attachment);
        if (!result) throw unavailable();
        return result;
      } finally {
        try { await store.write(lockPath, { ...claimed.value, leaseUntil: 0 }, claimed.etag); } catch {}
      }
    },
  };
}
