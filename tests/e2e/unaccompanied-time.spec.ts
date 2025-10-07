import { test, expect } from '@playwright/test';

/**
 * E2E Test: Unaccompanied Time Tracking
 * Sprint 1 Day 2: Dynamic time period tracking with auto-calculation
 */

test.describe('Unaccompanied Time Tracking - Caregiver Form', () => {
  test.beforeEach(async ({ page }) => {
    // Login as caregiver
    await page.goto('/auth/caregiver/login');
    await page.fill('input[name="caregiverId"]', '550e8400-e29b-41d4-a716-446655440001');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/caregiver\/form/);

    // Navigate to Unaccompanied Time section (assuming it's Section 6 or 7)
    await page.click('text=/Unaccompanied Time|Time Alone/i');
  });

  test('should display unaccompanied time section with empty state', async ({ page }) => {
    // Should see section header
    await expect(page.locator('text=/Unaccompanied Time/i')).toBeVisible();

    // Should see "Add Time Period" button
    await expect(page.locator('button:has-text("Add Time Period")')).toBeVisible();

    // Should see incidents textarea
    await expect(page.locator('textarea[placeholder*="incidents"]')).toBeVisible();
  });

  test('should add a single unaccompanied time period', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("Add Time Period")');

    // Fill in time period
    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');
    await page.fill('input[placeholder*="reason"]', 'Emergency bathroom break');

    // Should auto-calculate duration
    await expect(page.locator('text=/30.*minutes/i')).toBeVisible();

    // Should show replacement person field
    await page.fill('input[placeholder*="replacement"]', 'Nurse Mary');
  });

  test('should add multiple unaccompanied time periods', async ({ page }) => {
    // Add first period
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '10:00');
    await page.fill('input[name="endTime"]', '10:15');
    await page.fill('input[placeholder*="reason"]', 'Short break');

    // Add second period
    await page.click('button:has-text("Add Time Period")');
    const timeInputs = page.locator('input[name="startTime"]');
    await timeInputs.nth(1).fill('14:00');

    const endInputs = page.locator('input[name="endTime"]');
    await endInputs.nth(1).fill('14:45');

    // Should show both periods
    await expect(page.locator('text=/15.*minutes/i')).toBeVisible();
    await expect(page.locator('text=/45.*minutes/i')).toBeVisible();

    // Should show total duration
    await expect(page.locator('text=/Total.*60.*minutes/i')).toBeVisible();
  });

  test('should remove a time period', async ({ page }) => {
    // Add two periods
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '10:00');
    await page.fill('input[name="endTime"]', '10:15');

    await page.click('button:has-text("Add Time Period")');
    const timeInputs = page.locator('input[name="startTime"]');
    await timeInputs.nth(1).fill('14:00');

    // Remove first period
    await page.click('button[data-testid="remove-period"]:first-of-type');

    // Should only have one period left
    const periods = page.locator('[data-testid="time-period"]');
    await expect(periods).toHaveCount(1);
  });

  test('should validate time period (end time must be after start time)', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    // Enter invalid times (end before start)
    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '13:00');

    // Should show error
    await expect(page.locator('text=/End time must be after start time/i')).toBeVisible();

    // Should not calculate duration
    await expect(page.locator('text=/-.*minutes/i')).toBeVisible(); // Negative or error
  });

  test('should record incidents during unaccompanied time', async ({ page }) => {
    // Add time period
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');

    // Record incident
    const incidentText = 'Care recipient tried to get up alone but replacement nurse assisted immediately. No injuries.';
    await page.fill('textarea[placeholder*="incidents"]', incidentText);

    // Should accept long text
    const textarea = page.locator('textarea[placeholder*="incidents"]');
    await expect(textarea).toHaveValue(incidentText);
  });

  test('should allow empty unaccompanied time (never left alone)', async ({ page }) => {
    // Don't add any periods

    // Should be able to proceed without adding periods
    const addButton = page.locator('button:has-text("Add Time Period")');
    await expect(addButton).toBeVisible();

    // Total should be 0 or empty
    const total = page.locator('text=/Total/i');
    if (await total.isVisible()) {
      await expect(total).toContainText('0');
    }
  });

  test('should calculate total unaccompanied minutes correctly', async ({ page }) => {
    // Add three periods
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '09:00');
    await page.fill('input[name="endTime"]', '09:20'); // 20 min

    await page.click('button:has-text("Add Time Period")');
    let timeInputs = page.locator('input[name="startTime"]');
    await timeInputs.nth(1).fill('12:00');
    let endInputs = page.locator('input[name="endTime"]');
    await endInputs.nth(1).fill('12:30'); // 30 min

    await page.click('button:has-text("Add Time Period")');
    timeInputs = page.locator('input[name="startTime"]');
    await timeInputs.nth(2).fill('15:00');
    endInputs = page.locator('input[name="endTime"]');
    await endInputs.nth(2).fill('15:25'); // 25 min

    // Total should be 75 minutes
    await expect(page.locator('text=/Total.*75.*minutes/i')).toBeVisible();
  });

  test('should persist unaccompanied time data when navigating sections', async ({ page }) => {
    // Add time period
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '14:00');
    await page.fill('input[name="endTime"]', '14:30');
    await page.fill('input[placeholder*="reason"]', 'Emergency break');

    // Navigate away
    await page.click('text=/Morning|Section 1/i');

    // Navigate back
    await page.click('text=/Unaccompanied Time/i');

    // Data should persist
    await expect(page.locator('input[name="startTime"]')).toHaveValue('14:00');
    await expect(page.locator('input[name="endTime"]')).toHaveValue('14:30');
    await expect(page.locator('input[placeholder*="reason"]')).toHaveValue('Emergency break');
  });

  test('should show warning for long unaccompanied periods', async ({ page }) => {
    // Add long period (>60 minutes)
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="startTime"]', '10:00');
    await page.fill('input[name="endTime"]', '12:00'); // 120 minutes

    // Should show warning
    await expect(page.locator('text=/⚠️.*long period|Warning.*2 hours/i')).toBeVisible();
  });
});

test.describe('Unaccompanied Time - Family Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family member
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@family.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/family\/dashboard/);
  });

  test('should display unaccompanied time warning if total > 60 minutes', async ({ page }) => {
    // Assume today's log has 75 minutes unaccompanied
    await expect(page.locator('text=/75 minutes unaccompanied/i')).toBeVisible();

    // Should have warning styling
    const alert = page.locator('text=/unaccompanied/i').locator('../..');
    await expect(alert).toHaveClass(/border-yellow|bg-yellow-50/);
  });

  test('should display unaccompanied incidents if recorded', async ({ page }) => {
    // Should show incident text
    await expect(page.locator('text=/Care recipient tried to get up/i')).toBeVisible();

    // Should be in prominent location
    const incident = page.locator('text=/incident/i');
    await expect(incident).toBeVisible();
  });

  test('should show no warning if unaccompanied time is minimal', async ({ page }) => {
    // Assume today's log has <30 minutes unaccompanied
    const warning = page.locator('text=/⚠️.*unaccompanied/i');

    // Should not be visible or should show as acceptable
    if (await warning.isVisible()) {
      await expect(warning).toContainText(/acceptable|normal|brief/i);
    }
  });

  test('should display unaccompanied time in summary card', async ({ page }) => {
    // Should see time summary
    await expect(page.locator('text=/Time Alone:|Unaccompanied:/i')).toBeVisible();

    // Should show total minutes or hours
    await expect(page.locator('text=/[0-9]+ (minutes|min|hour)/i')).toBeVisible();
  });
});
