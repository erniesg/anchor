import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Testing Deployed Site
 * Use this config to test against the live deployment
 */

export default defineConfig({
  testDir: './apps/web/tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: 'line',

  use: {
    baseURL: 'https://anchor-dev.erniesg.workers.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - testing deployed site
});
