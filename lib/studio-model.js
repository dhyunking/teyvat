import { randomUUID } from 'node:crypto';
import { prepareWorks } from '../src/works.js';
import { StudioError } from './studio-error.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IMAGE_PATH = /^\/assets\/works\/([0-9a-f-]{36})\.webp$/;
export const initialState = () => ({ drafts: {}, uploads: {} });
export const seedCatalog = seed => ({ revision: 'seed', works: seed.works, assets: {}, updatedAt: null });
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
export function draftWork(input = {}, id) {
  return { id, brand: text(input.brand, 140), itemsKr: text(input.itemsKr, 300), itemsEn: text(input.itemsEn, 400),
    desc: text(input.desc, 5000), descEn: text(input.descEn, 6000), dark: input.dark === true,
    cover: text(input.cover, 300), hero: text(input.hero, 300),
    types: Array.isArray(input.types) ? [...new Set(input.types.filter(x => ['bag', 'carton', 'rigid', 'magnetic', 'assembled', 'corrugated', 'print', 'etc'].includes(x)))] : [],
    chapters: (Array.isArray(input.chapters) ? input.chapters : []).slice(0, 12).map(c => ({ kr: text(c?.kr, 100), en: text(c?.en, 100),
      imgs: (Array.isArray(c?.imgs) ? c.imgs : []).slice(0, 60).map(img => ({ src: text(img?.src, 300), size: ['w', 'h', 't', 'c'].includes(img?.size) ? img.size : 'h' })) })),
  };
}
export function saveDraft(state, body, catalog, now) {
  const key = body.key || randomUUID();
  if (!UUID.test(key)) throw new StudioError(400, '임시 저장 식별자를 확인해 주세요.');
  const previous = state.drafts[key];
  if ((previous?.version || 0) !== body.version) throw new StudioError(409, '다른 창에서 수정한 내용이 있습니다. 목록에서 다시 열어 주세요.');
  if (!previous && Object.keys(state.drafts).length >= 100) throw new StudioError(400, '임시 저장 항목을 먼저 정리해 주세요.');
  const original = previous?.originalId || (catalog.works.some(w => w.id === body.originalId) ? body.originalId : null);
  const ids = [...catalog.works, ...Object.values(state.drafts).map(d => d.work)].map(w => Number(w.id)).filter(Number.isSafeInteger);
  const id = previous?.work.id || original || String(Math.max(0, ...ids) + 1).padStart(2, '0');
  state.drafts[key] = { key, originalId: original, baseWork: previous?.baseWork || (original ? structuredClone(catalog.works.find(w => w.id === original)) : null), work: draftWork(body.work, id), version: (previous?.version || 0) + 1,
    baseRevision: previous?.baseRevision ?? catalog.revision, placement: ['first', 'last', 'keep'].includes(body.placement) ? body.placement : previous?.placement || (original ? 'keep' : 'first'), updatedAt: now };
  return key;
}
export function candidateCatalog(catalog, draft, state, source, now) {
  if (draft.baseRevision !== catalog.revision) {
    const current = catalog.works.find(w => w.id === draft.work.id);
    const canonical = value => value ? JSON.stringify(prepareWorks({ works: [value] })) : '';
    if (draft.originalId ? canonical(current) !== canonical(draft.baseWork) : Boolean(current)) throw new StudioError(409, '이 작업물이 다른 창에서 수정됐습니다. 임시 저장을 보관한 뒤 최신 작업물을 다시 열어 주세요.');
  }
  let work;
  try { [work] = prepareWorks({ works: [{ ...draft.work, chapters: draft.work.chapters.filter(c => c.imgs.length).map(c => ({ ...c, kr: c.kr.trim() || '작업 사진' })) }] }); }
  catch (error) { throw new StudioError(400, error.message); }
  // Store the editor's object format; the public renderer converts image entries into tuples.
  work.chapters = work.chapters.map(c => ({ ...c, imgs: c.imgs.map(([src, size]) => ({ src, size })) }));
  const works = structuredClone(catalog.works);
  const oldIndex = works.findIndex(w => w.id === work.id);
  if (oldIndex >= 0) works.splice(oldIndex, 1);
  const position = draft.placement === 'first' ? 0 : draft.placement === 'last' || oldIndex < 0 ? works.length : oldIndex;
  works.splice(position, 0, work);
  const sourcePaths = new Set(source.files.map(f => '/' + f.file));
  const assets = {};
  for (const src of allImages(works)) {
    const asset = state.uploads[src] || catalog.assets[src];
    if (asset) assets[src] = asset;
    else if (!sourcePaths.has(src)) throw new StudioError(400, '아직 업로드되지 않은 사진이 있습니다. 다시 업로드해 주세요.');
  }
  return { revision: randomUUID(), works, assets, updatedAt: now };
}
export function allImages(works) {
  return [...new Set(works.flatMap(w => [w.cover, w.hero || w.cover, ...(w.chapters || []).flatMap(c => c.imgs.map(img => img.src))]).filter(Boolean))];
}
export function mergeSource(files, catalog) {
  if (!catalog || catalog.revision === 'seed') return files;
  const map = new Map(files.map(f => [f.file, f]));
  map.set('content/works.json', { file: 'content/works.json', data: Buffer.from(JSON.stringify({ works: catalog.works })).toString('base64'), encoding: 'base64' });
  for (const [path, asset] of Object.entries(catalog.assets)) {
    if (!IMAGE_PATH.test(path) || !/^[0-9a-f]{40}$/.test(asset.vercelSha) || !Number.isInteger(asset.size) || asset.size > 2 * 1024 * 1024) throw new StudioError(400, '사진 저장 정보를 확인할 수 없습니다.');
    map.set(path.slice(1), { file: path.slice(1), sha: asset.vercelSha, size: asset.size });
  }
  return [...map.values()];
}
