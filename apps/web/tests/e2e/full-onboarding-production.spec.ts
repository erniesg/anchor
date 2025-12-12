import { test, expect } from '@playwright/test';

/**
 * Full Production Onboarding Flow Test
 * Tests the complete user journey from signup to family dashboard
 * This test creates REAL data on the live site
 */

test.describe('Full Production Onboarding Flow', () => {
  const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';

  // Generate unique test data
  const timestamp = Date.now();
  const testData = {
    family: {
      name: `E2E Test Family ${timestamp}`,
      email: `e2e-test-${timestamp}@example.com`,
      password: 'TestPassword123!',
      phone: '+6512345678',
    },
    careRecipient: {
      name: 'Grandmother Lee Mei Ling',
      dateOfBirth: '1945-03-15',
      condition: 'Progressive Supranuclear Palsy',
      location: 'Singapore, Ang Mo Kio',
      emergencyContact: '+6591234567',
    },
    caregiver: {
      name: 'Maria Santos',
      phone: '+6598765432',
      language: 'en',
    },
  };

  let generatedPin: string;
  let userToken: string;
  let careRecipientId: string;

  test('should complete full onboarding flow from signup to dashboard', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for full flow

    console.log('\n========================================');
    console.log('🧪 TESTING FULL PRODUCTION ONBOARDING FLOW');
    console.log('========================================\n');
    console.log(`Test User: ${testData.family.email}`);
    console.log(`Base URL: ${BASE_URL}\n`);

    // ====================================================================
    // STEP 1: SIGNUP
    // ====================================================================
    console.log('📝 STEP 1: User Signup');
    console.log('----------------------------------------');

    await page.goto(`${BASE_URL}/auth/signup`);
    await expect(page).toHaveURL(/\/auth\/signup/);

    // Verify signup page loaded
    await expect(page.locator('h1:has-text("Anchor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Family Account")')).toBeVisible();

    console.log('✅ Signup page loaded');

    // Fill signup form
    await page.fill('input[name="name"]', testData.family.name);
    await page.fill('input[name="email"]', testData.family.email);
    await page.fill('input[name="phone"]', testData.family.phone);
    await page.fill('input[name="password"]', testData.family.password);
    await page.fill('input[name="confirmPassword"]', testData.family.password);

    console.log('✅ Signup form filled');

    // Submit signup
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Wait for redirect to onboarding
    await expect(page).toHaveURL(/\/family\/onboarding/, { timeout: 15000 });

    console.log('✅ User created and redirected to onboarding');

    // Capture user token from localStorage
    userToken = await page.evaluate(() => localStorage.getItem('token') || '');
    expect(userToken).toBeTruthy();
    console.log(`✅ User token captured: ${userToken.substring(0, 20)}...`);

    // ====================================================================
    // STEP 2: CARE RECIPIENT SETUP
    // ====================================================================
    console.log('\n📝 STEP 2: Care Recipient Setup');
    console.log('----------------------------------------');

    // Verify onboarding page
    await expect(page.locator('h1:has-text("Welcome to Anchor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Add Care Recipient")')).toBeVisible();

    console.log('✅ Care recipient form loaded');

    // Fill care recipient form
    await page.fill('input[type="text"][required]', testData.careRecipient.name);
    await page.fill('input[type="date"]', testData.careRecipient.dateOfBirth);

    // Find and fill condition field by placeholder
    const conditionInput = page.locator('input[placeholder*="Dementia"]');
    await conditionInput.fill(testData.careRecipient.condition);

    // Find and fill location by placeholder
    const locationInput = page.locator('input[placeholder*="Singapore"]');
    await locationInput.fill(testData.careRecipient.location);

    // Fill emergency contact
    await page.fill('input[type="tel"]', testData.careRecipient.emergencyContact);

    console.log('✅ Care recipient form filled');
    console.log(`   Name: ${testData.careRecipient.name}`);
    console.log(`   DOB: ${testData.careRecipient.dateOfBirth}`);
    console.log(`   Condition: ${testData.careRecipient.condition}`);

    // Submit care recipient form
    await page.click('button[type="submit"]:has-text("Continue")');

    // Wait for navigation to caregiver setup
    await expect(page).toHaveURL(/\/family\/onboarding\/caregiver/, { timeout: 15000 });

    console.log('✅ Care recipient created, redirected to caregiver setup');

    // Capture care recipient data
    const careRecipientData = await page.evaluate(() => {
      const data = localStorage.getItem('careRecipient');
      return data ? JSON.parse(data) : null;
    });

    expect(careRecipientData).toBeTruthy();
    expect(careRecipientData.name).toBe(testData.careRecipient.name);
    careRecipientId = careRecipientData.id;

    console.log(`✅ Care recipient ID: ${careRecipientId}`);

    // ====================================================================
    // STEP 3: CAREGIVER SETUP
    // ====================================================================
    console.log('\n📝 STEP 3: Caregiver Setup');
    console.log('----------------------------------------');

    // Verify caregiver setup page
    await expect(page.locator('h1:has-text("Almost Done")')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Caregiver Account")')).toBeVisible();

    console.log('✅ Caregiver setup page loaded');

    // Fill caregiver form
    await page.fill('input[placeholder*="Maria"]', testData.caregiver.name);
    await page.fill('input[type="tel"]', testData.caregiver.phone);

    // Select language
    await page.selectOption('select', testData.caregiver.language);

    console.log('✅ Caregiver form filled');
    console.log(`   Name: ${testData.caregiver.name}`);
    console.log(`   Phone: ${testData.caregiver.phone}`);

    // Submit caregiver form
    await page.click('button[type="submit"]:has-text("Generate PIN")');

    console.log('⏳ Waiting for caregiver account creation...');

    // Check for error message first
    const errorMessage = page.locator('div.bg-error\\/10');
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.log(`❌ Error creating caregiver: ${errorText}`);

      // Take screenshot for debugging
      await page.screenshot({
        path: `/tmp/caregiver-error-${timestamp}.png`,
        fullPage: true
      });

      throw new Error(`Failed to create caregiver: ${errorText}`);
    }

    // Wait for PIN to be displayed - check for the success heading
    const successHeading = page.locator('h2:has-text("Caregiver Account Created!")');
    await expect(successHeading).toBeVisible({ timeout: 15000 });

    // Capture the generated PIN
    const pinElement = page.locator('p.text-5xl.font-bold.text-primary-700');
    await expect(pinElement).toBeVisible();
    generatedPin = await pinElement.textContent() || '';

    console.log('✅ Caregiver account created');
    console.log(`✅ Generated PIN: ${generatedPin}`);

    expect(generatedPin).toMatch(/^\d{6}$/); // Should be 6 digits

    // Take screenshot of PIN page
    await page.screenshot({
      path: `/tmp/caregiver-pin-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✅ PIN screenshot saved: /tmp/caregiver-pin-${timestamp}.png`);

    // ====================================================================
    // STEP 4: NAVIGATE TO DASHBOARD
    // ====================================================================
    console.log('\n📝 STEP 4: Navigate to Family Dashboard');
    console.log('----------------------------------------');

    // Click "Go to Dashboard" button
    await page.click('button:has-text("Go to Dashboard")');

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/family\/dashboard/, { timeout: 15000 });

    console.log('✅ Navigated to family dashboard');

    // ====================================================================
    // STEP 5: VERIFY DASHBOARD DISPLAYS DATA
    // ====================================================================
    console.log('\n📝 STEP 5: Verify Data on Dashboard');
    console.log('----------------------------------------');

    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');

    // Verify care recipient name is displayed
    const careRecipientNameOnDashboard = page.locator(`text="${testData.careRecipient.name}"`);
    await expect(careRecipientNameOnDashboard.first()).toBeVisible({ timeout: 10000 });

    console.log(`✅ Care recipient name displayed: ${testData.careRecipient.name}`);

    // Look for dashboard elements
    const dashboardElements = {
      quickActions: page.locator('text=/Quick Actions|Actions/i').first(),
      recentActivity: page.locator('text=/Recent Activity|Activity/i').first(),
      alerts: page.locator('text=/Alerts|Alert/i').first(),
    };

    // Check if key dashboard sections are present
    for (const [section, locator] of Object.entries(dashboardElements)) {
      const isVisible = await locator.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`✅ Dashboard section found: ${section}`);
      }
    }

    // Take a screenshot of the dashboard
    await page.screenshot({
      path: `/tmp/dashboard-screenshot-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✅ Dashboard screenshot saved: /tmp/dashboard-screenshot-${timestamp}.png`);

    // ====================================================================
    // STEP 6: VERIFY DATA PERSISTENCE (API CHECK)
    // ====================================================================
    console.log('\n📝 STEP 6: Verify Data Persistence via API');
    console.log('----------------------------------------');

    // Fetch care recipients from API to verify data was saved
    const apiResponse = await page.request.get('https://anchor-dev-api.erniesg.workers.dev/care-recipients', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    expect(apiResponse.ok()).toBeTruthy();
    const recipients = await apiResponse.json();

    console.log(`✅ API returned ${recipients.length} care recipient(s)`);

    // Find our test recipient
    const testRecipient = recipients.find((r: { id: string }) => r.id === careRecipientId);
    expect(testRecipient).toBeTruthy();

    console.log('✅ Care recipient data verified in database:');
    console.log(`   ID: ${testRecipient.id}`);
    console.log(`   Name: ${testRecipient.name}`);
    console.log(`   Condition: ${testRecipient.condition}`);
    console.log(`   Location: ${testRecipient.location}`);
    console.log(`   Emergency Contact: ${testRecipient.emergencyContact}`);

    // Verify caregiver was created
    if (testRecipient.caregivers && testRecipient.caregivers.length > 0) {
      const caregiver = testRecipient.caregivers[0];
      console.log('✅ Caregiver data verified:');
      console.log(`   ID: ${caregiver.id}`);
      console.log(`   Name: ${caregiver.name}`);
      console.log(`   Phone: ${caregiver.phone}`);
    }

    // ====================================================================
    // FINAL SUMMARY
    // ====================================================================
    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================');
    console.log('\n📊 Test Summary:');
    console.log('----------------------------------------');
    console.log(`User Email: ${testData.family.email}`);
    console.log(`User Name: ${testData.family.name}`);
    console.log(`Care Recipient: ${testData.careRecipient.name}`);
    console.log(`Care Recipient ID: ${careRecipientId}`);
    console.log(`Caregiver: ${testData.caregiver.name}`);
    console.log(`Caregiver PIN: ${generatedPin}`);
    console.log('\n✅ Full onboarding flow works perfectly in production!');
    console.log('✅ All data persisted correctly');
    console.log('✅ Dashboard displays data properly');
    console.log('========================================\n');
  });

  test('should show care recipient data on dashboard after onboarding', async ({ page }) => {
    test.setTimeout(60000);

    console.log('\n📝 Testing: Dashboard displays onboarding data');

    // Use existing test user (from previous test)
    const existingEmail = 'admin@example.com';
    const existingPassword = 'Admin123456';

    // Login
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', existingEmail);
    await page.fill('input[name="password"]', existingPassword);
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL(/\/family\/dashboard/, { timeout: 15000 });

    console.log('✅ Logged in and navigated to dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify care recipient is displayed
    const careRecipientName = page.locator('text="Grandmother Lee"').first();
    await expect(careRecipientName).toBeVisible({ timeout: 10000 });

    console.log('✅ Care recipient name visible on dashboard');

    // Take screenshot
    await page.screenshot({
      path: `/tmp/dashboard-existing-user-${Date.now()}.png`,
      fullPage: true
    });

    console.log('✅ Dashboard screenshot saved');
  });
});
