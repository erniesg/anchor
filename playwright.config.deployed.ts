import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Deployed Environment
 * Tests against live deployed site
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2, // Retry on deployed environment
  workers: 1, // Sequential execution for deployed tests
  reporter: 'line',
  timeout: 60000, // Longer timeout for deployed site

  use: {
    baseURL: 'https://anchor-dev.erniesg.workers.dev',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer config - testing deployed site
});
