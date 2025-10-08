import { test, expect } from '@playwright/test';

/**
 * E2E Test: Spiritual & Emotional Well-Being - Sprint 3 Day 1
 * Tests the complete flow of adding spiritual & emotional data and viewing it on the dashboard
 * Source: Daily Care Report Template page 12
 */

test.describe('Spiritual & Emotional Well-Being E2E', () => {
  test('should add spiritual & emotional data and display on dashboard', async ({ page }) => {
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

    // Navigate through sections to Spiritual & Emotional (Section 10)
    // Sections 1-9
    for (let i = 0; i < 9; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Verify we're on Spiritual & Emotional section
    await expect(page.locator('h2').first()).toContainText('Spiritual & Emotional Well-Being');

    // Fill prayer time
    const timeInputs = await page.locator('input[type="time"]').all();
    await timeInputs[0].fill('09:00'); // Start time
    await timeInputs[1].fill('09:30'); // End time

    // Select prayer expression
    await page.click('button:has-text("Speaking Out Loud")');

    // Select overall mood (4 out of 5)
    const moodButtons = await page.locator('button:has-text("4")').all();
    await moodButtons[0].click(); // First set of 1-5 buttons is mood

    // Select communication scale (3 out of 5)
    const commButtons = await page.locator('button:has-text("3")').all();
    await commButtons[1].click(); // Second set of 1-5 buttons is communication

    // Select social interaction
    await page.click('button:has-text("Engaged")');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Navigate to Notes & Submit section
    await page.click('button:has-text("Next: Notes & Submit")');
    await page.waitForTimeout(500);
    await expect(page.locator('h2').first()).toContainText('Notes & Submit');

    // Submit the report
    await page.click('button:has-text("Submit Report")');

    // Wait a bit for the submission to process
    await page.waitForTimeout(3000);

    // Debug: Take a screenshot
    await page.screenshot({ path: 'test-results/after-submit.png', fullPage: true });

    // Check console for errors
    page.on('console', msg => console.log('Browser console:', msg.text()));

    // Wait for success message
    await expect(page.locator('text=Report Submitted Successfully')).toBeVisible({ timeout: 10000 });

    // Verify spiritual & emotional data is shown in summary
    await expect(page.locator('text=Prayer')).toBeVisible();
    await expect(page.locator('text=09:00')).toBeVisible();
    await expect(page.locator('text=Mood: 4')).toBeVisible();
    await expect(page.locator('text=Communication: 3')).toBeVisible();

    console.log('✅ Spiritual & Emotional E2E test passed');
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

    // Navigate to Spiritual & Emotional section (skip filling other sections)
    for (let i = 0; i < 9; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Spiritual & Emotional Well-Being');

    // Only fill mood scale (leave other fields empty)
    const moodButtons = await page.locator('button:has-text("5")').all();
    await moodButtons[0].click();

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

  test('should validate mood and communication scales (1-5)', async ({ page }) => {
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

    // Navigate to Spiritual & Emotional section
    for (let i = 0; i < 9; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Spiritual & Emotional Well-Being');

    // Verify all mood scale buttons are present (1-5)
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator('button:has-text("' + i + '")').first()).toBeVisible();
    }

    // Test selecting each scale value
    const moodButtons = await page.locator('button').filter({ hasText: /^[1-5]$/ }).all();

    // Select mood = 1
    await moodButtons[0].click();
    await expect(moodButtons[0]).toHaveClass(/bg-primary-100/);

    // Select mood = 5
    await moodButtons[4].click();
    await expect(moodButtons[4]).toHaveClass(/bg-primary-100/);

    // Select communication = 3
    await moodButtons[7].click(); // 6th-10th buttons are communication scale
    await expect(moodButtons[7]).toHaveClass(/bg-primary-100/);

    console.log('✅ Scale validation test passed');
  });

  test('should allow selecting all prayer expression types', async ({ page }) => {
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

    // Navigate to Spiritual & Emotional section
    for (let i = 0; i < 9; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Spiritual & Emotional Well-Being');

    // Verify all prayer expression options are present
    await expect(page.locator('button:has-text("Speaking Out Loud")')).toBeVisible();
    await expect(page.locator('button:has-text("Whispering")')).toBeVisible();
    await expect(page.locator('button:has-text("Mumbling")')).toBeVisible();
    await expect(page.locator('button:has-text("Silent Worship")')).toBeVisible();

    // Test selecting each option
    await page.click('button:has-text("Whispering")');
    await expect(page.locator('button:has-text("Whispering")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Silent Worship")');
    await expect(page.locator('button:has-text("Silent Worship")')).toHaveClass(/bg-primary-100/);

    console.log('✅ Prayer expression test passed');
  });

  test('should allow selecting all social interaction types', async ({ page }) => {
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

    // Navigate to Spiritual & Emotional section
    for (let i = 0; i < 9; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').first()).toContainText('Spiritual & Emotional Well-Being');

    // Verify all social interaction options are present
    await expect(page.locator('button:has-text("Engaged")')).toBeVisible();
    await expect(page.locator('button:has-text("Responsive")')).toBeVisible();
    await expect(page.locator('button:has-text("Withdrawn")')).toBeVisible();
    await expect(page.locator('button:has-text("Aggressive/Hostile")')).toBeVisible();

    // Test selecting each option
    await page.click('button:has-text("Responsive")');
    await expect(page.locator('button:has-text("Responsive")')).toHaveClass(/bg-primary-100/);

    await page.click('button:has-text("Withdrawn")');
    await expect(page.locator('button:has-text("Withdrawn")')).toHaveClass(/bg-primary-100/);

    console.log('✅ Social interaction test passed');
  });
});
