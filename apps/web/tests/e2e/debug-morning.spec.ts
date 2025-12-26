import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';

// Use existing test credentials from last comprehensive test
const username = 'formcg1766772556878';
const pin = '897666';

test('Debug Morning Form Submission', async ({ page }) => {
  test.setTimeout(120000);

  // Capture console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });

  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('care-logs')) {
      console.log(`>> ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('   Body:', request.postData()?.substring(0, 500));
      }
    }
  });

  page.on('response', async response => {
    if (response.url().includes('care-logs')) {
      console.log(`<< ${response.status()} ${response.url()}`);
      try {
        const body = await response.text();
        if (body.length < 500) {
          console.log('   Response:', body);
        }
      } catch {
        // ignore
      }
    }
  });

  console.log('Using credentials:', username, pin);

  // Login as caregiver
  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Go to morning form
  console.log('Navigating to morning form...');
  await page.goto(`${BASE_URL}/caregiver/form/morning`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  console.log('Filling form...');

  // Fill wake time
  const wakeInput = page.locator('input[type="time"]').first();
  await wakeInput.click();
  await wakeInput.fill('07:30');
  await wakeInput.blur();
  console.log('Set wake time');

  // Select mood
  const calmBtn = page.locator('button:has-text("Calm")').first();
  if (await calmBtn.isVisible()) {
    await calmBtn.click();
    console.log('Selected Calm mood');
  }

  // Fill breakfast time - scroll to breakfast section
  const breakfastHeading = page.locator('h2:has-text("Breakfast")');
  if (await breakfastHeading.isVisible()) {
    await breakfastHeading.scrollIntoViewIfNeeded();
    // Find the time input within the breakfast section
    const breakfastSection = page.locator('div').filter({ has: breakfastHeading });
    const breakfastTime = breakfastSection.locator('input[type="time"]').first();
    if (await breakfastTime.isVisible()) {
      await breakfastTime.click();
      await breakfastTime.fill('08:30');
      await breakfastTime.blur();
      console.log('Set breakfast time');
    } else {
      console.log('Breakfast time input not found');
    }
  } else {
    console.log('Breakfast heading not visible');
  }

  await page.waitForTimeout(2000);

  // Check submit button state
  const submitBtn = page.locator('button:has-text("Submit Morning Section")');
  const isVisible = await submitBtn.isVisible();
  const isEnabled = await submitBtn.isEnabled();
  console.log(`Submit button - visible: ${isVisible}, enabled: ${isEnabled}`);

  // Get button's disabled attribute
  const disabledAttr = await submitBtn.getAttribute('disabled');
  console.log(`Submit button disabled attr: ${disabledAttr}`);

  // Check form state via progress indicator
  const progress = page.locator('text=/\\d\\/\\d required/');
  if (await progress.isVisible()) {
    console.log('Progress:', await progress.textContent());
  }

  // Click submit
  console.log('Clicking submit button...');
  await submitBtn.click();

  // Wait and check for response
  await page.waitForTimeout(5000);

  // Check if section was marked as submitted
  const submittedBadge = page.locator('text=Submitted');
  const isSubmitted = await submittedBadge.isVisible();
  console.log(`Submitted badge visible: ${isSubmitted}`);

  // Print all captured console logs
  console.log('\n=== Browser Console Logs ===');
  consoleLogs.forEach(log => console.log(log));

  // Verify via API
  console.log('\n=== Verifying via API ===');
  const loginResp = await fetch(`${API_URL}/auth/caregiver/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  const loginData = await loginResp.json();
  const token = loginData.token;

  const logResp = await fetch(`${API_URL}/care-logs/caregiver/today`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const logData = await logResp.json();

  console.log('Care log data:');
  console.log('  wakeTime:', logData.wakeTime);
  console.log('  mood:', logData.mood);
  console.log('  completedSections:', JSON.stringify(logData.completedSections));
  console.log('  meals.breakfast:', JSON.stringify(logData.meals?.breakfast));

  // This is the real test - data should be saved
  expect(logData.wakeTime).toBe('07:30');
  expect(logData.mood).toBe('calm');
});
