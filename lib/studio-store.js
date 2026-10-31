import { get, put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { createInquiryStore, StoreConflict } from './inquiry-store.js';

export function createStudioStore(env = process.env, sdk = { get, put }) {
  const json = createInquiryStore(env);
  const options = () => ({ token: env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15000) });
  return {
    read: path => json.read(path),
    write: (path, value, etag) => json.write(path, value, etag),
    async image(path) {
      const result = await sdk.get(path, { ...options(), access: 'private', useCache: false });
      if (!result) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async putImage(path, bytes) {
      try {
        await sdk.put(path, bytes, { ...options(), access: 'private', addRandomSuffix: false,
          allowOverwrite: false, contentType: 'image/webp', cacheControlMaxAge: 60 });
      } catch (error) {
        const existing = await this.image(path).catch(() => null);
        if (!existing || createHash('sha256').update(existing).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) throw error;
      }
    },
  };
}

export async function updateRecord(store, path, change, fallback = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const entry = await store.read(path);
    const value = await change(structuredClone(entry?.value ?? fallback));
    try { return await store.write(path, value, entry?.etag); }
    catch (error) { if (!(error instanceof StoreConflict)) throw error; }
  }
  throw new Error('Studio storage update conflict.');
}
