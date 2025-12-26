import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';

test('Verify Morning Form Autosave Captures Correct Data', async ({ page }) => {
  test.setTimeout(180000);

  // Collect all PATCH requests
  const patchRequests: { url: string; body: string }[] = [];

  page.on('request', request => {
    if (request.method() === 'PATCH' && request.url().includes('care-logs')) {
      const body = request.postData() || '';
      patchRequests.push({ url: request.url(), body });
      console.log(`>> PATCH ${request.url()}`);
      console.log(`   Body: ${body}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('care-logs') && response.request().method() === 'PATCH') {
      try {
        const text = await response.text();
        console.log(`<< ${response.status()} Response: ${text.substring(0, 200)}`);
      } catch {
        console.log(`<< ${response.status()} (no body)`);
      }
    }
  });

  // Create fresh caregiver account
  const timestamp = Date.now();
  const email = `autosave_test_${timestamp}@test.com`;
  const password = 'TestPass123!';
  const careRecipientName = 'Autosave Test Recipient';

  // Step 1: Create family account
  console.log('Creating family account...');
  await page.goto(`${BASE_URL}/signup`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Step 2: Setup care recipient
  await page.waitForURL(/.*setup.*|.*dashboard.*/, { timeout: 15000 });
  const setupNameInput = page.locator('input[placeholder*="name"], input[name="name"]').first();
  if (await setupNameInput.isVisible()) {
    await setupNameInput.fill(careRecipientName);
    await page.click('button:has-text("Continue"), button:has-text("Next")');
    await page.waitForTimeout(2000);
  }

  // Step 3: Create caregiver
  await page.goto(`${BASE_URL}/family/caregivers`);
  await page.waitForTimeout(2000);

  const addCaregiverBtn = page.locator('button:has-text("Add Caregiver")');
  if (await addCaregiverBtn.isVisible()) {
    await addCaregiverBtn.click();
    await page.waitForTimeout(1000);
  }

  const nameInput = page.locator('input[placeholder*="name"], input[name="name"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill(`Autosave Tester ${timestamp}`);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add")').first();
    await createBtn.click();
    await page.waitForTimeout(3000);
  }

  // Extract caregiver credentials
  let username = '';
  let pin = '';

  const credentialsCard = page.locator('text=/Username:/i').first();
  if (await credentialsCard.isVisible()) {
    const credText = await page.locator('.bg-gray-50, .bg-slate-50, [class*="credential"]').textContent();
    console.log('Credentials section:', credText);

    const usernameMatch = credText?.match(/Username:\s*(\S+)/);
    const pinMatch = credText?.match(/PIN:\s*(\d+)/);

    if (usernameMatch) username = usernameMatch[1];
    if (pinMatch) pin = pinMatch[1];
  }

  if (!username || !pin) {
    // Try another extraction method
    const allText = await page.content();
    const usernameMatch = allText.match(/Username:\s*([a-z0-9]+)/i);
    const pinMatch = allText.match(/PIN:\s*(\d{6})/);

    if (usernameMatch) username = usernameMatch[1];
    if (pinMatch) pin = pinMatch[1];
  }

  console.log(`Credentials: Username=${username}, PIN=${pin}`);
  expect(username).toBeTruthy();
  expect(pin).toBeTruthy();

  // Step 4: Login as caregiver
  console.log('Logging in as caregiver...');
  await page.goto(`${BASE_URL}/caregiver/login`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Step 5: Go to morning form
  console.log('Navigating to morning form...');
  await page.goto(`${BASE_URL}/caregiver/form/morning`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Clear any existing PATCH requests
  patchRequests.length = 0;

  // Step 6: Fill wake time ONLY
  console.log('Filling wake time...');
  const wakeUpSection = page.locator('h2:has-text("Wake Up")').locator('..').locator('..');
  const wakeTimeInput = wakeUpSection.locator('input[type="time"]').first();

  await wakeTimeInput.scrollIntoViewIfNeeded();
  await wakeTimeInput.click();
  await wakeTimeInput.fill('07:30');
  await wakeTimeInput.blur();
  console.log('Set wake time to 07:30');

  // Wait for autosave to trigger
  console.log('Waiting 5 seconds for autosave...');
  await page.waitForTimeout(5000);

  // Check what was sent
  console.log(`\n=== PATCH Requests Captured: ${patchRequests.length} ===`);
  for (const req of patchRequests) {
    console.log(`Body: ${req.body}`);

    // Verify wakeTime is correct
    try {
      const payload = JSON.parse(req.body);
      console.log(`  Parsed - wakeTime: ${payload.wakeTime}`);

      // This is the critical assertion - wakeTime should be 07:30
      if (payload.wakeTime) {
        expect(payload.wakeTime).toBe('07:30');
      }
    } catch {
      console.log('  Could not parse as JSON');
    }
  }

  // Now fill mood
  console.log('\nSelecting mood...');
  patchRequests.length = 0;

  const calmBtn = page.locator('button:has-text("Calm")').first();
  await calmBtn.click();
  console.log('Selected Calm mood');

  // Wait for autosave
  await page.waitForTimeout(5000);

  console.log(`\n=== PATCH Requests After Mood: ${patchRequests.length} ===`);
  for (const req of patchRequests) {
    console.log(`Body: ${req.body}`);

    try {
      const payload = JSON.parse(req.body);
      console.log(`  Parsed - wakeTime: ${payload.wakeTime}, mood: ${payload.mood}`);

      // Both should be correct now
      if (payload.wakeTime) {
        expect(payload.wakeTime).toBe('07:30');
      }
      if (payload.mood) {
        expect(payload.mood).toBe('calm');
      }
    } catch {
      console.log('  Could not parse as JSON');
    }
  }

  // Verify via API
  console.log('\n=== Verifying via API ===');
  const loginResp = await fetch(`${API_URL}/auth/caregiver/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  const loginData = await loginResp.json() as { token: string };
  const token = loginData.token;

  const logResp = await fetch(`${API_URL}/care-logs/caregiver/today`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const logData = await logResp.json() as { wakeTime: string | null; mood: string | null };

  console.log('API Response:');
  console.log(`  wakeTime: ${logData.wakeTime}`);
  console.log(`  mood: ${logData.mood}`);

  // Final assertion
  expect(logData.wakeTime).toBe('07:30');
  expect(logData.mood).toBe('calm');
});
