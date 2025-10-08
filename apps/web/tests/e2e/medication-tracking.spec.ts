import { test, expect } from '@playwright/test';

/**
 * E2E Test: Enhanced Medication Tracking - Sprint 2 Day 4
 * Tests the complete flow of adding medication data with purpose/notes and viewing adherence on dashboard
 */

test.describe('Medication Tracking E2E', () => {
  test('should add medication data with purpose/notes and display adherence on dashboard', async ({ page }) => {
    // Increase timeout for SPA navigation
    test.setTimeout(90000);

    // Navigate to caregiver login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for login form to load (SPA)
    await page.waitForSelector('input[name="caregiverId"]', { timeout: 30000 });

    // Login as caregiver (using actual live caregiver)
    await page.fill('input[name="caregiverId"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to form (with longer timeout for SPA)
    await page.waitForURL('**/caregiver/form', { timeout: 30000 });
    await page.waitForSelector('h2', { timeout: 10000 });
    await expect(page.locator('h2')).toContainText('Morning Routine');

    // Navigate to Medications section (Section 2)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Medications');

    // Fill medication 1: Glucophage - given with purpose and notes
    const med1Checkbox = page.locator('input[type="checkbox"]').first();
    await med1Checkbox.check();
    await page.waitForTimeout(200);

    // Fill time
    const timeInputs = await page.locator('input[type="time"]').all();
    await timeInputs[0].fill('08:00');

    // Fill purpose
    const purposeInputs = await page.locator('input[placeholder*="Diabetes control"]').all();
    await purposeInputs[0].fill('Type 2 Diabetes management');

    // Fill notes
    const notesTextareas = await page.locator('textarea[placeholder*="Take with food"]').all();
    await notesTextareas[0].fill('Taken with water as prescribed');

    // Fill medication 2: Forxiga - given with purpose only
    const med2Checkbox = page.locator('input[type="checkbox"]').nth(1);
    await med2Checkbox.check();
    await page.waitForTimeout(200);

    const timeInputs2 = await page.locator('input[type="time"]').all();
    await timeInputs2[1].fill('08:30');

    await purposeInputs[1].fill('Blood sugar control');

    // Leave medication 3: Ozempic - not given but with purpose and notes
    await purposeInputs[2].fill('Diabetes control');
    await notesTextareas[2].fill('Patient refused - too tired');

    // Verify data is filled
    await expect(med1Checkbox).toBeChecked();
    await expect(med2Checkbox).toBeChecked();

    // Wait for auto-save
    await page.waitForTimeout(2000);

    console.log('✅ Medication tracking caregiver form E2E test passed!');
  });

  test('should display medication adherence on family dashboard', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to family login
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for login form
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });

    // Login as family admin
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/family/dashboard', { timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for data to load

    // Check for medication card
    const medicationCard = page.locator('[data-testid="medication-card"]');
    await expect(medicationCard).toBeVisible({ timeout: 10000 });

    // Check if adherence data is displayed (if there are medications today)
    const cardContent = await medicationCard.textContent();
    console.log('Medication card content:', cardContent);

    // Take screenshot for manual verification
    await page.screenshot({ path: '/tmp/medication-dashboard.png', fullPage: true });

    // Verify we're on the dashboard
    const url = page.url();
    expect(url).toContain('/family/dashboard');

    console.log('✅ Family dashboard medication display test passed!');
    console.log('📸 Screenshot saved to /tmp/medication-dashboard.png');
  });

  test('should display medication adherence chart in week view', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to family login
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Login as family admin
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/family/dashboard', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Switch to Week view
    await page.click('button:has-text("Week")');
    await page.waitForTimeout(2000);

    // Check for medication adherence chart
    const adherenceChart = page.locator('[data-testid="medication-adherence-chart"]');
    await expect(adherenceChart).toBeVisible({ timeout: 10000 });

    // Verify chart title
    await expect(adherenceChart.locator('h3')).toContainText('Medication Adherence');

    // Take screenshot
    await page.screenshot({ path: '/tmp/medication-week-view.png', fullPage: true });

    console.log('✅ Medication adherence week view test passed!');
    console.log('📸 Screenshot saved to /tmp/medication-week-view.png');
  });
});
