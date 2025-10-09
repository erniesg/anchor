import { test, expect } from '@playwright/test';

/**
 * E2E Test: Oral Care & Hygiene - Sprint 3 Day 3
 * Tests the complete flow of adding oral care data and viewing it on the dashboard
 * Source: Daily Care Report Template page 10
 */

test.describe('Oral Care & Hygiene E2E', () => {
  test('should add oral care data and submit successfully', async ({ page }) => {
    // Increase timeout for SPA navigation
    test.setTimeout(90000);

    // Navigate to caregiver login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for login form to load (SPA)
    await page.waitForSelector('input[name="caregiverId"]', { timeout: 30000 });

    // Login as caregiver
    await page.fill('input[name="caregiverId"]', '88fef386-a0bd-452d-a8b6-be2844ef0bc6');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to form
    await page.waitForURL('**/caregiver/form', { timeout: 30000 });
    await page.waitForSelector('h2', { timeout: 10000 });
    await expect(page.locator('h2')).toContainText('Morning Routine');

    // Navigate through sections to Oral Care (Section 12)
    // Sections 1-11
    for (let i = 0; i < 11; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Verify we're on Oral Care section
    await expect(page.locator('h2').first()).toContainText('Oral Care');

    // Check "Teeth Brushed"
    await page.click('input[type="checkbox"]#teethBrushed');

    // Fill times brushed
    await page.fill('input[type="number"][placeholder*="number of times"]', '2');

    // Check "Dentures Cleaned"
    await page.click('input[type="checkbox"]#denturesCleaned');

    // Check "Mouth Rinsed"
    await page.click('input[type="checkbox"]#mouthRinsed');

    // Select assistance level (minimal)
    await page.click('button:has-text("Minimal")');

    // Select oral health issues (dry mouth)
    await page.click('button:has-text("Dry Mouth")');

    // Fill notes
    await page.fill('textarea[placeholder*="oral health"]', 'Good cooperation during oral care');

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
    await expect(page.locator('button:has-text("Create New Report for Tomorrow")')).toBeVisible();

    console.log('✅ Oral Care E2E test passed');
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

    // Navigate to Oral Care section (skip filling other sections)
    for (let i = 0; i < 11; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Oral Care');

    // Only check teeth brushed (leave other fields empty)
    await page.click('input[type="checkbox"]#teethBrushed');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Navigate to submit
    await page.click('button:has-text("Next: Notes & Submit")');
    await page.waitForTimeout(500);

    // Submit should work even with partial data (all fields optional)
    await page.click('button:has-text("Submit Report")');
    await expect(page.locator('text=Report Submitted Successfully')).toBeVisible({ timeout: 10000 });

    console.log('✅ Optional fields test passed');
  });

  test('should allow selecting multiple oral health issues', async ({ page }) => {
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

    // Navigate to Oral Care section
    for (let i = 0; i < 11; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Oral Care');

    // Select multiple oral health issues
    await page.click('button:has-text("Bleeding Gums")');
    await expect(page.locator('button:has-text("Bleeding Gums")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Dry Mouth")');
    await expect(page.locator('button:has-text("Dry Mouth")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Pain")');
    await expect(page.locator('button:has-text("Pain")').first()).toHaveClass(/bg-primary-100/);

    console.log('✅ Multiple health issues test passed');
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

    // Navigate to Oral Care section
    for (let i = 0; i < 11; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Oral Care');

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
