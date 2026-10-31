import React from 'react';
import { StreamableLogic as DCLogic } from './runtime.js';
import { submitInquiry, selectFiles } from './inquiry.js';
import { metadata, updateMetadata, routeFor, parseRoute } from './seo.js';

import { J, P, F, U, UR, auto, TYPES, NOTES, W, RAW, WORKS, FILTERS, CLIENTS, LINES, RANGE, ITEMS, QTY, SZ, DARK, LIGHT, clamp, eo, eio, EMPTY, AX, AY } from './data.js';

export default class Component extends DCLogic {
  state = { page: this.props.initialRoute?.page || 'home', workId: this.props.initialRoute?.workId || '01', filter: 'all', view: null, hover: null, items: [], qty: '', form: { ...EMPTY }, sent: false };
  hRef = React.createRef(); procRef = React.createRef(); transRef = React.createRef();
  winRef = React.createRef(); leftRef = React.createRef(); rightRef = React.createRef();
  heroRef = React.createRef(); svgRef = React.createRef(); clipRef = React.createRef(); inkRef = React.createRef();
  fullRef = React.createRef(); metaRef = React.createRef(); capRef = React.createRef(); marqRef = React.createRef(); previewRef = React.createRef();

  componentDidMount() {
    const init = this.props.preview ? this.props.initialRoute : this.parseHash();
    if (location.hash.startsWith('#/')) history.replaceState(null, '', routeFor(init.page, init.workId));
    if (init.page !== 'home') this.setState({ page: init.page, ...(init.workId ? { workId: init.workId } : {}) });
    this.setTitle(init.page, init.workId);
    this.onPop = () => { const r = this.parseHash(); if (r.page === this.state.page && (!r.workId || r.workId === this.state.workId)) return; const tel = this.transRef.current; if (tel && tel.getAnimations) tel.getAnimations().forEach(a => a.cancel()); this.fromPop = true; this.swap(r.page, r.workId ? { workId: r.workId } : undefined); };
    addEventListener('popstate', this.onPop);
    this.onResize = () => { if (Math.abs((this.state.vw || 0) - innerWidth) > 1) this.setState({ vw: innerWidth }); };
    addEventListener('resize', this.onResize); this.onResize();
    this.t0 = performance.now();
    const loop = now => { this.tick(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    setTimeout(() => this.reveal(), 80);
  }
  componentWillUnmount() { removeEventListener('resize', this.onResize); removeEventListener('popstate', this.onPop); cancelAnimationFrame(this.raf); if (this.io) this.io.disconnect(); }
  componentDidUpdate() {
    const ps = this.previousRenderState || {}; this.previousRenderState = { ...this.state };
    if (ps.page !== this.state.page && this.state.page !== 'blank') { this.glyphs = null; this.letters = null; setTimeout(() => this.reveal(), 80); }
    if (ps.filter !== this.state.filter || ps.view !== this.state.view) setTimeout(() => this.reveal(), 40);
  }
  scrollTop() { const se = document.scrollingElement || document.documentElement; se.scrollTop = 0; window.scrollTo(0, 0); }
  motionOn() {
    return this.props.motion !== false && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  linkNav(e, page, extra) {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0)) return;
    if (e) e.preventDefault();
    this.nav(page, extra);
  }
  nav(page, extra) {
    if (this.props.preview) return;
    const el = this.transRef.current;
    if (!el || !this.motionOn() || !el.animate) return this.swap(page, extra);
    if (this.navBusy) return;
    this.navBusy = true;
    const LABELS = { home: 'HOME 홈', works: 'WORKS 작업', detail: 'WORK 작업 상세', services: 'SERVICES 서비스', about: 'ABOUT 소개', contact: 'CONTACT 문의' };
    const lb = el.querySelector('[data-tlabel]'); if (lb) lb.textContent = LABELS[page] || '';
    const glyphs = [...el.querySelectorAll('[data-tg]')];
    const ease = 'cubic-bezier(.76,0,.24,1)';
    el.style.visibility = 'visible';
    const inA = el.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0%)' }], { duration: 560, easing: ease, fill: 'forwards' });
    glyphs.forEach((g, i) => g.animate([{ transform: 'translateY(120%)' }, { transform: 'translateY(0%)' }], { duration: 520, delay: 200 + (2 - i) * 80, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }));
    const finish = () => {
      el.getAnimations().forEach(a => a.cancel()); glyphs.forEach(g => g.getAnimations().forEach(a => a.cancel()));
      el.style.visibility = 'hidden'; this.navBusy = false;
    };
    inA.onfinish = () => {
      this.swap(page, extra);
      setTimeout(() => {
        glyphs.forEach((g, i) => g.animate([{ transform: 'translateY(0%)' }, { transform: 'translateY(-120%)' }], { duration: 420, delay: (2 - i) * 60, easing: 'cubic-bezier(.7,0,.8,.3)', fill: 'forwards' }));
        const outA = el.animate([{ transform: 'translateY(0%)' }, { transform: 'translateY(-100%)' }], { duration: 620, delay: 180, easing: ease, fill: 'forwards' });
        outA.onfinish = finish; outA.oncancel = finish;
      }, 420);
    };
    inA.oncancel = finish;
  }
  slugOf(id) {
    const w = WORKS.find(x => x.id === id); if (!w) return id;
    const sl = w.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return sl ? `${w.id}-${sl}` : w.id;
  }
  hashFor(page, workId) { return routeFor(page, workId); }
  parseHash() { return parseRoute(location.hash.startsWith('#/') ? location.hash.slice(1) : location.pathname); }
  setTitle(page, workId) { updateMetadata(metadata(page, workId)); }
  swap(page, extra) {
    const wid = (extra && extra.workId) || this.state.workId;
    const hash = this.hashFor(page, wid);
    if (!this.fromPop && location.pathname !== hash) { try { history.pushState(null, '', hash); } catch (_) { location.assign(hash); } }
    this.fromPop = false;
    this.setTitle(page, wid);
    this.setState({ page: 'blank', menuOpen: false }, () => {
      this.scrollTop();
      requestAnimationFrame(() => this.setState({ page, hover: null, ...(extra || {}) }));
    });
  }
  tick(now) {
    const motion = this.motionOn();
    const hero = this.heroRef.current, svg = this.svgRef.current, cg = this.clipRef.current, ink = this.inkRef.current;
    const win = this.winRef.current, L = this.leftRef.current, R = this.rightRef.current;
    if (hero && win && L && R && (this.props.heroStyle || 'type') === 'type') {
      if (!this.letters || !this.letters.length || !hero.contains(this.letters[0])) this.letters = [...hero.querySelectorAll('[data-l]')];
      const t = motion ? now - this.t0 : 1e6, W = innerWidth, H = innerHeight;
      this.letters.forEach((el, i) => { const k = eo(clamp((t - 150 - i * 90) / 950)); el.style.transform = `translateY(${((1 - k) * 110).toFixed(2)}%)`; });
      const open = eo(clamp((t - 900) / 1100));
      const r = hero.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - H)), e = eio(clamp(p / 0.85));
      const w0 = W * 0.17 * open, h0 = H * 0.6;
      const w = w0 + (W - w0) * e, h = h0 + (H - h0) * e;
      win.style.width = w + 'px'; win.style.height = h + 'px';
      const off = w / 2 + W * 0.012 + e * W * 0.1;
      L.style.transform = `translate(${-off}px,-50%)`; R.style.transform = `translate(${off}px,-50%)`;
      const vs = `'wdth' ${(125 - e * 55).toFixed(1)}`;
      L.style.fontVariationSettings = vs; R.style.fontVariationSettings = vs;
      if (this.metaRef.current) this.metaRef.current.style.opacity = (clamp((t - 1400) / 700) * (1 - clamp(p * 5))).toFixed(3);
      const c = this.capRef.current;
      if (c) { const o = clamp((p - 0.82) / 0.14); c.style.opacity = o; c.style.transform = `translateY(${(1 - o) * 16}px)`; c.style.pointerEvents = o > 0.5 ? 'auto' : 'none'; }
    } else if (hero && svg && cg && ink) {
      if (!this.glyphs || !this.glyphs.length || !svg.contains(this.glyphs[0])) this.glyphs = [...svg.querySelectorAll('[data-g]')];
      const W = innerWidth, H = innerHeight;
      const t = motion ? now - this.t0 : 1e6;
      const k = Math.min((W * 0.84) / 112, (H * 0.5) / 34);
      const tx = (W - 112 * k) / 2, ty = (H - 34 * k) / 2 - H * 0.03;
      const r = hero.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - H));
      const zt = clamp(p / 0.66);
      const z = 1 + Math.pow(zt, 3) * 30;
      const m = eio(zt);
      const sx = (tx + AX * k) + (W / 2 - (tx + AX * k)) * m;
      const sy = (ty + AY * k) + (H / 2 - (ty + AY * k)) * m;
      const T = `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${(k * z).toFixed(4)}) translate(${-AX} ${-AY})`;
      cg.setAttribute('transform', T); ink.setAttribute('transform', T);
      svg.style.opacity = '1';
      this.glyphs.forEach((g, i) => { const d = eo(clamp((t - 120 - (2 - i) * 140) / 950)); g.setAttribute('transform', `translate(0 ${((1 - d) * 36).toFixed(2)})`); });
      ink.style.opacity = (1 - clamp((t - 1500) / 900)).toFixed(3);
      if (this.fullRef.current) this.fullRef.current.style.opacity = clamp((p - 0.58) / 0.1).toFixed(3);
      if (this.metaRef.current) this.metaRef.current.style.opacity = (clamp((t - 1700) / 700) * (1 - clamp(p * 6))).toFixed(3);
      const c = this.capRef.current;
      if (c) { const o = clamp((p - 0.78) / 0.12); c.style.opacity = o; c.style.transform = `translateY(${(1 - o) * 16}px)`; c.style.pointerEvents = o > 0.5 ? 'auto' : 'none'; }
    }
    this.tickB(); this.tickP(now);
    const mq = this.marqRef.current;
    if (mq && motion) { const half = mq.scrollWidth / 2; if (half) mq.style.transform = `translateX(${-((now * 0.05) % half)}px)`; }
  }

  tickP(now) {
    const sec = this.procRef.current; if (!sec) return;
    const H = innerHeight, r = sec.getBoundingClientRect();
    if (r.bottom < -50 || r.top > H + 50) return;
    const p = clamp(-r.top / Math.max(1, r.height - H));
    const stage = sec.querySelector('[data-pstage]'), sc = sec.querySelector('[data-pscale]'), scene = sec.querySelector('[data-pscene]');
    if (!stage || !sc || !scene) return;
    const sr = stage.getBoundingClientRect();
    sc.style.transform = `scale(${Math.min(sr.width / 680, sr.height / 900, 1.3).toFixed(4)})`;
    this.procP = p;
    const k = eio(clamp((p - 0.58) / 0.26));
    const ur = this.rot || { z: 0, x: 0 };
    if (!this.dragging && p < 0.86) { ur.z *= 0.9; ur.x *= 0.9; }
    const sway = this.dragging ? 0 : Math.sin(now / 2200) * 7 * k;
    scene.style.transform = `translateY(${(118 * (1 - k)).toFixed(1)}px) rotateX(${(16 + 42 * k + ur.x * k).toFixed(2)}deg) rotateZ(${(-8 - 30 * k + sway + ur.z * k).toFixed(2)}deg) translateZ(${(-100 * k).toFixed(1)}px)`;
    const dimO = (clamp((p - 0.1) / 0.1) * (1 - clamp((p - 0.5) / 0.08))).toFixed(3);
    sec.querySelectorAll('[data-dim]').forEach(d => { d.style.opacity = dimO; });
    const order = ['base', 'back', 'front', 'left', 'right', 'lid', 'tuck'];
    const fs = eio(clamp((p - 0.6) / 0.2)), fl = eio(clamp((p - 0.76) / 0.14)), ft = eio(clamp((p - 0.86) / 0.1));
    const rot = { base: '', front: `rotateX(${90 * fs}deg)`, back: `rotateX(${-90 * fs}deg)`, left: `rotateY(${90 * fs}deg)`, right: `rotateY(${-90 * fs}deg)`, lid: `rotateX(${-90 * fl}deg)`, tuck: `rotateX(${-90 * ft}deg)` };
    sec.querySelectorAll('[data-pf]').forEach(el => {
      const key = el.dataset.pf, i = order.indexOf(key);
      if (rot[key]) el.style.transform = rot[key];
      const f = el.firstElementChild; if (!f) return;
      const d = eo(clamp((p - i * 0.022) / 0.2));
      const line = f.querySelector('[data-line]'); if (line) line.style.strokeDashoffset = ((1 - d) * +line.dataset.line).toFixed(1);
      const lbl = f.querySelector('[data-lbl]'); if (lbl) lbl.style.opacity = (clamp((p - 0.06 - i * 0.02) / 0.1) * (1 - clamp((p - 0.32) / 0.08))).toFixed(3);
      const fill = f.querySelector('[data-fill]'); if (fill) fill.style.opacity = clamp((p - 0.3) / 0.1).toFixed(3);
      const pr = f.querySelector('[data-print]'); if (pr) { const q = eo(clamp((p - 0.36 - i * 0.025) / 0.12)); pr.querySelectorAll('[data-pa]').forEach(pa => { pa.style.opacity = q.toFixed(3); pa.style.clipPath = q >= 0.999 ? 'none' : `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`; }); }
    });
    const act = p < 0.3 ? 0 : p < 0.58 ? 1 : 2;
    sec.querySelectorAll('[data-pstep]').forEach((el, i) => { const on = i === act; const o = on ? '1' : '0'; if (el.style.opacity !== o) { el.style.opacity = o; el.style.transform = on ? 'none' : `translateY(${i < act ? -16 : 16}px)`; } });
    const dg = sec.querySelector('[data-pdigits]'); if (dg) { const t = `translateY(${-act}em)`; if (dg.style.transform !== t) dg.style.transform = t; }
    const ranges = [[0, 0.3], [0.3, 0.58], [0.58, 1]];
    sec.querySelectorAll('[data-pbar]').forEach((el, i) => { el.style.transform = `scaleX(${clamp((p - ranges[i][0]) / (ranges[i][1] - ranges[i][0])).toFixed(4)})`; });
    const note = sec.querySelector('[data-pnote]'); if (note) { const t = ['DIELINE — 200 × 200 × 200', 'PRINT — GRAPHIC & FINISH', p > 0.86 ? 'DRAG TO ROTATE — 드래그해서 돌려보세요' : 'FOLD — ASSEMBLED BOX'][act]; if (note.textContent !== t) note.textContent = t; }
  }
  tickB() {
    const sec = this.hRef.current; if (!sec) { this.lastX = null; return; }
    const W = innerWidth, H = innerHeight, r = sec.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - H));
    const track = sec.querySelector('[data-track]'); if (!track) return;
    const x = -p * Math.max(0, track.scrollWidth - W);
    const v = this.lastX == null ? 0 : x - this.lastX; this.lastX = x;
    this.vel = (this.vel || 0) * 0.86 + v * 0.14;
    const sk = clamp(this.vel * 0.05, -7, 7);
    track.style.transform = `translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`;
    const wd = 100 + clamp(Math.abs(this.vel) * 0.9, 0, 25);
    sec.querySelectorAll('[data-panel]').forEach(pn => {
      const pr = pn.getBoundingClientRect(), c = (pr.left + pr.width / 2 - W / 2) / W;
      const im = pn.querySelector('[data-pimg]'); if (im) im.style.transform = `translateX(${(-c * 9).toFixed(2)}%)`;
      const nm = pn.querySelector('[data-num]'); if (nm) nm.style.transform = `translateX(${(c * 60).toFixed(1)}px)`;
      const na = pn.querySelector('[data-name]'); if (na) na.style.fontVariationSettings = `'wdth' ${wd.toFixed(1)}`;
    });
    const bg = sec.querySelector('[data-bgword]'); if (bg) bg.style.transform = `translate(${(-p * 40).toFixed(2)}%, -50%)`;
    const bar = sec.querySelector('[data-bar]'); if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const cnt = sec.querySelector('[data-count]'); const label = `${String(Math.min(7, Math.floor(p * 6.99) + 1)).padStart(2, '0')} / 07`;
    if (cnt && cnt.textContent !== label) cnt.textContent = label;
  }

  reveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!this.motionOn()) { els.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; el.dataset.revealed = 'done'; }); return; }
    if (!this.io) this.io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.style.opacity = '1'; en.target.style.transform = 'none'; en.target.dataset.revealed = 'done'; this.io.unobserve(en.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    els.forEach(el => {
      if (el.dataset.revealed === 'done') return;
      if (el.dataset.revealed === 'wait') { this.io.observe(el); return; }
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.top < innerHeight * 0.95) { el.dataset.revealed = 'done'; el.style.opacity = '1'; el.style.transform = 'none'; return; }
      el.dataset.revealed = 'wait';
      el.style.transition = 'opacity 1s cubic-bezier(.2,.7,.2,1), transform 1s cubic-bezier(.2,.7,.2,1)';
      el.style.opacity = '0'; el.style.transform = 'translateY(32px)';
      this.io.observe(el);
    });
  }
  shape(w) {
    return {
      ...w,
      typesKr: w.types.map(t => TYPES[t][0]).join(' · '),
      typesEn: w.types.map(t => TYPES[t][1].toUpperCase()).join(' · '),
      typesNote: w.types.map(t => NOTES[t]).join(' — '),
      card: w.dark ? '#141413' : '#E4DFD5',
      previewOp: this.state.hover === w.id ? 1 : 0,
      href: routeFor('detail', w.id), open: e => this.linkNav(e, 'detail', { workId: w.id }),
      enter: () => this.setState({ hover: w.id }),
    };
  }

  renderVals() {
    const s = this.state;
    const view = s.view || this.props.worksView || 'grid';
    const go = {};
    ['home', 'works', 'services', 'about', 'contact'].forEach(p => { go[p] = e => this.linkNav(e, p); });
    const open = {};
    WORKS.forEach(w => { open['w' + w.id] = e => this.linkNav(e, 'detail', { workId: w.id }); });
    const allWorks = WORKS.map(w => this.shape(w));
    const worksList = allWorks.filter(w => s.filter === 'all' || w.types.includes(s.filter));
    const idx = Math.max(0, WORKS.findIndex(w => w.id === s.workId));
    const work = allWorks[idx], next = allWorks[(idx + 1) % WORKS.length];
    const chapters = work.chapters.map((c, i) => ({
      en: c.en, kr: c.kr, no: String(i + 1).padStart(2, '0'), total: String(work.chapters.length).padStart(2, '0'), count: String(c.imgs.length).padStart(2, '0'),
      imgs: c.imgs.map(([src, sz], j) => ({ src, col: SZ[sz][0], ar: SZ[sz][1], alt: `${work.brand} ${c.kr} ${j + 1}` })),
    }));
    const filters = FILTERS.map(f => ({
      label: f === 'all' ? '전체' : TYPES[f][0],
      count: f === 'all' ? WORKS.length : WORKS.filter(w => w.types.includes(f)).length,
      active: s.filter === f, inactive: s.filter !== f,
      pick: () => this.setState({ filter: f }),
    }));
    const setField = k => e => { const v = e.target.value; this.setState(st => ({ form: { ...st.form, [k]: v } })); };
    const set = {}; Object.keys(EMPTY).forEach(k => { set[k] = setField(k); });

    return {
      grain: this.props.grain !== false,
      isHome: s.page === 'home', isWorksList: s.page === 'works', isDetail: s.page === 'detail',
      isServices: s.page === 'services', isAbout: s.page === 'about', isContact: s.page === 'contact',
      isWorks: s.page === 'works' || s.page === 'detail',
      go, open,
      leadWorkHref: WORKS.some(w => w.id === '01') ? routeFor('detail', '01') : '/works',
      leadWorkOpen: open.w01 || go.works,
      hRef: this.hRef, procRef: this.procRef, transRef: this.transRef,
      procCols: (s.vw || 1200) < 760 ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.15fr)',
      procRows: (s.vw || 1200) < 760 ? 'minmax(0,1fr) auto' : 'auto',
      procStageOrder: (s.vw || 1200) < 760 ? '-1' : '0',
      procCursor: s.boxGrab ? 'grabbing' : 'grab',
      pDown: e => { if ((this.procP || 0) < 0.86) return; this.dragging = { x: e.clientX, y: e.clientY }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} this.setState({ boxGrab: true }); },
      pMove: e => { const d = this.dragging; if (!d) return; this.rot = this.rot || { z: 0, x: 0 }; this.rot.z += (e.clientX - d.x) * 0.45; this.rot.x = clamp(this.rot.x - (e.clientY - d.y) * 0.3, -40, 30); d.x = e.clientX; d.y = e.clientY; },
      pUp: () => { if (this.dragging) { this.dragging = null; this.setState({ boxGrab: false }); } },
      finishes: [
        ['금박', 'Hot Foil', J('bag-03'), 'Jade Palace Golf Club', '01'],
        ['형압', 'Emboss', J('bag-08'), 'Jade Palace Golf Club', '01'],
        ['로고 형압', 'Logo Emboss', U(57, 1), 'MUWA', '25'],
        ['골판지 인쇄', 'Corrugated Print', U(7, 5), 'PAN AM', '02'],
      ].map(([kr, en, img, src, workId], i) => ({ kr, en, img, src: src.toUpperCase(), no: 'F—' + String(i + 1).padStart(2, '0'), open: () => WORKS.some(w => w.id === workId) ? this.nav('detail', { workId }) : this.nav('works') })),
      faqs: [
        ['최소 주문 수량이 있나요?', '품목과 인쇄 방식에 따라 달라요. 원하시는 수량을 알려주시면 가능한 방법과 단가를 함께 안내해 드립니다.'],
        ['제작 기간은 얼마나 걸리나요?', '사양이 정해진 뒤 품목, 수량, 후가공에 따라 달라져요. 희망 납기를 알려주시면 일정에 맞출 수 있는지 먼저 확인해 드립니다.'],
        ['샘플을 먼저 받아볼 수 있나요?', '본 생산 전에 형태와 색을 확인하는 방법을 품목에 맞춰 안내해 드려요. 가능 여부와 비용은 사양에 따라 달라집니다.'],
        ['디자인 파일만 있어도 제작할 수 있나요?', '가지고 계신 디자인 파일로 인쇄와 제작만 진행할 수 있어요. 인쇄용 데이터 점검과 보완이 필요하면 함께 도와드립니다.'],
        ['디자인부터 맡길 수 있나요?', '기획과 디자인부터 함께해요. 제품 제안 및 개발, 디자인 및 브랜딩, 패키지 제작까지 한 곳에서 진행합니다.'],
      ].map(([q, a], i) => ({ q, a, no: String(i + 1).padStart(2, '0'), open: s.faq === i, closed: s.faq !== i, sign: s.faq === i ? '−' : '+', toggle: () => this.setState(st => ({ faq: st.faq === i ? null : i })) })),
      isNarrow: (s.vw || 1200) < 760, isWide: (s.vw || 1200) >= 760,
      menuOpen: !!s.menuOpen && (s.vw || 1200) < 760,
      openMenu: () => this.setState({ menuOpen: true }), closeMenu: () => this.setState({ menuOpen: false }),
      featured: allWorks.slice(0, 7).map((w, k) => { const img = w.cover; return {
        href: w.href, id: w.id, n: w.id, brand: w.brand, itemsKr: w.itemsKr, img, open: w.open, card: w.dark ? '#141413' : '#E4DFD5', yOff: k % 2 ? '8vh' : '-6vh',
      }; }),
      isTypeHero: (this.props.heroStyle || 'type') === 'type', isLogoHero: this.props.heroStyle === 'logo',
      winRef: this.winRef, leftRef: this.leftRef, rightRef: this.rightRef,
      heroRef: this.heroRef, svgRef: this.svgRef, clipRef: this.clipRef, inkRef: this.inkRef, fullRef: this.fullRef,
      metaRef: this.metaRef, capRef: this.capRef, marqRef: this.marqRef, previewRef: this.previewRef,
      totalCount: String(WORKS.length),
      allWorks, worksList, filters, visibleCount: String(worksList.length).padStart(2, '0'),
      isGrid: view === 'grid', isIndex: view === 'index',
      gridLine: view === 'grid' ? '#1A1915' : 'transparent', gridColor: view === 'grid' ? '#1A1915' : '#66625A',
      indexLine: view === 'index' ? '#1A1915' : 'transparent', indexColor: view === 'index' ? '#1A1915' : '#66625A',
      setGrid: () => this.setState({ view: 'grid' }), setIndex: () => this.setState({ view: 'index' }),
      previewOp: s.hover ? 1 : 0,
      onIndexMove: e => { const el = this.previewRef.current; if (el) el.style.transform = `translate(${e.clientX + 28}px, ${e.clientY - 180}px)`; },
      onIndexLeave: () => this.setState({ hover: null }),
      specRows: Object.entries(work.specs || {}).filter(([, v]) => v).map(([k, v]) => ({ k: ({ size: 'SIZE', paper: 'PAPER', print: 'PRINT', finish: 'FINISH', qty: 'QUANTITY', year: 'YEAR' })[k] || k.toUpperCase(), v })),
      work, next, chapters, th: work.dark ? DARK : LIGHT,
      clients: CLIENTS,
      lines: LINES.map((l, i) => ({ ...l, no: String(i + 1).padStart(2, '0') })),
      range: RANGE.map((r, i) => ({
        ...r, no: String(i + 1).padStart(2, '0'),
        cursor: r.key ? 'pointer' : 'default',
        link: r.key ? `관련 작업 ${WORKS.filter(w => w.types.includes(r.key)).length}건 →` : '',
        go: r.key ? () => this.nav('works', { filter: r.key }) : undefined,
      })),
      form: s.form, set, sent: s.sent, notSent: !s.sent, receiptId: s.receiptId || '',
      itemOpts: ITEMS.map(l => ({ label: l, active: s.items.includes(l), inactive: !s.items.includes(l), toggle: () => this.setState(st => ({ items: st.items.includes(l) ? st.items.filter(x => x !== l) : [...st.items, l] })) })),
      budgetOpts: ['300만원 미만', '300 – 1,000만원', '1,000 – 3,000만원', '3,000만원 이상', '미정'].map(l => ({ label: l, active: s.budget === l, inactive: s.budget !== l, pick: () => this.setState({ budget: l }) })),
      onFiles: e => selectFiles(this, e),
      fileLabel: (s.files && s.files.length) ? (s.files.length > 2 ? `${s.files.slice(0, 2).map(f => f.name).join(', ')} 외 ${s.files.length - 2}개` : s.files.map(f => f.name).join(', ')) : '선택된 파일 없음',
      onConsent: e => { const v = e.target.checked; this.setState(st => ({ form: { ...st.form, consent: v } })); },
      togglePriv: () => this.setState(st => ({ privOpen: !st.privOpen })),
      privOpen: !!s.privOpen, privLabel: s.privOpen ? '내용 접기' : '수집 항목 · 목적 · 보유 기간 보기',
      qtyOpts: QTY.map(l => ({ label: l, active: s.qty === l, inactive: s.qty !== l, pick: () => this.setState({ qty: l }) })),
      submit: e => submitInquiry(this, e),
      submitting: !!s.submitting, submitLabel: s.submitting ? "전송 중…" : "문의 보내기",
      formErr: s.formErr || '', hasErr: !!s.formErr,
      resetForm: () => { this.inquiryAttempt = null; this.setState({ sent: false, form: { ...EMPTY }, items: [], qty: '', budget: '', files: [], privOpen: false, formErr: '', receiptId: '' }); },
      toTop: () => { const se = document.scrollingElement || document.documentElement; se.scrollTo ? se.scrollTo({ top: 0, behavior: 'smooth' }) : (se.scrollTop = 0); },
    };
  }
}


