import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow - Signup to Care Recipient Creation', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
  const API_URL = process.env.VITE_API_URL || 'http://localhost:8787';

  test('should complete full signup and care recipient onboarding', async ({ page }) => {
    test.setTimeout(60000);

    // Generate unique email for this test run
    const testEmail = `test-${Date.now()}@example.com`;
    const testName = 'Test Family Admin';
    const testPassword = 'SecurePass123!';

    console.log('\n=== STEP 1: Sign Up New User ===');
    console.log(`Using email: ${testEmail}`);

    // Navigate to signup page
    await page.goto(`${BASE_URL}/auth/signup`);
    await expect(page).toHaveURL(/\/auth\/signup/);

    // Fill signup form
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);

    // Submit signup form
    await page.click('button[type="submit"]');

    console.log('✅ Signup form submitted');

    // Wait for navigation to onboarding page
    await expect(page).toHaveURL(/\/family\/onboarding/, { timeout: 10000 });
    console.log('✅ Redirected to onboarding page');

    console.log('\n=== STEP 2: Create Care Recipient Profile ===');

    // Verify onboarding page loaded
    await expect(page.locator('h1:has-text("Welcome to Anchor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Add Care Recipient")')).toBeVisible();

    // Fill care recipient form
    await page.fill('input[placeholder*="Sulochana"]', 'Sulochana Viswanathan');
    await page.fill('input[type="date"]', '1947-12-13');
    await page.fill('input[placeholder*="Progressive"]', 'Progressive Supranuclear Palsy');
    await page.fill('input[placeholder*="Singapore"]', 'Petaling Jaya');
    await page.fill('input[type="tel"]', '+6591163935');

    console.log('✅ Care recipient form filled');

    // Submit care recipient form
    await page.click('button[type="submit"]:has-text("Continue")');

    console.log('⏳ Submitting care recipient...');

    // Wait for successful navigation to caregiver onboarding
    await expect(page).toHaveURL(/\/family\/onboarding\/caregiver/, { timeout: 15000 });
    console.log('✅ Successfully navigated to caregiver onboarding');

    // Verify caregiver onboarding page loaded
    await expect(page.locator('h1:has-text("Almost Done")')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Caregiver Account")')).toBeVisible();

    console.log('\n=== STEP 3: Verify Care Recipient Was Created ===');

    // Check localStorage for care recipient data
    const careRecipient = await page.evaluate(() => {
      const data = localStorage.getItem('careRecipient');
      return data ? JSON.parse(data) : null;
    });

    expect(careRecipient).toBeTruthy();
    expect(careRecipient.name).toBe('Sulochana Viswanathan');
    expect(careRecipient.condition).toBe('Progressive Supranuclear Palsy');
    expect(careRecipient.location).toBe('Petaling Jaya');
    expect(careRecipient.emergencyContact).toBe('+6591163935');
    expect(careRecipient.id).toBeTruthy(); // Should have a UUID

    console.log('✅ Care recipient created successfully:', careRecipient);

    console.log('\n✅ ONBOARDING FLOW TEST PASSED');
  });

  test('should show error for missing user session', async ({ page }) => {
    test.setTimeout(30000);

    console.log('\n=== Testing Error Handling: Missing User Session ===');

    // Navigate directly to onboarding without signup
    await page.goto(`${BASE_URL}/family/onboarding`);

    // Try to submit form without being logged in
    await page.fill('input[placeholder*="Sulochana"]', 'Test Name');
    await page.click('button[type="submit"]:has-text("Continue")');

    // Should show error message
    await expect(page.locator('text=/User session expired|Failed to create care recipient/')).toBeVisible({
      timeout: 5000,
    });

    console.log('✅ Error handling works correctly');
  });

  test('should validate required fields', async ({ page, request }) => {
    test.setTimeout(30000);

    console.log('\n=== Testing Form Validation ===');

    // Create a test user first
    const testEmail = `validation-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${API_URL}/auth/signup`, {
      data: {
        email: testEmail,
        name: 'Validation Test User',
        password: 'TestPass123!',
      },
    });

    expect(signupResponse.ok()).toBeTruthy();
    const signupData = await signupResponse.json();

    // Navigate to onboarding
    await page.goto(`${BASE_URL}/family/onboarding`);

    // Set auth in localStorage
    await page.evaluate(({ user, token }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    }, {
      user: signupData.user,
      token: signupData.token,
    });

    await page.reload();

    // Try to submit without filling required name field
    await page.click('button[type="submit"]:has-text("Continue")');

    // Form should not submit (name is required)
    await expect(page).toHaveURL(/\/family\/onboarding\/$/);

    console.log('✅ Required field validation works');
  });
});

test.describe('Onboarding Flow - API Endpoint Tests', () => {
  const API_URL = process.env.VITE_API_URL || 'http://localhost:8787';

  test('should use correct API endpoint in all environments', async ({ request }) => {
    test.setTimeout(30000);

    console.log('\n=== Testing API Endpoint Configuration ===');
    console.log(`API URL: ${API_URL}`);

    // Create test user
    const testEmail = `api-test-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${API_URL}/auth/signup`, {
      data: {
        email: testEmail,
        name: 'API Test User',
        password: 'TestPass123!',
      },
    });

    expect(signupResponse.ok()).toBeTruthy();
    const { user, token } = await signupResponse.json();

    console.log('✅ User created via API');

    // Test care recipient creation endpoint
    const recipientResponse = await request.post(`${API_URL}/care-recipients`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
      },
      data: {
        name: 'API Test Recipient',
        dateOfBirth: '1950-01-01',
        condition: 'Test Condition',
      },
    });

    expect(recipientResponse.ok()).toBeTruthy();
    const recipient = await recipientResponse.json();

    expect(recipient.id).toBeTruthy();
    expect(recipient.name).toBe('API Test Recipient');
    expect(recipient.familyAdminId).toBe(user.id);

    console.log('✅ Care recipient created via API:', recipient);
    console.log('✅ API endpoint configuration is correct');
  });
});
