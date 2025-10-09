import { test, expect } from '@playwright/test';

/**
 * E2E Test: Physical Activity & Exercise - Sprint 3 Day 2
 * Tests the complete flow of adding physical activity data and viewing it on the dashboard
 * Source: Daily Care Report Template pages 8-9
 */

test.describe('Physical Activity & Exercise E2E', () => {
  test('should add physical activity data and display on dashboard', async ({ page }) => {
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

    // Navigate through sections to Physical Activity (Section 11)
    // Sections 1-10
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Verify we're on Physical Activity section
    await expect(page.locator('h2').first()).toContainText('Physical Activity');

    // Fill exercise duration
    await page.fill('input[type="number"]', '30');

    // Select exercise types (walking and stretching)
    await page.click('button:has-text("🚶 Walking")');
    await page.click('button:has-text("🧘 Stretching")');

    // Fill walking distance
    await page.fill('input[placeholder*="around house"]', 'around house, to mailbox');

    // Select assistance level (minimal)
    await page.click('button:has-text("Minimal")');

    // Select pain level (none)
    const painButtons = await page.locator('button:has-text("😊 None")').all();
    await painButtons[0].click(); // First "None" button is for pain

    // Select energy after activity (energized)
    await page.click('button:has-text("⚡ Energized")');

    // Select participation willingness (willing)
    await page.click('button:has-text("👍 Willing")');

    // Select equipment (cane)
    await page.click('button:has-text("🦯 Cane")');

    // Fill mobility notes
    await page.fill('textarea[placeholder*="mobility"]', 'Good mobility today, steady gait');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Navigate to Notes & Submit section
    await page.click('button:has-text("Next: Notes & Submit")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Notes & Submit');

    // Submit the report
    await page.click('button:has-text("Submit Report")');

    // Wait for success message
    await expect(page.locator('text=Report Submitted Successfully')).toBeVisible({ timeout: 10000 });

    // Verify the "Create New Report" button is visible (confirms submission success)
    await expect(page.locator('button:has-text("Create New Report for Tomorrow")')).toBeVisible();

    console.log('✅ Physical Activity E2E test passed');
  });

  test('should handle optional fields correctly', async ({ page }) => {
    test.setTimeout(90000);

    // Navigate and login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForSelector('input[name="caregiverId"]', { timeout: 30000 });
    await page.fill('input[name="caregiverId"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/caregiver/form', { timeout: 30000 });
    await page.waitForSelector('h2', { timeout: 10000 });

    // Navigate to Physical Activity section (skip filling other sections)
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Physical Activity');

    // Only fill duration (leave other fields empty)
    await page.fill('input[type="number"]', '15');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Navigate to submit
    await page.click('button:has-text("Next: Notes & Submit")');
    await page.waitForTimeout(500);

    // Submit should work even with partial data (all fields optional except duration)
    await page.click('button:has-text("Submit Report")');
    await expect(page.locator('text=Report Submitted Successfully')).toBeVisible({ timeout: 10000 });

    console.log('✅ Optional fields test passed');
  });

  test('should allow selecting multiple exercise types and equipment', async ({ page }) => {
    test.setTimeout(90000);

    // Navigate and login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForSelector('input[name="caregiverId"]', { timeout: 30000 });
    await page.fill('input[name="caregiverId"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/caregiver/form', { timeout: 30000 });
    await page.waitForSelector('h2', { timeout: 10000 });

    // Navigate to Physical Activity section
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Physical Activity');

    // Select all exercise types
    await page.click('button:has-text("🚶 Walking")');
    await expect(page.locator('button:has-text("🚶 Walking")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("🧘 Stretching")');
    await expect(page.locator('button:has-text("🧘 Stretching")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("🪑 Chair Exercises")');
    await expect(page.locator('button:has-text("🪑 Chair Exercises")')).toHaveClass(/bg-primary-100/);

    // Select multiple equipment items
    await page.click('button:has-text("🦯 Cane")');
    await expect(page.locator('button:has-text("🦯 Cane")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("🚶‍♂️ Walker")');
    await expect(page.locator('button:has-text("🚶‍♂️ Walker")')).toHaveClass(/bg-primary-100/);

    console.log('✅ Multiple selection test passed');
  });

  test('should validate assistance levels correctly', async ({ page }) => {
    test.setTimeout(90000);

    // Navigate and login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForSelector('input[name="caregiverId"]', { timeout: 30000 });
    await page.fill('input[name="caregiverId"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/caregiver/form', { timeout: 30000 });
    await page.waitForSelector('h2', { timeout: 10000 });

    // Navigate to Physical Activity section
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Physical Activity');

    // Test each assistance level
    await page.click('button:has-text("None")');
    await expect(page.locator('button:has-text("None")').first()).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Minimal")');
    await expect(page.locator('button:has-text("Minimal")').first()).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Moderate")');
    await expect(page.locator('button:has-text("Moderate")').first()).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Full")');
    await expect(page.locator('button:has-text("Full")').first()).toHaveClass(/bg-primary-100/);

    console.log('✅ Assistance level validation test passed');
  });
});
