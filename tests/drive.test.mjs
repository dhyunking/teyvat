import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDriveClient } from '../lib/drive.js';
import { memoryStore } from './helpers.mjs';

const env = { NAVERWORKS_SHARED_DRIVE_ID: '@testdrive', NAVERWORKS_DRIVE_PARENT_ID: 'homepage-folder',
  NAVERWORKS_DRIVE_FOLDER_URL: 'https://drive.worksmobile.com/#/homepage-folder' };
const bytes = Buffer.from('%PDF-1.7 test'), file = { filename: 'drawing.pdf', content_type: 'application/pdf', content: bytes.toString('base64') };
function worksMock({ publicFolder = false, readOnly = false, loseUploadResponse = false, loseFolderResponse = false, mismatch = false, uploadUrl = 'https://apis-storage.worksmobile.com/upload' } = {}) {
  const calls = []; let folder, uploaded, content, partial;
  const fetcher = async (url, init) => {
    calls.push({ url, init }); assert.equal(init.headers.Authorization, 'Bearer test-access');
    const path = new URL(url).pathname;
    if (url === 'https://apis-storage.worksmobile.com/download') return new Response(mismatch ? Buffer.alloc(bytes.length, 1) : content);
    if (url === 'https://apis-storage.worksmobile.com/upload') {
      assert.ok(init.body instanceof FormData);
      const incoming = Buffer.from(await init.body.get('Filedata').arrayBuffer());
      content = partial ? Buffer.concat([partial, incoming]) : incoming;
      uploaded = { fileId: 'uploaded-file', parentFileId: 'request-folder', fileName: init.body.get('resourceName'), fileSize: content.length, fileType: 'DOC', statuses: [] };
      if (loseUploadResponse) throw new Error('Response lost');
      return Response.json(uploaded, { status: 201 });
    }
    if (path.endsWith('/sharedrives/%40testdrive')) return Response.json({ permissionType: readOnly ? 'READ' : 'WRITE', accessibleRange: 'MEMBER' });
    if (path.endsWith('/link')) return publicFolder ? Response.json({ accessType: 'ANYONE' }) : new Response('', { status: 404 });
    if (path.endsWith('/files/homepage-folder') && !init.method) return Response.json({ fileType: 'FOLDER', statuses: [] });
    if (path.endsWith('/files/homepage-folder/children')) return Response.json({ files: folder ? [folder] : [], responseMetaData: {} });
    if (path.endsWith('/createfolder')) {
      folder = { fileId: 'request-folder', parentFileId: 'homepage-folder', fileName: JSON.parse(init.body).fileName, fileType: 'FOLDER', statuses: [] };
      if (loseFolderResponse) throw new Error('Folder response lost');
      return Response.json(folder, { status: 201 });
    }
    if (path.endsWith('/files/request-folder/children')) return Response.json({ files: uploaded ? [uploaded] : [], responseMetaData: {} });
    if (path.endsWith('/files/request-folder') && init.method === 'POST') {
      const request = JSON.parse(init.body); assert.equal(request.overwrite, false); assert.equal(request.suffixOnDuplicate, false);
      if (request.resume && !partial) return Response.json({ code: 'INVALID_PARAMETER', description: 'Not Exist Resource' }, { status: 400 });
      assert.equal(request.resume, Boolean(partial));
      return Response.json({ uploadUrl, offset: partial?.length || 0 });
    }
    if (path.endsWith('/files/uploaded-file/download')) return new Response(null, { status: 302, headers: { location: 'https://apis-storage.worksmobile.com/download' } });
    if (path.endsWith('/files/uploaded-file') && !init.method) return Response.json(uploaded);
    throw new Error('Unexpected API request: ' + path);
  };
  return { fetcher, calls,
    seedPartial(attachment, requestId, length) {
      partial = bytes.subarray(0, length);
      folder = { fileId: 'request-folder', parentFileId: 'homepage-folder', fileName: requestId, fileType: 'FOLDER', statuses: [] };
      uploaded = { fileId: 'uploaded-file', parentFileId: 'request-folder', fileName: attachment.storedName, fileSize: bytes.length, fileType: 'DOC', statuses: ['IN_PROGRESS'] };
    },
  };
}
function client(mock, store = memoryStore()) { return createDriveClient(env, mock.fetcher, { store, auth: { token: async () => 'test-access' } }); }
test('NAVER WORKS uses a request folder, fixed filenames, original bytes, and no sharing mutations', async () => {
  const mock = worksMock(), drive = client(mock), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId);
  assert.equal(attachment.storedName, '01_drawing.pdf'); assert.match(attachment.sha256, /^[a-f0-9]{64}$/);
  assert.equal(attachment.provider, 'naverworks'); assert.ok(!attachment.content);
  const result = await drive.upload(attachment, file, requestId);
  assert.equal(result.id, 'uploaded-file'); assert.equal(result.folderId, 'request-folder');
  assert.equal(result.webViewLink, env.NAVERWORKS_DRIVE_FOLDER_URL);
  await drive.upload(attachment, file, requestId);
  assert.equal(mock.calls.filter(call => call.url === 'https://apis-storage.worksmobile.com/upload').length, 1);
  assert.ok(!mock.calls.some(call => call.url.endsWith('/link') && call.init.method));
});
test('lost folder and upload responses recover without creating another folder or file', async () => {
  const mock = worksMock({ loseUploadResponse: true, loseFolderResponse: true }), drive = client(mock), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId);
  assert.equal((await drive.upload(attachment, file, requestId)).id, 'uploaded-file');
  await drive.upload(attachment, file, requestId);
  assert.equal(mock.calls.filter(call => call.url.endsWith('/createfolder')).length, 1);
  assert.equal(mock.calls.filter(call => call.url === 'https://apis-storage.worksmobile.com/upload').length, 1);
});
test('partial uploads resume using the documented offset and verify complete stored contents', async () => {
  const mock = worksMock(), drive = client(mock), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId); mock.seedPartial(attachment, requestId, 4);
  await drive.upload(attachment, file, requestId);
  assert.equal(mock.calls.find(call => call.url === 'https://apis-storage.worksmobile.com/upload').init.headers['Content-Range'], `4-${bytes.length - 1}/${bytes.length}`);
});
test('public folders, missing write permissions and wrong downloaded contents fail closed', async () => {
  for (const options of [{ publicFolder: true }, { readOnly: true }, { mismatch: true }]) {
    const mock = worksMock(options), drive = client(mock), requestId = randomUUID();
    const [attachment] = await drive.allocate([file], requestId);
    await assert.rejects(drive.upload(attachment, file, requestId));
  }
});
test('an untrusted upload URL cannot receive file bytes or an OAuth token', async () => {
  const mock = worksMock({ uploadUrl: 'https://attacker.example/upload' }), drive = client(mock), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId);
  await assert.rejects(drive.upload(attachment, file, requestId));
  assert.ok(!mock.calls.some(call => call.url.startsWith('https://attacker.example')));
});
test('a persistent request lock prevents concurrent file upload workers', async () => {
  const mock = worksMock(), store = memoryStore(), drive = client(mock, store), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId);
  await store.write(`operations/drive-${requestId}.json`, { leaseUntil: Date.now() + 120000 });
  await assert.rejects(drive.upload(attachment, file, requestId), error => error.status === 409);
  assert.equal(mock.calls.length, 0);
});
test('text-only inquiries work without NAVER WORKS credentials or folders', async () => {
  const drive = createDriveClient({}, () => { throw new Error('Unexpected provider request'); }, { store: memoryStore() });
  assert.deepEqual(await drive.allocate([]), []);
  await assert.rejects(drive.allocate([file], randomUUID()));
});
test('stored attachment reads verify the current file metadata and exact original bytes', async () => {
  const mock = worksMock(), drive = client(mock), requestId = randomUUID();
  const [attachment] = await drive.allocate([file], requestId), stored = await drive.upload(attachment, file, requestId);
  assert.deepEqual(await drive.download(stored), bytes);
  await assert.rejects(drive.download({ ...stored, size: stored.size + 1 }));
});
test('file browser links are read-only company links and never widen a members-only drive', async () => {
  for (const accessibleRange of ['DOMAIN', 'MEMBER']) {
    let sharing, mutations = 0;
    const fetcher = async (url, init) => {
      if (url.endsWith('/link')) {
        if (init.method === 'POST') { mutations++; const value = JSON.parse(init.body); assert.equal(value.accessType, 'ORGANIZATION'); assert.equal(value.linkPermissionType, 'DOWNLOAD'); sharing = { ...value, linkUrl: 'https://works.do/verified-file' }; return Response.json(sharing, { status: 201 }); }
        return sharing ? Response.json(sharing) : new Response(null, { status: 404 });
      }
      return Response.json({ permissionType: 'WRITE', accessibleRange });
    };
    const drive = createDriveClient(env, fetcher, { store: memoryStore(), auth: { token: async () => 'access' } });
    const stored = { provider: 'naverworks', id: 'file', driveId: '@testdrive' };
    if (accessibleRange === 'DOMAIN') { assert.equal(await drive.browserLink(stored), 'https://works.do/verified-file'); assert.equal(await drive.browserLink(stored), 'https://works.do/verified-file'); assert.equal(mutations, 1); }
    else { await assert.rejects(drive.browserLink(stored)); assert.equal(mutations, 0); }
  }
});
