import { test, expect, devices, type Locator, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';
const RESULT_DIR = process.env.RESULT_DIR || '/tmp/anchor-dev-rich-audit';

test.describe.configure({ mode: 'serial' });

async function isVisible(locator: Locator) {
  try {
    return await locator.isVisible({ timeout: 5000 });
  } catch {
    return false;
  }
}

function getSectionSubmitButton(page: Page, section: 'morning' | 'afternoon' | 'evening') {
  const title = section.charAt(0).toUpperCase() + section.slice(1);
  return page.getByRole('button', {
    name: new RegExp(`^(Submit ${title} Section|Update & Re-submit ${title}|Complete Required Fields)$`, 'i'),
  }).first();
}

test('anchor-dev full rich-data audit for family review, validation, and mobile sanity', async ({ page, request, browser }) => {
  test.setTimeout(360000);

  const issues: string[] = [];
  const observations: string[] = [];
  const timestamp = Date.now();
  const familyEmail = `full-audit-${timestamp}@example.com`;
  const familyPassword = 'TestPass123!';
  const familyName = `Full Audit ${timestamp}`;
  const recipientName = `Audit Recipient ${timestamp % 100000}`;
  const caregiverName = `Audit Caregiver ${timestamp % 100000}`;
  const requestedUsername = `facg${timestamp}`.slice(0, 20);

  let caregiverUsername = requestedUsername;
  let caregiverPin = '';
  let careRecipientId = '';
  let familyToken = '';
  let caregiverToken = '';
  let careLogId = '';

  const recordIssue = (message: string) => {
    issues.push(message);
    console.log(`ISSUE: ${message}`);
  };

  const takeShot = async (name: string) => {
    await page.screenshot({ path: `${RESULT_DIR}/${name}.png`, fullPage: true });
  };

  const getTodayLogAsCaregiver = async () => {
    const response = await request.get(`${API_URL}/care-logs/caregiver/today`, {
      headers: { Authorization: `Bearer ${caregiverToken}` },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };

  const getTodayLogAsFamily = async () => {
    const response = await request.get(`${API_URL}/care-logs/recipient/${careRecipientId}/today`, {
      headers: { Authorization: `Bearer ${familyToken}` },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };

  const openQuickLog = async () => {
    await page.locator('div.fixed.bottom-6.right-6 > button').first().click();
  };

  const addFluid = async (drinkType: string, amount: number, time: string) => {
    await openQuickLog();
    await page.getByRole('button', { name: /Fluid/i }).click();
    await page.locator('select').first().selectOption(drinkType);
    await page.getByRole('button', { name: new RegExp(`^${amount}$`) }).click();
    await page.locator('input[type="time"]').last().fill(time);
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(1200);
  };

  const addToileting = async (type: 'urination' | 'bowel' | 'both', assistance: 'none' | 'partial' | 'full', time: string) => {
    await openQuickLog();
    await page.getByRole('button', { name: /Toileting/i }).click();
    await page.getByRole('button', { name: new RegExp(type === 'both' ? 'Both' : type === 'bowel' ? 'Bowel' : 'Urination') }).click();
    await page.getByRole('button', { name: new RegExp(assistance === 'full' ? 'Full' : assistance === 'partial' ? 'Partial' : 'None') }).click();
    await page.locator('input[type="time"]').last().fill(time);
    await page.locator('textarea').last().fill('Recorded during full audit.');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForTimeout(1200);
  };

  await fs.mkdir(RESULT_DIR, { recursive: true });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`BROWSER ERROR: ${msg.text()}`);
    }
  });

  page.on('response', async (response) => {
    if ((response.url().includes('/care-logs') || response.url().includes('/auth')) && response.status() >= 400) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '<unavailable>';
      }
      console.log(`HTTP ${response.status()} ${response.url()} ${body}`);
    }
  });

  // Family signup and onboarding
  await page.goto(`${BASE_URL}/auth/signup`);
  await expect(page.locator('h2:has-text("Create Family Account")')).toBeVisible();
  await page.fill('input[name="name"]', familyName);
  await page.fill('input[name="email"]', familyEmail);
  await page.fill('input[name="phone"]', '+65 8123 4567');
  await page.fill('input[name="password"]', familyPassword);
  await page.fill('input[name="confirmPassword"]', familyPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/family/onboarding', { timeout: 20000 });
  await takeShot('01-signup');

  await page.locator('input[placeholder*="Sulochana"], input[type="text"][required]').first().fill(recipientName);
  await page.fill('input[type="date"]', '1945-03-15');
  await page.fill('input[placeholder*="Dementia"]', 'Progressive supranuclear palsy');
  await page.fill('input[placeholder*="Singapore"]', 'Singapore, Ang Mo Kio');
  await page.fill('input[type="tel"]', '+65 9000 1111');
  await page.locator('button[type="submit"]:has-text("Continue"), button:has-text("Continue")').first().click();
  await page.waitForURL('**/family/onboarding/caregiver', { timeout: 20000 });
  await takeShot('02-care-recipient');

  await page.fill('input[placeholder*="Maria"]', caregiverName);
  const usernameField = page.locator('input[placeholder*="maria-helper"]');
  if (await usernameField.count()) {
    await usernameField.fill(requestedUsername);
  }
  const caregiverPhoneField = page.locator('input[type="tel"]');
  if (await caregiverPhoneField.count()) {
    await caregiverPhoneField.fill('+65 9888 7777');
  }
  const languageSelect = page.locator('select');
  if (await languageSelect.count()) {
    await languageSelect.selectOption('en');
  }
  await page.locator('button[type="submit"]:has-text("Generate PIN"), button:has-text("Generate PIN")').first().click();
  await expect(page.locator('h2:has-text("Caregiver Account Created!")')).toBeVisible({ timeout: 20000 });

  const displayedUsername = page.locator('.bg-blue-50 .font-mono, .bg-blue-50 .text-2xl');
  if (await displayedUsername.count()) {
    caregiverUsername = ((await displayedUsername.first().textContent()) || caregiverUsername).trim();
  }
  caregiverPin = ((((await page.locator('.tracking-widest, p.text-5xl.font-bold.text-primary-700').first().textContent()) || '').replace(/\s/g, '')).trim());
  expect(caregiverPin).toMatch(/^\d{6}$/);
  await takeShot('03-caregiver-created');

  await page.locator('button:has-text("Go to Dashboard")').click();
  await page.waitForURL('**/family/dashboard', { timeout: 20000 });
  await takeShot('04-family-dashboard-empty');

  familyToken = await page.evaluate(() => localStorage.getItem('token') || '');
  const onboardingRecipient = await page.evaluate(() => localStorage.getItem('careRecipient') || '');
  if (onboardingRecipient) {
    careRecipientId = JSON.parse(onboardingRecipient).id;
  }
  expect(familyToken).toBeTruthy();
  expect(careRecipientId).toBeTruthy();

  // Caregiver login
  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', caregiverUsername);
  await page.fill('input[name="pin"]', caregiverPin);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/caregiver/form', { timeout: 20000 });
  caregiverToken = await page.evaluate(() => localStorage.getItem('caregiverToken') || '');
  expect(caregiverToken).toBeTruthy();

  // Morning
  await page.goto(`${BASE_URL}/caregiver/form/morning`);
  await expect(page.locator('h1:has-text("Morning Care Log"), h1:has-text("Morning")').first()).toBeVisible({ timeout: 10000 });
  await takeShot('05-morning-empty');

  const morningSubmit = getSectionSubmitButton(page, 'morning');
  if (!(await morningSubmit.isDisabled())) {
    recordIssue('Morning form submit is enabled before required fields are complete.');
  }
  if ((await page.locator('text=/Shower|Hair Wash/i').count()) === 0) {
    recordIssue('Current morning flow has no shower/hair-wash UI, but the family dashboard still exposes a legacy shower field.');
  }

  await page.locator('input[type="time"]').first().fill('07:00');
  await page.getByRole('button', { name: /^Alert$/ }).first().click();

  const sleepCard = page.locator('h2:has-text("Last Night\'s Sleep")').locator('..').locator('..');
  await sleepCard.getByRole('button', { name: /^Light$/ }).click();
  await sleepCard.getByRole('button', { name: /^2$/ }).click();
  await sleepCard.getByRole('button', { name: /^Bathroom$/ }).click();
  await sleepCard.getByRole('button', { name: /^Pain$/ }).click();

  await page.locator('input[placeholder="120/80"]').fill('125/82');
  await page.locator('input[placeholder="72"]').fill('76');
  await page.locator('input[placeholder="98"]').fill('97');
  await page.locator('input[placeholder="5.5"]').fill('5.8');
  const vitalsTimeInputs = page.locator('input[type="time"]');
  if (await vitalsTimeInputs.count() > 1) {
    await vitalsTimeInputs.nth(1).fill('08:00');
  }

  const breakfastCard = page.locator('h2:has-text("Breakfast")').locator('..').locator('..');
  await breakfastCard.locator('input[type="time"]').fill('08:30');
  await breakfastCard.getByRole('button', { name: /^4$/ }).click();
  await breakfastCard.getByRole('button', { name: /^None$/ }).click();
  await breakfastCard.getByRole('button', { name: /^Coughing$/ }).click();
  await page.waitForTimeout(4000);

  if (await morningSubmit.isDisabled()) {
    recordIssue('Morning form submit remains disabled after required fields were filled.');
  } else {
    await morningSubmit.click();
    await page.waitForTimeout(2500);
  }
  await takeShot('06-morning-submitted');

  const morningLog = await getTodayLogAsCaregiver();
  careLogId = morningLog.id;
  if (morningLog?.nightSleep?.quality !== 'light') {
    recordIssue('Morning sleep quality/wakings do not persist to `nightSleep`; the split form is likely sending the wrong field name.');
  }
  observations.push(`Morning API nightSleep after submit: ${JSON.stringify(morningLog?.nightSleep ?? null)}`);

  await addFluid('water', 250, '09:15');
  await addFluid('tea', 200, '14:10');
  await addToileting('both', 'partial', '11:20');

  // Afternoon
  await page.goto(`${BASE_URL}/caregiver/form/afternoon`);
  await expect(page.locator('h1:has-text("Afternoon Care Log"), h1:has-text("Afternoon")').first()).toBeVisible({ timeout: 10000 });
  const afternoonSubmit = getSectionSubmitButton(page, 'afternoon');
  if (!(await afternoonSubmit.isDisabled())) {
    recordIssue('Afternoon form submit is enabled before lunch/rest requirements are complete.');
  }

  const lunchCard = page.locator('h2:has-text("Lunch")').locator('..').locator('..');
  await lunchCard.locator('input[type="time"]').fill('12:30');
  await lunchCard.getByRole('button', { name: /^3$/ }).click();
  await lunchCard.getByRole('button', { name: /^Some$/ }).click();

  const teaCard = page.locator('h2:has-text("Tea Break")').locator('..').locator('..');
  await teaCard.locator('input[type="time"]').fill('15:30');
  await teaCard.getByRole('button', { name: /^2$/ }).click();

  const restCard = page.locator('h2:has-text("Afternoon Rest")').locator('..').locator('..');
  await restCard.locator('input[type="checkbox"]').check();
  await restCard.locator('input[type="time"]').nth(0).fill('14:00');
  await restCard.locator('input[type="time"]').nth(1).fill('15:00');
  await restCard.getByRole('button', { name: /^Restless$/ }).click();
  await restCard.locator('input[placeholder="Any notes about rest..."]').fill('Dozed lightly after lunch.');
  await page.waitForTimeout(2000);

  if (await afternoonSubmit.isDisabled()) {
    recordIssue('Afternoon form submit remains disabled after lunch/rest inputs were provided.');
  } else {
    await afternoonSubmit.click();
    await page.waitForTimeout(2500);
  }
  await takeShot('07-afternoon-submitted');

  // Evening
  await page.goto(`${BASE_URL}/caregiver/form/evening`);
  await expect(page.locator('h1:has-text("Evening Care Log"), h1:has-text("Evening")').first()).toBeVisible({ timeout: 10000 });
  const eveningSubmit = getSectionSubmitButton(page, 'evening');
  if (!(await eveningSubmit.isDisabled())) {
    recordIssue('Evening form submit is enabled before dinner time is complete.');
  }
  if ((await page.locator('text=/Sleep Quality|Night Wakings|Reasons for Waking/i').count()) === 0) {
    observations.push('Evening form exposes bedtime/behaviors/notes but no quality/wakings controls.');
  }

  const dinnerCard = page.locator('h2:has-text("Dinner")').locator('..').locator('..');
  await dinnerCard.locator('input[type="time"]').fill('18:30');
  await dinnerCard.getByRole('button', { name: /^4$/ }).click();
  await dinnerCard.getByRole('button', { name: /^Some$/ }).click();

  const bedtimeCard = page.locator('h2:has-text("Bedtime")').locator('..').locator('..');
  await bedtimeCard.locator('input[type="time"]').fill('21:30');
  await bedtimeCard.getByRole('button', { name: /^Restless$/ }).click();
  await bedtimeCard.getByRole('button', { name: /^Calling out$/ }).click();
  await bedtimeCard.locator('input[placeholder="Any notes about bedtime..."], textarea').last().fill('Settled after reassurance.');
  await page.waitForTimeout(2000);

  if (await eveningSubmit.isDisabled()) {
    recordIssue('Evening form submit remains disabled after dinner time was filled.');
  } else {
    await eveningSubmit.click();
    await page.waitForTimeout(2500);
  }
  await takeShot('08-evening-submitted');

  // Summary
  await page.goto(`${BASE_URL}/caregiver/form/summary`);
  await expect(page.locator('h1:has-text("Daily Summary")')).toBeVisible({ timeout: 10000 });
  const summarySubmit = page.locator('button', { hasText: /Submit (Daily )?Summary/i }).first();
  if (!(await summarySubmit.isDisabled())) {
    recordIssue('Daily summary submit is enabled before balance issues are set.');
  }

  await page.getByRole('button', { name: /^2$/ }).first().click();
  await page.waitForTimeout(300);
  if (!(await summarySubmit.isDisabled())) {
    recordIssue('Daily summary only requires balance issues; safety, hygiene, and caregiver notes are not validated before submission.');
  }

  await page.getByRole('button', { name: /^None$/ }).nth(0).click();
  await page.getByRole('button', { name: /^None$/ }).nth(1).click();
  await page.getByRole('button', { name: /^Uses aid$/ }).click();

  const safetyLabels = [
    'Trip hazards cleared',
    'Cables secured',
    'Proper footwear worn',
    'Slip hazards addressed',
    'Mobility aids accessible',
    'Emergency equipment ready',
  ];
  for (const label of safetyLabels) {
    const row = page.locator(`text=${label}`).locator('..');
    await row.getByRole('button').click();
  }

  await page.locator('text=Bath/Shower').click();
  await page.locator('text=Hair Washed').click();
  await page.locator('text=Skin Care').click();
  await page.getByRole('button', { name: /^Both$/ }).click();
  await page.locator('input[placeholder="Any hygiene notes..."]').fill('Full hygiene support completed.');

  await page.getByRole('button', { name: /\+ Add Period/ }).click();
  const unaccompaniedCard = page.locator('h2:has-text("Unaccompanied Time")').locator('..').locator('..');
  await unaccompaniedCard.locator('input[type="time"]').nth(0).fill('16:00');
  await unaccompaniedCard.locator('input[type="time"]').nth(1).fill('16:30');
  await unaccompaniedCard.locator('input[placeholder="e.g., Break, errand"]').fill('Caregiver break');
  await unaccompaniedCard.locator('input[placeholder="e.g., Family member name"]').fill('Neighbor Mei');

  await page.locator('textarea[placeholder="Positive moments, good progress..."]').fill('Meals and hydration went smoothly.');
  await page.locator('textarea[placeholder="Any difficulties today..."]').fill('Needed extra reassurance at bedtime.');
  await page.locator('textarea[placeholder="Things to watch for, suggestions..."]').fill('Encourage another evening drink.');
  await page.locator('textarea[placeholder="Anything the family should know..."]').fill('Sleep was fragmented but manageable.');
  await page.locator('textarea[placeholder="Any other observations..."]').fill('Full rich-data audit run on anchor-dev.');

  await summarySubmit.click();
  await page.waitForTimeout(2500);
  await takeShot('09-summary-submitted');

  await page.goto(`${BASE_URL}/caregiver/form`);
  const completeDayButton = page.locator('button:has-text("Complete Day")').first();
  if (await isVisible(completeDayButton)) {
    await completeDayButton.click();
    await page.waitForTimeout(2500);
  }
  await takeShot('10-complete-day');

  // Patch fields that are not reachable through the current split-form UI so the family rendering can still be verified.
  const beforePatchLog = await getTodayLogAsCaregiver();
  careLogId = beforePatchLog.id;
  const patchResponse = await request.patch(`${API_URL}/care-logs/${careLogId}`, {
    headers: {
      Authorization: `Bearer ${caregiverToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      showerTime: '08:45',
      hairWash: true,
      medications: [
        {
          name: 'Metformin 500mg',
          given: true,
          time: '08:15',
          timeSlot: 'before_breakfast',
          purpose: 'Diabetes control',
        },
        {
          name: 'Atorvastatin 20mg',
          given: false,
          time: null,
          timeSlot: 'bedtime',
          notes: 'Patient declined at bedtime',
        },
      ],
      nightSleep: {
        ...(beforePatchLog.nightSleep || {}),
        bedtime: beforePatchLog.nightSleep?.bedtime || '21:30',
        quality: 'light',
        wakings: 2,
        wakingReasons: ['bathroom', 'pain'],
        behaviors: beforePatchLog.nightSleep?.behaviors || ['restless', 'calling out'],
        notes: beforePatchLog.nightSleep?.notes || 'Settled after reassurance.',
      },
    },
  });
  expect(patchResponse.ok()).toBeTruthy();

  // Family verification
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="email"]', familyEmail);
  await page.fill('input[name="password"]', familyPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/family/dashboard', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("Today")').click();
  await page.waitForTimeout(1000);

  familyToken = await page.evaluate(() => localStorage.getItem('token') || familyToken);
  const familyLog = await getTodayLogAsFamily();
  observations.push(`Family API keys: ${Object.keys(familyLog).sort().join(', ')}`);

  await takeShot('11-family-today');

  await expect(page.locator('text=Breakfast:')).toBeVisible();
  await expect(page.locator('text=Lunch:')).toBeVisible();
  await expect(page.locator('text=Dinner:')).toBeVisible();
  await expect(page.locator('text=125/82')).toBeVisible();
  await expect(page.locator('text=76 bpm')).toBeVisible();
  await expect(page.locator('text=97%')).toBeVisible();
  await expect(page.locator('text=5.8 mmol/L')).toBeVisible();
  await expect(page.locator('text=Metformin 500mg')).toBeVisible();
  await expect(page.locator('text=Atorvastatin 20mg')).toBeVisible();
  await expect(page.locator('text=450 ml')).toBeVisible();
  await expect(page.locator('text=Bedtime: 21:30')).toBeVisible();
  await expect(page.locator('text=Light Sleep')).toBeVisible();
  await expect(page.locator('text=Safety Checks: 6/6 Complete')).toBeVisible();
  await expect(page.locator('text=Meals and hydration went smoothly.')).toBeVisible();
  await expect(page.locator('text=08:45')).toBeVisible();

  if (familyLog.personalHygiene && (await page.locator('text=/Personal Hygiene|Bath\\/Shower|Hair Washed|Skin Care/i').count()) === 0) {
    recordIssue('Family API includes `personalHygiene`, but the family dashboard has no visible personal-hygiene card or fields.');
  }
  if (familyLog.personalHygiene?.oralCare === 'both' && (await page.locator('text=/Oral Care & Hygiene/i').count()) === 0) {
    recordIssue('Summary `personalHygiene.oralCare` was saved, but there is no family-side rendering for that simplified oral-care summary.');
  }

  await page.locator('button:has-text("Week")').click();
  await page.waitForTimeout(2500);
  await takeShot('12-family-week');
  if (familyLog.nightSleep?.quality && !(await isVisible(page.locator('text=Sleep Quality Trend')))) {
    recordIssue('Family week view did not show the sleep trend after sleep data was present.');
  }

  await page.locator('button:has-text("Activity")').click();
  await page.waitForTimeout(2000);
  await takeShot('13-family-activity');

  // Mobile sanity: caregiver login + summary layout + family dashboard width checks.
  const mobileContext = await browser.newContext({
    ...devices['iPhone 12'],
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/caregiver/login`);
  await mobilePage.fill('input[name="username"]', caregiverUsername);
  await mobilePage.fill('input[name="pin"]', caregiverPin);

  const mobileSubmitBox = await mobilePage.locator('button[type="submit"]').boundingBox();
  if (!mobileSubmitBox || mobileSubmitBox.height < 44) {
    recordIssue('Mobile caregiver login submit button is below the 44px touch-target baseline.');
  }

  await mobilePage.click('button[type="submit"]');
  await mobilePage.waitForURL('**/caregiver/form', { timeout: 20000 });
  await mobilePage.goto(`${BASE_URL}/caregiver/form/summary`);
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(1500);

  const summaryViewport = mobilePage.viewportSize();
  const summaryScrollWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
  if (summaryViewport && summaryScrollWidth > summaryViewport.width + 8) {
    recordIssue(`Mobile caregiver summary overflows horizontally (${summaryScrollWidth}px body width on a ${summaryViewport.width}px viewport).`);
  }

  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobilePage.waitForTimeout(800);
  const mobileFab = mobilePage.locator('div.fixed.bottom-6.right-6 > button').first();
  const mobileSummarySubmit = mobilePage.locator('button', { hasText: /Summary/i }).last();
  const fabBox = await mobileFab.boundingBox();
  const mobileSummaryBox = await mobileSummarySubmit.boundingBox();
  if (fabBox && mobileSummaryBox) {
    const overlaps =
      fabBox.x < mobileSummaryBox.x + mobileSummaryBox.width &&
      fabBox.x + fabBox.width > mobileSummaryBox.x &&
      fabBox.y < mobileSummaryBox.y + mobileSummaryBox.height &&
      fabBox.y + fabBox.height > mobileSummaryBox.y;
    if (overlaps) {
      recordIssue('Mobile quick-log FAB overlaps the daily-summary submit CTA near the bottom of the page.');
    }
  }
  await mobilePage.screenshot({ path: `${RESULT_DIR}/14-mobile-caregiver-summary.png`, fullPage: true });

  await mobilePage.goto(`${BASE_URL}/auth/login`);
  await mobilePage.fill('input[name="email"]', familyEmail);
  await mobilePage.fill('input[name="password"]', familyPassword);
  await mobilePage.click('button[type="submit"]');
  await mobilePage.waitForURL('**/family/dashboard', { timeout: 20000 });
  await mobilePage.waitForTimeout(2000);
  const familyViewport = mobilePage.viewportSize();
  const familyScrollWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
  if (familyViewport && familyScrollWidth > familyViewport.width + 8) {
    recordIssue(`Mobile family dashboard overflows horizontally (${familyScrollWidth}px body width on a ${familyViewport.width}px viewport).`);
  }
  await mobilePage.screenshot({ path: `${RESULT_DIR}/15-mobile-family-dashboard.png`, fullPage: true });
  await mobileContext.close();

  await fs.writeFile(
    `${RESULT_DIR}/summary.json`,
    JSON.stringify({
      baseUrl: BASE_URL,
      apiUrl: API_URL,
      family: { email: familyEmail, password: familyPassword },
      caregiver: { username: caregiverUsername, pin: caregiverPin },
      careRecipientId,
      careLogId,
      issues,
      observations,
    }, null, 2),
  );

  expect(issues, issues.join('\n')).toEqual([]);
});
