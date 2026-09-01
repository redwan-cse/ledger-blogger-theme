import { defineConfig } from '@playwright/test';

const paceMs = Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);
if (!Number.isFinite(paceMs) || paceMs < 4000) {
  throw new Error('HARNESS_PACE_MS must be an integer greater than or equal to 4000.');
}

export default defineConfig({
  testDir: './tests/render',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  projects: [
    { name: 'javascript', use: { javaScriptEnabled: true } },
    { name: 'no-javascript', use: { javaScriptEnabled: false } },
    { name: 'reduced-motion', use: { javaScriptEnabled: true } }
  ],
  use: {
    baseURL: process.env.STAGING_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
