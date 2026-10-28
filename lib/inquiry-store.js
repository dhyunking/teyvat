import { get, put, list, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';

export class StoreConflict extends Error {}

export function createInquiryStore(env = process.env, sdk = { get, put, list }) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  const options = () => ({ ...(token ? { token } : {}), abortSignal: AbortSignal.timeout(8000) });
  return {
    async read(path) {
      try {
        const result = await sdk.get(path, { ...options(), access: 'private', useCache: false });
        if (!result) return null;
        // Transparent response compression prefixes the origin ETag with W/. Conditional Blob writes
        // compare against the strong origin value; keep the version from this body, never a later HEAD.
        return { value: await new Response(result.stream).json(), etag: result.blob.etag?.replace(/^W\//, '') };
      } catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    },
    async write(path, value, etag) {
      try {
        const result = await sdk.put(path, JSON.stringify(value), {
          ...options(), access: 'private', addRandomSuffix: false, contentType: 'application/json',
          cacheControlMaxAge: 60, allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}),
        });
        return { value, etag: result.etag };
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) throw new StoreConflict();
        if (etag) throw error;
        // A timed-out create may already have committed. Read it back rather than overwrite it.
        const existing = await this.read(path);
        if (existing) throw new StoreConflict();
        throw error;
      }
    },
    async list(cursor) {
      return sdk.list({ ...options(), prefix: 'inquiries/', limit: 100, ...(cursor ? { cursor } : {}) });
    },
  };
}
