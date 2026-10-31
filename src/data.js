import content from '../content/works.json' with { type: 'json' };
import { prepareWorks } from './works.js';
const J = n => `/assets/web/jade/${n}.webp`;
const P = n => `/assets/pdf/${n}.jpg`;
const F = { 4: '2023-06-20_CtsW-H5BcjI', 5: '2023-06-20_CtsW0zFBgT9', 6: '2023-06-20_CtsWAdqhOK9', 7: '2023-06-20_CtsWD8LBwZS', 8: '2023-06-20_CtsWKBkBkEI', 9: '2023-06-20_CtsWOqKB0Um', 10: '2023-06-20_CtsWYfCBn46', 11: '2023-06-20_CtsWpUbhQyI', 12: '2023-06-20_CtsXCDohuVw', 13: '2023-06-20_CtsXMwRBPCc', 14: '2023-06-20_CtsXQtphdO-', 15: '2023-06-20_CtsYh5lBtkU', 16: '2023-06-28_CuBjnJZBVkU', 18: '2023-06-28_CuBkQhmhi3F', 19: '2023-06-28_CuBoAz7hybe', 21: '2023-06-29_CuDtYhzBcIk', 22: '2023-07-11_Cuid5I6h-jL', 23: '2023-07-14_CuqUvkrBWlz', 24: '2023-07-18_Cu0ywojhUSG', 25: '2023-09-04_Cww4aq_Bz3X', 26: '2023-09-04_Cww4svSBd_O', 27: '2023-09-04_Cww4xdQB6l2', 28: '2023-09-13_CxHrVSdBbZW', 29: '2023-09-13_CxHrb13hB2L', 30: '2023-09-13_CxHrg55Bpmd', 31: '2023-09-13_CxHrpunBt_1', 32: '2023-09-13_CxHrueChGe5', 33: '2023-11-01_CzGGZperkrz', 34: '2023-11-01_CzGHUUYryWh', 35: '2023-11-01_CzGIh6ELerq', 36: '2023-11-02_CzIYniSP5uS', 37: '2023-11-02_CzIYpl-vIj0', 38: '2023-11-02_CzIYtBqPWje', 39: '2023-11-02_CzIgzQWvNOO', 40: '2023-11-03_CzK8CRaLSnR', 41: '2023-11-03_CzK8HUzryDA', 42: '2023-12-01_C0Ta5xhLOTG', 43: '2023-12-04_C0ar2NEhMba', 44: '2023-12-04_C0ars5FBjaB', 45: '2023-12-04_C0aryvohIEb', 46: '2024-01-29_C2q7BYOB_vV', 47: '2024-01-29_C2rH4QeBhg-', 48: '2024-01-29_C2rILCQBx-Q', 49: '2024-01-29_C2rQONmrr5p', 50: '2024-01-29_C2rUYIgr66_', 51: '2024-01-30_C2tK-weBPf5', 52: '2024-01-30_C2t_MlGr2PZ', 53: '2024-01-30_C2t_Puer0HP', 54: '2024-01-30_C2t_TT-rZMB', 55: '2024-01-30_C2tnM9phFRf', 57: '2024-01-30_C2tuHoRr2oP', 59: '2025-06-05_DKgEAQxhCFF', 60: '2025-06-05_DKgEP64hTfj' };
const U = (f, n) => `/assets/web/${F[f]}/${String(n).padStart(2, '0')}.webp`;
const UR = (f, a, b) => Array.from({ length: b - a + 1 }, (_, i) => U(f, a + i));
const auto = (paths, leadWide) => {
  const out = []; let rest = paths.slice();
  if (leadWide && rest.length) { out.push([rest[0], 'w']); rest = rest.slice(1); }
  if (rest.length === 1) out.push([rest[0], 'c']);
  else if (rest.length % 2 === 1) rest.forEach((p, i) => out.push([p, i < 3 ? 't' : 'h']));
  else rest.forEach(p => out.push([p, 'h']));
  return out;
};
const TYPES = {
  bag: ['쇼핑백', 'Shopping Bag'], carton: ['단상자', 'Folding Carton'], rigid: ['싸바리', 'Rigid Box'], magnetic: ['표지바리', 'Magnetic Box'],
  assembled: ['조립박스', 'Assembled Box'], corrugated: ['골판지 박스', 'Corrugated Box'], print: ['인쇄물', 'Print'], etc: ['Etc', 'Etc'],
};
const NOTES = {
  bag: '일반형 / 핫멜트 / 지끈 접착 쇼핑백', carton: '단면 / 3면 / 4면 접착 박스 / 창문박스', rigid: '싸바리 상/하', magnetic: '표지바리 자석 박스',
  assembled: 'G형 / Y형 박스', corrugated: '골판지 인쇄 및 합지 박스', print: '포스터 · 리플렛 · 카드 · 봉투', etc: '부직포 파우치 · 비닐포장재 · 틴케이스 등',
};
const W = (o) => o;
const RAW = content.works;
let WORKS = prepareWorks(content);
export function setPreviewWork(input, imageMap = src => src) {
  const [work] = prepareWorks({ works: [input] });
  work.cover = imageMap(work.cover); work.hero = imageMap(work.hero);
  work.chapters.forEach(chapter => chapter.imgs.forEach(image => { image[0] = imageMap(image[0]); }));
  WORKS = [work, ...WORKS.filter(other => other.id !== work.id)];
  return work;
}
const FILTERS = ['all', 'bag', 'carton', 'rigid', 'magnetic', 'assembled', 'corrugated', 'print', 'etc'];
const CLIENTS = ['Jade Palace Golf Club', 'PAN AM', 'Rare Medium Welldone', 'Owlr', 'Sir.LOIN', 'MARBLE NINE', 'minTree', 'SIOWA', 'Knotted', 'YARNNAKARN × STARBUCKS', 'MOKITO', 'Petit Palais', '모락관', 'KKOALAPIE', '선인장 가족 한의원', 'DANDANG', 'K—K Market Festival', 'Famille Mary', 'MilliLiter CentiLiter', 'et', '51오일', 'keatz', 'formule', 'MUWA', 'WHAT a CRISP', 'GELI BUDDY', 'BORED & HUNGRY', 'Organature', '일양약품', 'PHARVIS KOREA'];
const LINES = [
  { kr: '다양한 종이 제품 인쇄', sub: '카탈로그, 브로셔, 포스터, 스티커, 책 등', en: 'Paper print products' },
  { kr: '디자인 및 브랜딩', sub: '패키지 그래픽 · 브랜드 디자인', en: 'Design & branding' },
  { kr: '종이 패키지 제작', sub: '쇼핑백, 박스, 봉투, 포장지 등', en: 'Paper packaging' },
  { kr: '틴케이스 제작', sub: '사각 · 원형 틴케이스', en: 'Tin cases' },
  { kr: '다용도 파우치 제작', sub: '부직포 · 비닐 파우치', en: 'Multi-purpose pouches' },
  { kr: '접착 봉투 및 비닐 포장재', sub: '비닐지퍼백 · 비닐포장재', en: 'Adhesive envelopes & poly packaging' },
];
const RANGE = [
  { key: 'bag', kr: '쇼핑백', en: 'Shopping Bag', sub: '일반형 / 핫멜트 / 지끈 접착 쇼핑백', img: J('bag-02') },
  { key: 'carton', kr: '단상자', en: 'Folding Carton', sub: '단면 / 3면 / 4면 접착 박스 / 창문박스', img: U(13, 1) },
  { key: 'rigid', kr: '싸바리', en: 'Rigid Box', sub: '싸바리 상/하', img: U(15, 1) },
  { key: 'magnetic', kr: '표지바리', en: 'Magnetic Box', sub: '표지바리 자석 박스', img: U(11, 3) },
  { key: 'assembled', kr: '조립박스', en: 'Assembled Box', sub: 'G형 / Y형 박스', img: U(46, 1) },
  { key: 'corrugated', kr: '골판지 박스', en: 'Corrugated Box', sub: '골판지 인쇄 및 합지 박스', img: U(7, 1) },
  { key: 'etc', kr: 'Etc', en: '', sub: '게또바시(PET) / 플라스틱 사출 / 비닐지퍼백 / 비닐포장재 / 부직포 파우치 / 지관통 지함 등', img: U(8, 1) },
];
const ITEMS = ['쇼핑백', '단상자', '싸바리 · 표지바리', '조립박스', '골판지 박스', '인쇄물', '틴케이스 · 파우치', '기타'];
const QTY = ['500개 미만', '500 – 3,000개', '3,000개 이상', '미정'];
const SZ = { w: ['span 6', '16/9'], h: ['span 3', '1/1'], t: ['span 2', '4/5'], c: ['2 / span 4', '1/1'] };
const DARK = { bg: '#121211', fg: '#EEEAE2', mute: '#A8A399', line: 'rgba(238,234,226,.2)', card: '#1E1E1C' };
const LIGHT = { bg: '#EEEAE2', fg: '#1A1915', mute: '#66625A', line: 'rgba(26,25,21,.18)', card: '#E4DFD5' };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eo = t => 1 - Math.pow(1 - t, 3);
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const EMPTY = { company: '', name: '', phone: '', email: '', due: '', message: '', consent: false };
const AX = 64.5, AY = 17;


export { J, P, F, U, UR, auto, TYPES, NOTES, W, RAW, WORKS, FILTERS, CLIENTS, LINES, RANGE, ITEMS, QTY, SZ, DARK, LIGHT, clamp, eo, eio, EMPTY, AX, AY };
