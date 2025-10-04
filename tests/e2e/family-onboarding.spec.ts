import { test, expect } from '@playwright/test';

/**
 * E2E Test: Family Onboarding Flow
 * Tests the complete family signup to caregiver creation journey
 */

test.describe('Family Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full onboarding flow', async ({ page }) => {
    // Step 1: Family Signup
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'family@example.com');
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.fill('input[name="phone"]', '+6512345678');
    await page.click('button:has-text("Sign Up")');

    // Should redirect to care recipient form
    await expect(page).toHaveURL(/\/family\/onboarding\/care-recipient/);

    // Step 2: Add Care Recipient
    await page.fill('input[name="name"]', 'Grandma Lee');
    await page.fill('input[name="condition"]', 'Progressive Supranuclear Palsy');
    await page.fill('input[name="dateOfBirth"]', '1945-03-15');
    await page.fill('input[name="location"]', 'Singapore');
    await page.fill('input[name="emergencyContact"]', '+6598765432');
    await page.click('button:has-text("Continue")');

    // Should redirect to caregiver creation
    await expect(page).toHaveURL(/\/family\/onboarding\/caregiver/);

    // Step 3: Create Caregiver
    await page.fill('input[name="name"]', 'Maria Santos');
    await page.fill('input[name="phone"]', '+6591234567');
    await page.fill('input[name="email"]', 'maria@example.com');
    await page.selectOption('select[name="language"]', 'en');
    await page.click('button:has-text("Create Caregiver")');

    // Should show PIN
    await expect(page.locator('text=/PIN: \\d{6}/')).toBeVisible();

    // Should have continue button
    await page.click('button:has-text("Continue to Dashboard")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/family\/dashboard/);
    await expect(page.locator('text=Grandma Lee')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    await expect(page.locator('text=/invalid.*email/i')).toBeVisible();
  });

  test('should validate password length', async ({ page }) => {
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="password"]', 'short');
    await page.click('button:has-text("Sign Up")');

    await expect(page.locator('text=/password.*8/i')).toBeVisible();
  });

  test('should prevent duplicate email registration', async ({ page }) => {
    // First signup
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'duplicate@example.com');
    await page.fill('input[name="name"]', 'First User');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    // Logout and try again
    await page.click('text=Logout');
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'duplicate@example.com');
    await page.fill('input[name="name"]', 'Second User');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    await expect(page.locator('text=/email.*already.*registered/i')).toBeVisible();
  });

  test('should allow navigation back in onboarding flow', async ({ page }) => {
    // Complete step 1
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'back@example.com');
    await page.fill('input[name="name"]', 'Back Test');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    await expect(page).toHaveURL(/\/family\/onboarding\/care-recipient/);

    // Go back
    await page.click('button:has-text("Back")');

    // Should return to signup (or edit mode)
    await expect(page).toHaveURL(/\/auth\/signup|\/family\/onboarding/);
  });

  test('should save progress when navigating away', async ({ page }) => {
    // Start onboarding
    await page.click('text=Get Started');
    await page.fill('input[name="email"]', 'save@example.com');
    await page.fill('input[name="name"]', 'Save Test');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    // Fill care recipient partially
    await page.fill('input[name="name"]', 'Grandma Test');
    await page.fill('input[name="condition"]', 'PSP');

    // Navigate away
    await page.goto('/');

    // Return to onboarding
    await page.goto('/family/onboarding/care-recipient');

    // Data should be preserved
    await expect(page.locator('input[name="name"]')).toHaveValue('Grandma Test');
    await expect(page.locator('input[name="condition"]')).toHaveValue('PSP');
  });
});

test.describe('Family Login Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    // Assume user exists
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'family@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button:has-text("Log in")');

    await expect(page).toHaveURL(/\/family\/dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button:has-text("Log in")');

    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible();
  });

  test('should redirect to dashboard if already logged in', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'family@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button:has-text("Log in")');

    // Try to access login page again
    await page.goto('/auth/login');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/family\/dashboard/);
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should complete onboarding on mobile', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    // All form fields should be visible and tappable
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();

    await emailInput.fill('mobile@example.com');
    await page.fill('input[name="name"]', 'Mobile User');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign Up")');

    // Should work on mobile
    await expect(page).toHaveURL(/\/family\/onboarding\/care-recipient/);
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/');

    const getStartedButton = page.locator('text=Get Started');
    await expect(getStartedButton).toBeVisible();

    // Check button size (should be at least 44x44px for touch)
    const box = await getStartedButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
