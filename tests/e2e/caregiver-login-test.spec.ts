import { test, expect } from '@playwright/test';

test.describe('Caregiver Login Test', () => {
  test('full flow: family signup -> caregiver creation -> caregiver login', async ({ page }) => {
    const timestamp = Date.now();
    const email = `cg-test-${timestamp}@test.com`;
    
    console.log('=== FULL CAREGIVER TEST ===');
    
    // ===== PART 1: Family Setup =====
    console.log('\n--- PART 1: Family Signup ---');
    await page.goto('/auth/signup');
    await page.waitForTimeout(1000);
    await page.getByLabel('Full Name').fill(`CG Test ${timestamp}`);
    await page.getByLabel('Email').fill(email);
    await page.getByPlaceholder('Minimum 8 characters').fill('TestPass123!');
    await page.getByPlaceholder('Re-enter your password').fill('TestPass123!');
    await page.click('button:has-text("Create Account")');
    await page.waitForURL('**/onboarding**', { timeout: 15000 });
    console.log('✅ Family signup complete');
    
    // ===== PART 2: Create Care Recipient =====
    console.log('\n--- PART 2: Care Recipient ---');
    await page.fill('input[placeholder*="Sulochana"]', 'CG Test Patient');
    await page.fill('input[type="date"]', '1950-01-15');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/caregiver**', { timeout: 10000 });
    console.log('✅ Care recipient created');
    
    // ===== PART 3: Create Caregiver =====
    console.log('\n--- PART 3: Create Caregiver ---');
    await page.fill('input[placeholder*="Maria"]', 'Test Caregiver');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(3000);
    
    // Wait for success card to appear
    await page.waitForSelector('text=Share these credentials', { timeout: 10000 });
    
    // Extract Caregiver ID (UUID) - it's in a font-mono span
    const idElement = page.locator('.bg-blue-50 .font-mono').first();
    const caregiverId = await idElement.textContent();
    
    // Extract PIN - it's large text in the primary-colored box
    const pinElement = page.locator('.text-5xl.font-bold');
    const pin = await pinElement.textContent();
    
    console.log(`Caregiver ID: ${caregiverId}`);
    console.log(`PIN: ${pin}`);
    
    if (!caregiverId || !pin) {
      console.log('❌ Failed to extract credentials');
      await page.screenshot({ path: '/tmp/caregiver-creds-fail.png' });
      return;
    }
    
    console.log('✅ Caregiver created with credentials');
    
    // ===== PART 4: Test Caregiver Login =====
    console.log('\n--- PART 4: Caregiver Login ---');
    
    // Navigate to caregiver login
    await page.goto('/caregiver/login');
    await page.waitForTimeout(1000);
    
    // Fill login form with Caregiver ID (UUID works too)
    await page.fill('input[name="username"], input[placeholder*="happy-panda"]', caregiverId.trim());
    await page.fill('input#pin-input, input[name="pin"]', pin.trim());
    
    await page.screenshot({ path: '/tmp/caregiver-login-filled.png' });
    
    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    await page.screenshot({ path: '/tmp/caregiver-login-result.png' });
    
    if (finalUrl.includes('/caregiver/form')) {
      console.log('✅ Caregiver login successful!');
      
      // Verify we can see the form
      await expect(page.locator('text=Daily Care Report')).toBeVisible({ timeout: 5000 });
      console.log('✅ Care form is visible');
    } else {
      console.log('❌ Login failed');
      const error = page.locator('.text-red, .text-error, [role="alert"]');
      if (await error.count() > 0) {
        console.log(`Error: ${await error.first().textContent()}`);
      }
    }
    
    console.log('\n=== TEST COMPLETE ===');
  });
});
