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
const RAW = [
  W({ brand: 'Jade Palace Golf Club', itemsKr: '쇼핑백 · 선물 박스 · 부직포 파우치 · 행택', itemsEn: 'Shopping bags, gift boxes, non-woven pouches, hang tags', types: ['bag', 'corrugated', 'etc'], dark: true, cover: J('bag-02'), hero: J('box-03'),
    desc: '제이드팰리스 골프클럽의 쇼핑백, 선물 박스, 부직포 파우치, 행택을 같은 프레임 패턴과 금색 로고로 맞춘 패키지입니다.',
    descEn: 'Shopping bags, gift boxes, non-woven pouches and hang tags for Jade Palace Golf Club, tied together by one frame pattern and a gold logo.',
    chapters: [
      { en: 'Shopping Bag', kr: '쇼핑백', imgs: [[J('bag-03'), 'w'], [J('bag-02'), 'h'], [J('bag-01'), 'h'], [J('bag-05'), 'w'], [J('bag-04'), 'h'], [J('bag-06'), 'h'], [J('bag-07'), 'h'], [J('bag-08'), 'h']] },
      { en: 'Gift Box', kr: '선물 박스', imgs: [[J('box-04'), 'w'], [J('box-01'), 'h'], [J('box-02'), 'h'], [J('box-05'), 'w']] },
      { en: 'Pouch & Tag', kr: '파우치 · 행택', imgs: [[J('pouch-04'), 'w'], [J('pouch-01'), 'h'], [J('pouch-02'), 'h'], [J('pouch-03'), 'w']] },
    ] }),
  W({ brand: 'PAN AM', itemsKr: '쇼핑백 · 골판지 박스 · 테이프 · 틴케이스 · 파우치', itemsEn: 'Shopping bags, corrugated boxes, tape, tin cases, pouches', types: ['bag', 'corrugated', 'etc'], dark: true, cover: U(6, 3), hero: U(7, 1),
    desc: 'PAN AM의 로고와 블루 컬러를 쇼핑백, 골판지 박스, 포장 테이프, 틴케이스, 비닐 파우치에 적용했습니다.',
    descEn: 'The PAN AM logo and blue carried across shopping bags, corrugated boxes, packing tape, tin cases and poly pouches.',
    chapters: [
      { en: 'Shopping Bag', kr: '쇼핑백', imgs: auto(UR(6, 1, 5), true) },
      { en: 'Corrugated Box', kr: '골판지 박스 · 테이프', imgs: auto([U(7, 5), ...UR(7, 1, 4)], true) },
      { en: 'Tin Case & Pouch', kr: '틴케이스 · 파우치', imgs: auto([U(8, 10), ...UR(8, 1, 9)], true) },
    ] }),
  W({ brand: 'Rare Medium Welldone', itemsKr: '선물 박스 · 인쇄 박스 · 포장지 · 봉투 · 카드 · 라벨', itemsEn: 'Gift boxes, printed boxes, wrapping paper, envelopes, cards, labels', types: ['rigid', 'corrugated', 'print', 'etc'], dark: true, cover: U(33, 1), hero: U(33, 2),
    desc: 'Rare Medium Welldone의 선물 박스, 인쇄 박스, 포장지, 봉투, 카드, 라벨을 붉은 타이포그래피 하나로 묶었습니다.',
    descEn: 'Gift boxes, printed boxes, wrapping paper, envelopes, cards and labels for Rare Medium Welldone, tied together by one red typographic system.',
    chapters: [
      { en: 'Gift Box', kr: '선물 박스', imgs: auto([...UR(33, 1, 3), ...UR(10, 1, 2)]) },
      { en: 'Printed Box', kr: '인쇄 박스', imgs: auto([...UR(36, 1, 3), ...UR(38, 1, 2)]) },
      { en: 'Paper & Label', kr: '포장지 · 봉투 · 라벨', imgs: auto([U(34, 1), ...UR(35, 1, 2), U(37, 1), U(39, 1)], true) },
    ] }),
  W({ brand: 'Owlr', itemsKr: '쇼핑백 · 종이 봉투', itemsEn: 'Shopping bags, paper bag', types: ['bag'], dark: true, cover: U(9, 4), hero: U(9, 2),
    desc: '블루 바탕에 흰 로고를 크게 올린 Owlr의 쇼핑백입니다. 보틀용 세로형을 포함해 여러 크기로 제작했습니다.',
    descEn: 'Owlr shopping bags with a large white logo on blue, made in several sizes including a tall bottle bag.',
    chapters: [{ en: 'Shopping Bag', kr: '쇼핑백', imgs: auto(UR(9, 1, 7)) }, { en: 'Paper Bag', kr: '종이 봉투', imgs: auto(UR(9, 8, 9), true) }] }),
  W({ brand: 'Sir.LOIN', itemsKr: '자석 박스 · 선물 세트 · 카드', itemsEn: 'Magnetic box, gift set, cards', types: ['magnetic'], cover: U(11, 1), hero: U(11, 3),
    desc: '네이비 표지바리 자석 박스와 흰 줄무늬 박스, 카드로 구성한 Sir.LOIN의 선물 세트입니다.',
    descEn: 'A Sir.LOIN gift set: a navy magnetic box, a white striped box and printed cards.',
    chapters: [{ en: 'Gift Set', kr: '선물 세트', imgs: auto(UR(11, 1, 5)) }] }),
  W({ brand: 'MARBLE NINE', itemsKr: '서랍형 싸바리 박스', itemsEn: 'Drawer-style rigid box', types: ['rigid'], cover: U(15, 1), hero: U(15, 1),
    desc: '리본 손잡이를 단 2단 서랍형 싸바리 박스입니다. 뚜껑에 금색 로고를 올렸습니다.',
    descEn: 'A two-drawer rigid box with ribbon pulls and a gold logo on the lid.', chapters: [] }),
  W({ brand: 'minTree', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(42, 1), hero: U(41, 3),
    desc: '짙은 녹색 단상자에 제품 정보를 인쇄한 minTree의 패키지입니다.',
    descEn: 'Deep green folding cartons for minTree with product information printed on every face.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto([U(41, 1), ...UR(40, 1, 2), ...UR(41, 2, 3), ...UR(42, 1, 3)], true) }] }),
  W({ brand: 'SIOWA', itemsKr: '디저트 박스 · 쇼핑백', itemsEn: 'Dessert boxes, shopping bag', types: ['carton', 'bag'], cover: U(30, 1), hero: U(29, 3),
    desc: 'SIOWA(Greeting Dessert)의 디저트 박스와 크라프트 쇼핑백입니다. 흰 박스에는 로고를 형압으로 넣었습니다.',
    descEn: 'Dessert boxes and a kraft shopping bag for SIOWA Greeting Dessert, with the logo embossed on the white box.',
    chapters: [{ en: 'Dessert Box', kr: '디저트 박스', imgs: auto([...UR(28, 1, 3), ...UR(29, 1, 3)], true) }, { en: 'Shopping Bag', kr: '쇼핑백', imgs: auto([U(30, 1)]) }] }),
  W({ brand: 'Knotted — Coffee & Chocolate', itemsKr: '커피 단상자 · 초콜릿 싸바리 박스', itemsEn: 'Coffee cartons, chocolate rigid boxes', types: ['carton', 'rigid'], cover: U(13, 4), hero: U(13, 1),
    desc: '노티드 커피는 단상자로, 초콜릿은 싸바리 상/하 박스로 제작했습니다.', descEn: 'Knotted coffee in folding cartons and chocolate in lid-and-base rigid boxes.',
    chapters: [{ en: 'Coffee', kr: '커피 · 단상자', imgs: auto(UR(13, 1, 5)) }, { en: 'Chocolate', kr: '초콜릿 · 싸바리', imgs: auto([U(50, 1), P('p9-2'), P('p9-3'), P('p9-4'), P('p9-5'), P('p9-6')]) }] }),
  W({ brand: 'Knotted — Goods', itemsKr: '창문 박스 · 조립박스 · 틴케이스 · 파우치', itemsEn: 'Window boxes, assembled boxes, tin cases, pouches', types: ['carton', 'assembled', 'etc'], cover: U(19, 1), hero: U(24, 1),
    desc: '인형을 담는 창문 박스, 버스 모양 조립박스, 틴케이스와 원형 케이스, 파우치까지 노티드 굿즈 패키지입니다.',
    descEn: 'Knotted merchandise packaging: window boxes for plush toys, a bus-shaped assembled box, tin and round cases, and pouches.',
    chapters: [
      { en: 'Window Box', kr: '창문 박스', imgs: auto([U(14, 1), ...UR(16, 1, 2), ...UR(23, 1, 2)]) },
      { en: 'Assembled Box', kr: '조립박스', imgs: auto([U(24, 1), P('p12-2'), P('p12-3'), P('p12-5'), P('p13-2')], true) },
      { en: 'Tin & Case', kr: '틴케이스 · 케이스', imgs: auto([U(12, 1), ...UR(19, 1, 3), U(22, 1)]) },
      { en: 'Pouch', kr: '파우치', imgs: auto(UR(16, 3, 4)) },
    ] }),
  W({ brand: 'YARNNAKARN × STARBUCKS', itemsKr: '크라프트 박스 · 내부 칸막이', itemsEn: 'Kraft boxes with inserts', types: ['corrugated'], cover: U(53, 1), hero: U(54, 1),
    desc: '얀나칸과 스타벅스 협업 머그·피처를 담는 크라프트 박스입니다. 내부에 제품을 고정하는 칸막이를 넣었습니다.',
    descEn: 'Kraft boxes for the YARNNAKARN × STARBUCKS mugs and pitchers, with inserts that hold each piece in place.',
    chapters: [{ en: 'Kraft Box', kr: '크라프트 박스', imgs: auto([U(53, 1), ...UR(54, 1, 2), ...UR(52, 1, 2)]) }] }),
  W({ brand: 'MOKITO', itemsKr: '걸이형 단상자', itemsEn: 'Hanging folding cartons', types: ['carton'], cover: U(45, 1), hero: U(43, 1),
    desc: '매장 진열용 걸이 구멍을 낸 MOKITO의 단상자입니다.', descEn: 'Folding cartons for MOKITO with a hang tab for retail display.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto([...UR(43, 1, 2), U(44, 1), U(45, 1)]) }] }),
  W({ brand: 'Petit Palais', itemsKr: '단상자', itemsEn: 'Folding carton', types: ['carton'], cover: U(49, 2), hero: U(49, 3),
    desc: '흰 바탕에 파란 일러스트를 전면 인쇄한 Petit Palais의 박스입니다.', descEn: 'A Petit Palais box printed all over with blue illustrations on white.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto(UR(49, 1, 3), true) }] }),
  W({ brand: '모락관', itemsKr: '손잡이 조립박스', itemsEn: 'Assembled box with handle', types: ['assembled'], cover: U(46, 1), hero: U(46, 3),
    desc: '손잡이를 접어 올리는 모락관의 포장 박스입니다. 식기 일러스트 패턴을 전면에 인쇄했습니다.', descEn: 'A carry box for Morakgwan with a fold-up handle, printed all over with a tableware pattern.',
    chapters: [{ en: 'Assembled Box', kr: '조립박스', imgs: auto(UR(46, 1, 3)) }] }),
  W({ brand: 'KKOALAPIE', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(47, 1), hero: U(48, 1),
    desc: '일러스트를 전면에 인쇄한 KKOALAPIE의 단상자입니다.', descEn: 'Folding cartons for KKOALAPIE, printed edge to edge with illustration.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto([...UR(47, 1, 2), U(48, 1), P('p7-7')]) }] }),
  W({ brand: '선인장 가족 한의원', itemsKr: '쇼핑백 · 단상자', itemsEn: 'Shopping bag, folding cartons', types: ['bag', 'carton'], cover: U(5, 4), hero: U(5, 1),
    desc: '선인장 가족 한의원의 쇼핑백과 단상자입니다. 식물 그림으로 제품을 구분했습니다.', descEn: 'A shopping bag and folding cartons for a Korean medicine clinic, with a different plant drawing for each product.',
    chapters: [{ en: 'Bag & Carton', kr: '쇼핑백 · 단상자', imgs: auto(UR(5, 1, 4)) }] }),
  W({ brand: 'DANDANG', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(4, 3), hero: U(4, 1),
    desc: '노란 바탕에 브랜드 로고를 배치한 단당의 단상자입니다.', descEn: 'Folding cartons for DANDANG with the brand mark on yellow.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto(UR(4, 1, 3)) }] }),
  W({ brand: 'K—K Market Festival', itemsKr: '포스터 · 리플렛 · 카드', itemsEn: 'Posters, leaflets, cards', types: ['print'], cover: U(25, 2), hero: U(26, 1),
    desc: 'K—K Market Festival의 포스터, 리플렛, 카드 인쇄물입니다.', descEn: 'Posters, leaflets and cards for K—K Market Festival.',
    chapters: [{ en: 'Print', kr: '인쇄물', imgs: auto([...UR(25, 1, 3), ...UR(26, 1, 2), U(27, 1)], true) }] }),
  W({ brand: 'Famille Mary', itemsKr: '슬리브 박스', itemsEn: 'Sleeve box', types: ['carton'], cover: U(31, 1), hero: U(31, 2),
    desc: '꿀벌 일러스트와 금박을 올린 Famille Mary의 슬리브 박스입니다.', descEn: 'A sleeve box for Famille Mary with a bee illustration and gold foil.',
    chapters: [{ en: 'Sleeve Box', kr: '슬리브 박스', imgs: auto(UR(31, 1, 2)) }] }),
  W({ brand: 'MilliLiter CentiLiter', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(32, 2), hero: U(32, 1),
    desc: '흰 바탕에 검은 로고만 올린 MilliLiter CentiLiter의 패키지입니다.', descEn: 'Packaging for MilliLiter CentiLiter: a black logo on plain white.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto(UR(32, 1, 2)) }] }),
  W({ brand: 'et', itemsKr: '봉투 · 파우치형 박스', itemsEn: 'Envelope, pouch box', types: ['etc'], cover: U(51, 3), hero: U(51, 1),
    desc: '녹색과 흰색 두 가지로 만든 et의 봉투와 파우치형 박스입니다.', descEn: 'An envelope and pouch-style box for et in green and white.',
    chapters: [{ en: 'Envelope & Pouch', kr: '봉투 · 파우치', imgs: auto(UR(51, 1, 3)) }] }),
  W({ brand: '51오일', itemsKr: '택배 박스', itemsEn: 'Mailer box', types: ['corrugated'], cover: U(55, 1), hero: U(55, 2),
    desc: '흑백 사진을 인쇄한 51오일 콜드프레스 참기름·들기름 박스입니다.', descEn: 'A mailer box for 51 Oil cold-pressed sesame and perilla oil, printed with a black-and-white photo.',
    chapters: [{ en: 'Mailer Box', kr: '택배 박스', imgs: auto(UR(55, 1, 3)) }] }),
  W({ brand: 'keatz', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(59, 1), hero: U(59, 1),
    desc: '맛별로 색을 나눈 keatz Yogurt Bark 단상자입니다.', descEn: 'keatz Yogurt Bark cartons, colour-coded by flavour.', chapters: [] }),
  W({ brand: 'formule', itemsKr: '단상자', itemsEn: 'Folding cartons', types: ['carton'], cover: U(60, 2), hero: U(60, 1),
    desc: '패턴을 전면에 인쇄한 formule 단상자입니다. F3은 금색으로 구분했습니다.', descEn: 'formule cartons printed all over with a pattern; F3 is set apart in gold.',
    chapters: [{ en: 'Folding Carton', kr: '단상자', imgs: auto(UR(60, 1, 2)) }] }),
  W({ brand: 'MUWA', itemsKr: '형압 인쇄물', itemsEn: 'Embossed print', types: ['print'], cover: U(57, 2), hero: U(57, 1),
    desc: 'MUWA 로고를 형압으로 표현한 인쇄물입니다.', descEn: 'Printed matter with the MUWA logo in emboss.',
    chapters: [{ en: 'Print', kr: '인쇄물', imgs: auto(UR(57, 1, 2)) }] }),
  W({ brand: 'WHAT a CRISP', itemsKr: '조립박스', itemsEn: 'Assembled box', types: ['assembled'], cover: U(18, 1), hero: P('p12-6'),
    desc: '흰색과 오렌지색 면을 나눈 WHAT a CRISP의 조립박스입니다.', descEn: 'An assembled box for WHAT a CRISP, split between white and orange panels.', chapters: [] }),
  W({ brand: 'GELI BUDDY', itemsKr: '단상자', itemsEn: 'Folding carton', types: ['carton'], cover: U(21, 1), hero: P('p7-9'),
    desc: '앞면에 반려견 사진을 넣은 GELI BUDDY의 단상자입니다.', descEn: 'A folding carton for GELI BUDDY with a dog photo on the front.', chapters: [] }),
  W({ brand: 'BORED & HUNGRY', itemsKr: '조립박스', itemsEn: 'Assembled box', types: ['assembled'], cover: P('p15-6'), hero: P('p12-7'),
    desc: '연두색 바탕의 BORED & HUNGRY 조립박스입니다.', descEn: 'An assembled box for BORED & HUNGRY in lime green.', chapters: [] }),
  W({ brand: 'Organature', itemsKr: '조립박스', itemsEn: 'Assembled box', types: ['assembled'], cover: P('p8-8'), hero: P('p13-4'),
    desc: '짙은 녹색 바탕의 Organature 조립박스입니다.', descEn: 'An assembled box for Organature in deep green.', chapters: [] }),
];
const WORKS = RAW.map((w, i) => ({ dark: false, ...w, id: String(i + 1).padStart(2, '0') }));
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
