import { test, expect } from '@playwright/test';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';

// Use existing caregiver credentials
const USERNAME = 'formcg1766775326146';
const PIN = '762885';

test('Trace Morning Form Network Requests', async ({ page }) => {
  test.setTimeout(180000);

  // Capture ALL network requests
  const patchBodies: string[] = [];

  page.on('request', request => {
    if (request.method() === 'PATCH' && request.url().includes('care-logs')) {
      const body = request.postData() || '';
      patchBodies.push(body);
      console.log(`[PATCH] ${request.url()}`);
      console.log(`        Body: ${body}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('care-logs') && response.request().method() === 'PATCH') {
      console.log(`[PATCH RESPONSE] ${response.status()}`);
      try {
        const text = await response.text();
        console.log(`        Response: ${text.substring(0, 200)}`);
      } catch { /* ignore */ }
    }
  });

  // Login as caregiver
  console.log(`Logging in as ${USERNAME}...`);
  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="pin"]', PIN);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to morning form
  console.log('Navigating to morning form...');
  await page.goto(`${BASE_URL}/caregiver/form/morning`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Clear captured requests
  patchBodies.length = 0;

  // Fill wake time
  console.log('Filling wake time...');
  const wakeTimeInput = page.locator('input[type="time"]').first();
  await wakeTimeInput.waitFor({ state: 'visible' });
  await wakeTimeInput.click();
  await wakeTimeInput.fill('07:30');
  await wakeTimeInput.blur();
  console.log('Set wake time to 07:30');

  // Wait for autosave (3 second debounce + buffer)
  console.log('Waiting 6 seconds for autosave...');
  await page.waitForTimeout(6000);

  console.log(`\n=== PATCH Requests Captured: ${patchBodies.length} ===`);
  for (const body of patchBodies) {
    console.log(`Body: ${body}`);
    try {
      const data = JSON.parse(body);
      console.log(`  wakeTime: ${data.wakeTime}`);
      console.log(`  mood: ${data.mood}`);
    } catch { /* not JSON */ }
  }

  // Fill mood
  console.log('\nClicking mood button...');
  patchBodies.length = 0;
  const calmBtn = page.locator('button:has-text("Calm")').first();
  await calmBtn.click();
  console.log('Clicked Calm');

  // Wait for autosave
  await page.waitForTimeout(6000);

  console.log(`\n=== PATCH Requests After Mood: ${patchBodies.length} ===`);
  for (const body of patchBodies) {
    console.log(`Body: ${body}`);
    try {
      const data = JSON.parse(body);
      console.log(`  wakeTime: ${data.wakeTime}`);
      console.log(`  mood: ${data.mood}`);
    } catch { /* not JSON */ }
  }

  // Verify via API
  console.log('\n=== Verifying via API ===');
  const loginResp = await fetch(`${API_URL}/auth/caregiver/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, pin: PIN }),
  });
  const loginData = await loginResp.json() as { token: string };
  const token = loginData.token;

  const logResp = await fetch(`${API_URL}/care-logs/caregiver/today`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const logData = await logResp.json() as { wakeTime?: string; mood?: string };

  console.log('API Response:');
  console.log(`  wakeTime: ${logData.wakeTime}`);
  console.log(`  mood: ${logData.mood}`);

  // Check if any PATCH was sent
  if (patchBodies.length === 0 && !logData.wakeTime) {
    console.log('\n❌ NO PATCH REQUESTS WERE SENT - AUTOSAVE IS NOT WORKING!');
  }

  // At minimum, verify we can see PATCH requests
  expect(patchBodies.length).toBeGreaterThan(0);
});
