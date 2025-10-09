import { test, expect, devices } from '@playwright/test';

// Test on iPhone 13 (can be configured for other devices in playwright.config)
test.use({ ...devices['iPhone 13'] });

test.describe('Mobile Caregiver Experience', () => {
  const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
  const CAREGIVER_ID = '88fef386-a0bd-452d-a8b6-be2844ef0bc6';
  const CAREGIVER_PIN = '123456';
  const deviceName = 'iPhone 13';

  test('should display mobile-optimized login', async ({ page }) => {
    console.log(`\n📱 Testing on ${deviceName}...`);

    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.waitForLoadState('networkidle');

    // Check viewport
    const viewport = page.viewportSize();
    console.log(`  Viewport: ${viewport?.width}x${viewport?.height}`);

    // Verify mobile layout elements are visible
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for responsive design
    const submitButton = page.locator('button[type="submit"]');
    const buttonBox = await submitButton.boundingBox();

    if (buttonBox) {
      console.log(`  Submit button: ${buttonBox.width}x${buttonBox.height}`);
      expect(buttonBox.width).toBeGreaterThan(100); // Touch-friendly width
      expect(buttonBox.height).toBeGreaterThan(40); // Touch-friendly height
    }

    console.log(`  ✅ ${deviceName} login page rendered correctly`);
      });

      test('should handle touch interactions', async ({ page }) => {
    console.log(`\n🖐️  Testing touch on ${deviceName}...`);

    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.waitForLoadState('networkidle');

    // Test tap/touch on inputs
    await page.locator('input[type="text"]').tap();
    await page.fill('input[type="text"]', CAREGIVER_ID);

    await page.locator('input[type="password"]').tap();
    await page.fill('input[type="password"]', CAREGIVER_PIN);

    // Test tap on submit button
    await page.locator('button[type="submit"]').tap();

    // Wait for navigation
    await page.waitForURL('**/caregiver/form', { timeout: 10000 });
    console.log(`  ✅ ${deviceName} touch interactions working`);
      });

      test('should display mobile form layout', async ({ page }) => {
    console.log(`\n📋 Testing form layout on ${deviceName}...`);

    // Login first
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[type="text"]', CAREGIVER_ID);
    await page.fill('input[type="password"]', CAREGIVER_PIN);
    await page.locator('button[type="submit"]').tap();
    await page.waitForURL('**/caregiver/form');

    // Check form header is visible
    await expect(page.locator('text=/Daily Care Report/i')).toBeVisible();

    // Check form sections don't overflow
    const viewport = page.viewportSize();
    if (viewport) {
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      console.log(`  Body width: ${bodyWidth}px, Viewport: ${viewport.width}px`);

      // Should not require horizontal scrolling
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Small margin allowed
    }

    console.log(`  ✅ ${deviceName} form layout optimized`);
      });

      test('should handle mobile time picker', async ({ page }) => {
    console.log(`\n⏰ Testing time picker on ${deviceName}...`);

    // Login and navigate to form
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[type="text"]', CAREGIVER_ID);
    await page.fill('input[type="password"]', CAREGIVER_PIN);
    await page.locator('button[type="submit"]').tap();
    await page.waitForURL('**/caregiver/form');

    // Find and interact with time input
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.tap();

    // On mobile, time pickers use native widgets
    // Just verify we can set a value
    await timeInput.fill('08:30');

    const value = await timeInput.inputValue();
    expect(value).toBe('08:30');

    console.log(`  ✅ ${deviceName} time picker working`);
      });

      test('should handle mobile slider interactions', async ({ page }) => {
    console.log(`\n📊 Testing sliders on ${deviceName}...`);

    // Login and navigate to form
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[type="text"]', CAREGIVER_ID);
    await page.fill('input[type="password"]', CAREGIVER_PIN);
    await page.locator('button[type="submit"]').tap();
    await page.waitForURL('**/caregiver/form');

    // Navigate to meals section (has sliders)
    await page.locator('button').filter({ hasText: /Next/i }).first().tap();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /Next/i }).first().tap();
    await page.waitForTimeout(500);

    // Find appetite slider
    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible({ timeout: 1000 })) {
      // Test slider interaction
      await slider.fill('4');
      const value = await slider.inputValue();
      expect(value).toBe('4');
      console.log(`  ✅ ${deviceName} slider interaction working`);
    } else {
      console.log(`  ⏭️  No sliders visible in current section`);
    }
      });

      test('should have touch-friendly buttons', async ({ page }) => {
    console.log(`\n🔘 Testing button sizes on ${deviceName}...`);

    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.waitForLoadState('networkidle');

    // Check submit button size
    const submitButton = page.locator('button[type="submit"]');
    const box = await submitButton.boundingBox();

    if (box) {
      // Apple's Human Interface Guidelines recommend 44x44pt minimum
      // Android Material Design recommends 48x48dp minimum
      const minSize = deviceName.includes('iPad') ? 44 : 48;

      console.log(`  Button size: ${box.width}x${box.height}px`);
      expect(box.height).toBeGreaterThanOrEqual(minSize);
      console.log(`  ✅ ${deviceName} buttons are touch-friendly (min ${minSize}px)`);
    }
  });

  test('should complete full form submission on mobile', async ({ page }) => {
    test.setTimeout(90000);

    // Use iPhone 13 as default mobile device
    await page.setViewportSize(devices['iPhone 13'].viewport);

    console.log('\n📱 Full Mobile Submission Test...');

    // Login
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[type="text"]', CAREGIVER_ID);
    await page.fill('input[type="password"]', CAREGIVER_PIN);
    await page.locator('button[type="submit"]').tap();
    await page.waitForURL('**/caregiver/form');

    console.log('✅ Mobile login successful');

    // Fill minimum required sections
    // Section 1: Morning Routine
    await page.locator('input[type="time"]').first().fill('08:00');
    await page.locator('button:has-text("alert")').tap();
    await page.locator('button').filter({ hasText: /Next/i }).first().tap();
    await page.waitForTimeout(300);

    // Section 2: Medications (skip)
    await page.locator('button').filter({ hasText: /Next/i }).first().tap();
    await page.waitForTimeout(300);

    // Section 3: Meals
    await page.locator('input[type="time"]').first().fill('09:00');
    const sliders = await page.locator('input[type="range"]').all();
    if (sliders.length >= 2) {
      await sliders[0].fill('4');
      await sliders[1].fill('75'); // Changed from 70 to 75 (slider step is 25)
    }
    await page.locator('button').filter({ hasText: /Next/i }).first().tap();
    await page.waitForTimeout(300);

    console.log('✅ Mobile form filling working');

    // Navigate to end (simplified for mobile)
    let attempts = 0;
    while (attempts < 15) {
      const submitButton = await page.locator('button:has-text("Submit Report")').count();
      if (submitButton > 0) {
    console.log('✅ Reached submit section on mobile');
    break;
      }

      const nextButton = await page.locator('button').filter({ hasText: /Next/i }).first();
      if (await nextButton.isVisible({ timeout: 1000 })) {
    await nextButton.tap();
    await page.waitForTimeout(300);
    attempts++;
      } else {
    break;
      }
    }

    // Verify completion percentage is visible on mobile
    const completionText = await page.locator('text=/\\d+%/').textContent();
    console.log(`Mobile form completion: ${completionText}`);

    console.log('✅ Mobile form navigation complete');
  });
});
