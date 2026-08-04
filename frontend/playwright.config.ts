import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-375', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1024', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'overflow-320', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 720 } } },
  ],
  webServer: process.env['PLAYWRIGHT_BASE_URL']
    ? undefined
    : {
        command: 'npm start -- --host 127.0.0.1 --port 4200',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
