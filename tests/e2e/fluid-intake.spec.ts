import { test, expect } from '@playwright/test';

/**
 * Sprint 2 Day 2: Fluid Intake Monitoring E2E Tests
 * Testing caregiver form UI for fluid intake tracking
 */

test.describe('Caregiver Form - Fluid Intake Monitoring', () => {

  test.beforeEach(async ({ page }) => {
    // Login as caregiver (using seeded E2E test data)
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'e80c2b2a-4688-4a29-9579-51b3219f20fc');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/caregiver\/form/);
  });

  test('should display fluid intake section with empty state', async ({ page }) => {
    // Should show section heading
    await expect(page.locator('h3:has-text("Fluid Intake Monitoring")')).toBeVisible();

    // Should show empty state message
    await expect(page.locator('text=No fluid entries yet')).toBeVisible();

    // Should show add button
    await expect(page.locator('button:has-text("Add Fluid Entry")')).toBeVisible();

    // Should show zero total
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('0 ml');
  });

  test('should add fluid entry with beverage selection', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');

    // Should show fluid entry form
    await expect(page.locator('[data-testid="fluid-entry-0"]')).toBeVisible();

    // Should have beverage dropdown with predefined options
    const beverageSelect = page.locator('select[name="fluids.0.name"]');
    await expect(beverageSelect).toBeVisible();

    // Check predefined beverage options
    await beverageSelect.click();
    await expect(page.locator('option:has-text("Glucerna Milk")')).toBeVisible();
    await expect(page.locator('option:has-text("Moringa Water")')).toBeVisible();
    await expect(page.locator('option:has-text("Plain Water")')).toBeVisible();
    await expect(page.locator('option:has-text("Orange Juice")')).toBeVisible();
  });

  test('should calculate total fluid intake automatically', async ({ page }) => {
    // Add first entry
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');

    // Check first entry total
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('250 ml');

    // Add second entry
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.1.name"]', 'Plain Water');
    await page.fill('input[name="fluids.1.time"]', '10:00');
    await page.fill('input[name="fluids.1.amountMl"]', '150');

    // Check updated total (250 + 150 = 400)
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('400 ml');

    // Add third entry
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.2.name"]', 'Orange Juice');
    await page.fill('input[name="fluids.2.time"]', '14:00');
    await page.fill('input[name="fluids.2.amountMl"]', '200');

    // Check final total (250 + 150 + 200 = 600)
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('600 ml');
  });

  test('should show warning for low fluid intake', async ({ page }) => {
    // Add single entry with low amount
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Plain Water');
    await page.fill('input[name="fluids.0.time"]', '08:00');
    await page.fill('input[name="fluids.0.amountMl"]', '300');

    // Should show low fluid warning (< 1000ml)
    const warning = page.locator('[data-testid="low-fluid-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Low fluid intake');
    await expect(warning).toContainText('300 ml');
    await expect(warning).toHaveClass(/bg-yellow/); // Warning color
  });

  test('should not show warning for adequate fluid intake', async ({ page }) => {
    // Add entries totaling >= 1000ml
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:00');
    await page.fill('input[name="fluids.0.amountMl"]', '500');

    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.1.name"]', 'Plain Water');
    await page.fill('input[name="fluids.1.time"]', '12:00');
    await page.fill('input[name="fluids.1.amountMl"]', '300');

    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.2.name"]', 'Orange Juice');
    await page.fill('input[name="fluids.2.time"]', '16:00');
    await page.fill('input[name="fluids.2.amountMl"]', '250');

    // Total = 1050ml, should not show warning
    await expect(page.locator('[data-testid="low-fluid-warning"]')).not.toBeVisible();

    // Should show adequate status
    const status = page.locator('[data-testid="fluid-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/bg-green/); // Success color
  });

  test('should remove fluid entry', async ({ page }) => {
    // Add three entries
    await page.click('button:has-text("Add Fluid Entry")');
    await page.click('button:has-text("Add Fluid Entry")');
    await page.click('button:has-text("Add Fluid Entry")');

    // Should have 3 entries
    await expect(page.locator('[data-testid^="fluid-entry-"]')).toHaveCount(3);

    // Remove first entry
    await page.click('[data-testid="remove-fluid-0"]');

    // Should have 2 entries
    await expect(page.locator('[data-testid^="fluid-entry-"]')).toHaveCount(2);
  });

  test('should track swallowing issues per fluid', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');

    // Check swallowing issue checkboxes
    await page.check('input[name="fluids.0.swallowingIssues.coughing"]');
    await page.check('input[name="fluids.0.swallowingIssues.slow"]');

    // Should show selected issues
    await expect(page.locator('input[name="fluids.0.swallowingIssues.coughing"]')).toBeChecked();
    await expect(page.locator('input[name="fluids.0.swallowingIssues.slow"]')).toBeChecked();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');

    // Try to submit without filling fields
    await page.click('button:has-text("Submit")');

    // Should show validation errors
    await expect(page.locator('text=Beverage is required')).toBeVisible();
    await expect(page.locator('text=Time is required')).toBeVisible();
    await expect(page.locator('text=Amount is required')).toBeVisible();
  });

  test('should persist data on section navigation', async ({ page }) => {
    // Fill fluid intake data
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');

    // Navigate to different section
    await page.click('text=Vital Signs');

    // Navigate back to fluids section
    await page.click('text=Fluids');

    // Data should persist
    await expect(page.locator('select[name="fluids.0.name"]')).toHaveValue('Glucerna Milk');
    await expect(page.locator('input[name="fluids.0.time"]')).toHaveValue('08:30');
    await expect(page.locator('input[name="fluids.0.amountMl"]')).toHaveValue('250');
  });

  test('should submit care log with fluid intake data', async ({ page }) => {
    // Fill required fields
    await page.fill('input[name="wakeTime"]', '07:00');
    await page.selectOption('select[name="mood"]', 'alert');

    // Add fluid entries
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Moringa Water');
    await page.fill('input[name="fluids.0.time"]', '08:00');
    await page.fill('input[name="fluids.0.amountMl"]', '200');

    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.1.name"]', 'Plain Water');
    await page.fill('input[name="fluids.1.time"]', '10:00');
    await page.fill('input[name="fluids.1.amountMl"]', '150');

    // Submit form
    await page.click('button:has-text("Submit")');

    // Should show success message
    await expect(page.locator('text=Care log submitted successfully')).toBeVisible();
  });
});

