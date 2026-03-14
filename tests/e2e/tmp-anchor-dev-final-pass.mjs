import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';
const RESULT_DIR = '/tmp/anchor-dev-final-pass';

await fs.mkdir(RESULT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const issues = [];
const runtimeErrors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shot(name) {
  await page.screenshot({ path: `${RESULT_DIR}/${name}.png`, fullPage: true });
}

async function step(label, fn) {
  console.log(`STEP: ${label}`);
  const result = await fn();
  console.log(`DONE: ${label}`);
  return result;
}

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    runtimeErrors.push(text);
    console.log('BROWSER ERROR:', text);
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
    console.log('HTTP', response.status(), response.url(), body);
  }
});

const timestamp = Date.now();
const familyEmail = `final-pass-${timestamp}@example.com`;
const familyPassword = 'TestPass123!';
const familyName = `Final Pass ${timestamp}`;
const recipientName = `Final Recipient ${timestamp % 100000}`;
const caregiverName = `Final Caregiver ${timestamp % 100000}`;
const requestedUsername = `fpcg${timestamp}`.slice(0, 20);
let caregiverUsername = requestedUsername;
let caregiverPin = '';
let caregiverToken = '';
let familyToken = '';
let careRecipientId = '';
let careLogId = '';

async function getFamilyLog() {
  const response = await page.request.get(`${API_URL}/care-logs/recipient/${careRecipientId}/today`, {
    headers: { Authorization: `Bearer ${familyToken}` },
  });
  assert(response.ok(), `family today log failed: ${response.status()}`);
  return response.json();
}

async function getCaregiverLog() {
  const response = await page.request.get(`${API_URL}/care-logs/caregiver/today`, {
    headers: { Authorization: `Bearer ${caregiverToken}` },
  });
  assert(response.ok(), `caregiver today log failed: ${response.status()}`);
  return response.json();
}

async function openQuickLog() {
  await page.locator('div.fixed.bottom-6.right-6 > button').first().click();
}

async function addFluid(drinkType, amount, time) {
  await openQuickLog();
  await page.getByRole('button', { name: /Fluid/i }).click();
  await page.locator('select').first().selectOption(drinkType);
  await page.getByRole('button', { name: new RegExp(`^${amount}$`) }).click();
  await page.locator('input[type="time"]').last().fill(time);
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(1200);
}

async function addToileting(type, assistance, time) {
  await openQuickLog();
  await page.getByRole('button', { name: /Toileting/i }).click();
  await page.getByRole('button', { name: new RegExp(type === 'both' ? 'Both' : type === 'bowel' ? 'Bowel' : 'Urination') }).click();
  await page.getByRole('button', { name: new RegExp(assistance === 'full' ? 'Full' : assistance === 'partial' ? 'Partial' : 'None') }).click();
  await page.locator('input[type="time"]').last().fill(time);
  await page.locator('textarea').last().fill('Recorded during final pass.');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(1200);
}

async function addExercise(type, duration, time) {
  await openQuickLog();
  await page.getByRole('button', { name: /Exercise/i }).click();
  await page.locator('select').first().selectOption(type);
  await page.getByRole('button', { name: new RegExp(`^${duration}$`) }).click();
  await page.locator('input[type="time"]').last().fill(time);
  await page.locator('textarea').last().fill('Gentle supervised session.');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(1200);
}

