import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`existing pages render without errors or overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/', '/works', '/works/01-jade-palace-golf-club', '/services', '/about', '/contact']) {
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      await expect(page.locator('.sc-has-error')).toHaveCount(0);
      await expect(page.locator('h1')).toHaveCount(1);
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBeTruthy();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://teyvat.kr${path}`);
      await expect(page.locator('body')).not.toContainText('{{');
      await page.screenshot({ path: `test-results/${width}-${path.replaceAll('/', '_') || 'home'}.png` });
    }
    expect(errors).toEqual([]);
  });
}

test('static HTML has crawlable navigation, body, per-page metadata and FAQ answers without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/works');
  const link = page.locator('a[href="/works/01-jade-palace-golf-club"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('h1')).toHaveText('Jade Palace Golf Club');
  await page.goto('/services');
  expect(await page.content()).toContain('품목과 인쇄 방식에 따라 달라요.');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await context.close();
});

test('navigation, back and legacy hash URLs retain the original transitions', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('header a[href="/services"]').click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.locator('h1')).toHaveText('Services');
  await page.goBack();
  await expect(page.locator('h1')).toContainText('테바디엔피');
  await page.goto('/#/contact');
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.locator('form')).toBeVisible();
  expect(errors).toEqual([]);
});

async function fillContact(page) {
  await page.goto('/contact');
  await page.getByLabel('브랜드 · 회사명 *').fill('테스트 브랜드');
  await page.getByLabel('담당자 *', { exact: true }).fill('테스트 담당자');
  await page.getByLabel('연락처 *').fill('010-1234-5678');
  await page.getByLabel('이메일 *').fill('sender@example.com');
  await page.getByLabel('문의 내용').fill('인쇄 및 패키지 제작 문의입니다.');
  await page.getByRole('checkbox').check();
}
test('form sends actual attachment bytes and only shows receipt after accepted response', async ({ page }) => {
  let body;
  await page.route('**/api/contact', async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { accepted: true, requestId: body.requestId, notification: 'sent' } });
  });
  await fillContact(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'drawing.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 sample') });
  await page.getByRole('button', { name: '문의 보내기 Send →' }).click();
  await expect(page.getByText('RECEIVED 접수 완료')).toBeVisible();
  expect(body.attachments[0].content).toBe(Buffer.from('%PDF-1.7 sample').toString('base64'));
  expect(body.email).toBe('sender@example.com');
  await expect(page.getByRole('status')).toContainText(body.requestId);
});
test('failed sends retain input and reuse the same idempotency key on retry', async ({ page }) => {
  const ids = [];
  await page.route('**/api/contact', async route => {
    const body = route.request().postDataJSON(); ids.push(body.requestId);
    await route.fulfill({ status: 502, json: { accepted: false, message: '전송 결과를 확인하지 못했습니다.' } });
  });
  await fillContact(page);
  const submit = page.getByRole('button', { name: '문의 보내기 Send →' });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('전송 결과를 확인하지 못했습니다.');
  await expect(page.getByLabel('브랜드 · 회사명 *')).toHaveValue('테스트 브랜드');
  await expect(page.getByText('RECEIVED 접수 완료')).toHaveCount(0);
  await submit.click();
  await expect.poll(() => ids.length).toBe(2);
  expect(ids[0]).toBe(ids[1]);
});
