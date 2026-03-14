import { test, expect } from '@playwright/test';

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';

// This test debugs the family view issue for hello@ernie.sg
test.describe('Family View Debug', () => {
  test('Debug family API response', async ({ page }) => {
    test.setTimeout(120000);

    // Monitor network requests
    const apiCalls: Array<{ url: string; method: string; status?: number; response?: unknown }> = [];

    page.on('request', request => {
      if (request.url().includes('care-logs') || request.url().includes('care-recipients')) {
        console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async response => {
      if (response.url().includes('care-logs') || response.url().includes('care-recipients')) {
        const call = {
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
          response: null as unknown,
        };
        try {
          call.response = await response.json();
        } catch {
          call.response = await response.text().catch(() => 'Unable to read');
        }
        apiCalls.push(call);
        console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
        console.log(`           ${JSON.stringify(call.response).substring(0, 500)}`);
      }
    });

    // Navigate to family login
    await page.goto(`${BASE_URL}/family/login`);
    console.log('Navigated to login page');

    // Check if the login form exists
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Login form is visible');

    // Note: We don't know the actual password for hello@ernie.sg
    // So this test will just verify the form exists and login flow works

    // Let's instead test with a new signup to verify the dashboard works
    console.log('Creating a new test user to verify dashboard flow...');

    // Navigate to signup
    await page.goto(`${BASE_URL}/family/signup`);

    const timestamp = Date.now();
    const testEmail = `dashtest_${timestamp}@test.com`;
    const testPassword = 'TestPass123!';
    const testName = `Dashboard Tester ${timestamp}`;

    // Fill signup form
    await page.locator('input[name="email"]').fill(testEmail);
    await page.locator('input[name="name"]').fill(testName);
    await page.locator('input[name="password"]').fill(testPassword);
    const confirmPassword = page.locator('input[name="confirmPassword"]');
    if (await confirmPassword.count() > 0) {
      await confirmPassword.fill(testPassword);
    }

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('After signup, current URL:', page.url());

    // Check if we're redirected to onboarding or dashboard
    if (page.url().includes('onboarding')) {
      console.log('Redirected to onboarding - need to create care recipient first');

      // Complete onboarding
      const crNameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
      if (await crNameInput.count() > 0) {
        await crNameInput.fill('Test Care Recipient');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    }

    // Now log API calls
    console.log('\n=== API Calls Made ===');
    for (const call of apiCalls) {
      console.log(`${call.method} ${call.url}`);
      console.log(`  Status: ${call.status}`);
      console.log(`  Response: ${JSON.stringify(call.response).substring(0, 300)}`);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/family-debug.png' });

    console.log('\nFinal URL:', page.url());

    // Clean up - this is just a debug test
    expect(true).toBe(true);
  });

  test('Check API directly for care recipient data', async ({ request }) => {
    // Check if we can see what's happening with the API
    const CR_ID = '5415e93d-2c35-4f39-9641-1c52a25b2c3f';

    // First, let's verify the caregiver can see the data
    // Login as the caregiver (Jenny - quick-turtle-39)
    // We need to find her PIN first
    console.log('Checking care log status via database simulation...');

    // Use a caregiver we know works
    const cgLoginResp = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: {
        username: 'formcg1766776022171',
        pin: '133322',
      },
    });

    if (cgLoginResp.ok()) {
      const loginData = await cgLoginResp.json();
      console.log('Caregiver login successful');

      // Get the care log
      const logResp = await request.get(`${API_URL}/care-logs/caregiver/today`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });

      if (logResp.ok()) {
        const logData = await logResp.json();
        console.log('Caregiver today log:', JSON.stringify(logData, null, 2));
        console.log('Care recipient ID:', logData.careRecipientId);
        console.log('Completed sections:', JSON.stringify(logData.completedSections));
        console.log('Status:', logData.status);
        console.log('Wake time:', logData.wakeTime);
        console.log('Mood:', logData.mood);
      } else {
        console.log('Failed to get caregiver log:', await logResp.text());
      }
    } else {
      console.log('Caregiver login failed:', await cgLoginResp.text());
    }

    expect(true).toBe(true);
  });
});
