import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import seed from '../../content/works.json' with { type: 'json' };

const image = await readFile('assets/web/jade/bag-02.webp');
async function mockStudio(page, { signedIn = true, failUpload = false } = {}) {
  const state = { works: structuredClone(seed.works), drafts: [], job: null, saves: [], uploads: 0, published: [] };
  await page.route('**/api/admin?**', async route => {
    const request = route.request(), url = new URL(request.url()), op = url.searchParams.get('op');
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (op === 'session') return reply({ authenticated: signedIn, csrf: 'test-csrf' });
    if (op === 'login') { if (body.password !== 'studio-test-password') return reply({ message: '비밀번호를 확인해 주세요.' }, 401); signedIn = true; return reply({ authenticated: true, csrf: 'test-csrf' }); }
    if (op === 'setup') { signedIn = true; return reply({ authenticated: true, csrf: 'test-csrf' }); }
    if (!signedIn) return reply({ message: '다시 로그인해 주세요.' }, 401);
    if (op === 'catalog') return reply({ works: state.works, revision: 'seed', assets: {}, drafts: state.drafts, readyToPublish: true, busy: state.job?.status === 'building', activeJob: state.job });
    if (op === 'draft') {
      const previous = state.drafts.find(d => d.key === body.key);
      if ((previous?.version || 0) !== body.version) return reply({ message: '다른 창에서 수정한 내용이 있습니다.' }, 409);
      const draft = { ...body, version: body.version + 1, updatedAt: Date.now(), work: { ...body.work, id: previous?.work.id || body.originalId || '30' } };
      state.drafts = [draft, ...state.drafts.filter(d => d.key !== draft.key)]; state.saves.push(draft); return reply(draft);
    }
    if (op === 'upload') {
      state.uploads++;
      if (failUpload && state.uploads === 1) return reply({ message: '업로드 연결이 끊어졌습니다.' }, 503);
      expect(Buffer.from(body.data, 'base64').subarray(8, 12).toString()).toBe('WEBP');
      return reply({ path: `/assets/works/${body.id}.webp`, size: image.length }, 201);
    }
    if (op === 'image') return route.fulfill({ contentType: 'image/webp', body: image });
    if (op === 'publish') {
      const draft = state.drafts.find(d => d.key === body.key); state.published.push(draft);
      state.job = { id: body.requestId, workId: draft.work.id, status: 'building' };
      state.works = [draft.work, ...state.works.filter(w => w.id !== draft.work.id)]; return reply(state.job, 202);
    }
    if (op === 'job') { state.job.status = 'ready'; state.drafts = []; return reply(state.job); }
    if (op === 'logout') { signedIn = false; return reply({ ok: true }); }
    if (op === 'discard') { state.drafts = state.drafts.filter(d => d.key !== body.key); return reply({ ok: true }); }
    return reply({ ok: true });
  });
  return state;
}

for (const width of [1440, 390]) test(`Studio cards, search and filtering work without overflow at ${width}px`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 }); await mockStudio(page); await page.goto('/admin');
  await expect(page.locator('.work-card')).toHaveCount(29);
  await page.getByRole('textbox', { name: '작업물 검색' }).fill('PAN AM');
  await expect(page.locator('.work-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: '작업물 검색' }).fill('');
  await page.getByRole('combobox', { name: '제작 종류 필터' }).selectOption('bag');
  await expect(page.locator('.work-card')).toHaveCount(seed.works.filter(w => w.types.includes('bag')).length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: `test-results/studio-catalog-${width}.png`, fullPage: false });
  expect(errors).toEqual([]);
});

test('multiple photos, cover selection, keyboard order, true preview and publication form one complete flow', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = await mockStudio(page); await page.goto('/admin');
  await page.getByRole('button', { name: '새 작업물', exact: true }).click();
  await page.getByRole('textbox', { name: '브랜드명', exact: true }).fill('Studio QA Brand');
  await page.getByLabel('작업 사진 업로드').setInputFiles([{ name: 'first.webp', mimeType: 'image/webp', buffer: image }, { name: 'second.webp', mimeType: 'image/webp', buffer: image }]);
  await expect(page.locator('.photo-card')).toHaveCount(2);
  await page.locator('.photo-card').nth(1).getByRole('button', { name: '대표 사진으로 선택' }).click();
  await page.locator('.photo-card').nth(1).getByRole('button', { name: '사진 앞으로 이동' }).click();
  await expect(page.locator('.photo-card').first()).toHaveClass(/is-cover/);
  await page.getByRole('textbox', { name: '제작 품목', exact: true }).fill('쇼핑백 · 선물 박스');
  await page.getByRole('button', { name: '쇼핑백', exact: true }).click();
  await page.getByRole('textbox', { name: '작업 설명', exact: true }).fill('사진 업로드와 홈페이지 게시를 확인하는 작업입니다.');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.getByText('임시 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.saves.at(-1).work.chapters[0].imgs).toHaveLength(2);
  expect(state.saves.at(-1).work.cover).toBe(state.saves.at(-1).work.chapters[0].imgs[0].src);
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await expect(page.frameLocator('.preview-modal iframe').locator('h1')).toHaveText('Studio QA Brand');
  await expect(page.frameLocator('.preview-modal iframe').locator('.sc-has-error')).toHaveCount(0);
  await page.getByRole('button', { name: '모바일 화면', exact: true }).click();
  await page.screenshot({ path: 'test-results/studio-live-preview.png' });
  await page.getByRole('button', { name: '미리보기 닫기' }).click();
  await page.getByRole('button', { name: '게시하기', exact: true }).click();
  await page.getByRole('button', { name: '홈페이지에 게시', exact: true }).click();
  await expect(page.getByText('홈페이지에 새로운 내용을 반영하고 있어요')).toBeVisible();
  await expect(page.getByText('게시가 완료됐습니다. 홈페이지에서 확인해 보세요.')).toBeVisible({ timeout: 15000 });
  expect(state.published).toHaveLength(1); await expect(page.locator('.work-card')).toHaveCount(30);
  expect(errors).toEqual([]);
});

test('upload failures keep the file for retry and drafts do not appear publicly before publishing', async ({ page }) => {
  const state = await mockStudio(page, { failUpload: true }); await page.goto('/admin');
  await page.getByRole('button', { name: '새 작업물', exact: true }).click();
  await page.getByRole('textbox', { name: '브랜드명', exact: true }).fill('Private Draft');
  await page.getByLabel('작업 사진 업로드').setInputFiles({ name: 'retry.webp', mimeType: 'image/webp', buffer: image });
  await expect(page.getByText('업로드 연결이 끊어졌습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '게시하기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.photo-card')).toHaveCount(1);
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page.getByText('임시 저장했습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '작업물 목록', exact: true }).click();
  await page.getByRole('tab', { name: /임시 저장/ }).click();
  await expect(page.locator('.work-card')).toHaveCount(1);
  expect(state.works).toHaveLength(29); expect(state.published).toHaveLength(0);
  expect(state.uploads).toBe(2);
});

test('login rejects wrong passwords and normal logout returns to the login screen', async ({ page }) => {
  await mockStudio(page, { signedIn: false }); await page.goto('/admin');
  await page.getByLabel('관리자 비밀번호', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('비밀번호를 확인해 주세요.');
  await page.getByLabel('관리자 비밀번호', { exact: true }).fill('studio-test-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.locator('.work-card')).toHaveCount(29);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('heading', { name: '작업실에 오신 것을 환영해요' })).toBeVisible();
});
