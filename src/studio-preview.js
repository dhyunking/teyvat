import { createRoot } from 'react-dom/client';
import { createApp } from './app.js';
import { setPreviewWork } from './data.js';
import { photoUrl } from './studio-images.js';

let root = createRoot(document.getElementById('dc-root'));
window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'teyvat:preview') return;
  const input = structuredClone(event.data.work);
  if (!input?.cover) return;
  input.id ||= '999999'; input.brand ||= '브랜드명'; input.itemsKr ||= '제작 품목'; input.desc ||= '작업 설명이 여기에 표시됩니다.';
  if (!input.types?.length) input.types = ['bag'];
  input.chapters = (input.chapters || []).filter(c => c.imgs?.length).map(c => ({ ...c, kr: c.kr || '작업 사진' }));
  try {
    const work = setPreviewWork(input, photoUrl);
    const top = scrollY;
    root.unmount(); document.getElementById('dc-root').replaceChildren(); root = createRoot(document.getElementById('dc-root'));
    root.render(createApp(document, { page: 'detail', workId: work.id }, { preview: true, motion: false, grain: false }));
    requestAnimationFrame(() => scrollTo(0, top));
  } catch { parent.postMessage({ type: 'teyvat:preview-error' }, location.origin); }
});
parent.postMessage({ type: 'teyvat:preview-ready' }, location.origin);
