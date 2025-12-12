import { test, expect } from '@playwright/test';

test.describe('Debug Care Log Submission', () => {
  test('capture detailed error info', async ({ page }) => {
    const errors: string[] = [];
    const apiCalls: { url: string; status: number; body: string }[] = [];

    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[CONSOLE ${msg.type()}]:`, text);
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    // Capture all network requests and responses
    page.on('request', request => {
      if (request.url().includes('care-logs')) {
        console.log(`[REQUEST] ${request.method()} ${request.url()}`);
        console.log('[REQUEST BODY]:', request.postData());
      }
    });

    page.on('response', async response => {
      if (response.url().includes('care-logs')) {
        const status = response.status();
        console.log(`[RESPONSE] ${status} ${response.url()}`);

        try {
          const body = await response.text();
          console.log('[RESPONSE BODY]:', body);

          apiCalls.push({
            url: response.url(),
            status,
            body: body
          });
        } catch {
          console.log('[RESPONSE] Could not read body');
        }
      }
    });

    console.log('\n=== LOGIN ===');
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="text"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/caregiver/form');
    console.log('✅ Logged in');

    console.log('\n=== FILL MINIMAL FORM ===');

    // Section 1: Morning Routine
    await page.locator('input[type="time"]').first().fill('09:00');
    await page.locator('button:has-text("sleepy")').click();
    await page.locator('button:has-text("Next")').first().click();
    console.log('✅ Section 1 complete');

    // Section 2: Medications (skip)
    await page.locator('button:has-text("Next")').first().click();
    console.log('✅ Section 2 skipped');

    // Section 3: Meals - FILL THIS TO AVOID VALIDATION ERRORS
    await page.locator('input[type="time"]').first().fill('09:00');
    const sliders = await page.locator('input[type="range"]').all();
    await sliders[0].fill('3');
    await sliders[1].fill('50');
    await page.locator('button:has-text("Next")').first().click();
    console.log('✅ Section 3 complete');

    // Section 4: Vitals (skip)
    await page.locator('button:has-text("Next")').first().click();
    console.log('✅ Section 4 skipped');

    // Section 5: Toileting - FILL TO AVOID VALIDATION
    const toiletInputs = await page.locator('input[type="number"]').all();
    if (toiletInputs.length > 0) {
      await toiletInputs[0].fill('1');
    }
    await page.locator('button:has-text("Next")').first().click();
    console.log('✅ Section 5 complete');

    // Navigate through remaining sections
    console.log('\n=== NAVIGATE TO SUBMIT ===');
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      const nextButtons = await page.locator('button').filter({ hasText: /Next/i }).all();

      if (nextButtons.length > 0) {
        console.log(`Clicking Next button ${i + 1}`);
        await nextButtons[0].click();
      } else {
        const submitExists = await page.locator('button:has-text("Submit Report")').count();
        if (submitExists > 0) {
          console.log('✅ Reached submit section');
          break;
        }
      }
    }

    // Take screenshot before submit
    await page.screenshot({ path: '/tmp/before-submit-debug.png', fullPage: true });

    console.log('\n=== ATTEMPT SUBMIT ===');
    const submitButton = page.locator('button:has-text("Submit Report")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    console.log('Clicking Submit Report...');
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(5000);

    // Take screenshot after submit
    await page.screenshot({ path: '/tmp/after-submit-debug.png', fullPage: true });

    console.log('\n=== RESULTS ===');
    console.log('Errors captured:', errors.length);
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));

    console.log('\nAPI Calls:', apiCalls.length);
    apiCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.status} ${call.url}`);
      console.log(`     Body: ${call.body.substring(0, 200)}`);
    });

    const currentUrl = page.url();
    console.log('\nFinal URL:', currentUrl);

    if (currentUrl.includes('/caregiver/form')) {
      console.log('❌ SUBMISSION FAILED - Still on form');
    } else {
      console.log('✅ SUBMISSION SUCCESS - Redirected');
    }
  });
});
