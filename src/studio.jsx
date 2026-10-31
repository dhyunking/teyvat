import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowLeft, Plus, Search, Grid2X2, ImagePlus, UploadCloud, X, Check, LoaderCircle, LogOut, Eye, Send, Save, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, GripVertical, Trash2, Images, LockKeyhole, ShieldCheck, CircleHelp, AlertCircle, ExternalLink, Monitor, Smartphone, KeyRound } from 'lucide-react';
import { optimizePhoto, photoUrl } from './studio-images.js';

const CATEGORIES = { bag: '쇼핑백', carton: '단상자', rigid: '싸바리', magnetic: '표지바리', assembled: '조립박스', corrugated: '골판지 박스', print: '인쇄물', etc: '기타' };
const LAYOUTS = { w: '전체 폭', h: '2열', t: '3열', c: '가운데' };
const emptyWork = () => ({ id: '', brand: '', itemsKr: '', itemsEn: '', types: [], desc: '', descEn: '', cover: '', hero: '', dark: false, chapters: [] });
const countPhotos = work => new Set([work.cover, work.hero, ...(work.chapters || []).flatMap(c => c.imgs.map(i => i.src))].filter(Boolean)).size;
const timeLabel = timestamp => timestamp ? new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp) : '';
const clone = value => structuredClone(value);
function recoveredDrafts(existing) {
  const result = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const name = localStorage.key(i);
      if (!name?.startsWith('teyvat.recovery.')) continue;
      const key = name.slice('teyvat.recovery.'.length), value = JSON.parse(localStorage.getItem(name));
      if (value?.at < Date.now() - 7 * 86400000) { localStorage.removeItem(name); continue; }
      if (!/^[0-9a-f-]{36}$/.test(key) || !value?.work || existing.some(d => d.key === key)) continue;
      result.push({ key, work: value.work, originalId: value.originalId || null, version: 0, placement: value.placement || 'first', updatedAt: value.at, recovered: true });
    }
  } catch {}
  return result;
}
function Mark({ light = false }) { return <div className={'brand-mark' + (light ? ' light' : '')}><span>TEYVAT<span className="brand-dot">.</span></span><small>STUDIO</small></div>; }
function IconButton({ label, children, ...props }) { return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>; }
function Button({ children, primary, ghost, ...props }) { return <button type="button" className={'button ' + (primary ? 'primary' : ghost ? 'ghost' : '')} {...props}>{children}</button>; }
function useDialogFocus(active, close) {
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...document.querySelectorAll('.modal-backdrop:last-of-type button:not(:disabled), .modal-backdrop:last-of-type input:not(:disabled), .modal-backdrop:last-of-type iframe')];
    const timer = setTimeout(() => controls()[0]?.focus(), 0);
    const key = event => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    addEventListener('keydown', key);
    return () => { clearTimeout(timer); removeEventListener('keydown', key); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [active]);
}

function Preview({ work, full = false, mobile = false }) {
  const frame = useRef(), wrap = useRef(), latest = useRef(work), ready = useRef(false);
  const [width, setWidth] = useState(450);
  latest.current = work;
  const send = () => { if (ready.current && latest.current.cover) frame.current?.contentWindow?.postMessage({ type: 'teyvat:preview', work: clone(latest.current) }, location.origin); };
  useEffect(() => {
    const listener = event => { if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'teyvat:preview-ready') { ready.current = true; send(); } };
    addEventListener('message', listener);
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (wrap.current) observer.observe(wrap.current);
    return () => { removeEventListener('message', listener); observer.disconnect(); };
  }, []);
  useEffect(() => { const timer = setTimeout(send, 450); return () => clearTimeout(timer); }, [work]);
  const target = mobile ? 390 : 1200, scale = full ? Math.min(1, width / target) : width / target;
  return <div ref={wrap} className={'site-preview ' + (full ? 'full' : '')}>
    {work.cover ? <iframe ref={frame} title="홈페이지 상세 페이지 미리보기" src="/admin/preview" onLoad={() => { ready.current = true; send(); }} style={{ width: target, height: full ? `calc((100vh - 145px) / ${scale})` : 1550, transform: `scale(${scale})`, marginLeft: full && width > target ? (width - target) / 2 : 0 }} /> : <div className="empty-preview"><Images size={36} strokeWidth={1.3} /><strong>작업물이 여기에 완성돼요</strong><p>사진을 올리면 홈페이지에 표시될<br />모습을 바로 확인할 수 있습니다.</p></div>}
  </div>;
}

