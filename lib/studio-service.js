import { createHash, randomUUID } from 'node:crypto';
import { StudioError } from './studio-auth.js';
import { updateRecord } from './studio-store.js';
import { IMAGE_PATH, UUID, initialState, seedCatalog, saveDraft, candidateCatalog, mergeSource } from './studio-model.js';

const STATE = 'cms/studio.json', CATALOG = 'cms/catalog.json', SOURCE = 'cms/source.json', LEASE = 'cms/lease.json';
const validSource = file => /^(?:api|lib|src|assets|content|scripts)\//.test(file) || ['package.json', 'package-lock.json', 'vercel.json', 'llms.txt'].includes(file);
export function createStudioService({ store, provider, seed, now = Date.now }) {
  const catalog = async () => (await store.read(CATALOG))?.value || seedCatalog(seed);
  const state = async () => (await store.read(STATE))?.value || initialState();
  async function lock(owner, kind, strict = false) {
    if (!UUID.test(owner || '')) throw new StudioError(400, '게시 식별자가 올바르지 않습니다.');
    const previous = (await store.read(LEASE))?.value;
    if (previous?.kind === 'publish' && previous.owner !== owner && previous.expires <= now()) {
      let job;
      try { job = await jobStatus(previous.owner); }
      catch (error) {
        if (error.status !== 404 || (await catalog()).jobId === previous.owner) throw error;
        await unlock(previous.owner); job = { status: 'failed' };
      }
      if (!['ready', 'failed'].includes(job.status)) throw new StudioError(409, '홈페이지 업데이트가 진행 중입니다. 완료된 뒤 게시해 주세요.');
    }
    await updateRecord(store, LEASE, value => {
      if (strict && value.expires > now() && value.owner === owner) throw new StudioError(409, '같은 게시 요청이 이미 처리 중입니다. 잠시 후 상태를 확인해 주세요.');
      if (value.expires > now() && value.owner !== owner) throw new StudioError(409, '홈페이지 업데이트가 진행 중입니다. 완료된 뒤 게시해 주세요.');
      return { owner, kind, expires: now() + 20 * 60 * 1000 };
    });
  }
  async function unlock(owner) {
    await updateRecord(store, LEASE, value => value.owner === owner ? { owner: null, expires: 0 } : value);
  }
  async function commitCatalog(job) {
    const release = (await store.read(`cms/releases/${job.revision}.json`))?.value;
    if (!release) throw new StudioError(503, '게시 자료를 확인할 수 없습니다.');
    await updateRecord(store, CATALOG, current => {
      const revision = current.revision || 'seed';
      if (revision === release.revision) return current;
      if (revision !== job.baseRevision) throw new StudioError(409, '새로운 게시 자료가 있습니다. 목록을 다시 확인해 주세요.');
      return release;
    });
    await updateRecord(store, STATE, value => {
      const draft = value.drafts?.[job.draftKey];
      if (draft?.version === job.draftVersion) draft.baseRevision = job.revision;
      return value;
    }, initialState());
  }
  async function jobStatus(id) {
    if (!UUID.test(id || '')) throw new StudioError(400, '게시 식별자가 올바르지 않습니다.');
    let job = (await store.read(`cms/jobs/${id}.json`))?.value;
    if (!job) throw new StudioError(404, '게시 기록을 찾을 수 없습니다.');
    if (['ready', 'failed'].includes(job.status)) return job;
    if (!job.deploymentId) {
      const found = await provider.findJob(id);
      if (!found) {
        if (job.createdAt + 20 * 60 * 1000 <= now()) {
          job.status = 'failed'; await updateRecord(store, `cms/jobs/${id}.json`, () => job); await unlock(id);
        }
        return job;
      }
      job = { ...job, deploymentId: found.id, url: found.url, status: 'building' };
      await commitCatalog(job);
    }
    const remote = await provider.status(job.deploymentId);
    if (remote.status === 'READY' && !remote.aliasError) {
      job.status = 'ready'; job.completedAt = now();
      await updateRecord(store, STATE, value => {
        if (value.drafts?.[job.draftKey]?.version === job.draftVersion) delete value.drafts[job.draftKey];
        return value;
      }, initialState());
      await unlock(id);
    } else if (['ERROR', 'CANCELED'].includes(remote.status) || remote.aliasError) {
      job.status = 'failed';
      const previous = (await store.read(`cms/releases/${job.baseRevision}.json`))?.value;
      if (previous) await updateRecord(store, CATALOG, value => value.revision === job.revision ? previous : value);
      await updateRecord(store, STATE, value => {
        const draft = value.drafts?.[job.draftKey];
        if (draft?.version === job.draftVersion) draft.baseRevision = job.baseRevision;
        return value;
      }, initialState());
      await unlock(id);
    }
    const saved = await updateRecord(store, `cms/jobs/${id}.json`, value => ['ready', 'failed'].includes(value.status) ? value : job);
    return saved.value;
  }
  return {
    async overview() {
      let lease = (await store.read(LEASE))?.value;
      let activeJob;
      const latest = await catalog();
      const jobId = lease?.kind === 'publish' ? lease.owner : latest.jobId;
      if (jobId) {
        activeJob = await jobStatus(jobId).catch(() => null);
        lease = (await store.read(LEASE))?.value;
      }
      const [published, saved, source] = await Promise.all([catalog(), state(), store.read(SOURCE)]);
      return { ...published, drafts: Object.values(saved.drafts), readyToPublish: Boolean(source),
        busy: Boolean(lease?.expires > now()), activeJob };
    },
    async save(body) {
      const published = await catalog(); let key;
      const result = await updateRecord(store, STATE, value => { key = saveDraft(value, body, published, now()); return value; }, initialState());
      return result.value.drafts[key];
    },
    async discard(body) {
      if (!UUID.test(body.key || '')) throw new StudioError(400, '임시 저장 항목을 확인해 주세요.');
      await updateRecord(store, STATE, value => {
        if (value.drafts?.[body.key]?.version !== body.version) throw new StudioError(409, '다른 창에서 수정한 내용이 있습니다.');
        delete value.drafts[body.key]; return value;
      }, initialState());
    },
    async upload(body) {
      if (!UUID.test(body.id || '') || typeof body.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data)) throw new StudioError(400, '사진 파일을 다시 선택해 주세요.');
      const bytes = Buffer.from(body.data, 'base64');
      if (bytes.length < 16 || bytes.length > 2 * 1024 * 1024 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new StudioError(400, '사진 변환 결과를 확인할 수 없습니다. JPG·PNG·WEBP 사진을 다시 선택해 주세요.');
      const path = `/assets/works/${body.id}.webp`, hash = createHash('sha256').update(bytes).digest('hex');
      const previous = (await state()).uploads[path];
      if (previous) { if (previous.sha256 !== hash) throw new StudioError(409, '다른 사진과 업로드 식별자가 겹쳤습니다.'); return { path, ...previous }; }
      const blob = `cms/images/${body.id}.webp`;
      await store.putImage(blob, bytes);
      const vercelSha = await provider.upload(bytes);
      const asset = { blob, size: bytes.length, sha256: hash, vercelSha, createdAt: now() };
      await updateRecord(store, STATE, value => {
        if (value.uploads[path] && value.uploads[path].sha256 !== hash) throw new StudioError(409, '사진 업로드가 충돌했습니다.');
        value.uploads[path] = asset; return value;
      }, initialState());
      return { path, ...asset };
    },
    async image(id) {
      if (!UUID.test(id || '')) throw new StudioError(404, '사진을 찾을 수 없습니다.');
      const path = `/assets/works/${id}.webp`;
      const asset = (await state()).uploads[path] || (await catalog()).assets[path];
      if (!asset || !IMAGE_PATH.test(path)) throw new StudioError(404, '사진을 찾을 수 없습니다.');
      const bytes = await store.image(asset.blob);
      if (!bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new StudioError(503, '사진을 불러올 수 없습니다.');
      return bytes;
    },
    async publish(body) {
      const id = body.requestId;
      if (!UUID.test(id || '')) throw new StudioError(400, '게시 식별자를 확인해 주세요.');
      const previous = await store.read(`cms/jobs/${id}.json`);
      if (previous) return jobStatus(id);
      await lock(id, 'publish', true);
      let durable = false;
      try {
        const [published, saved, source] = await Promise.all([catalog(), state(), store.read(SOURCE)]);
        if (!source) throw new StudioError(503, '게시 연결을 준비하고 있습니다.');
        if (provider.currentSha && await provider.currentSha() !== source.value.gitSha) throw new StudioError(409, '홈페이지 코드 업데이트가 진행 중입니다. 완료된 뒤 다시 게시해 주세요.');
        const draft = saved.drafts[body.key];
        if (!draft || draft.version !== body.version) throw new StudioError(409, '임시 저장을 마친 뒤 다시 게시해 주세요.');
        const release = candidateCatalog(published, draft, saved, source.value, now());
        release.jobId = id;
        if (!await store.read(`cms/releases/${published.revision}.json`)) await store.write(`cms/releases/${published.revision}.json`, published);
        await store.write(`cms/releases/${release.revision}.json`, release);
        let job = { id, revision: release.revision, baseRevision: published.revision, draftKey: draft.key, draftVersion: draft.version,
          workId: draft.work.id, status: 'preparing', createdAt: now() };
        await store.write(`cms/jobs/${id}.json`, job); durable = true;
        const created = await provider.create(mergeSource(source.value.files, release), { deploymentSource: 'teyvat-studio',
          githubCommitSha: source.value.gitSha, cmsRevision: release.revision, cmsJobId: id });
        job = { ...job, deploymentId: created.id, url: created.url, status: 'building' };
        await commitCatalog(job);
        await updateRecord(store, `cms/jobs/${id}.json`, () => job);
        return job;
      } catch (error) {
        if (!durable) await unlock(id);
        else if (error.definitive) {
          await updateRecord(store, `cms/jobs/${id}.json`, value => ({ ...value, status: 'failed' }));
          await unlock(id);
        }
        // An ambiguous provider response keeps the durable job for lookup by cmsJobId.
        throw error;
      }
    },
    jobStatus,
    async sourceBegin(owner) {
      const lease = (await store.read(LEASE))?.value;
      const latest = await catalog(), jobId = lease?.kind === 'publish' ? lease.owner : latest.jobId;
      if (jobId) {
        let job;
        try { job = await jobStatus(jobId); }
        catch (error) {
          if (error.status !== 404 || latest.jobId === jobId) throw error;
          if (lease?.expires > now()) throw new StudioError(409, '게시 요청을 준비하고 있습니다.');
          await unlock(jobId); job = { status: 'failed' };
        }
        if (!['ready', 'failed'].includes(job.status)) throw new StudioError(409, '게시 작업이 진행 중입니다.');
      }
      await lock(owner, 'source');
      return catalog();
    },
    async sourceFinish(body) {
      const previous = await store.read(SOURCE);
      if (previous?.value.deploymentId === body.deploymentId && previous.value.gitSha === body.gitSha) { if (body.owner) await unlock(body.owner); return; }
      const lease = (await store.read(LEASE))?.value;
      if (previous && (lease?.owner !== body.owner || lease.kind !== 'source' || lease.expires <= now())) throw new StudioError(409, '배포 잠금을 다시 확인해 주세요.');
      if (!/^[0-9a-f]{40}$/.test(body.gitSha || '') || !Array.isArray(body.files) || !body.files.length || body.files.length > 5000 || body.files.some(f => !f || typeof f.file !== 'string' || !validSource(f.file) || f.file.split('/').some(x => x === '..' || x.startsWith('.')) || !/^[0-9a-f]{40}$/.test(f.sha) || !Number.isSafeInteger(f.size) || f.size < 0)) throw new StudioError(400, '배포 소스 정보를 확인할 수 없습니다.');
      const remote = await provider.status(body.deploymentId);
      if (remote.status !== 'READY' || remote.meta.githubCommitSha !== body.gitSha) throw new StudioError(409, '완료된 배포만 연결할 수 있습니다.');
      await updateRecord(store, SOURCE, () => ({ files: body.files, gitSha: body.gitSha, deploymentId: body.deploymentId, updatedAt: now() }));
      if (body.owner) await unlock(body.owner);
    },
    sourceAbort: unlock,
  };
}
