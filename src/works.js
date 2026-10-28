const TYPES = new Set(['bag', 'carton', 'rigid', 'magnetic', 'assembled', 'corrugated', 'print', 'etc']);
const SIZES = new Set(['w', 'h', 't', 'c']);

// Keep stored IDs independent of display order so reordering never renumbers URLs.
export function prepareWorks(content) {
  if (!Array.isArray(content?.works) || !content.works.length) throw new Error('작업물을 최소 한 개 등록해 주세요.');
  const ids = new Set();
  return content.works.map((work, index) => {
    const fail = message => { throw new Error(`작업물 ${index + 1}: ${message}`); };
    const text = (value, label) => {
      if (typeof value !== 'string' || !value.trim()) fail(`${label}을 입력해 주세요.`);
      return value.trim();
    };
    const image = (value, label) => {
      const src = text(value, label);
      if (!/^\/assets\/(?:[\p{L}\p{N}_ .()-]+\/)*[\p{L}\p{N}_ .()-]+\.(?:jpe?g|png|webp|avif|gif)$/iu.test(src) || src.split('/').some(part => part === '.' || part === '..')) fail(`${label}는 이미지 업로드에서 선택해 주세요.`);
      return src;
    };
    const id = text(work?.id, '작업 번호');
    if (!/^(?!0+$)[0-9]{2,}$/.test(id) || ids.has(id)) fail('작업 번호는 겹치지 않는 두 자리 이상의 숫자로 입력해 주세요.');
    ids.add(id);
    if (!Array.isArray(work.types) || !work.types.length || work.types.some(type => !TYPES.has(type))) fail('제작 종류를 선택해 주세요.');
    const brand = text(work.brand, '브랜드명');
    const itemsKr = text(work.itemsKr, '제작 품목');
    const desc = text(work.desc, '작업 설명');
    const cover = image(work.cover, '대표 이미지');
    if (work.chapters != null && !Array.isArray(work.chapters)) fail('상세 섹션을 확인해 주세요.');
    return {
      dark: work.dark === true, brand, itemsKr, itemsEn: work.itemsEn?.trim() || itemsKr,
      types: [...new Set(work.types)], cover, hero: work.hero ? image(work.hero, '상단 이미지') : cover,
      desc, descEn: work.descEn?.trim() || desc,
      chapters: (work.chapters || []).map(chapter => {
        const kr = text(chapter?.kr, '섹션 제목');
        if (!Array.isArray(chapter.imgs) || !chapter.imgs.length) fail('상세 섹션에 이미지를 추가해 주세요.');
        return { kr, en: chapter.en?.trim() || kr, imgs: chapter.imgs.map(img => {
          const size = img?.size || 'h';
          if (!SIZES.has(size)) fail('이미지 배치를 선택해 주세요.');
          return [image(img?.src, '상세 이미지'), size];
        }) };
      }), id,
    };
  });
}