try {
  await step('family signup', async () => {
    await page.goto(`${BASE_URL}/auth/signup`);
    await page.fill('input[name="name"]', familyName);
    await page.fill('input[name="email"]', familyEmail);
    await page.fill('input[name="phone"]', '+65 8123 4567');
    await page.fill('input[name="password"]', familyPassword);
    await page.fill('input[name="confirmPassword"]', familyPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/family/onboarding', { timeout: 20000 });
    await shot('01-signup');
  });

  await step('family onboarding', async () => {
    await page.locator('input[placeholder*="Sulochana"], input[type="text"][required]').first().fill(recipientName);
    await page.fill('input[type="date"]', '1945-03-15');
    await page.fill('input[placeholder*="Dementia"]', 'Progressive supranuclear palsy');
    await page.fill('input[placeholder*="Singapore"]', 'Singapore, Ang Mo Kio');
    await page.fill('input[type="tel"]', '+65 9000 1111');
    await page.locator('button[type="submit"]:has-text("Continue"), button:has-text("Continue")').first().click();
    await page.waitForURL('**/family/onboarding/caregiver', { timeout: 20000 });
    await page.fill('input[placeholder*="Maria"]', caregiverName);
    const usernameField = page.locator('input[placeholder*="maria-helper"]');
    if (await usernameField.count()) await usernameField.fill(requestedUsername);
    const caregiverPhoneField = page.locator('input[type="tel"]');
    if (await caregiverPhoneField.count()) await caregiverPhoneField.fill('+65 9888 7777');
    const languageSelect = page.locator('select');
    if (await languageSelect.count()) await languageSelect.selectOption('en');
    await page.locator('button[type="submit"]:has-text("Generate PIN"), button:has-text("Generate PIN")').first().click();
    await page.locator('h2:has-text("Caregiver Account Created!")').waitFor({ timeout: 20000 });
    const displayedUsername = page.locator('.bg-blue-50 .font-mono, .bg-blue-50 .text-2xl');
    if (await displayedUsername.count()) caregiverUsername = ((await displayedUsername.first().textContent()) || caregiverUsername).trim();
    caregiverPin = ((((await page.locator('.tracking-widest, p.text-5xl.font-bold.text-primary-700').first().textContent()) || '').replace(/\s/g, '')).trim());
    assert(/^\d{6}$/.test(caregiverPin), 'caregiver PIN missing');
    await page.locator('button:has-text("Go to Dashboard")').click();
    await page.waitForURL('**/family/dashboard', { timeout: 20000 });
    familyToken = await page.evaluate(() => localStorage.getItem('token') || '');
    const storedRecipient = await page.evaluate(() => localStorage.getItem('careRecipient') || '');
    careRecipientId = JSON.parse(storedRecipient).id;
    assert(familyToken && careRecipientId, 'family auth or recipient missing after onboarding');
    await shot('02-family-dashboard-empty');
  });

  await step('caregiver login', async () => {
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/caregiver/form', { timeout: 20000 });
    caregiverToken = await page.evaluate(() => localStorage.getItem('caregiverToken') || '');
    assert(caregiverToken, 'caregiver token missing after login');
  });

  await step('morning section', async () => {
    await page.goto(`${BASE_URL}/caregiver/form/morning`);
    const submitButton = page.getByRole('button', { name: /^(Submit Morning Section|Update & Re-submit Morning|Complete Required Fields)$/ });
    assert(await submitButton.isDisabled(), 'morning submit should start disabled');
    await page.locator('input[type="time"]').first().fill('07:00');
    await page.getByRole('button', { name: /^Alert$/ }).click();
    const sleepCard = page.locator('h2:has-text("Last Night\'s Sleep")').locator('..').locator('..');
    await sleepCard.getByRole('button', { name: /^Light$/ }).click();
    await sleepCard.getByRole('button', { name: /^2$/ }).click();
    await sleepCard.getByRole('button', { name: /^Bathroom$/ }).click();
    await sleepCard.getByRole('button', { name: /^Pain$/ }).click();
    await page.locator('input[placeholder="120/80"]').fill('125/82');
    await page.locator('input[placeholder="72"]').fill('76');
    await page.locator('input[placeholder="98"]').fill('97');
    await page.locator('input[placeholder="5.5"]').fill('5.8');
    const morningTimes = page.locator('input[type="time"]');
    await morningTimes.nth(1).fill('08:00');
    const breakfastCard = page.locator('h2:has-text("Breakfast")').locator('..').locator('..');
    await breakfastCard.locator('input[type="time"]').fill('08:30');
    await breakfastCard.getByRole('button', { name: /^4$/ }).click();
    await breakfastCard.getByRole('button', { name: /^None$/ }).click();
    await breakfastCard.getByRole('button', { name: /^Coughing$/ }).click();
    assert(!(await submitButton.isDisabled()), 'morning submit should enable after required fields');
    await submitButton.click();
    await page.waitForTimeout(2000);
    const log = await getCaregiverLog();
    careLogId = log.id;
    assert(log.nightSleep?.quality === 'light', 'morning sleep quality did not persist');
    assert(log.meals?.breakfast?.time === '08:30', 'breakfast missing after morning submit');
    await shot('03-morning-submitted');
  });

  await step('quick actions', async () => {
    await addFluid('water', 250, '09:15');
    await addFluid('tea', 200, '14:10');
    await addToileting('both', 'partial', '11:20');
    await addExercise('walking', 15, '17:00');
    const log = await getCaregiverLog();
    assert(log.totalFluidIntake === 450, `expected totalFluidIntake 450, got ${log.totalFluidIntake}`);
    assert(log.bowelMovements?.frequency === 1, 'bowel movement quick action missing');
    assert(log.urination?.frequency === 1, 'urination quick action missing');
    assert(log.physicalActivity?.exerciseDuration === 15, 'exercise quick action missing');
  });

  await step('afternoon section', async () => {
    await page.goto(`${BASE_URL}/caregiver/form/afternoon`);
    const submitButton = page.getByRole('button', { name: /^(Submit Afternoon Section|Update & Re-submit Afternoon|Complete Required Fields)$/ });
    assert(await submitButton.isDisabled(), 'afternoon submit should start disabled');
    const lunchCard = page.locator('h2:has-text("Lunch")').locator('..').locator('..');
    await lunchCard.locator('input[type="time"]').fill('12:30');
    await lunchCard.getByRole('button', { name: /^3$/ }).click();
    await lunchCard.getByRole('button', { name: /^Some$/ }).click();
    const teaCard = page.locator('h2:has-text("Tea Break")').locator('..').locator('..');
    await teaCard.locator('input[type="time"]').fill('15:30');
    await teaCard.getByRole('button', { name: /^2$/ }).click();
    const restCard = page.locator('h2:has-text("Afternoon Rest")').locator('..').locator('..');
    await restCard.locator('input[type="checkbox"]').check();
    const allTimes = page.locator('input[type="time"]');
    await allTimes.nth(2).fill('14:00');
    await allTimes.nth(3).fill('15:00');
    await page.getByRole('button', { name: /^Restless$/ }).click();
    await page.locator('input[placeholder="Any notes about rest..."]').fill('Dozed lightly after lunch.');
    assert(!(await submitButton.isDisabled()), 'afternoon submit should enable after required fields');
    await submitButton.click();
    await page.waitForTimeout(2000);
    const log = await getCaregiverLog();
    assert(log.meals?.lunch?.time === '12:30', 'lunch missing after afternoon submit');
    assert(log.meals?.teaBreak?.time === '15:30', 'tea break missing after afternoon submit');
    assert(log.afternoonRest?.startTime === '14:00', 'afternoon rest missing after submit');
    await shot('04-afternoon-submitted');
  });

  await step('evening section', async () => {
    await page.goto(`${BASE_URL}/caregiver/form/evening`);
    const submitButton = page.getByRole('button', { name: /^(Submit Evening Section|Update & Re-submit Evening|Complete Required Fields)$/ });
    assert(await submitButton.isDisabled(), 'evening submit should start disabled');
    const dinnerCard = page.locator('h2:has-text("Dinner")').locator('..').locator('..');
    await dinnerCard.locator('input[type="time"]').fill('18:30');
    await dinnerCard.getByRole('button', { name: /^4$/ }).click();
    await dinnerCard.getByRole('button', { name: /^Some$/ }).click();
    const bedtimeCard = page.locator('h2:has-text("Bedtime")').locator('..').locator('..');
    await bedtimeCard.locator('input[type="time"]').fill('21:30');
    await bedtimeCard.getByRole('button', { name: /^Restless$/ }).click();
    await bedtimeCard.getByRole('button', { name: /^Calling out$/ }).click();
    await bedtimeCard.locator('input[placeholder="Any notes about bedtime..."]').fill('Settled after reassurance.');
    assert(!(await submitButton.isDisabled()), 'evening submit should enable after dinner time');
    await submitButton.click();
    await page.waitForTimeout(2000);
    const log = await getCaregiverLog();
    assert(log.meals?.dinner?.time === '18:30', 'dinner missing after evening submit');
    assert(log.nightSleep?.bedtime === '21:30', 'bedtime missing after evening submit');
    await shot('05-evening-submitted');
  });

  await step('summary section', async () => {
    await page.goto(`${BASE_URL}/caregiver/form/summary`);
    const submitButton = page.getByRole('button', { name: /^(Submit Daily Summary|Update & Re-submit Summary|Complete Required Fields)$/ });
    assert(await submitButton.isDisabled(), 'summary submit should start disabled');
    await page.getByRole('button', { name: /^2$/ }).first().click();
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
      await page.locator(`text=${label}`).locator('..').getByRole('button').click();
    }
    await page.getByRole('button', { name: /Bath\/Shower/ }).click();
    await page.getByRole('button', { name: /Hair Washed/ }).click();
    await page.getByRole('button', { name: /Skin Care/ }).click();
    await page.getByRole('button', { name: /^Both$/ }).click();
    await page.locator('input[placeholder="Any hygiene notes..."]').fill('Full hygiene support completed.');
    await page.getByRole('button', { name: /\+ Add Period/ }).click();
    const summaryTimes = page.locator('input[type="time"]');
    await summaryTimes.nth(0).fill('16:00');
    await summaryTimes.nth(1).fill('16:30');
    await page.locator('input[placeholder="e.g., Break, errand"]').fill('Caregiver break');
    await page.locator('input[placeholder="e.g., Family member name"]').fill('Neighbor Mei');
    await page.locator('textarea[placeholder="Positive moments, good progress..."]').fill('Meals and hydration went smoothly.');
    await page.locator('textarea[placeholder="Any difficulties today..."]').fill('Needed extra reassurance at bedtime.');
    await page.locator('textarea[placeholder="Things to watch for, suggestions..."]').fill('Encourage another evening drink.');
    await page.locator('textarea[placeholder="Anything the family should know..."]').fill('Sleep was fragmented but manageable.');
    await page.locator('textarea[placeholder="Any other observations..."]').fill('Final rich-data pass on anchor-dev.');
    assert(!(await submitButton.isDisabled()), 'summary submit should enable after balance issues are set');
    await submitButton.click();
    await page.waitForTimeout(2000);
    const log = await getCaregiverLog();
    const patchResponse = await page.request.patch(`${API_URL}/care-logs/${log.id}`, {
      headers: {
        Authorization: `Bearer ${caregiverToken}`,
        'Content-Type': 'application/json',
      },
      data: {
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
            timeSlot: 'before_bedtime',
            notes: 'Patient declined at bedtime',
          },
        ],
      },
    });
    assert(patchResponse.ok(), `medication patch failed: ${patchResponse.status()}`);
    await shot('06-summary-submitted');
  });

  await step('complete day submit', async () => {
    await page.goto(`${BASE_URL}/caregiver/form`);
    await page.getByRole('button', { name: /Complete Day & Submit/ }).click();
    await page.waitForTimeout(2500);
    const log = await getCaregiverLog();
    assert(log.status === 'submitted', `expected submitted status, got ${log.status}`);
    assert(log.meals?.breakfast?.time === '08:30', 'breakfast missing after final submit');
    assert(log.meals?.lunch?.time === '12:30', 'lunch missing after final submit');
    assert(log.meals?.teaBreak?.time === '15:30', 'tea break missing after final submit');
    assert(log.meals?.dinner?.time === '18:30', 'dinner missing after final submit');
    assert(log.personalHygiene?.oralCare === 'both', 'personal hygiene oral care missing after final submit');
    await shot('07-day-submitted');
  });

  await step('family dashboard verification', async () => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', familyEmail);
    await page.fill('input[name="password"]', familyPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/family/dashboard', { timeout: 20000 });
    await page.waitForTimeout(3000);
    familyToken = await page.evaluate(() => localStorage.getItem('token') || familyToken);
    const log = await getFamilyLog();
    assert(log.status === 'submitted', 'family today log not submitted');
    assert(log.totalFluidIntake === 450, `family fluid total mismatch: ${log.totalFluidIntake}`);
    assert(log.personalHygiene?.bathOrShower === true, 'family personal hygiene missing bath/shower');
    assert(log.medications?.length === 2, 'family medications missing');
    const expectedTexts = [
      'Breakfast:',
      'Lunch:',
      'Tea Break:',
      'Dinner:',
      '125/82',
      '76 bpm',
      '97%',
      '5.8 mmol/L',
      '450 ml',
      'Bedtime: 21:30',
      'Light Sleep',
      'Safety Checks: 6/6 Complete',
      'Meals and hydration went smoothly.',
      'Metformin 500mg',
      'Atorvastatin 20mg',
    ];
    for (const text of expectedTexts) {
      await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
    }
    await shot('08-family-dashboard-today');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Week$/ }).click();
    await page.waitForTimeout(1500);
    await page.getByText('Sleep Quality Trend', { exact: false }).waitFor({ timeout: 10000 });
    await page.getByText('Medication Adherence', { exact: false }).waitFor({ timeout: 10000 });
    await shot('09-family-dashboard-week');
    await page.goto(`${BASE_URL}/family/trends`);
    await page.getByText('7-Day Health Trends').waitFor({ timeout: 20000 });
    await page.getByText('Blood Pressure Trends (7 Days)', { exact: false }).waitFor({ timeout: 10000 });
    await page.getByText('Appetite & Meal Consumption', { exact: false }).waitFor({ timeout: 10000 });
    await shot('10-family-trends');
  });

  await step('mobile sanity', async () => {
    const mobileContext = await browser.newContext({ ...devices['iPhone 12'] });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/caregiver/login`);
    await mobilePage.fill('input[name="username"]', caregiverUsername);
    await mobilePage.fill('input[name="pin"]', caregiverPin);
    const submitBox = await mobilePage.locator('button[type="submit"]').boundingBox();
    assert(submitBox && submitBox.height >= 44, 'mobile caregiver login submit touch target is too small');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL('**/caregiver/form', { timeout: 20000 });
    await mobilePage.goto(`${BASE_URL}/caregiver/form/summary`);
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.waitForTimeout(1500);
    const summaryViewport = mobilePage.viewportSize();
    const summaryScrollWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    assert(!summaryViewport || summaryScrollWidth <= summaryViewport.width + 8, `mobile summary overflow: ${summaryScrollWidth}`);
    await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mobilePage.waitForTimeout(800);
    const fabBox = await mobilePage.locator('div.fixed.bottom-6.right-6 > button').first().boundingBox();
    const summaryButtonBox = await mobilePage.getByRole('button', { name: /^(Submit Daily Summary|Update & Re-submit Summary|Complete Required Fields)$/ }).boundingBox();
    if (fabBox && summaryButtonBox) {
      const overlaps = fabBox.x < summaryButtonBox.x + summaryButtonBox.width &&
        fabBox.x + fabBox.width > summaryButtonBox.x &&
        fabBox.y < summaryButtonBox.y + summaryButtonBox.height &&
        fabBox.y + fabBox.height > summaryButtonBox.y;
      assert(!overlaps, 'mobile quick-log FAB overlaps summary submit CTA');
    }
    await mobilePage.goto(`${BASE_URL}/auth/login`);
    await mobilePage.fill('input[name="email"]', familyEmail);
    await mobilePage.fill('input[name="password"]', familyPassword);
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL('**/family/dashboard', { timeout: 20000 });
    await mobilePage.waitForTimeout(2000);
    const familyViewport = mobilePage.viewportSize();
    const familyScrollWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    assert(!familyViewport || familyScrollWidth <= familyViewport.width + 8, `mobile family dashboard overflow: ${familyScrollWidth}`);
    await mobilePage.screenshot({ path: `${RESULT_DIR}/11-mobile-family-dashboard.png`, fullPage: true });
    await mobileContext.close();
  });

  const functionalRuntimeErrors = runtimeErrors.filter((text) =>
    text.includes('Failed to fetch day log') || text.includes('Failed to fetch care recipients')
  );
  if (functionalRuntimeErrors.length) {
    issues.push(...functionalRuntimeErrors);
  }

  await fs.writeFile(`${RESULT_DIR}/summary.json`, JSON.stringify({
    familyEmail,
    familyPassword,
    caregiverUsername,
    caregiverPin,
    careRecipientId,
    careLogId,
    runtimeErrors,
    issues,
  }, null, 2));

  console.log('FINAL PASS COMPLETE');
  console.log(JSON.stringify({
    careRecipientId,
    careLogId,
    issuesCount: issues.length,
    runtimeErrorCount: runtimeErrors.length,
  }, null, 2));
} catch (error) {
  console.error('FINAL PASS FAILED:', error);
  await page.screenshot({ path: `${RESULT_DIR}/failure.png`, fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
