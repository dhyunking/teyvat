import { WORKS } from './data.js';
import originalSchema from './original-schema.json' with { type: 'json' };

export const SITE_NAME = 'TEYVAT D&P 테바디엔피';
export const DESCRIPTION = '테바디엔피(TEYVAT D&P)는 쇼핑백·박스 등 패키지 디자인부터 인쇄·제작까지 한 곳에서 진행합니다.';
export const TITLES = {
  home: `${SITE_NAME} — 패키지 디자인 · 인쇄 · 제작`,
  works: `패키지 제작 포트폴리오 · Works — ${SITE_NAME}`,
  services: `패키지 디자인·인쇄·제작 서비스 — ${SITE_NAME}`,
  about: `회사 소개 · About — ${SITE_NAME}`,
  contact: `패키지 제작 문의 · Contact — ${SITE_NAME}`,
};
const descriptions = {
  home: DESCRIPTION,
  works: '쇼핑백, 단상자, 싸바리, 골판지 박스 등 테바디엔피가 디자인하고 제작한 패키지 작업을 살펴보세요.',
  services: '기획부터 디자인, 인쇄, 패키지 제작까지. 제작 품목, 진행 과정, 최소 주문 수량과 제작 기간에 대한 안내.',
  about: '소중한 것을 담는 상자를 만드는 테바디엔피. 제품 기획, 디자인 및 브랜딩, 인쇄, 패키징을 한 팀이 진행합니다.',
  contact: '패키지 제작 문의 — 품목과 수량, 일정을 알려주시면 사양과 견적을 안내해 드립니다.',
};
export function routeFor(page, workId) {
  if (page === 'home') return '/';
  if (page === 'detail') {
    const work = WORKS.find(w => w.id === workId);
    const slug = work?.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `/works/${workId}${slug ? `-${slug}` : ''}`;
  }
  return `/${page}`;
}
export function parseRoute(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/') return { page: 'home' };
  const work = WORKS.find(w => routeFor('detail', w.id) === path);
  if (work) return { page: 'detail', workId: work.id };
  const page = path.slice(1);
  return Object.hasOwn(TITLES, page) ? { page } : { page: 'home' };
}
export function metadata(page, workId) {
  const work = WORKS.find(w => w.id === workId);
  return {
    title: page === 'detail' && work ? `${work.brand} · ${work.itemsKr} — ${SITE_NAME}` : TITLES[page],
    description: page === 'detail' && work ? `${work.brand} — ${work.itemsKr}. ${work.desc}` : descriptions[page],
    path: routeFor(page, workId),
    image: '/assets/og-image.png',
  };
}
export function updateMetadata(meta) {
  document.title = meta.title;
  const origin = document.documentElement.dataset.siteUrl;
  document.querySelector('link[rel="canonical"]').href = origin + meta.path;
  for (const [selector, content] of [
    ['meta[name="description"]', meta.description],
    ['meta[property="og:title"]', meta.title],
    ['meta[property="og:description"]', meta.description],
    ['meta[property="og:url"]', origin + meta.path],
    ['meta[name="twitter:title"]', meta.title],
    ['meta[name="twitter:description"]', meta.description],
  ]) document.querySelector(selector)?.setAttribute('content', content);
  const route = { ...parseRoute(meta.path), path: meta.path };
  document.getElementById('structured-data').textContent = JSON.stringify(structuredData(route, origin));
}
export function structuredData(route, origin) {
  const meta = metadata(route.page, route.workId);
  const graph = JSON.parse(JSON.stringify(originalSchema['@graph'].filter(item => item['@type'] !== 'FAQPage')).replaceAll('https://teyvat.kr', origin));
  graph.push({ '@type': route.page === 'contact' ? 'ContactPage' : route.page === 'about' ? 'AboutPage' : route.page === 'works' ? 'CollectionPage' : 'WebPage',
    '@id': origin + route.path + '#page', url: origin + route.path, name: meta.title,
    description: meta.description, inLanguage: 'ko-KR', isPartOf: { '@id': origin + '/#site' }, about: { '@id': origin + '/#org' } });
  if (route.page === 'services') graph.push(originalSchema['@graph'].find(item => item['@type'] === 'FAQPage'));
  if (route.page !== 'home') graph.push({ '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈', item: origin + '/' },
    ...(route.page === 'detail' ? [{ '@type': 'ListItem', position: 2, name: '작업', item: origin + '/works' }] : []),
    { '@type': 'ListItem', position: route.page === 'detail' ? 3 : 2, name: meta.title.split(' — ')[0], item: origin + route.path },
  ] });
  return { '@context': 'https://schema.org', '@graph': graph };
}
export const routes = [
  ...Object.keys(TITLES).map(page => ({ page, path: routeFor(page) })),
  ...WORKS.map(w => ({ page: 'detail', workId: w.id, path: routeFor('detail', w.id) })),
];
