import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';
const RESULT_DIR = process.env.RESULT_DIR || '/tmp/anchor-dev-family-review';

const familyEmail = 'family-review-1773417424088@example.com';
const familyPassword = 'TestPass123!';
const caregiverUsername = 'rvcg1773417424088';
const caregiverPin = '835245';

test('anchor-dev family review continuation from summary to family verification', async ({ page }) => {
  test.setTimeout(180000);

  await fs.mkdir(RESULT_DIR, { recursive: true });

  page.on('response', async (response) => {
    if (response.url().includes('/care-logs') && response.status() >= 400) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '<unavailable>';
      }
      console.log(`HTTP ${response.status()} ${response.url()} ${body}`);
    }
  });

  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', caregiverUsername);
  await page.fill('input[name="pin"]', caregiverPin);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/caregiver/form', { timeout: 20000 });

  await page.goto(`${BASE_URL}/caregiver/form/summary`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${RESULT_DIR}/08a-summary-loaded.png`, fullPage: true });

  const balanceButton = page.locator('button.rounded-full', { hasText: '3' }).first();
  if (await balanceButton.count()) {
    await balanceButton.click();
  }
  const summaryTextarea = page.locator('textarea').first();
  if (await summaryTextarea.count()) {
    await summaryTextarea.fill('Continuation audit: summary submitted and family review verified.');
  }
  await page.waitForTimeout(4000);
  const summarySubmitButton = page.locator('button', { hasText: /Submit (Daily )?Summary/i }).first();
  await expect(summarySubmitButton).toBeVisible({ timeout: 10000 });
  await summarySubmitButton.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${RESULT_DIR}/08-summary-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/caregiver/form`);
  await page.waitForTimeout(2000);
  const completeDayButton = page.locator('button:has-text("Complete Day")').first();
  await expect(completeDayButton).toBeVisible({ timeout: 10000 });
  await completeDayButton.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${RESULT_DIR}/09-complete-day-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', familyEmail);
  await page.fill('input[name="password"]', familyPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/family/dashboard', { timeout: 20000 });
  await page.waitForTimeout(3000);

  const familyToken = await page.evaluate(() => localStorage.getItem('token') || '');
  const careRecipientRaw = await page.evaluate(() => localStorage.getItem('careRecipient') || '');
  const careRecipient = JSON.parse(careRecipientRaw);

  await page.locator('button:has-text("Today")').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('text=No meal data recorded')).toHaveCount(0);
  await expect(page.locator('text=Breakfast:')).toBeVisible();
  await expect(page.locator('text=Lunch:')).toBeVisible();
  await expect(page.locator('text=Dinner:')).toBeVisible();
  await expect(page.locator('text=08:30')).toBeVisible();
  await expect(page.locator('text=12:30')).toBeVisible();
  await expect(page.locator('text=18:30')).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/10-family-today-review.png`, fullPage: true });

  const todayLogResponse = await fetch(`${API_URL}/care-logs/recipient/${careRecipient.id}/today`, {
    headers: { Authorization: `Bearer ${familyToken}` },
  });
  expect(todayLogResponse.ok).toBeTruthy();
  const todayLog = await todayLogResponse.json();
  expect(todayLog.meals.breakfast).toBeTruthy();
  expect(todayLog.meals.lunch).toBeTruthy();
  expect(todayLog.meals.dinner).toBeTruthy();

  await page.locator('button:has-text("Week")').click();
  await page.waitForTimeout(3000);
  await expect(page.locator('text=Avg Appetite (1-5)').first()).toBeVisible();
  await expect(page.locator('text=Avg Eaten %').first()).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/11-family-week-review.png`, fullPage: true });

  await page.locator('button:has-text("Activity")').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('text=Section Progression').first()).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/12-family-activity-review.png`, fullPage: true });

  await page.goto(`${BASE_URL}/family/trends`);
  await expect(page.locator('text=7-Day Health Trends')).toBeVisible();
  const loading = page.locator('text=Loading trend data...');
  if (await loading.count()) {
    await expect(loading).toBeHidden({ timeout: 20000 });
  }
  await expect(page.locator('text=Avg Appetite (1-5)').first()).toBeVisible();
  await expect(page.locator('text=Avg Eaten %').first()).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/13-family-trends-review.png`, fullPage: true });

  await fs.writeFile(
    `${RESULT_DIR}/summary.json`,
    JSON.stringify({
      baseUrl: BASE_URL,
      apiUrl: API_URL,
      mergedCommit: '0a74db598b7a228e8285787b88cbb1d55d1e3028',
      deployRun: 'https://github.com/erniesg/anchor/actions/runs/23058913813',
      family: { email: familyEmail, password: familyPassword },
      caregiver: { username: caregiverUsername, pin: caregiverPin },
      careRecipientId: careRecipient.id,
      assertions: {
        apiMealsPresent: ['breakfast', 'lunch', 'dinner'],
        familyTodayShowsMeals: true,
        familyWeekLegendUpdated: true,
        familyActivityVisible: true,
        familyTrendsLoaded: true,
      },
    }, null, 2),
  );
});
