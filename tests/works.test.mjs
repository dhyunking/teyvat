import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorks } from '../src/works.js';
import content from '../content/works.json' with { type: 'json' };
import { routeFor, routes } from '../src/seo.js';

test('reordering or deleting entries preserves the remaining work IDs and URLs', () => {
  const original = prepareWorks(content);
  const changed = prepareWorks({ works: [...content.works].reverse().slice(1) });
  for (const work of changed) {
    assert.equal(work.id, original.find(entry => entry.brand === work.brand).id);
    assert.equal(routeFor('detail', work.id), routes.find(route => route.workId === work.id).path);
  }
});

test('new CMS entries support optional English, hero, section lists and image sizes', () => {
  const data = { id: '30', brand: 'New Brand', itemsKr: '쇼핑백', desc: '새 작업', types: ['bag'], cover: '/assets/works/new.webp' };
  const minimal = prepareWorks({ works: [data] })[0];
  assert.equal(minimal.hero, data.cover);
  assert.equal(minimal.itemsEn, data.itemsKr);
  assert.deepEqual(minimal.chapters, []);
  const withSections = prepareWorks({ works: [{ ...data, chapters: [{ kr: '상세', imgs: [{ src: data.cover }] }] }] })[0];
  assert.deepEqual(withSections.chapters, [{ kr: '상세', en: '상세', imgs: [[data.cover, 'h']] }]);
});

test('duplicate IDs, missing required content and invalid image or category values stop publishing', () => {
  assert.throws(() => prepareWorks({ works: [content.works[0], content.works[0]] }), /작업 번호/);
  for (const patch of [{ id: '0' }, { brand: '' }, { types: ['unknown'] }, { cover: '/assets/../secret.png' }, { cover: 'https://example.com/a.png' }, { chapters: [{ kr: '상세', imgs: [] }] }, { chapters: [{ kr: '상세', imgs: [{ src: '/assets/test.jpg', size: 'bad' }] }] }]) {
    assert.throws(() => prepareWorks({ works: [{ ...content.works[0], ...patch }] }));
  }
  assert.throws(() => prepareWorks({ works: [] }), /최소 한 개/);
});
