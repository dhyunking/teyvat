import { readFile, writeFile, mkdir, cp, rm, mkdtemp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { renderToString } from 'react-dom/server';
import { routes, metadata, structuredData, SITE_NAME } from '../src/seo.js';
import { WORKS } from '../src/data.js';
import { BASE_CSS, FULL_PAGE_CSS } from '../src/runtime.js';

export async function buildSite() {
  const origin = new URL(process.env.SITE_URL || 'https://teyvat.kr').origin;
  const indexable = process.env.VERCEL_ENV !== 'preview';
  const out = 'dist';
  const images = new Set(WORKS.flatMap(work => [work.cover, work.hero, ...work.chapters.flatMap(chapter => chapter.imgs.map(([src]) => src))]));
  for (const image of images) {
    if (!(await stat('.' + image).catch(() => null))?.isFile()) throw new Error(`작업물 이미지를 찾을 수 없습니다: ${image}`);
  }
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'assets'), { recursive: true });
  await cp('assets', join(out, 'assets'), { recursive: true });
  const client = await build({ entryPoints: ['src/client.js'], outdir: join(out, 'assets'),
    entryNames: 'site-[hash]', bundle: true, minify: true, format: 'esm', target: 'es2022',
    loader: { '.html': 'text' }, metafile: true, define: { 'process.env.NODE_ENV': '"production"' } });
  const script = '/' + Object.keys(client.metafile.outputs).find(p => p.endsWith('.js')).replace(/^dist\//, '');
  const temporary = await mkdtemp(join(tmpdir(), 'teyvat-build-'));
  try {
    const server = join(temporary, 'app.mjs');
    await build({ entryPoints: ['src/app.js'], outfile: server, bundle: true, platform: 'node', format: 'esm',
      loader: { '.html': 'text' }, external: ['react'], define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'resolve-react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: import.meta.resolve('react').replace('file://', ''), external: true })); } }] });
    const { createApp } = await import(pathToFileURL(server));
    const original = JSON.parse(await readFile('src/original-schema.json', 'utf8'));
    const faq = original['@graph'].find(item => item['@type'] === 'FAQPage');
    const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
    const css = BASE_CSS + FULL_PAGE_CSS + await readFile('src/styles.css', 'utf8');
    for (const route of routes) {
      const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: origin + route.path });
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      globalThis.DOMParser = dom.window.DOMParser;
      globalThis.Node = dom.window.Node;
      const app = createApp(dom.window.document, route);
      const markup = renderToString(app);
      if (markup.includes('sc-has-error') || markup.includes('sc-placeholder')) throw new Error(`Failed to render ${route.path}`);
      const pseudoCSS = [...dom.window.document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
      const meta = metadata(route.page, route.workId);
      const verification = [['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION], ['naver-site-verification', process.env.NAVER_SITE_VERIFICATION]]
        .filter(([, value]) => value).map(([name, value]) => `<meta name="${name}" content="${escape(value)}">`).join('\n');
      const html = `<!doctype html>
<html lang="ko" data-site-url="${escape(origin)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}">
<meta name="robots" content="${indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}">
<link rel="canonical" href="${origin}${route.path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${escape(SITE_NAME)}">
<meta property="og:locale" content="ko_KR"><meta property="og:title" content="${escape(meta.title)}">
<meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${origin}${route.path}">
<meta property="og:image" content="${origin}${meta.image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="테바디엔피 — 패키지 디자인 · 인쇄 · 제작">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(meta.title)}">
<meta name="twitter:description" content="${escape(meta.description)}"><meta name="twitter:image" content="${origin}${meta.image}">
<meta name="theme-color" content="#EEEAE2"><link rel="icon" href="/assets/teyvat-logo.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="회사 및 서비스 안내">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&amp;family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans+KR:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
${verification}<style>${css}\n${pseudoCSS}</style>
<script id="structured-data" type="application/ld+json">${json(structuredData(route, origin))}</script>
<script type="module" src="${script}"></script></head>
<body><div id="dc-root">${markup}</div><noscript><style>[data-l]{transform:none!important}</style><p style="padding:20px">온라인 문의 양식을 이용하려면 JavaScript를 켜 주세요. 이메일: <a href="mailto:inquiry@teyvat.kr">inquiry@teyvat.kr</a></p></noscript></body></html>`;
      const file = route.path === '/' ? 'index.html' : route.path.slice(1) + '.html';
      await mkdir(join(out, file, '..'), { recursive: true });
      await writeFile(join(out, file), html);
      dom.window.close();
    }
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(r => `  <url><loc>${origin}${r.path}</loc></url>`).join('\n')}\n</urlset>\n`;
    await writeFile(join(out, 'sitemap.xml'), sitemap);
    await writeFile(join(out, 'robots.txt'), `User-agent: *\n${indexable ? 'Allow: /\nDisallow: /api/' : 'Disallow: /'}\n\nSitemap: ${origin}/sitemap.xml\n`);
    const overview = (await readFile('llms.txt', 'utf8')).replaceAll('https://teyvat.kr', origin);
    const links = `\n## 공식 페이지\n${routes.filter(r => r.page !== 'detail').map(r => `- [${metadata(r.page).title}](${origin}${r.path})`).join('\n')}\n\n## 작업 상세\n${WORKS.map(w => `- [${w.brand}](${origin}${routes.find(r => r.workId === w.id).path}): ${w.itemsKr}`).join('\n')}\n`;
    await writeFile(join(out, 'llms.txt'), overview + links);
    await writeFile(join(out, 'llms-full.txt'), overview + links + '\n## 자주 묻는 질문\n' + faq.mainEntity.map(q => `### ${q.name}\n${q.acceptedAnswer.text}`).join('\n\n'));
    await writeFile(join(out, '404.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>페이지를 찾을 수 없습니다 — TEYVAT</title><style>${css}</style></head><body><main style="padding:15vh 6vw"><h1>페이지를 찾을 수 없습니다.</h1><p><a href="/">TEYVAT 홈으로 돌아가기 →</a></p></main></body></html>`);
    console.log(`Built ${routes.length} static pages with SEO/GEO assets for ${origin}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
    delete globalThis.window; delete globalThis.document; delete globalThis.DOMParser; delete globalThis.Node;
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) await buildSite();
