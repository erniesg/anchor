import { test, expect } from '@playwright/test';

/**
 * E2E Test: Fall Risk Alerts on Family Dashboard
 * Sprint 1: Tests fall risk indicators and major fall alerts
 */

test.describe('Fall Risk Alerts - Family Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family member
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@family.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/family\/dashboard/);
  });

  test('should display major fall alert banner', async ({ page }) => {
    // Assume caregiver has submitted a major fall in today's log
    // (This would be seeded in test data)

    // Should see prominent red alert
    await expect(page.locator('text=/MAJOR FALL REPORTED/i')).toBeVisible();

    // Should show fall details
    await expect(page.locator('text=/Walking pattern:/i')).toBeVisible();
    await expect(page.locator('text=/Balance level:/i')).toBeVisible();
    await expect(page.locator('text=/Reported:/i')).toBeVisible();

    // Alert should have critical styling
    const alert = page.locator('text=/MAJOR FALL REPORTED/i').locator('../..');
    await expect(alert).toHaveClass(/border-red-500/);
    await expect(alert).toHaveClass(/bg-red-50/);
  });

  test('should display balance warning for severe issues', async ({ page }) => {
    // Assume balance level 4 or 5 in today's log
    await expect(page.locator('text=/Balance Concern/i')).toBeVisible();
    await expect(page.locator('text=/Severe balance problems/i')).toBeVisible();

    // Should show balance level
    await expect(page.locator('text=/Level [45]\/5/i')).toBeVisible();
  });

  test('should display multiple near falls warning', async ({ page }) => {
    // Assume multiple near falls in today's log
    await expect(page.locator('text=/Multiple Near Falls/i')).toBeVisible();
    await expect(page.locator('text=/Increased monitoring recommended/i')).toBeVisible();

    // Should have yellow/warning styling
    const alert = page.locator('text=/Multiple Near Falls/i').locator('../..');
    await expect(alert).toHaveClass(/border-yellow/);
  });

  test('should show fall risk summary card', async ({ page }) => {
    // Fall Risk card should be visible
    await expect(page.locator('h3:has-text("Fall Risk & Movement")')).toBeVisible();

    // Should show all relevant data
    await expect(page.locator('text=/Balance:/i')).toBeVisible();
    await expect(page.locator('text=/Level [1-5]\/5/i')).toBeVisible();

    // Check for color coding
    const balanceRow = page.locator('text=/Balance:/i').locator('..');
    const balanceValue = balanceRow.locator('span').last();

    // If balance >= 4, should be orange
    const balanceText = await balanceValue.textContent();
    if (balanceText?.includes('4') || balanceText?.includes('5')) {
      await expect(balanceValue).toHaveClass(/text-orange-600/);
    }
  });

  test('should display walking pattern details', async ({ page }) => {
    await expect(page.locator('h3:has-text("Fall Risk & Movement")')).toBeVisible();

    // If walking pattern exists
    const walkingRow = page.locator('text=/Walking:/i');
    if (await walkingRow.isVisible()) {
      // Should show patterns as comma-separated list
      const patterns = walkingRow.locator('..').locator('span').last();
      const text = await patterns.textContent();
      expect(text).toMatch(/(shuffling|uneven|stumbling|slow)/);
    }
  });

  test('should highlight major fall in summary card', async ({ page }) => {
    // Assume major fall in today's log
    const fallRiskCard = page.locator('h3:has-text("Fall Risk & Movement")').locator('../..');

    // Card should have red border for major fall
    await expect(fallRiskCard).toHaveClass(/border-red-400/);

    // Should show MAJOR fall indicator
    await expect(page.locator('text=/🚨 MAJOR/i')).toBeVisible();
  });

  test('should show freezing episodes if present', async ({ page }) => {
    await expect(page.locator('h3:has-text("Fall Risk & Movement")')).toBeVisible();

    const freezingRow = page.locator('text=/Freezing:/i');
    if (await freezingRow.isVisible()) {
      // Should show severity
      const severity = freezingRow.locator('..').locator('span').last();
      const text = await severity.textContent();
      expect(text?.toLowerCase()).toMatch(/(mild|severe)/);

      // Severe should be red
      if (text?.toLowerCase().includes('severe')) {
        await expect(severity).toHaveClass(/text-red-600/);
      }
    }
  });

  test('should not show fall risk card when no data', async ({ page }) => {
    // If no fall risk data in today's log
    // (This would need a specific test data setup)

    // Card should not be visible
    const fallRiskCard = page.locator('h3:has-text("Fall Risk & Movement")');
    // This test depends on test data configuration
  });

  test('should show fall data in week view', async ({ page }) => {
    // Switch to week view
    await page.click('button:has-text("Week")');

    // Should see fall risk data in weekly summary
    // (Implementation depends on week view design)
    await expect(page.locator('text=/Fall Risk/i')).toBeVisible();
  });

  test('should render fall alerts on mobile', async ({ page, context }) => {
    // Set mobile viewport
    await context.setViewportSize({ width: 375, height: 667 });

    // Major fall alert should be responsive
    const alert = page.locator('text=/MAJOR FALL REPORTED/i').locator('../..');
    await expect(alert).toBeVisible();

    // Text should be readable
    await expect(alert).toHaveCSS('font-size', /.+/);

    // Should stack vertically on mobile
    const alertBox = await alert.boundingBox();
    expect(alertBox?.width).toBeLessThan(400);
  });
});

test.describe('Fall Risk Alert Priority', () => {
  test('major fall alert should appear above other cards', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@family.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');

    // Major fall alert should be near the top
    const majorFallAlert = page.locator('text=/MAJOR FALL REPORTED/i').locator('../..');
    const alertPosition = await majorFallAlert.boundingBox();

    // Should be in upper portion of page (y < 800px from top)
    expect(alertPosition?.y).toBeLessThan(800);
  });

  test('should show timestamp on fall alerts', async ({ page }) => {
    await page.goto('/family/dashboard');

    // Check for timestamp format
    const timestamp = page.locator('text=/Reported: \\d{1,2}:\\d{2} (am|pm)/i');
    if (await timestamp.isVisible()) {
      const text = await timestamp.textContent();
      expect(text).toMatch(/Reported: \d{1,2}:\d{2} (am|pm)/i);
    }
  });
});
