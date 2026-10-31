export async function optimizePhoto(file) {
  if (!/^image\/(?:jpeg|png|webp|avif|gif)$/.test(file.type)) throw new Error('JPG, PNG, WEBP, AVIF 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.');
  if (file.size > 25 * 1024 * 1024) throw new Error('원본 사진은 한 장당 25MB까지 올릴 수 있습니다.');
  let image;
  try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('사진을 열 수 없습니다. 다른 사진을 선택해 주세요.'); }
  try {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 2400 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = .87, blob;
    for (let attempt = 0; attempt < 8; attempt++) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob) throw new Error('사진 변환에 실패했습니다.');
      if (blob.size <= 1.8 * 1024 * 1024) break;
      quality *= .8;
    }
    if (blob.size > 2 * 1024 * 1024) throw new Error('사진 용량을 줄이지 못했습니다. 조금 작은 사진으로 다시 시도해 주세요.');
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    return { data, bytes: blob.size, layout: image.width / image.height > 1.6 ? 'w' : 'h' };
  } finally { image.close(); }
}
export const photoUrl = src => {
  const match = /^\/assets\/works\/([0-9a-f-]{36})\.webp$/.exec(src || '');
  return match ? `/api/admin?op=image&id=${match[1]}` : src;
};
