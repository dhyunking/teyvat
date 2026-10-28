import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, workers: 2,
  use: { baseURL: 'http://localhost:4173', browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/dev.mjs --no-build', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
});
