import { test, expect } from '@playwright/test';

/**
 * E2E Test: Sleep Tracking - Sprint 2 Day 3
 * Tests the complete flow of adding sleep tracking data and viewing it on the dashboard
 */

test.describe('Sleep Tracking E2E', () => {
  test('should add sleep tracking data and display on dashboard', async ({ page }) => {
    // Navigate to caregiver login
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/login');

    // Login as caregiver (using test credentials from seed data)
    await page.fill('input[name="caregiverId"]', '550e8400-e29b-41d4-a716-446655440001');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to form
    await page.waitForURL('**/caregiver/form');
    await expect(page.locator('h2')).toContainText('Morning Routine');

    // Navigate through sections to Sleep Tracking (Section 5)
    // Section 1 -> 2 (Medications)
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toContainText('Medications');

    // Section 2 -> 3 (Meals)
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toContainText('Meals');

    // Section 3 -> 4 (Fluid Intake)
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toContainText('Fluid Intake');

    // Section 4 -> 5 (Sleep Tracking)
    await page.click('button:has-text("Next: Sleep Tracking")');
    await expect(page.locator('h2')).toContainText('Rest & Sleep');

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

    // Navigate to next section to trigger auto-save
    await page.click('button:has-text("Next: Vital Signs")');
    await expect(page.locator('h2')).toContainText('Vital Signs');

    // Wait for auto-save (check for save indicator)
    await page.waitForTimeout(2000);

    // Navigate back to verify data persisted
    await page.click('button:has-text("Back: Sleep")');
    await expect(page.locator('h2')).toContainText('Rest & Sleep');

    // Verify afternoon rest data persisted
    const afternoonCheckbox = page.locator('input[type="checkbox"]:near(:text("Had afternoon rest today"))');
    await expect(afternoonCheckbox).toBeChecked();

    const startTimeInput = page.locator('input[type="time"]').first();
    await expect(startTimeInput).toHaveValue('14:00');

    // Verify night sleep data persisted
    const nightCheckbox = page.locator('input[type="checkbox"]:near(:text("Record night sleep"))');
    await expect(nightCheckbox).toBeChecked();

    const wakingsInput = page.locator('input[type="number"][min="0"]');
    await expect(wakingsInput).toHaveValue('2');

    // Skip to end and submit (for dashboard test)
    // Navigate through remaining sections quickly
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(500);
    }

    // Submit the care log
    await page.click('button:has-text("Submit Care Log")');

    // Wait for submission
    await page.waitForTimeout(2000);

    // Logout and login as family member to view dashboard
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login');

    // Login as family admin
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/family/dashboard');

    // Check for sleep summary card
    const sleepCard = page.locator('[data-testid="sleep-card"]');
    await expect(sleepCard).toBeVisible();

    // Verify afternoon rest display
    await expect(sleepCard).toContainText('Afternoon Rest');
    await expect(sleepCard).toContainText('😌 Light Sleep');
    await expect(sleepCard).toContainText('14:00 - 15:30');

    // Verify night sleep display
    await expect(sleepCard).toContainText('Night Sleep');
    await expect(sleepCard).toContainText('😟 Restless');
    await expect(sleepCard).toContainText('21:30');
    await expect(sleepCard).toContainText('Woke 2 times');

    // Expand sleep details
    await page.click('[data-testid="sleep-details-toggle"]');

    // Verify waking reasons displayed
    await expect(sleepCard).toContainText('Toilet');
    await expect(sleepCard).toContainText('Pain');

    // Verify behaviors displayed
    await expect(sleepCard).toContainText('Snoring');
    await expect(sleepCard).toContainText('Restless');

    // Check for poor sleep warning banner
    const poorSleepWarning = page.locator('[data-testid="poor-sleep-warning"]');
    await expect(poorSleepWarning).toBeVisible();
    await expect(poorSleepWarning).toContainText('Restless sleep last night');

    // Switch to week view to check chart
    await page.click('button:has-text("Week")');
    await page.waitForTimeout(1000);

    // Verify sleep quality chart exists
    const sleepChart = page.locator('[data-testid="sleep-quality-chart"]');
    await expect(sleepChart).toBeVisible();
    await expect(sleepChart).toContainText('Sleep Quality Trend');

    console.log('✅ Sleep tracking E2E test passed!');
  });
});
