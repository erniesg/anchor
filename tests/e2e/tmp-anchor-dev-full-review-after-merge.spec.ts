import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';
const RESULT_DIR = process.env.RESULT_DIR || '/tmp/anchor-dev-full-review';

test('anchor-dev merged build passes family review flow end to end', async ({ page }) => {
  test.setTimeout(240000);

  const timestamp = Date.now();
  const familyEmail = `merged-review-${timestamp}@example.com`;
  const familyPassword = 'TestPass123!';
  const familyName = `Merged Review ${timestamp}`;
  const recipientName = `Merged Recipient ${timestamp % 100000}`;
  const caregiverName = `Merged Caregiver ${timestamp % 100000}`;
  const requestedUsername = `mrcg${timestamp}`.slice(0, 20);

  let caregiverUsername = requestedUsername;
  let caregiverPin = '';
  let careRecipientId = '';
  let familyToken = '';

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

  await page.goto(`${BASE_URL}/auth/signup`);
  await page.fill('input[name="name"]', familyName);
  await page.fill('input[name="email"]', familyEmail);
  await page.fill('input[name="phone"]', '+65 8111 2222');
  await page.fill('input[name="password"]', familyPassword);
  await page.fill('input[name="confirmPassword"]', familyPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/family/onboarding', { timeout: 20000 });
  await page.screenshot({ path: `${RESULT_DIR}/01-signup-onboarding.png`, fullPage: true });

  await page.locator('input[placeholder*="Sulochana"], input[type="text"][required]').first().fill(recipientName);
  await page.fill('input[type="date"]', '1945-03-15');
  await page.fill('input[placeholder*="Dementia"]', 'Parkinsonism');
  await page.fill('input[placeholder*="Singapore"]', 'Singapore, Bishan');
  await page.fill('input[type="tel"]', '+65 9222 3333');
  await page.locator('button[type="submit"]:has-text("Continue"), button:has-text("Continue")').first().click();
  await page.waitForURL('**/family/onboarding/caregiver', { timeout: 20000 });
  await page.screenshot({ path: `${RESULT_DIR}/02-care-recipient-created.png`, fullPage: true });

  await page.fill('input[placeholder*="Maria"]', caregiverName);
  const usernameField = page.locator('input[placeholder*="maria-helper"]');
  if (await usernameField.count()) {
    await usernameField.fill(requestedUsername);
  }
  const caregiverPhoneField = page.locator('input[type="tel"]');
  if (await caregiverPhoneField.count()) {
    await caregiverPhoneField.fill('+65 9333 4444');
  }
  const languageSelect = page.locator('select');
  if (await languageSelect.count()) {
    await languageSelect.selectOption('en');
  }
  await page.locator('button[type="submit"]:has-text("Generate PIN"), button:has-text("Generate PIN")').first().click();
  await expect(page.locator('h2:has-text("Caregiver Account Created!")')).toBeVisible({ timeout: 20000 });

  const usernameDisplay = page.locator('.bg-blue-50 .font-mono, .bg-blue-50 .text-2xl');
  if (await usernameDisplay.count()) {
    caregiverUsername = ((await usernameDisplay.first().textContent()) || requestedUsername).trim();
  }
  caregiverPin = (((await page.locator('.tracking-widest, p.text-5xl.font-bold.text-primary-700').first().textContent()) || '').replace(/\s/g, '')).trim();
  expect(caregiverPin).toMatch(/^\d{6}$/);
  await page.screenshot({ path: `${RESULT_DIR}/03-caregiver-created.png`, fullPage: true });

  await page.locator('button:has-text("Go to Dashboard")').click();
  await page.waitForURL('**/family/dashboard', { timeout: 20000 });
  await page.screenshot({ path: `${RESULT_DIR}/04-family-dashboard-after-onboarding.png`, fullPage: true });

  familyToken = await page.evaluate(() => localStorage.getItem('token') || '');
  const careRecipientRaw = await page.evaluate(() => localStorage.getItem('careRecipient') || '');
  if (careRecipientRaw) {
    careRecipientId = JSON.parse(careRecipientRaw).id;
  }

  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', caregiverUsername);
  await page.fill('input[name="pin"]', caregiverPin);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/caregiver/form', { timeout: 20000 });

  await page.goto(`${BASE_URL}/caregiver/form/morning`);
  await page.locator('input[type="time"]').first().fill('07:00');
  await page.locator('button', { hasText: /^Alert$/ }).first().click();
  const morningTimes = page.locator('input[type="time"]');
  const morningCount = await morningTimes.count();
  if (morningCount > 1) {
    await morningTimes.nth(morningCount > 2 ? 2 : 1).fill('08:30');
  }
  await page.locator('.rounded-full:has-text("4")').first().click();
  const noneButton = page.locator('button:has-text("None")').first();
  if (await noneButton.count()) {
    await noneButton.click();
  }
  await page.waitForTimeout(2500);
  await page.locator('button', { hasText: /Submit Morning/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${RESULT_DIR}/05-morning-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/caregiver/form/afternoon`);
  await page.locator('input[type="time"]').first().fill('12:30');
  await page.locator('.rounded-full:has-text("3")').first().click();
  await page.waitForTimeout(2500);
  await page.locator('button', { hasText: /Submit Afternoon/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${RESULT_DIR}/06-afternoon-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/caregiver/form/evening`);
  await page.locator('input[type="time"]').first().fill('18:30');
  await page.locator('.rounded-full:has-text("4")').first().click();
  const eveningTimes = page.locator('input[type="time"]');
  if (await eveningTimes.count() > 1) {
    await eveningTimes.last().fill('21:30');
  }
  await page.waitForTimeout(2500);
  await page.locator('button', { hasText: /Submit Evening/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${RESULT_DIR}/07-evening-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/caregiver/form/summary`);
  await page.waitForTimeout(1500);
  const balanceButton = page.locator('button.rounded-full', { hasText: '3' }).first();
  if (await balanceButton.count()) {
    await balanceButton.click();
  }
  const summaryTextarea = page.locator('textarea').first();
  if (await summaryTextarea.count()) {
    await summaryTextarea.fill('Merged anchor-dev review flow completed successfully.');
  }
  await page.waitForTimeout(2500);
  const submitSummaryButton = page.locator('button', { hasText: /Submit (Daily )?Summary/i }).first();
  await submitSummaryButton.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${RESULT_DIR}/08-summary-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/caregiver/form`);
  await page.waitForTimeout(2000);
  const completeDayButton = page.locator('button:has-text("Complete Day")').first();
  await expect(completeDayButton).toBeVisible({ timeout: 15000 });
  await completeDayButton.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${RESULT_DIR}/09-complete-day-submitted.png`, fullPage: true });

  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', familyEmail);
  await page.fill('input[name="password"]', familyPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/family/dashboard', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("Today")').click();
  await page.waitForTimeout(1000);

  familyToken = await page.evaluate(() => localStorage.getItem('token') || familyToken);
  const familyRecipientRaw = await page.evaluate(() => localStorage.getItem('careRecipient') || '');
  if (familyRecipientRaw) {
    careRecipientId = JSON.parse(familyRecipientRaw).id;
  }

  await expect(page.locator('text=No meal data recorded')).toHaveCount(0);
  await expect(page.locator('text=Breakfast:')).toBeVisible();
  await expect(page.locator('text=Lunch:')).toBeVisible();
  await expect(page.locator('text=Dinner:')).toBeVisible();
  await expect(page.locator('text=08:30')).toBeVisible();
  await expect(page.locator('text=12:30')).toBeVisible();
  await expect(page.locator('text=18:30')).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/10-family-today-review.png`, fullPage: true });

  const todayLogResponse = await fetch(`${API_URL}/care-logs/recipient/${careRecipientId}/today`, {
    headers: { Authorization: `Bearer ${familyToken}` },
  });
  expect(todayLogResponse.ok).toBeTruthy();
  const todayLog = await todayLogResponse.json();
  expect(todayLog.meals.breakfast).toBeTruthy();
  expect(todayLog.meals.lunch).toBeTruthy();
  expect(todayLog.meals.dinner).toBeTruthy();

  await page.locator('button:has-text("Week")').click();
  await page.waitForTimeout(2500);
  await expect(page.locator('text=Avg Appetite (1-5)').first()).toBeVisible();
  await expect(page.locator('text=Avg Eaten %').first()).toBeVisible();
  await page.screenshot({ path: `${RESULT_DIR}/11-family-week-review.png`, fullPage: true });

  await page.locator('button:has-text("Activity")').click();
  await page.waitForTimeout(1500);
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
      careRecipientId,
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
