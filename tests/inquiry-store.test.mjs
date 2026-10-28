import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { createInquiryStore, StoreConflict } from '../lib/inquiry-store.js';

test('compressed Blob GET ETags can conditionally update the exact version whose body was read', async () => {
  const sdk = {
    async get() { return { stream: new Response(JSON.stringify({ value: 1 })).body, blob: { etag: 'W/"origin-version-1"' } }; },
    async put(path, body, options) { assert.equal(options.ifMatch, '"origin-version-1"'); assert.equal(options.allowOverwrite, true); return { etag: '"origin-version-2"' }; },
  };
  const store = createInquiryStore({}, sdk), current = await store.read('inquiries/test.json');
  assert.equal(current.value.value, 1);
  assert.equal((await store.write('inquiries/test.json', { value: 2 }, current.etag)).etag, '"origin-version-2"');
});
test('a concurrent origin update still rejects a stale compressed response version', async () => {
  let origin = { value: 1 }, version = '"v1"';
  const sdk = {
    async get() { return { stream: new Response(JSON.stringify(origin)).body, blob: { etag: 'W/' + version } }; },
    async put(path, body, options) { if (options.ifMatch !== version) throw new BlobPreconditionFailedError(); origin = JSON.parse(body); return { etag: version }; },
  };
  const store = createInquiryStore({}, sdk), previous = await store.read('inquiries/test.json');
  origin = { value: 2, concurrent: true }; version = '"v2"';
  await assert.rejects(store.write('inquiries/test.json', { value: 3 }, previous.etag), StoreConflict);
  assert.deepEqual(origin, { value: 2, concurrent: true });
});
test('an update failure is reported as its actual storage error rather than a false conflict', async () => {
  const failure = new Error('storage temporarily unavailable');
  const store = createInquiryStore({}, { async put() { throw failure; }, async get() { throw new Error('Unexpected read-back'); } });
  await assert.rejects(store.write('inquiries/test.json', {}, '"v1"'), error => error === failure);
});
