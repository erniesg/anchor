import { test, expect } from '@playwright/test';

test.describe('Caregiver Form Submission', () => {
  test('should login as caregiver and submit care log', async ({ page }) => {
    // Enable console and network logging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('Error')) {
        console.log('❌ BROWSER ERROR:', msg.text());
      }
    });

    page.on('response', async response => {
      if (response.status() >= 400) {
        console.log(`❌ HTTP ${response.status()}: ${response.url()}`);
        try {
          const body = await response.text();
          console.log('Response body:', body);
        } catch (e) {
          // Ignore if can't read body
        }
      } else if (response.url().includes('care-logs')) {
        console.log(`✅ HTTP ${response.status()}: ${response.url()}`);
      }
    });

    console.log('\n=== STEP 1: Login ===');
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[type="text"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[type="password"]', '123456');

    console.log('Submitting login...');
    await page.click('button[type="submit"]');

    // Wait for redirect to form
    await page.waitForURL('**/caregiver/form', { timeout: 10000 });
    console.log('✅ Login successful, redirected to form');

    // Check localStorage
    const caregiverToken = await page.evaluate(() => localStorage.getItem('caregiverToken'));
    const careRecipient = await page.evaluate(() => localStorage.getItem('careRecipient'));
    console.log('caregiverToken exists:', !!caregiverToken);
    console.log('careRecipient:', careRecipient ? JSON.parse(careRecipient).name : 'MISSING');

    console.log('\n=== STEP 2: Fill Form ===');

    // Section 1: Morning Routine
    console.log('Filling Section 1: Morning Routine');
    await page.locator('input[type="time"]').first().fill('09:00');
    await page.locator('button:has-text("sleepy")').click();
    await page.locator('button:has-text("Next")').first().click();

    // Section 2: Medications (skip)
    console.log('Skipping Section 2: Medications');
    await page.locator('button:has-text("Next")').first().click();

    // Section 3: Meals
    console.log('Filling Section 3: Meals');
    await page.locator('input[type="time"]').first().fill('09:00');
    const sliders = await page.locator('input[type="range"]').all();
    if (sliders.length >= 2) {
      await sliders[0].fill('3'); // appetite
      await sliders[1].fill('50'); // amount eaten
    }
    await page.locator('button:has-text("Next")').first().click();

    // Section 4: Vitals (skip)
    console.log('Skipping Section 4: Vitals');
    await page.locator('button:has-text("Next")').first().click();

    // Section 5: Toileting
    console.log('Filling Section 5: Toileting');
    await page.locator('input[type="number"]').first().fill('1');
    await page.locator('button:has-text("Next")').first().click();

    // Navigate through remaining sections by scrolling down and finding Next buttons
    console.log('Navigating through remaining sections...');

    // Keep clicking Next until we reach the submit section
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);

      // Try to find Next button
      const nextButtons = await page.locator('button').filter({ hasText: /Next/i }).all();

      if (nextButtons.length > 0) {
        console.log(`Found ${nextButtons.length} Next button(s), clicking first one`);
        await nextButtons[0].click();
      } else {
        // No Next button, might be on final section
        console.log('No Next button found, checking for Submit button');
        const submitExists = await page.locator('button:has-text("Submit Report")').count();
        if (submitExists > 0) {
          console.log('Found Submit button, ready to submit');
          break;
        }
      }
    }

    console.log('\n=== STEP 3: Submit ===');

    // Take screenshot to see where we are
    await page.screenshot({ path: '/tmp/before-submit.png', fullPage: true });
    console.log('📸 Screenshot saved');

    // Get current section
    const pageContent = await page.locator('body').textContent();
    console.log('Page contains Submit Report:', pageContent?.includes('Submit Report'));

    // Section 9: Notes & Submit
    // Look for the submit button
    const submitButton = page.locator('button:has-text("Submit Report")');
    const submitExists = await submitButton.count();

    if (submitExists === 0) {
      console.log('❌ Submit button not found! Scroll down...');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/after-scroll.png', fullPage: true });
    }

    await expect(submitButton).toBeVisible({ timeout: 5000 });

    console.log('Clicking Submit Report...');
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for success or error
    const currentUrl = page.url();
    console.log('Current URL after submit:', currentUrl);

    // Take screenshot
    await page.screenshot({ path: '/tmp/caregiver-form-after-submit.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/caregiver-form-after-submit.png');

    // Check if still on form (error) or redirected (success)
    if (currentUrl.includes('/caregiver/form')) {
      console.log('⚠️ Still on form page - likely submission failed');
      // Try to find error messages
      const errorText = await page.locator('body').textContent();
      if (errorText?.includes('error') || errorText?.includes('Error')) {
        console.log('Error found on page');
      }
    } else {
      console.log('✅ Redirected after submit - likely success');
    }
  });
});