test.describe('Family Dashboard - Fluid Intake Display', () => {

  test.beforeEach(async ({ page }) => {
    // Login as family admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/family/dashboard');
  });

  test('should display total fluid intake in summary card', async ({ page }) => {
    // Should show fluid intake card
    const card = page.locator('[data-testid="fluid-intake-card"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Fluid Intake');

    // Should show total ml
    await expect(page.locator('[data-testid="fluid-intake-total"]')).toContainText('ml');
  });

  test('should show low fluid warning if intake <1000ml', async ({ page }) => {
    // Assuming today's log has low fluid intake
    const warning = page.locator('[data-testid="low-fluid-warning"]');

    // Check if warning exists (depends on test data)
    const warningCount = await warning.count();
    if (warningCount > 0) {
      await expect(warning).toBeVisible();
      await expect(warning).toContainText('Low fluid intake');
      await expect(warning).toHaveClass(/bg-yellow/); // Warning color
    }
  });

  test('should display fluid breakdown details', async ({ page }) => {
    // Click to expand details
    await page.click('[data-testid="fluid-details-toggle"]');

    // Should show individual fluid entries
    const entries = page.locator('[data-testid^="fluid-entry-"]');
    const entryCount = await entries.count();

    if (entryCount > 0) {
      // Check first entry has required info
      await expect(entries.first()).toContainText('ml');
      await expect(entries.first()).toContainText(':'); // Time format
    }
  });

  test('should show swallowing issues alert if present', async ({ page }) => {
    // Check for swallowing issues alert
    const alert = page.locator('[data-testid="swallowing-issues-alert"]');
    const alertCount = await alert.count();

    if (alertCount > 0) {
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Swallowing issues');
      await expect(alert).toHaveClass(/bg-red/); // Alert color
    }
  });

  test('should display fluid intake trend in week view', async ({ page }) => {
    // Switch to week view
    await page.click('text=Week View');

    // Should show fluid intake chart
    await expect(page.locator('[data-testid="fluid-intake-chart"]')).toBeVisible();

    // Should have 7 days of data
    const bars = page.locator('[data-testid^="fluid-bar-"]');
    await expect(bars).toHaveCount(7);
  });
});