function Login({ setupToken, onLogin, api }) {
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (setupToken && password !== confirm) { setError('두 비밀번호가 일치하지 않습니다.'); return; }
    setBusy(true);
    try { const result = await api(setupToken ? 'setup' : 'login', { password, ...(setupToken ? { token: setupToken } : {}) }); setPassword(''); setConfirm(''); onLogin(result); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="login-screen">
    <section className="login-story"><Mark light /><div className="login-story-copy"><span className="eyebrow">THE NEXT CHAPTER</span><h1>새로운 작업을,<br />가장 좋은 모습으로.</h1><p>좋은 패키지에 담긴 이야기를<br />사진과 함께 차곡차곡 기록하세요.</p></div><div className="login-photo"><img src="/assets/web/jade/box-03.webp" alt="TEYVAT이 제작한 제이드팰리스 패키지" /><span>DESIGNED & MADE BY TEYVAT</span></div><small className="login-foot">TEYVAT D&P · WORKSPACE</small></section>
    <section className="login-form-area"><a href="/" className="back-site"><ArrowUpRight size={15} /> 홈페이지 보기</a><div className="login-form-inner"><div className="login-symbol"><LockKeyhole size={25} strokeWidth={1.5} /></div><span className="eyebrow">WELCOME TO YOUR STUDIO</span><h2>{setupToken ? '관리자 비밀번호 설정' : '작업실에 오신 것을 환영해요'}</h2><p>{setupToken ? '앞으로 작업물을 관리할 때 사용할 비밀번호를 정해 주세요.' : '사진과 이야기를 올리고, 홈페이지를 업데이트하세요.'}</p><form onSubmit={submit}>
      <label>관리자 비밀번호<div className="password-wrap"><input type={visible ? 'text' : 'password'} autoComplete={setupToken ? 'new-password' : 'current-password'} minLength={setupToken ? 12 : undefined} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} placeholder={setupToken ? '12자 이상의 비밀번호' : '비밀번호를 입력해 주세요'} autoFocus /><IconButton label={visible ? '비밀번호 숨기기' : '비밀번호 표시'} onClick={() => setVisible(!visible)}><Eye size={17} /></IconButton></div></label>
      {setupToken && <label>비밀번호 확인<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="한 번 더 입력해 주세요" /></label>}
      {error && <div className="error-note" role="alert"><AlertCircle size={16} />{error}</div>}
      <button className="button primary login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUpRight size={18} />}{setupToken ? '비밀번호 설정하고 시작하기' : '로그인'}</button>
    </form><div className="secure-note"><ShieldCheck size={15} /> 관리자만 접근할 수 있는 공간입니다.</div></div><span className="login-bottom">TEYVAT STUDIO</span></section>
  </main>;
}

function WorkCard({ item, onOpen, onDiscard, activeJob }) {
  const work = item.draft?.work || item.work, busy = activeJob && !['ready', 'failed'].includes(activeJob.status) && activeJob.workId === work.id;
  return <article className="work-card">
    <button className="work-card-open" onClick={onOpen} aria-label={`${work.brand || '새 작업물'} 편집`}>
      <div className="work-card-image">{work.cover ? <img src={photoUrl(work.cover)} alt={work.brand || '임시 저장 대표 사진'} loading="lazy" /> : <div className="no-cover"><ImagePlus size={34} strokeWidth={1.2} /><span>사진을 추가해 주세요</span></div>}
        <span className={'work-status ' + (busy ? 'posting' : item.draft ? 'draft' : '')}>{busy ? <><LoaderCircle size={12} className="spin" /> 게시 중</> : item.draft ? '임시 저장' : '공개 중'}</span>
        <span className="card-open-label">작업물 편집 <ArrowUpRight size={17} /></span>
      </div><div className="work-card-copy"><div><h3>{work.brand || '제목 없는 작업물'}</h3><p>{work.itemsKr || '제작 품목을 입력해 주세요'}</p></div><span className="card-arrow"><ArrowUpRight size={19} /></span></div>
    </button><div className="work-card-meta"><span>{(work.types || []).slice(0, 2).map(t => CATEGORIES[t]).join(' · ') || '작성 중'}</span><span><Images size={13} /> {countPhotos(work)}</span>{item.draft && <IconButton label="임시 저장 삭제" onClick={onDiscard}><Trash2 size={14} /></IconButton>}</div>
  </article>;
}

