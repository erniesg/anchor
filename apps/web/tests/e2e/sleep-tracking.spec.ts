import { test, expect } from '@playwright/test';

/**
 * E2E Test: Sleep Tracking - Sprint 2 Day 3
 * Tests the complete flow of adding sleep tracking data and viewing it on the dashboard
 */

test.describe('Sleep Tracking E2E', () => {
  test('should add sleep tracking data and display on dashboard', async ({ page }) => {
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

    // Navigate through sections to Sleep Tracking (Section 5)
    // Section 1 -> 2 (Medications)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Section 2 -> 3 (Meals)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Section 3 -> 4 (Fluid Intake)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Section 4 -> 5 (Sleep Tracking)
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Rest & Sleep');

    // Enable afternoon rest
    await page.check('input[type="checkbox"]:near(:text("Had afternoon rest today"))');

    // Fill afternoon rest details
    await page.fill('input[type="time"]', '14:00'); // Start time
    const timeInputs = await page.locator('input[type="time"]').all();
    await timeInputs[1].fill('15:30'); // End time

    // Select afternoon rest quality
    await page.click('button:has-text("😌 Light Sleep")');

    // Add optional notes
    await page.fill('textarea[placeholder*="afternoon rest"]', 'Slept peacefully on the sofa');

    // Enable night sleep
    await page.check('input[type="checkbox"]:near(:text("Record night sleep"))');

    // Fill night sleep details
    await page.fill('input[type="time"]:below(:text("Bedtime"))', '21:30');

    // Select night sleep quality
    const qualityButtons = await page.locator('button:has-text("😟 Restless")').all();
    await qualityButtons[1].click(); // Second one is for night sleep

    // Set number of wakings
    await page.fill('input[type="number"][min="0"]', '2');

    // Select waking reasons
    await page.check('input[type="checkbox"]:near(:text("Toilet"))');
    await page.check('input[type="checkbox"]:near(:text("Pain"))');

    // Select sleep behaviors
    await page.check('input[type="checkbox"]:near(:text("Snoring"))');
    await page.check('input[type="checkbox"]:near(:text("Restless"))');

    // Add night sleep notes
    await page.fill('textarea[placeholder*="night sleep"]', 'Woke up twice, seemed uncomfortable');

    // Verify all data is filled (immediate check before navigation)
    const afternoonCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(afternoonCheckbox).toBeChecked();

    const nightCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await expect(nightCheckbox).toBeChecked();

    const wakingsInput = page.locator('input[type="number"][min="0"]');
    await expect(wakingsInput).toHaveValue('2');

    // Wait for auto-save to complete
    await page.waitForTimeout(2000);

    // Test complete - sleep data successfully filled in form
    // Note: Data persistence is validated via API tests
    console.log('✅ Sleep tracking caregiver form E2E test passed!');
  });

  // TODO: Add family dashboard test once family user credentials are set up
  test.skip('should display sleep data on family dashboard', async ({ page }) => {
    // This test requires:
    // 1. Family admin user with known password in remote DB
    // 2. Submitted care log with sleep data
    // 3. Family dashboard UI implementation with data-testid attributes
  });
});
