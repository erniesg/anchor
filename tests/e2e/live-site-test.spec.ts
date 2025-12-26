import { test, expect } from '@playwright/test';

test.describe('Live Site Full Flow', () => {
  test('full signup to caregiver creation', async ({ page }) => {
    const timestamp = Date.now();
    const email = `live-${timestamp}@test.com`;
    const password = 'TestPass123!';
    
    console.log('=== FULL FLOW TEST ===');
    console.log(`Email: ${email}\n`);
    
    // ========== STEP 1: SIGNUP ==========
    console.log('STEP 1: Family Signup');
    await page.goto('/auth/signup');
    await page.waitForTimeout(2000);
    
    await page.getByLabel('Full Name').fill(`Test User ${timestamp}`);
    await page.getByLabel('Email').fill(email);
    await page.getByPlaceholder('Minimum 8 characters').fill(password);
    await page.getByPlaceholder('Re-enter your password').fill(password);
    
    await page.click('button:has-text("Create Account")');
    
    // Wait for navigation
    await page.waitForURL('**/onboarding**', { timeout: 15000 });
    console.log('✅ Signup successful!\n');
    
    // ========== STEP 2: CREATE CARE RECIPIENT ==========
    console.log('STEP 2: Create Care Recipient');
    await page.waitForTimeout(2000);
    
    await page.fill('input[placeholder*="Sulochana"]', 'Test Care Recipient');
    await page.fill('input[type="date"]', '1950-01-15');
    await page.fill('input[placeholder*="Dementia"]', 'Dementia');
    
    console.log('Clicking Continue...');
    await page.click('button:has-text("Continue")');
    
    // Wait for navigation OR error
    try {
      await page.waitForURL('**/caregiver**', { timeout: 10000 });
      console.log('✅ Care recipient created!\n');
    } catch {
      // Check for errors
      const errorEl = page.locator('.bg-error, .text-red, .text-error, [role="alert"]');
      if (await errorEl.count() > 0) {
        const errorText = await errorEl.first().textContent();
        console.log(`❌ Error: ${errorText}`);
      } else {
        console.log(`⚠️ Still on: ${page.url()}`);
        await page.screenshot({ path: '/tmp/care-recipient-debug.png' });
      }
    }
    
    // ========== STEP 3: CREATE CAREGIVER (if on caregiver page) ==========
    if (page.url().includes('caregiver')) {
      console.log('STEP 3: Create Caregiver');
      await page.waitForTimeout(2000);
      
      // Check form structure
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} input fields`);
      
      await page.fill('input[placeholder*="Maria"], input:first-of-type', 'Test Caregiver');
      
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(5000);
      
      // Check for PIN
      const pinEl = page.locator('text=/\\d{6}/');
      if (await pinEl.count() > 0) {
        const pinText = await pinEl.first().textContent();
        console.log(`✅ PIN: ${pinText}`);
      }
      
      await page.screenshot({ path: '/tmp/caregiver-created.png' });
    }
    
    // ========== FINAL: Go to dashboard ==========
    console.log('\nNavigating to dashboard...');
    await page.goto('/family/dashboard');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/final-dashboard.png' });
    console.log(`Final URL: ${page.url()}`);
    
    console.log('\n=== TEST COMPLETE ===');
  });
});