function Editor({ initial, api, onBack, onPosted, notify, readyToPublish, busySite }) {
  const [work, setWork] = useState(clone(initial.work)), [placement, setPlacement] = useState(initial.placement || (initial.originalId ? 'keep' : 'first'));
  const [saveState, setSaveState] = useState('saved'), [savedAt, setSavedAt] = useState(initial.updatedAt), [queue, setQueue] = useState([]), [section, setSection] = useState(-1);
  const [advanced, setAdvanced] = useState(false), [preview, setPreview] = useState(false), [mobile, setMobile] = useState(false), [confirmPublish, setConfirmPublish] = useState(false), [publishing, setPublishing] = useState(false), [dropOver, setDropOver] = useState(false);
  const [recovery, setRecovery] = useState(() => { try { return JSON.parse(localStorage.getItem('teyvat.recovery.' + initial.key)); } catch { return null; } });
  const input = useRef(), current = useRef(), draft = useRef(clone(initial)), sequence = useRef(0), savedSequence = useRef(0), saving = useRef(null), dragging = useRef(), requestId = useRef(), sectionRef = useRef(section), queueRef = useRef(queue);
  current.current = { work, placement }; sectionRef.current = section; queueRef.current = queue;
  const uploadBusy = queue.some(q => ['waiting', 'uploading'].includes(q.state)), uploadErrors = queue.some(q => q.state === 'error');
  useDialogFocus(preview || confirmPublish, () => { if (!publishing) { setPreview(false); setConfirmPublish(false); } });
  function change(update) { sequence.current++; setSaveState('unsaved'); setWork(value => typeof update === 'function' ? update(value) : { ...value, ...update }); }
  function changePlacement(value) { sequence.current++; setSaveState('unsaved'); setPlacement(value); }
  async function persist(force = false) {
    if (saving.current) { await saving.current; if (savedSequence.current !== sequence.current) return persist(); return draft.current; }
    if (!force && savedSequence.current === sequence.current && draft.current.version > 0) return draft.current;
    const captured = sequence.current, snapshot = clone(current.current);
    setSaveState('saving');
    saving.current = (async () => {
      try {
        const result = await api('draft', { key: draft.current.key, originalId: draft.current.originalId, version: draft.current.version, ...snapshot });
        draft.current = result; savedSequence.current = captured; setSavedAt(result.updatedAt);
        setWork(value => ({ ...value, id: result.work.id }));
        if (captured === sequence.current) { setSaveState('saved'); localStorage.removeItem('teyvat.recovery.' + initial.key); }
        else setSaveState('unsaved');
        return result;
      } catch (e) { setSaveState('error'); throw e; } finally { saving.current = null; }
    })();
    return saving.current;
  }
  useEffect(() => {
    if (sequence.current === savedSequence.current) return;
    try { localStorage.setItem('teyvat.recovery.' + initial.key, JSON.stringify({ ...current.current, originalId: draft.current.originalId, at: Date.now() })); } catch {}
    const timer = setTimeout(() => { persist().catch(e => notify(e.message, true)); }, 1600);
    return () => clearTimeout(timer);
  }, [work, placement]);
  useEffect(() => {
    const leave = event => { if (sequence.current !== savedSequence.current || queueRef.current.some(q => ['waiting', 'uploading'].includes(q.state))) { event.preventDefault(); event.returnValue = ''; } };
    const keys = event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); persist(true).catch(e => notify(e.message, true)); } if (event.key === 'Escape') { setPreview(false); setConfirmPublish(false); } };
    addEventListener('beforeunload', leave); addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', leave); removeEventListener('keydown', keys); };
  }, []);
  async function back() { if (uploadBusy) return notify('사진 업로드가 끝나면 돌아갈 수 있습니다.'); try { if (sequence.current !== savedSequence.current) await persist(); onBack(); } catch (e) { notify(e.message, true); } }
  async function processPhoto(job) {
    setQueue(value => value.map(q => q.id === job.id ? { ...q, state: 'uploading' } : q));
    try {
      const photo = await optimizePhoto(job.file);
      const result = await api('upload', { id: job.id, data: photo.data });
      change(previous => {
        const next = clone(previous); if (!next.chapters.length) next.chapters.push({ kr: '작업 사진', en: 'Gallery', imgs: [] });
        const index = sectionRef.current >= 0 && sectionRef.current < next.chapters.length ? sectionRef.current : 0;
        const first = next.chapters.every(c => !c.imgs.length);
        next.chapters[index].imgs.push({ src: result.path, size: first ? 'w' : photo.layout });
        next.cover ||= result.path; next.hero ||= result.path; return next;
      });
      setQueue(value => value.map(q => q.id === job.id ? { ...q, state: 'done', file: null } : q));
    } catch (e) { setQueue(value => value.map(q => q.id === job.id ? { ...q, state: 'error', message: e.message } : q)); }
  }
  async function enqueue(files) {
    const selected = Array.from(files);
    if (countPhotos(current.current.work) + selected.length > 60) return notify('한 작업물에는 사진을 최대 60장까지 등록할 수 있습니다.', true);
    const jobs = selected.map(file => ({ id: crypto.randomUUID(), file, name: file.name, state: 'waiting' }));
    setQueue(value => [...value, ...jobs]);
    for (const job of jobs) await processPhoto(job);
  }
  const photos = (work.chapters || []).flatMap((c, si) => c.imgs.map((p, index) => ({ ...p, section: si, index, title: c.kr })));
  const extras = [...new Set([work.cover, work.hero].filter(Boolean))].filter(src => !photos.some(p => p.src === src)).map((src, index) => ({ src, section: -1, index, size: 'h', title: '대표·상단 사진' }));
  const shown = section === -1 ? [...extras, ...photos] : photos.filter(p => p.section === section);
  function cover(src) { change(previous => ({ ...previous, cover: src, hero: !previous.hero || previous.hero === previous.cover ? src : previous.hero })); }
  function remove(photo) { change(previous => { const next = clone(previous); if (photo.section >= 0) next.chapters[photo.section].imgs.splice(photo.index, 1); const available = next.chapters.flatMap(c => c.imgs).find(p => p.src !== photo.src)?.src || ''; if (next.cover === photo.src) next.cover = available; if (next.hero === photo.src) next.hero = next.cover; return next; }); }
  function reorder(from, to) {
    if (!from || from.section < 0 || to.section < 0 || from.section === to.section && from.index === to.index) return;
    change(previous => { const next = clone(previous), [photo] = next.chapters[from.section].imgs.splice(from.index, 1); next.chapters[to.section].imgs.splice(to.index, 0, photo); return next; });
  }
  async function publish() {
    if (uploadBusy || uploadErrors) return notify('사진 업로드를 완료하거나 실패한 사진을 목록에서 지워 주세요.', true);
    if (!work.brand.trim() || !work.desc.trim() || !work.itemsKr.trim() || !work.types.length || !work.cover) return notify('브랜드명, 제작 품목·종류, 작업 설명과 대표 사진을 입력해 주세요.', true);
    setPublishing(true);
    try { const saved = await persist(true); requestId.current ||= crypto.randomUUID(); const job = await api('publish', { key: saved.key, version: saved.version, requestId: requestId.current }); setConfirmPublish(false); onPosted(job); }
    catch (e) { if ([400, 409].includes(e.status)) requestId.current = null; notify(e.message, true); if (requestId.current) { try { const job = await api('job&id=' + requestId.current); onPosted(job); } catch {} } }
    finally { setPublishing(false); }
  }
  const saveLabels = { saved: '임시 저장됨', saving: '저장 중', unsaved: '변경 내용 있음', error: '저장하지 못했어요' };
  return <>
    <header className="studio-toolbar editor-toolbar"><button className="back-button" onClick={back}><ArrowLeft size={18} /> 작업물 목록</button><span className={'save-state ' + saveState} role="status">{saveState === 'saving' ? <LoaderCircle className="spin" size={14} /> : saveState === 'saved' ? <Check size={14} /> : <span className="status-dot" />}{saveLabels[saveState]}</span><div className="toolbar-actions"><Button onClick={() => setPreview(true)}><Eye size={16} /><span>미리보기</span></Button><Button disabled={saveState === 'saving' || publishing} onClick={() => persist(true).then(() => notify('임시 저장했습니다.')).catch(e => notify(e.message, true))}><Save size={16} /><span>임시 저장</span></Button><Button primary disabled={publishing || uploadBusy || uploadErrors || busySite || !readyToPublish} onClick={() => setConfirmPublish(true)}><Send size={16} /><span>{publishing ? '게시 요청 중' : '게시하기'}</span></Button></div></header>
    <div className="editor-layout"><div className="editor-main">
      {recovery && <div className="recovery-banner"><AlertCircle size={17} /><span>저장하지 못한 변경 내용이 있습니다.</span><button onClick={() => { sequence.current++; setWork(recovery.work); setPlacement(recovery.placement); setSaveState('unsaved'); setRecovery(null); }}>복구하기</button><IconButton label="복구 안내 닫기" onClick={() => { localStorage.removeItem('teyvat.recovery.' + initial.key); setRecovery(null); }}><X size={15} /></IconButton></div>}
      <div className="editor-heading"><span className="eyebrow">{initial.originalId ? 'EDIT PROJECT' : 'NEW PROJECT'}</span><label className="brand-input-label"><span className="sr-only">브랜드명</span><input className="brand-input" aria-label="브랜드명" maxLength={140} placeholder="어떤 브랜드의 작업인가요?" value={work.brand} onChange={e => change({ brand: e.target.value })} /></label><p>사진에 이야기를 더해, 새로운 작업을 소개해 주세요.</p></div>
      <section className="editor-section"><div className="section-heading"><h2>작업 사진 <span>{countPhotos(work)}</span></h2><Button ghost onClick={() => input.current.click()}><Plus size={16} /> 사진 추가</Button></div>
        <input ref={input} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple aria-label="작업 사진 업로드" onChange={e => { enqueue(e.target.files); e.target.value = ''; }} />
        <div className={'upload-zone ' + (dropOver ? 'over' : '') + (shown.length ? ' compact' : '')} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropOver(true); } }} onDragLeave={() => setDropOver(false)} onDrop={e => { e.preventDefault(); setDropOver(false); if (e.dataTransfer.files.length) enqueue(e.dataTransfer.files); }}>
          <button onClick={() => input.current.click()}><span className="upload-symbol"><UploadCloud size={28} strokeWidth={1.5} /></span><span><strong>{shown.length ? '사진을 더 추가해 보세요' : '여러 장의 사진을 여기에 놓아주세요'}</strong><span>끌어다 놓거나 <u>파일 선택</u> · 한 번에 여러 장을 올릴 수 있어요</span><small>JPG · PNG · WEBP · AVIF / 웹에 맞게 크기와 용량을 자동으로 줄여요</small></span></button>
        </div>
        {queue.some(q => q.state !== 'done') && <div className="upload-queue" aria-live="polite">{queue.filter(q => q.state !== 'done').map(q => <div key={q.id} className={q.state === 'error' ? 'error' : ''}>{q.state === 'error' ? <AlertCircle size={16} /> : <LoaderCircle size={16} className="spin" />}<span><strong>{q.name}</strong><small>{q.state === 'error' ? q.message : q.state === 'waiting' ? '업로드 대기 중' : '사진 최적화·업로드 중'}</small></span>{q.state === 'error' && <><button onClick={() => processPhoto(q)}>다시 시도</button><IconButton label={`${q.name} 업로드 취소`} onClick={() => setQueue(value => value.filter(x => x.id !== q.id))}><X size={15} /></IconButton></>}</div>)}</div>}
        {work.chapters.length > 1 && <div className="section-tabs"><button className={section === -1 ? 'selected' : ''} onClick={() => setSection(-1)}>전체 사진</button>{work.chapters.map((c, i) => <button key={i} className={section === i ? 'selected' : ''} onClick={() => setSection(i)}>{c.kr || `섹션 ${i + 1}`}</button>)}</div>}
        <div className="photo-grid">{shown.map(photo => <div key={`${photo.section}-${photo.index}-${photo.src}`} className={'photo-card ' + (work.cover === photo.src ? 'is-cover' : '')} draggable={photo.section >= 0} onDragStart={e => { dragging.current = photo; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', photo.src); }} onDragOver={e => { if (dragging.current && !e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (dragging.current) { e.preventDefault(); reorder(dragging.current, photo); dragging.current = null; } }} onDragEnd={() => { dragging.current = null; }}>
          <img src={photoUrl(photo.src)} alt={`${work.brand || '새 작업물'} ${photo.index + 1}번 사진`} draggable={false} loading="lazy" />
          <div className="photo-badges">{work.cover === photo.src && <span className="cover-badge"><Star size={11} fill="currentColor" /> 대표 사진</span>}{work.hero === photo.src && work.hero !== work.cover && <span>상단 사진</span>}</div>
          <div className="photo-tools"><IconButton label="대표 사진으로 선택" onClick={() => cover(photo.src)}><Star size={15} fill={work.cover === photo.src ? 'currentColor' : 'none'} /></IconButton><IconButton label="사진 삭제" onClick={() => remove(photo)}><Trash2 size={15} /></IconButton></div>
          <div className="photo-footer"><span>{photo.section < 0 ? '대표·상단용' : <><GripVertical size={13} />{String(photo.index + 1).padStart(2, '0')}</>}</span>{photo.section >= 0 && <div><IconButton label="사진 앞으로 이동" disabled={photo.index === 0} onClick={() => reorder(photo, { ...photo, index: photo.index - 1 })}><ChevronLeft size={14} /></IconButton><IconButton label="사진 뒤로 이동" disabled={photo.index === work.chapters[photo.section].imgs.length - 1} onClick={() => reorder(photo, { ...photo, index: photo.index + 1 })}><ChevronRight size={14} /></IconButton></div>}</div>
          {advanced && photo.section >= 0 && <select aria-label={`${photo.index + 1}번 사진 배치`} value={photo.size} onChange={e => change(previous => { const next = clone(previous); next.chapters[photo.section].imgs[photo.index].size = e.target.value; return next; })}>{Object.entries(LAYOUTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}
        </div>)}</div>
        {shown.length > 0 && <div className="photo-tip"><GripVertical size={14} /> 사진을 끌어서 순서를 바꾸고, 별표로 대표 사진을 선택하세요.</div>}
      </section>
      <section className="editor-section details-section"><div className="section-heading"><h2>작업 이야기</h2><span className="required-note">필수 정보</span></div><label>무엇을 제작했나요?<input aria-label="제작 품목" maxLength={300} value={work.itemsKr} onChange={e => change({ itemsKr: e.target.value })} placeholder="예: 쇼핑백 · 선물 박스 · 카드" /></label><fieldset className="category-field"><legend>제작 종류 <small>여러 개 선택할 수 있어요</small></legend><div>{Object.entries(CATEGORIES).map(([key, label]) => <button key={key} type="button" aria-pressed={work.types.includes(key)} className={work.types.includes(key) ? 'selected' : ''} onClick={() => change({ types: work.types.includes(key) ? work.types.filter(t => t !== key) : [...work.types, key] })}>{work.types.includes(key) && <Check size={13} />}{label}</button>)}</div></fieldset><label>작업 설명<textarea aria-label="작업 설명" maxLength={5000} rows={5} value={work.desc} onChange={e => change({ desc: e.target.value })} placeholder="어떤 브랜드를 위해, 어떤 제품을 만들었나요? 소재나 후가공 등 이 작업만의 특징을 소개해 주세요." /><span className="field-help">홈페이지 상세 페이지와 검색 결과의 설명으로 사용됩니다.</span></label></section>
      <section className="advanced-section"><button className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><span><SlidersHorizontal size={17} /> 추가 설정 <small>영문 · 사진 배치 · 홈페이지 표시 위치</small></span>{advanced ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>{advanced && <div className="advanced-content"><label>제작 품목 (영문)<input value={work.itemsEn} maxLength={400} onChange={e => change({ itemsEn: e.target.value })} placeholder="비워 두면 국문을 사용합니다" /></label><label>작업 설명 (영문)<textarea rows={3} maxLength={6000} value={work.descEn} onChange={e => change({ descEn: e.target.value })} placeholder="비워 두면 국문을 사용합니다" /></label><label className="check-label"><input type="checkbox" checked={work.dark} onChange={e => change({ dark: e.target.checked })} /><span>상세 페이지에 어두운 배경 사용</span></label><label>홈페이지 표시 위치<select value={placement} onChange={e => changePlacement(e.target.value)}>{initial.originalId && <option value="keep">현재 위치 유지</option>}<option value="first">맨 앞에 표시 · 메인 페이지에도 표시</option><option value="last">맨 뒤에 표시</option></select></label><label>상세 페이지 상단 사진<select value={work.hero || work.cover} onChange={e => change({ hero: e.target.value })}>{[...new Set([work.cover, work.hero, ...photos.map(p => p.src)].filter(Boolean))].map((src, i) => <option key={src} value={src}>사진 {i + 1}{src === work.cover ? ' · 대표 사진' : ''}</option>)}</select></label><div className="advanced-section-label">사진 섹션</div>{work.chapters.map((c, i) => <div className="chapter-fields" key={i}><label>섹션 {i + 1} 제목<input value={c.kr} onChange={e => change(previous => { const next = clone(previous); next.chapters[i].kr = e.target.value; return next; })} /></label><label>영문 제목<input value={c.en} onChange={e => change(previous => { const next = clone(previous); next.chapters[i].en = e.target.value; return next; })} /></label></div>)}<Button disabled={work.chapters.length >= 12} onClick={() => { change(previous => ({ ...previous, chapters: [...previous.chapters, { kr: '새 섹션', en: '', imgs: [] }] })); setSection(work.chapters.length); }}><Plus size={15} /> 사진 섹션 추가</Button></div>}</section>
      <p className="editor-bottom-note"><LockKeyhole size={13} /> 임시 저장은 관리자에게만 보입니다. 게시하기를 눌러야 홈페이지에 반영돼요.</p>
    </div><aside className="editor-preview"><div className="preview-heading"><span><span className="live-dot" /> LIVE PREVIEW</span><IconButton label="미리보기 크게 보기" onClick={() => setPreview(true)}><ArrowUpRight size={17} /></IconButton></div><Preview work={work} /><div className="preview-caption"><Monitor size={15} /><span>실제 홈페이지와 같은 화면입니다.</span></div><div className="publish-checklist"><h3>게시 전 확인하세요</h3>{[['대표 사진', Boolean(work.cover)], ['브랜드명·제작 품목', Boolean(work.brand.trim() && work.itemsKr.trim())], ['제작 종류·작업 설명', Boolean(work.types.length && work.desc.trim())]].map(([label, done]) => <div key={label}><span className={done ? 'done' : ''}>{done ? <Check size={12} /> : ''}</span>{label}</div>)}<small>{savedAt ? `${timeLabel(savedAt)} 임시 저장` : '사진과 내용을 자유롭게 추가해 보세요.'}</small></div></aside></div>
    {preview && <div className="modal-backdrop"><section className="preview-modal" role="dialog" aria-modal="true" aria-label="상세 페이지 미리보기"><header><div><Eye size={18} /><strong>홈페이지 미리보기</strong><span>게시 전 확인용</span></div><div className="viewport-toggle"><IconButton label="PC 화면" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={17} /></IconButton><IconButton label="모바일 화면" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={17} /></IconButton></div><IconButton label="미리보기 닫기" onClick={() => setPreview(false)}><X size={21} /></IconButton></header><Preview work={work} full mobile={mobile} /></section></div>}
    {confirmPublish && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><span className="confirm-icon"><Send size={23} /></span><h2 id="publish-title">홈페이지에 게시할까요?</h2><p>임시 저장된 내용을 공개합니다.<br />반영이 끝나면 완료 상태를 알려드릴게요.</p><div className="confirm-work">{work.cover && <img src={photoUrl(work.cover)} alt="게시할 작업물 대표 사진" />}<div><strong>{work.brand || '브랜드명을 입력해 주세요'}</strong><span>사진 {countPhotos(work)}장 · {work.itemsKr || '제작 품목 미입력'}</span></div></div><div className="confirm-actions"><Button disabled={publishing} onClick={() => setConfirmPublish(false)}>계속 편집</Button><Button primary disabled={publishing} onClick={publish}>{publishing ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}홈페이지에 게시</Button></div></section></div>}
  </>;
}

function Studio() {
  const [setupToken, setSetupToken] = useState(() => { const params = new URLSearchParams(location.hash.slice(1)); const token = params.get('setup'); if (token) history.replaceState(null, '', location.pathname); return token; });
  const [auth, setAuth] = useState(null), [catalog, setCatalog] = useState(null), [editor, setEditor] = useState(null), [tab, setTab] = useState('all'), [search, setSearch] = useState(''), [category, setCategory] = useState('all');
  const [toast, setToast] = useState(null), [job, setJob] = useState(null), [help, setHelp] = useState(false), [passwordDialog, setPasswordDialog] = useState(false), [passwords, setPasswords] = useState({ current: '', password: '' }), [initialError, setInitialError] = useState('');
  const csrf = useRef(''), toastTimer = useRef();
  useDialogFocus(help || passwordDialog, () => { setHelp(false); setPasswordDialog(false); });
  const notify = useCallback((message, error = false) => { clearTimeout(toastTimer.current); setToast({ message, error }); toastTimer.current = setTimeout(() => setToast(null), error ? 10000 : 5000); }, []);
  const api = useCallback(async (op, body) => {
    let response;
    try { response = await fetch('/api/admin?op=' + op, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Studio-CSRF': csrf.current }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new Error('네트워크 연결을 확인한 뒤 다시 시도해 주세요.'); }
    let result; try { result = await response.json(); } catch { throw new Error('서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    if (!response.ok) { if (response.status === 401 && !['login', 'setup'].includes(op)) setAuth(false); const error = new Error(result.message || '요청을 완료하지 못했습니다.'); error.status = response.status; throw error; }
    return result;
  }, []);
  const load = useCallback(async () => { const data = await api('catalog'); setCatalog(data); if (data.activeJob && !['ready', 'failed'].includes(data.activeJob.status)) setJob(data.activeJob); return data; }, [api]);
  useEffect(() => { api('session').then(result => { csrf.current = result.csrf || ''; setAuth(result.authenticated); }).catch(e => { setInitialError(e.message); setAuth(false); }); }, []);
  useEffect(() => { if (auth) load().catch(e => notify(e.message, true)); }, [auth]);
  useEffect(() => {
    if (!job || ['ready', 'failed'].includes(job.status)) return;
    const timer = setInterval(async () => {
      try { const next = await api('job&id=' + encodeURIComponent(job.id)); setJob(next); if (next.status === 'ready') { notify('게시가 완료됐습니다. 홈페이지에서 확인해 보세요.'); await load(); } else if (next.status === 'failed') { notify('게시를 완료하지 못했습니다. 기존 홈페이지는 유지되며, 임시 저장한 내용으로 다시 시도할 수 있습니다.', true); await load(); } }
      catch (e) { notify(e.message, true); }
    }, 4500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);
  const loggedIn = result => { csrf.current = result.csrf; setSetupToken(null); setAuth(true); };
  if (auth === null) return <div className="loading-screen"><Mark /><LoaderCircle className="spin" size={25} /><p>작업실을 여는 중입니다.</p></div>;
  if (!auth || setupToken) return <><Login setupToken={setupToken} onLogin={loggedIn} api={api} />{initialError && <div className="toast error" role="alert">{initialError}</div>}</>;
  const activeJob = job && !['ready', 'failed'].includes(job.status) ? job : catalog?.activeJob;
  const busy = Boolean(activeJob && !['ready', 'failed'].includes(activeJob.status)) || catalog?.busy;
  const savedDrafts = catalog?.drafts || [], drafts = [...savedDrafts, ...recoveredDrafts(savedDrafts)], works = catalog?.works || [];
  const entries = tab === 'drafts' ? drafts.map(draft => ({ draft })) : works.map(work => ({ work, draft: drafts.filter(d => d.work.id === work.id).sort((a, b) => b.updatedAt - a.updatedAt)[0] })).concat(tab === 'all' ? drafts.filter(d => !works.some(w => w.id === d.work.id)).map(draft => ({ draft })) : []);
  const filtered = entries.filter(item => { const work = item.draft?.work || item.work; return (!search || [work.brand, work.itemsKr, work.desc].some(x => (x || '').toLowerCase().includes(search.toLowerCase()))) && (category === 'all' || work.types.includes(category)); });
  const newEditor = () => setEditor({ key: crypto.randomUUID(), originalId: null, version: 0, placement: 'first', work: emptyWork(), updatedAt: null });
  const open = item => { if (busy && activeJob?.workId === (item.draft?.work || item.work).id) return notify('게시 중인 작업물은 완료된 뒤 수정할 수 있습니다.'); setEditor(item.draft || { key: crypto.randomUUID(), originalId: item.work.id, version: 0, placement: 'keep', work: clone(item.work), updatedAt: null }); };
  async function discard(draft) { if (!confirm('이 임시 저장을 삭제할까요? 이미 공개된 작업물은 그대로 유지됩니다.')) return; try { if (draft.recovered) localStorage.removeItem('teyvat.recovery.' + draft.key); else await api('discard', { key: draft.key, version: draft.version }); await load(); notify('임시 저장을 삭제했습니다.'); } catch (e) { notify(e.message, true); } }
  return <div className="studio-shell"><aside className="studio-sidebar"><Mark /><div className="workspace-label">YOUR WORKSPACE</div><nav><button className="selected" onClick={() => { if (editor) return notify('편집 화면의 목록 버튼을 사용해 주세요.'); setTab('all'); }}><Grid2X2 size={18} /> 작업물 관리 <span>{works.length}</span></button><button onClick={() => setHelp(true)}><CircleHelp size={18} /> 사용 안내</button></nav><div className="sidebar-site"><small>TEYVAT WEBSITE</small><a href="/" target="_blank" rel="noreferrer">홈페이지 보기 <ArrowUpRight size={16} /></a><p>사진과 이야기가 쌓이는<br />우리의 포트폴리오.</p></div><div className="sidebar-account"><span className="account-avatar">T</span><div><strong>TEYVAT 관리자</strong><small>작업실 관리</small></div><IconButton label="계정 설정" onClick={() => setPasswordDialog(true)}><KeyRound size={16} /></IconButton><IconButton label="로그아웃" onClick={async () => { if (editor) return notify('변경 내용을 저장하고 목록으로 돌아와 주세요.'); try { await api('logout', {}); setAuth(false); setCatalog(null); } catch (e) { notify(e.message, true); } }}><LogOut size={16} /></IconButton></div></aside>
    <main className={'studio-content ' + (editor ? 'editing' : '')}>{editor ? <Editor key={editor.key} initial={editor} api={api} onBack={() => { setEditor(null); load().catch(e => notify(e.message, true)); }} notify={notify} readyToPublish={catalog?.readyToPublish} busySite={busy} onPosted={next => { setJob(next); setEditor(null); load().catch(e => notify(e.message, true)); }} /> : <>
      <header className="studio-toolbar"><div className="breadcrumb"><span>워크스페이스</span><ChevronRight size={13} /><strong>작업물 관리</strong></div><a href="/works" target="_blank" rel="noreferrer" className="toolbar-site-link">공개된 작업물 보기 <ExternalLink size={14} /></a></header>
      <div className="catalog-wrap"><div className="catalog-heading"><div><span className="eyebrow">YOUR WORK, BEAUTIFULLY SHARED</span><h1>작업물 관리<span>{works.length}</span></h1><p>좋은 작업에 담긴 이야기를, 사진과 함께 전해 보세요.</p></div><Button primary onClick={newEditor}><Plus size={19} /> 새 작업물</Button></div>
        {busy && <div className="deploy-banner" role="status"><span className="deploy-symbol"><LoaderCircle size={18} className="spin" /></span><div><strong>홈페이지에 새로운 내용을 반영하고 있어요</strong><p>완료되면 알려드릴게요. 이 창을 닫아도 게시 작업은 계속됩니다.</p></div><a href="/works" target="_blank" rel="noreferrer">홈페이지 보기 <ArrowUpRight size={15} /></a></div>}
        {catalog && !catalog.readyToPublish && <div className="notice-banner"><ShieldCheck size={18} /><span>게시 연결을 준비하고 있습니다. 사진 업로드와 임시 저장부터 시작할 수 있어요.</span></div>}
        <div className="catalog-controls"><div className="catalog-tabs" role="tablist" aria-label="작업물 상태">{[['all', '전체', works.length + drafts.filter(d => !works.some(w => w.id === d.work.id)).length], ['public', '공개 중', works.length], ['drafts', '임시 저장', drafts.length]].map(([key, label, count]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</div><div className="catalog-filters"><div className="search-field"><Search size={16} /><input aria-label="작업물 검색" placeholder="브랜드명, 제작 품목 검색" value={search} onChange={e => setSearch(e.target.value)} />{search && <IconButton label="검색어 지우기" onClick={() => setSearch('')}><X size={14} /></IconButton>}</div><select aria-label="제작 종류 필터" value={category} onChange={e => setCategory(e.target.value)}><option value="all">모든 제작 종류</option>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
        {!catalog ? <div className="catalog-loading"><LoaderCircle className="spin" size={22} /><span>작업물을 불러오는 중입니다.</span><Button onClick={() => load().catch(e => notify(e.message, true))}>다시 불러오기</Button></div> : filtered.length ? <div className="work-grid">{filtered.map(item => <WorkCard key={item.draft?.key || item.work.id} item={item} onOpen={() => open(item)} onDiscard={() => discard(item.draft)} activeJob={activeJob} />)}</div> : <div className="empty-catalog"><Search size={35} strokeWidth={1.2} /><h2>{search || category !== 'all' ? '검색 결과가 없습니다' : tab === 'drafts' ? '아직 임시 저장한 작업물이 없어요' : '첫 작업물을 소개해 보세요'}</h2><p>{search || category !== 'all' ? '다른 검색어나 제작 종류로 찾아보세요.' : '사진을 올리고 설명을 더하면 새로운 작업물이 완성됩니다.'}</p><Button onClick={newEditor}><Plus size={16} /> 새 작업물 만들기</Button></div>}
        <footer className="catalog-footer"><span>TEYVAT STUDIO</span><p><LockKeyhole size={12} /> 임시 저장한 내용은 관리자에게만 보입니다.</p></footer>
      </div></>}
    </main>
    {toast && <div className={'toast ' + (toast.error ? 'error' : '')} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={17} /> : <Check size={17} />}<span>{toast.message}</span><IconButton label="알림 닫기" onClick={() => setToast(null)}><X size={15} /></IconButton></div>}
    {help && <div className="modal-backdrop"><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><IconButton label="사용 안내 닫기" onClick={() => setHelp(false)}><X size={19} /></IconButton><span className="eyebrow">A SIMPLE WAY TO SHARE</span><h2 id="help-title">사진으로 시작하고,<br />이야기로 완성하세요.</h2><ol><li><strong>새 작업물을 만드세요</strong><p>여러 사진을 한 번에 올리면 웹에 맞게 자동으로 최적화합니다.</p></li><li><strong>대표 사진과 순서를 정하세요</strong><p>별표로 대표 사진을 선택하고, 사진을 끌거나 이동 버튼으로 순서를 바꿔 주세요.</p></li><li><strong>브랜드와 작업을 소개하세요</strong><p>브랜드명, 제작 품목·종류와 설명을 입력합니다. 영문은 추가 설정에 있어요.</p></li><li><strong>미리보고 게시하세요</strong><p>PC·모바일 미리보기로 확인한 뒤 게시합니다. 임시 저장은 홈페이지에 공개되지 않아요.</p></li></ol><Button primary onClick={() => setHelp(false)}>알겠습니다 <Check size={16} /></Button></section></div>}
    {passwordDialog && <div className="modal-backdrop"><form className="confirm-modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onSubmit={async e => { e.preventDefault(); try { const result = await api('password', passwords); csrf.current = result.csrf; setPasswordDialog(false); setPasswords({ current: '', password: '' }); notify('비밀번호를 변경했습니다.'); } catch (error) { notify(error.message, true); } }}><h2 id="password-title">관리자 비밀번호 변경</h2><label>현재 비밀번호<input type="password" autoComplete="current-password" required value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} /></label><label>새 비밀번호<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="12자 이상" value={passwords.password} onChange={e => setPasswords({ ...passwords, password: e.target.value })} /></label><div className="confirm-actions"><Button onClick={() => setPasswordDialog(false)}>취소</Button><button className="button primary">비밀번호 변경</button></div></form></div>}
  </div>;
}
createRoot(document.getElementById('studio-root')).render(<Studio />);
