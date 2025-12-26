import { test, expect } from '@playwright/test';

test.describe('Live Site Testing', () => {
  const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
  
  test('complete signup flow on live site', async ({ page }) => {
    const timestamp = Date.now();
    
    console.log('=== Testing Live CF Site ===');
    console.log(`URL: ${BASE_URL}`);
    
    // 1. Landing page
    console.log('\n1. Opening landing page...');
    await page.goto(BASE_URL);
    await expect(page.locator('text=Anchor')).toBeVisible({ timeout: 10000 });
    console.log('✅ Landing page loaded');
    
    // 2. Go to signup
    console.log('\n2. Going to signup...');
    await page.click('text=Family Sign Up');
    await page.waitForURL('**/signup**', { timeout: 10000 });
    console.log('✅ On signup page');
    
    // 3. Fill form
    console.log('\n3. Filling signup form...');
    await page.fill('input[type="email"]', `live-test-${timestamp}@anchor.test`);
    
    // Try different selectors for name field
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input#name').first();
    await nameInput.fill(`Live Test User ${timestamp}`);
    
    // Fill password
    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();
    console.log(`Found ${count} password fields`);
    
    if (count >= 1) {
      await passwordInputs.nth(0).fill('TestPass123!');
    }
    if (count >= 2) {
      await passwordInputs.nth(1).fill('TestPass123!');
    }
    
    // Take screenshot before submit
    await page.screenshot({ path: '/tmp/before-submit.png' });
    console.log('Screenshot: /tmp/before-submit.png');
    
    // 4. Submit
    console.log('\n4. Submitting signup...');
    await page.click('button[type="submit"]');
    
    // Wait and check result
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    console.log(`\nFinal URL: ${finalUrl}`);
    
    // Take screenshot after submit
    await page.screenshot({ path: '/tmp/after-submit.png' });
    console.log('Screenshot: /tmp/after-submit.png');
    
    // Check if we made it to dashboard or onboarding
    if (finalUrl.includes('dashboard') || finalUrl.includes('onboarding')) {
      console.log('✅ Signup successful - redirected to dashboard/onboarding');
    } else if (finalUrl.includes('signup')) {
      console.log('⚠️ Still on signup page - check for errors');
      const errorText = await page.locator('.text-red, .error, [role="alert"]').textContent().catch(() => 'No error found');
      console.log(`Error message: ${errorText}`);
    }
  });
});
