import { test, expect } from '@playwright/test';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';

// Use existing caregiver credentials
const USERNAME = 'formcg1766775326146';
const PIN = '762885';

test('Debug Care Log Creation', async ({ page }) => {
  test.setTimeout(120000);

  // Capture ALL care-logs requests
  page.on('request', request => {
    if (request.url().includes('care-logs')) {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log(`          Body: ${request.postData()?.substring(0, 200)}`);
      }
    }
  });

  page.on('response', async response => {
    if (response.url().includes('care-logs')) {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
      try {
        const text = await response.text();
        console.log(`          Body: ${text.substring(0, 300)}`);
      } catch { /* ignore */ }
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('care') || msg.text().includes('log')) {
      console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Login as caregiver
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="pin"]', PIN);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to morning form
  console.log('\nNavigating to morning form...');
  await page.goto(`${BASE_URL}/caregiver/form/morning`);

  // Wait for the form to fully load and care log to be fetched/created
  await page.waitForLoadState('networkidle');
  console.log('Network idle reached');

  await page.waitForTimeout(5000);
  console.log('Waited 5 seconds after network idle');

  // Check if form is visible
  const wakeTimeInput = page.locator('input[type="time"]').first();
  const isVisible = await wakeTimeInput.isVisible();
  console.log(`\nWake time input visible: ${isVisible}`);

  // Try to get current URL
  console.log(`Current URL: ${page.url()}`);

  // Check for any loading indicators
  const loadingIndicator = page.locator('text=Loading');
  const isLoading = await loadingIndicator.isVisible().catch(() => false);
  console.log(`Loading indicator visible: ${isLoading}`);

  // Check for any error messages on the page
  const errorMessage = page.locator('.text-red-500, .text-red-600, [role="alert"]');
  const hasError = await errorMessage.isVisible().catch(() => false);
  if (hasError) {
    const errorText = await errorMessage.textContent();
    console.log(`Error on page: ${errorText}`);
  }

  expect(isVisible).toBe(true);
});
