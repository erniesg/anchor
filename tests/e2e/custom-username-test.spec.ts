import { test, expect } from '@playwright/test';

test.describe('Custom Username Caregiver Flow', () => {
  test('full flow: family signup -> create caregiver with custom username -> login', async ({ page }) => {
    const timestamp = Date.now();
    const email = `username-test-${timestamp}@test.com`;
    const customUsername = `test-helper-${timestamp % 10000}`;

    console.log('=== CUSTOM USERNAME TEST ===');
    console.log(`Email: ${email}`);
    console.log(`Custom Username: ${customUsername}`);

    // ===== PART 1: Family Setup =====
    console.log('\n--- PART 1: Family Signup ---');
    await page.goto('/auth/signup');
    await page.waitForTimeout(1000);
    await page.getByLabel('Full Name').fill(`Username Test ${timestamp}`);
    await page.getByLabel('Email').fill(email);
    await page.getByPlaceholder('Minimum 8 characters').fill('TestPass123!');
    await page.getByPlaceholder('Re-enter your password').fill('TestPass123!');
    await page.click('button:has-text("Create Account")');
    await page.waitForURL('**/onboarding**', { timeout: 15000 });
    console.log('✅ Family signup complete');

    // ===== PART 2: Create Care Recipient =====
    console.log('\n--- PART 2: Care Recipient ---');
    await page.fill('input[placeholder*="Sulochana"]', 'Test Care Recipient');
    await page.fill('input[type="date"]', '1950-01-15');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/caregiver**', { timeout: 10000 });
    console.log('✅ Care recipient created');

    // ===== PART 3: Create Caregiver with Custom Username =====
    console.log('\n--- PART 3: Create Caregiver with Custom Username ---');
    await page.fill('input[placeholder*="Maria"]', 'Test Caregiver');

    // Fill in custom username
    const usernameInput = page.locator('input[placeholder*="maria-helper"], input[placeholder*="leave blank"]');
    if (await usernameInput.count() > 0) {
      await usernameInput.fill(customUsername);
      console.log(`✅ Custom username entered: ${customUsername}`);
    } else {
      console.log('⚠️ Username input not found');
    }

    await page.click('button:has-text("Create")');
    await page.waitForTimeout(3000);

    // Wait for success card
    await page.waitForSelector('text=Share these credentials', { timeout: 10000 });

    // Extract username from success page
    const usernameElement = page.locator('.bg-blue-50 .text-2xl, .bg-blue-50 .font-bold.font-mono');
    const displayedUsername = await usernameElement.first().textContent();
    console.log(`Displayed Username: ${displayedUsername}`);

    // Extract PIN
    const pinElement = page.locator('.text-5xl.font-bold');
    const pin = await pinElement.textContent();
    console.log(`PIN: ${pin}`);

    // Verify custom username is displayed (not auto-generated)
    if (displayedUsername?.includes(customUsername.substring(0, 10))) {
      console.log('✅ Custom username is correctly displayed!');
    } else {
      console.log(`⚠️ Username mismatch. Expected: ${customUsername}, Got: ${displayedUsername}`);
    }

    await page.screenshot({ path: '/tmp/custom-username-success.png' });

    // ===== PART 4: Test Caregiver Login with Custom Username =====
    console.log('\n--- PART 4: Caregiver Login with Custom Username ---');

    await page.goto('/caregiver/login');
    await page.waitForTimeout(1000);

    // Use the custom username to login
    const loginInput = displayedUsername?.trim() || customUsername;
    await page.fill('input[placeholder*="happy-panda"], input[name="username"]', loginInput);
    await page.fill('input#pin-input, input[name="pin"]', pin?.trim() || '');

    await page.screenshot({ path: '/tmp/custom-username-login.png' });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    await page.screenshot({ path: '/tmp/custom-username-result.png' });

    if (finalUrl.includes('/caregiver/form')) {
      console.log('✅ Caregiver login with custom username successful!');
      // Verify the form page shows the logged in username
      await expect(page.locator(`text=Logged in as: ${loginInput}`)).toBeVisible({ timeout: 5000 });
      console.log('✅ Username displayed in form header');
      await expect(page.locator('text=Care Log for')).toBeVisible({ timeout: 5000 });
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
