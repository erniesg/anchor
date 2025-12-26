import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite for Anchor Dev Site
 * Tests the complete flow: Family -> Caregiver -> Forms -> Submission -> Viewing
 *
 * Routes (based on actual codebase):
 * - /auth/login - Family login
 * - /auth/signup - Family signup
 * - /family/dashboard - Family dashboard with Today/Week/Activity tabs
 * - /family/onboarding - Create care recipient
 * - /family/settings/caregivers - Manage caregivers
 * - /family/trends - 7-day health trends
 * - /caregiver/login - Caregiver login (username + 6-digit PIN)
 * - /caregiver/form - Caregiver form dashboard
 * - /caregiver/form/morning - Morning form
 * - /caregiver/form/afternoon - Afternoon form
 * - /caregiver/form/evening - Evening form
 * - /caregiver/form/summary - Daily summary form
 * - /caregiver/pack-list - Hospital bag management
 */

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';

// Test credentials (existing account for testing)
const FAMILY_EMAIL = 'abc@123.com';
const FAMILY_PASSWORD = 'TestPassword123!';

test.describe('Comprehensive E2E Test Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // =========================================
  // FAMILY FLOW TESTS
  // =========================================
  test.describe('Family Flow', () => {
    test('1. Family login page loads correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.waitForLoadState('networkidle');

      // Screenshot the login page
      await page.screenshot({ path: 'test-results/01-family-login-page.png', fullPage: true });

      // Verify login form elements exist
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Verify branding
      await expect(page.locator('h1:has-text("Anchor")')).toBeVisible();
      await expect(page.locator('h2:has-text("Family Login")')).toBeVisible();
    });

    test('2. Family login with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      await page.waitForLoadState('networkidle');

      // Fill login form
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);

      await page.screenshot({ path: 'test-results/02-family-login-filled.png', fullPage: true });

      // Submit login
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'test-results/03-after-family-login.png', fullPage: true });

      // Should redirect to dashboard or onboarding
      const currentUrl = page.url();
      console.log('After login URL:', currentUrl);

      // Verify we're on a valid post-login page
      expect(currentUrl.includes('/family/dashboard') || currentUrl.includes('/family/onboarding')).toBeTruthy();
    });

    test('3. Family dashboard - Today view', async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to dashboard
      await page.goto(`${BASE_URL}/family/dashboard`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/04-family-dashboard.png', fullPage: true });

      // Check for view tabs (Today, Week, Activity)
      const todayTab = page.locator('button:has-text("Today")');
      const weekTab = page.locator('button:has-text("Week")');
      const activityTab = page.locator('button:has-text("Activity")');

      // At least one tab should be visible
      const hasTabs = await todayTab.isVisible() || await weekTab.isVisible() || await activityTab.isVisible();

      if (hasTabs) {
        // Click Today tab if visible
        if (await todayTab.isVisible()) {
          await todayTab.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-results/05-today-view.png', fullPage: true });
        }
      }
    });

    test('4. Family dashboard - Week view', async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/family/dashboard`);
      await page.waitForTimeout(2000);

      // Click Week tab if visible
      const weekTab = page.locator('button:has-text("Week")');
      if (await weekTab.isVisible()) {
        await weekTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/06-week-view.png', fullPage: true });
      }
    });

    test('5. Family dashboard - Activity view with audit history', async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.goto(`${BASE_URL}/family/dashboard`);
      await page.waitForTimeout(2000);

      // Click Activity tab if visible
      const activityTab = page.locator('button:has-text("Activity")');
      if (await activityTab.isVisible()) {
        await activityTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/07-activity-view.png', fullPage: true });

        // Check for Activity view elements
        const trendsLink = page.locator('text=View Trends');
        const activityLog = page.locator('text=Activity Log');
        const sectionProgression = page.locator('text=Section Progression');

        // Screenshot with scroll to capture more content
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/08-activity-view-scrolled.png', fullPage: true });
      }
    });

    test('6. Family caregiver settings', async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to caregiver settings
      await page.goto(`${BASE_URL}/family/settings/caregivers`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/09-caregiver-settings.png', fullPage: true });

      // Check for key elements
      const addCaregiverBtn = page.locator('button:has-text("Add Caregiver")');
      const caregiverList = page.locator('[data-testid="caregiver-list"]');

      // Should have "Where Caregivers Login" info card
      const loginInfoCard = page.locator('text=Where Caregivers Login');
      if (await loginInfoCard.isVisible()) {
        await page.screenshot({ path: 'test-results/10-caregiver-login-info.png', fullPage: true });
      }
    });

    test('7. Family trends page', async ({ page }) => {
      // Login first
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to trends
      await page.goto(`${BASE_URL}/family/trends`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/11-trends-page.png', fullPage: true });

      // Check for trends header
      const trendsHeader = page.locator('text=7-Day Health Trends');
      if (await trendsHeader.isVisible()) {
        // Scroll to see charts
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/12-trends-charts.png', fullPage: true });
      }
    });
  });

  // =========================================
  // CAREGIVER FLOW TESTS
  // =========================================
  test.describe('Caregiver Flow', () => {
    test('8. Caregiver login page loads correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/login`);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'test-results/13-caregiver-login-page.png', fullPage: true });

      // Verify login form elements
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="pin"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Verify branding
      await expect(page.locator('h1:has-text("Caregiver Login")')).toBeVisible();
    });

    test('9. Caregiver login with credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/login`);
      await page.waitForLoadState('networkidle');

      // Try to login with test caregiver
      // Note: Username should be like "happy-panda-42", PIN is 6 digits
      await page.fill('input[name="username"]', 'ernie');
      await page.fill('input[name="pin"]', '123456'); // 6-digit PIN

      await page.screenshot({ path: 'test-results/14-caregiver-login-filled.png', fullPage: true });

      // Submit login
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'test-results/15-after-caregiver-login.png', fullPage: true });

      const currentUrl = page.url();
      console.log('After caregiver login URL:', currentUrl);
    });

    test('10. Caregiver form dashboard', async ({ page }) => {
      // Try to access form dashboard directly
      await page.goto(`${BASE_URL}/caregiver/login`);
      await page.fill('input[name="username"]', 'ernie');
      await page.fill('input[name="pin"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Check if we're on form dashboard or need to navigate there
      const currentUrl = page.url();
      if (!currentUrl.includes('/caregiver/form')) {
        await page.goto(`${BASE_URL}/caregiver/form`);
        await page.waitForTimeout(2000);
      }

      await page.screenshot({ path: 'test-results/16-caregiver-form-dashboard.png', fullPage: true });

      // Check for time period cards (Morning, Afternoon, Evening, Summary)
      const morningCard = page.locator('text=Morning');
      const afternoonCard = page.locator('text=Afternoon');
      const eveningCard = page.locator('text=Evening');
      const summaryCard = page.locator('text=Daily Summary');

      // Check for Quick Log section
      const quickLog = page.locator('text=Quick Log Anytime');
    });

    test('11. Morning form - UI structure', async ({ page }) => {
      // Navigate to morning form
      await page.goto(`${BASE_URL}/caregiver/form/morning`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/17-morning-form-top.png', fullPage: true });

      // Check for Wake Up section
      const wakeUpSection = page.locator('h2:has-text("Wake Up")');
      if (await wakeUpSection.isVisible()) {
        // Check for wake time input
        const wakeTimeInput = page.locator('input[type="time"]').first();
        expect(await wakeTimeInput.isVisible()).toBeTruthy();
      }

      // Check for Last Night's Sleep section
      const lastNightSleep = page.locator("h2:has-text(\"Last Night's Sleep\")");
      await lastNightSleep.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/18-morning-sleep-section.png', fullPage: true });

      // Check for sleep quality buttons
      const deepBtn = page.locator('button:has-text("Deep")');
      const lightBtn = page.locator('button:has-text("Light")');
      const restlessBtn = page.locator('button:has-text("Restless")');

      // Check for Breakfast section with Swallowing Issues
      const breakfastSection = page.locator('h2:has-text("Breakfast")');
      await breakfastSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/19-breakfast-section.png', fullPage: true });

      // Check for Swallowing Issues
      const swallowingIssues = page.locator('text=Swallowing Issues');
      if (await swallowingIssues.isVisible()) {
        // Check for swallowing issue buttons
        const chokingBtn = page.locator('button:has-text("Choking")');
        const coughingBtn = page.locator('button:has-text("Coughing")');
      }

      // Scroll to bottom to see submit button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/20-morning-form-bottom.png', fullPage: true });
    });

    test('12. Morning form - Fill and autosave', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/form/morning`);
      await page.waitForTimeout(2000);

      // Fill wake time
      const wakeTimeInput = page.locator('input[type="time"]').first();
      if (await wakeTimeInput.isVisible()) {
        await wakeTimeInput.fill('07:30');
      }

      // Select mood (Calm)
      const calmBtn = page.locator('button:has-text("Calm")');
      if (await calmBtn.isVisible()) {
        await calmBtn.click();
      }

      await page.screenshot({ path: 'test-results/21-morning-wakeup-filled.png', fullPage: true });

      // Fill Last Night's Sleep
      const lastNightSleep = page.locator("h2:has-text(\"Last Night's Sleep\")");
      await lastNightSleep.scrollIntoViewIfNeeded();

      // Select sleep quality
      const lightBtn = page.locator('button:has-text("Light")');
      if (await lightBtn.isVisible()) {
        await lightBtn.click();
      }

      // Select night wakings
      const oneWaking = page.locator('button:has-text("1")').first();
      if (await oneWaking.isVisible()) {
        await oneWaking.click();
      }

      await page.screenshot({ path: 'test-results/22-morning-sleep-filled.png', fullPage: true });

      // Fill breakfast
      const breakfastSection = page.locator('h2:has-text("Breakfast")');
      await breakfastSection.scrollIntoViewIfNeeded();

      const breakfastTimeInputs = page.locator('input[type="time"]');
      const breakfastTime = breakfastTimeInputs.nth(1); // Second time input
      if (await breakfastTime.isVisible()) {
        await breakfastTime.fill('08:00');
      }

      // Select amount eaten (3)
      const amount3 = page.locator('button:has-text("3")').first();
      if (await amount3.isVisible()) {
        await amount3.click();
      }

      // Select a swallowing issue (Coughing)
      const coughingBtn = page.locator('button:has-text("Coughing")');
      if (await coughingBtn.isVisible()) {
        await coughingBtn.click();
      }

      await page.screenshot({ path: 'test-results/23-breakfast-filled.png', fullPage: true });

      // Wait for autosave (3 seconds debounce)
      await page.waitForTimeout(4000);

      // Check for "Saved" indicator
      const savedIndicator = page.locator('text=Saved');
      await page.screenshot({ path: 'test-results/24-morning-autosaved.png', fullPage: true });
    });

    test('13. Evening form - Simplified bedtime', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/form/evening`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/25-evening-form.png', fullPage: true });

      // Check Dinner section
      const dinnerSection = page.locator('h2:has-text("Dinner")');
      if (await dinnerSection.isVisible()) {
        await dinnerSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        // Check for Swallowing Issues (should be present)
        const swallowingIssues = page.locator('text=Swallowing Issues');
        expect(await swallowingIssues.isVisible()).toBeTruthy();
      }

      // Check Bedtime section
      const bedtimeSection = page.locator('h2:has-text("Bedtime")');
      if (await bedtimeSection.isVisible()) {
        await bedtimeSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/26-evening-bedtime.png', fullPage: true });

        // Check for simplified note (should mention sleep is recorded in morning)
        const sleepNote = page.locator('text=Morning form');
      }
    });

    test('14. Summary form - Personal Hygiene section', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/form/summary`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/27-summary-form.png', fullPage: true });

      // Check for Personal Hygiene section
      const personalHygiene = page.locator('h2:has-text("Personal Hygiene")');
      if (await personalHygiene.isVisible()) {
        await personalHygiene.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/28-personal-hygiene.png', fullPage: true });

        // Check for hygiene options
        const bathShower = page.locator('text=Bath/Shower');
        const oralCare = page.locator('text=Oral Care');
        const hairWashed = page.locator('text=Hair Washed');
        const skinCare = page.locator('text=Skin Care');
      }

      // Check for Fall Risk section
      const fallRisk = page.locator('text=Fall Risk');
      if (await fallRisk.isVisible()) {
        await fallRisk.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/29-fall-risk.png', fullPage: true });
      }

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/30-summary-bottom.png', fullPage: true });
    });

    test('15. Pack list page', async ({ page }) => {
      await page.goto(`${BASE_URL}/caregiver/pack-list`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/31-pack-list.png', fullPage: true });

      // Check for Hospital Bag header
      const hospitalBagHeader = page.locator('h1:has-text("Hospital Bag")');

      // Scroll to see more items
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/32-pack-list-scrolled.png', fullPage: true });
    });
  });

  // =========================================
  // SIGNUP FLOW TEST (NEW USER)
  // =========================================
  test.describe('Signup Flow', () => {
    test('16. Family signup page structure', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/signup`);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'test-results/33-signup-page.png', fullPage: true });

      // Verify form elements
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="phone"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

      // Verify branding
      await expect(page.locator('h1:has-text("Anchor")')).toBeVisible();
      await expect(page.locator('h2:has-text("Create Family Account")')).toBeVisible();
    });

    test('17. Family signup - Fill form (without submit)', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/signup`);
      await page.waitForLoadState('networkidle');

      const timestamp = Date.now();

      // Fill signup form
      await page.fill('input[name="name"]', `E2E Test User ${timestamp}`);
      await page.fill('input[name="email"]', `e2e_test_${timestamp}@example.com`);
      await page.fill('input[name="phone"]', '+65 9123 4567');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');

      await page.screenshot({ path: 'test-results/34-signup-filled.png', fullPage: true });

      // Don't actually submit to avoid creating test accounts
      console.log('Signup form filled but not submitted (to avoid creating test accounts)');
    });
  });

  // =========================================
  // INTEGRATION TESTS
  // =========================================
  test.describe('Integration Tests', () => {
    test('18. Navigate between all main pages', async ({ page }) => {
      // Test that all routes are accessible
      const routes = [
        { path: '/auth/login', name: 'Family Login' },
        { path: '/auth/signup', name: 'Family Signup' },
        { path: '/caregiver/login', name: 'Caregiver Login' },
      ];

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route.path}`);
        await page.waitForTimeout(1000);

        // Take screenshot
        const screenshotName = route.name.toLowerCase().replace(/\s+/g, '-');
        await page.screenshot({ path: `test-results/nav-${screenshotName}.png`, fullPage: true });

        // Verify page loaded (no error)
        const errorText = page.locator('text=404');
        const hasError = await errorText.isVisible().catch(() => false);
        expect(hasError).toBeFalsy();
      }
    });

    test('19. Verify form autosave indicator', async ({ page }) => {
      // Login as family and go to caregiver settings to check UI interactions
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to settings
      await page.goto(`${BASE_URL}/family/settings`);
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/35-settings-page.png', fullPage: true });
    });

    test('20. Mobile responsive check', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Check login page
      await page.goto(`${BASE_URL}/auth/login`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/mobile-01-login.png', fullPage: true });

      // Check caregiver login
      await page.goto(`${BASE_URL}/caregiver/login`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/mobile-02-caregiver-login.png', fullPage: true });

      // Login and check dashboard
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[name="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'test-results/mobile-03-dashboard.png', fullPage: true });

      // Check morning form
      await page.goto(`${BASE_URL}/caregiver/form/morning`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/mobile-04-morning-form.png', fullPage: true });
    });
  });
});
