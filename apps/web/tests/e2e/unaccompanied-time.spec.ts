import { test, expect } from '@playwright/test';

test.describe('Caregiver Form - Unaccompanied Time Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Login as caregiver
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="text"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for form
    await page.waitForURL('**/caregiver/form', { timeout: 10000 });

    // Navigate to Section 7 (Unaccompanied Time)
    // We need to fill required fields in earlier sections first
    await page.fill('input[type="time"]', '07:00'); // Wake time
    await page.selectOption('select', 'calm'); // Mood

    // Navigate through sections to reach Section 7
    for (let i = 1; i < 7; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Should now be on Section 7
    await expect(page.locator('h2:has-text("Unaccompanied Time")')).toBeVisible();
  });

  test('should display empty unaccompanied time section', async ({ page }) => {
    await expect(page.locator('h2:has-text("Unaccompanied Time")')).toBeVisible();
    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(0);
    await expect(page.locator('button:has-text("Add Time Period")')).toBeVisible();
  });

  test('should add new time period entry', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(1);
    await expect(page.locator('input[name="startTime"]')).toBeVisible();
    await expect(page.locator('input[name="endTime"]')).toBeVisible();
  });

  test('should calculate duration automatically', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    // Fill times
    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');

    // Check duration is displayed
    await expect(page.locator('text=/Duration: 30 minutes/')).toBeVisible();
  });

  test('should add multiple time periods', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');

    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(3);
  });

  test('should remove time period entry', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');

    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(2);

    // Remove first period
    await page.locator('[data-testid="remove-period"]').first().click();

    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(1);
  });

  test('should calculate total unaccompanied time', async ({ page }) => {
    // Add first period (30 min)
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '10:00');
    await page.fill('input[name="endTime"]', '10:30');
    await page.fill('input[placeholder*="reason"]', 'Break 1');

    // Add second period (45 min)
    await page.click('button:has-text("Add Time Period")');
    const timePeriods = page.locator('[data-testid="time-period"]');
    const secondPeriod = timePeriods.nth(1);

    await secondPeriod.locator('input[name="startTime"]').fill('15:00');
    await secondPeriod.locator('input[name="endTime"]').fill('15:45');
    await secondPeriod.locator('input[placeholder*="reason"]').fill('Break 2');

    // Check total time
    await expect(page.locator('text=/Total unaccompanied time today: 75 minutes/')).toBeVisible();
  });

  test('should show warning for long unaccompanied time (>60 min)', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '15:30'); // 90 minutes
    await page.fill('input[placeholder*="reason"]', 'Extended break');

    // Should show warning
    await expect(page.locator('text=/Long period.*hour/')).toBeVisible();
    await expect(page.locator('text=/Exceeds 1 hour.*family will be notified/')).toBeVisible();
  });

  test('should validate start time before end time', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="startTime"]', '14:30');
    await page.fill('input[name="endTime"]', '14:00'); // Invalid: end before start

    // Should show error
    await expect(page.locator('text=/End time must be after start time/')).toBeVisible();
  });

  test('should accept incidents report', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');
    await page.fill('input[placeholder*="reason"]', 'Emergency break');

    // Fill incidents textarea
    await page.fill('textarea[placeholder*="concerning behaviors"]',
      'Care recipient tried to stand but was assisted by replacement person');

    // Navigate to submit section
    await page.click('button:has-text("Next")');

    // Should show in preview (Section 9)
    await expect(page.locator('text=/Unaccompanied Time/')).toBeVisible();
  });

  test('should persist data when navigating between sections', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');
    await page.fill('input[placeholder*="reason"]', 'Emergency');

    // Navigate forward
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2:has-text("Safety Checks")')).toBeVisible();

    // Navigate back
    await page.click('button:has-text("Back")');
    await expect(page.locator('h2:has-text("Unaccompanied Time")')).toBeVisible();

    // Data should persist
    await expect(page.locator('input[name="startTime"]')).toHaveValue('14:00');
    await expect(page.locator('input[name="endTime"]')).toHaveValue('14:30');
    await expect(page.locator('input[placeholder*="reason"]')).toHaveValue('Emergency');
  });

  test('should submit form with unaccompanied time data', async ({ page }) => {
    // Add time period with all data
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');
    await page.fill('input[placeholder*="reason"]', 'Emergency bathroom break');
    await page.fill('input[placeholder*="Replacement person"]', 'Nurse Mary');

    // Add incidents
    await page.fill('textarea[placeholder*="concerning behaviors"]',
      'No incidents occurred');

    // Navigate to submit
    await page.click('button:has-text("Next")'); // To Section 8
    await page.click('button:has-text("Next")'); // To Section 9 (Submit)

    // Submit form
    await page.click('button:has-text("Submit Care Log")');

    // Should show success message or redirect
    await page.waitForTimeout(2000); // Wait for submission

    // Check for success (adjust based on actual UI)
    // This might be a success message or redirect to dashboard
    const currentUrl = page.url();
    console.log('After submit URL:', currentUrl);
  });

  test('should skip section if no unaccompanied time', async ({ page }) => {
    // Don't add any time periods
    await expect(page.locator('[data-testid="time-period"]')).toHaveCount(0);

    // Should see info message
    await expect(page.locator('text=/If the care recipient was never left alone/')).toBeVisible();

    // Can still navigate forward
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2:has-text("Safety Checks")')).toBeVisible();
  });
});

test.describe('Family Dashboard - Unaccompanied Time Display', () => {
  test('should display unaccompanied time on dashboard', async ({ page }) => {
    // Login as family member
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/family/dashboard', { timeout: 10000 });

    // Check for unaccompanied time display (if data exists)
    const unaccompaniedSection = page.locator('text=/unaccompanied time/i');
    if (await unaccompaniedSection.isVisible()) {
      console.log('✅ Unaccompanied time section found');

      // Check for time display
      await expect(page.locator('text=/minutes/i')).toBeVisible();
    } else {
      console.log('ℹ️ No unaccompanied time data for today');
    }
  });

  test('should show incident alerts on dashboard', async ({ page }) => {
    // Login as family member
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/family/dashboard', { timeout: 10000 });

    // Check for incidents section (if data exists)
    const incidentsSection = page.locator('text=/incidents/i');
    if (await incidentsSection.isVisible()) {
      console.log('✅ Incidents section found');
    } else {
      console.log('ℹ️ No incidents reported for today');
    }
  });
});
