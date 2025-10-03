import { test, expect } from '@playwright/test';

/**
 * E2E Test: Caregiver Care Log Workflow
 * Tests draft/submit workflow with auto-save
 */

test.describe('Caregiver Care Log Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as caregiver
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/caregiver\/form/);
  });

  test('should complete full care log form', async ({ page }) => {
    // Section 1: Morning Routine
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.selectOption('select[name="mood"]', 'alert');
    await page.fill('input[name="showerTime"]', '08:00');
    await page.check('input[name="hairWash"]');

    // Section 2: Medications
    await page.click('text=Medications');
    await page.check('input[name="medications.0.given"]');
    await page.fill('input[name="medications.0.time"]', '08:15');

    // Section 3: Meals
    await page.click('text=Meals');
    await page.fill('input[name="breakfastTime"]', '09:00');
    await page.fill('input[name="breakfastAppetite"]', '4');
    await page.fill('input[name="breakfastAmount"]', '80');

    // Section 4: Vital Signs
    await page.click('text=Vital Signs');
    await page.fill('input[name="bloodPressure"]', '120/80');
    await page.fill('input[name="pulseRate"]', '72');
    await page.fill('input[name="oxygenLevel"]', '98');
    await page.fill('input[name="bloodSugar"]', '110');
    await page.fill('input[name="vitalsTime"]', '09:30');

    // Section 5: Toileting
    await page.click('text=Toileting');
    await page.fill('input[name="bowelFreq"]', '1');
    await page.fill('input[name="urineFreq"]', '5');
    await page.fill('input[name="diaperChanges"]', '3');

    // Section 6: Safety & Notes
    await page.click('text=Safety');
    await page.fill('textarea[name="notes"]', 'Patient had a good day');

    // Submit
    await page.click('button:has-text("Submit")');

    // Should show success message
    await expect(page.locator('text=/submitted.*successfully/i')).toBeVisible();

    // Form should be locked
    const wakeTimeInput = page.locator('input[name="wakeTime"]');
    await expect(wakeTimeInput).toBeDisabled();
  });

  test('should auto-save draft every 30 seconds', async ({ page }) => {
    // Fill some data
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.selectOption('select[name="mood"]', 'alert');

    // Wait for auto-save indicator
    await page.waitForSelector('text=/Saving/i', { timeout: 35000 });

    // Should show "Saved" status
    await expect(page.locator('text=/Saved/i')).toBeVisible({ timeout: 5000 });
  });

  test('should preserve data on page refresh', async ({ page }) => {
    // Fill data
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.fill('input[name="showerTime"]', '08:00');

    // Wait for auto-save
    await page.waitForSelector('text=/Saved/i', { timeout: 35000 });

    // Refresh page
    await page.reload();

    // Data should be preserved
    await expect(page.locator('input[name="wakeTime"]')).toHaveValue('07:30');
    await expect(page.locator('input[name="showerTime"]')).toHaveValue('08:00');
  });

  test('should lock form after submission', async ({ page }) => {
    // Fill minimal data
    await page.fill('input[name="wakeTime"]', '07:30');

    // Submit
    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=/submitted/i')).toBeVisible();

    // All inputs should be disabled
    const wakeTimeInput = page.locator('input[name="wakeTime"]');
    await expect(wakeTimeInput).toBeDisabled();

    // Submit button should be hidden or disabled
    await expect(page.locator('button:has-text("Submit")')).toBeHidden();
  });

  test('should show emergency alert for emergency flag', async ({ page }) => {
    // Check emergency flag
    await page.check('input[name="emergencyFlag"]');

    // Emergency note field should appear
    const emergencyNote = page.locator('textarea[name="emergencyNote"]');
    await expect(emergencyNote).toBeVisible();

    await emergencyNote.fill('Patient had a fall');

    // Submit
    await page.click('button:has-text("Submit")');

    // Should show alert confirmation
    await expect(page.locator('text=/emergency.*alert/i')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.click('button:has-text("Submit")');

    // Should show validation errors
    await expect(page.locator('text=/required/i')).toBeVisible();
  });

  test('should navigate between sections', async ({ page }) => {
    // Section navigation
    await page.click('text=Medications');
    await expect(page.locator('.section-medications')).toBeVisible();

    await page.click('text=Meals');
    await expect(page.locator('.section-meals')).toBeVisible();

    await page.click('text=Vital Signs');
    await expect(page.locator('.section-vitals')).toBeVisible();

    await page.click('text=Toileting');
    await expect(page.locator('.section-toileting')).toBeVisible();

    await page.click('text=Safety');
    await expect(page.locator('.section-safety')).toBeVisible();
  });

  test('should show progress indicator', async ({ page }) => {
    // Progress should show section completion
    await page.fill('input[name="wakeTime"]', '07:30');

    // Check progress indicator
    const progress = page.locator('[data-testid="progress-indicator"]');
    await expect(progress).toContainText(/1.*6|Section 1/);

    // Complete more sections
    await page.click('text=Medications');
    await page.check('input[name="medications.0.given"]');

    await expect(progress).toContainText(/2.*6|Section 2/);
  });
});

test.describe('Caregiver Login', () => {
  test('should login with valid PIN', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/caregiver\/form/);
  });

  test('should reject invalid PIN', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '000000');
    await page.click('button:has-text("Login")');

    await expect(page.locator('text=/invalid.*pin/i')).toBeVisible();
  });

  test('should validate PIN format (6 digits)', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123'); // Only 3 digits
    await page.click('button:has-text("Login")');

    await expect(page.locator('text=/6.*digit/i')).toBeVisible();
  });

  test('should prevent non-numeric PIN', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');

    const pinInput = page.locator('input[name="pin"]');
    await pinInput.fill('abc123');

    // Should only accept numbers
    const value = await pinInput.inputValue();
    expect(value).toMatch(/^\d*$/);
  });
});

test.describe('Draft/Submit Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');
  });

  test('should create draft on first save', async ({ page }) => {
    await page.fill('input[name="wakeTime"]', '07:30');

    // Wait for auto-save
    await page.waitForSelector('text=/Saved.*draft/i', { timeout: 35000 });

    // Status should show "Draft"
    await expect(page.locator('text=/Draft/i')).toBeVisible();
  });

  test('should allow editing draft', async ({ page }) => {
    // Create draft
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.waitForSelector('text=/Saved/i', { timeout: 35000 });

    // Edit draft
    await page.fill('input[name="wakeTime"]', '08:00');

    // Wait for save
    await page.waitForSelector('text=/Saving/i');
    await page.waitForSelector('text=/Saved/i');

    // Value should be updated
    await expect(page.locator('input[name="wakeTime"]')).toHaveValue('08:00');
  });

  test('should transition from draft to submitted', async ({ page }) => {
    // Create draft
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.waitForSelector('text=/Saved/i', { timeout: 35000 });

    // Status should be "Draft"
    await expect(page.locator('text=/Draft/i')).toBeVisible();

    // Submit
    await page.click('button:has-text("Submit")');

    // Status should change to "Submitted"
    await expect(page.locator('text=/Submitted/i')).toBeVisible();
  });
});

test.describe('Invalidation Workflow', () => {
  test('should allow editing after invalidation', async ({ page }) => {
    // Login as caregiver
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    // Assume log is invalidated (mock state)
    await page.goto('/caregiver/form?logId=invalidated-log-123');

    // Should show invalidation notice
    await expect(page.locator('text=/invalidated/i')).toBeVisible();
    await expect(page.locator('text=/correction.*needed/i')).toBeVisible();

    // Form should be editable
    const wakeTimeInput = page.locator('input[name="wakeTime"]');
    await expect(wakeTimeInput).not.toBeDisabled();

    // Can edit and resubmit
    await wakeTimeInput.fill('08:00');
    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=/submitted/i')).toBeVisible();
  });

  test('should show invalidation reason', async ({ page }) => {
    await page.goto('/caregiver/form?logId=invalidated-log-123');

    // Should display reason from family admin
    await expect(page.locator('text=/Reason.*incorrect.*wake.*time/i')).toBeVisible();
  });
});

test.describe('Mobile Workflow', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should complete form on mobile', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.tap('button:has-text("Login")');

    // Fill form on mobile
    await page.fill('input[name="wakeTime"]', '07:30');
    await page.selectOption('select[name="mood"]', 'alert');

    // Submit
    await page.tap('button:has-text("Submit")');

    await expect(page.locator('text=/submitted/i')).toBeVisible();
  });

  test('should have mobile-friendly inputs', async ({ page }) => {
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'caregiver-123');
    await page.fill('input[name="pin"]', '123456');
    await page.tap('button:has-text("Login")');

    // Time inputs should use mobile keyboards
    const wakeTimeInput = page.locator('input[name="wakeTime"]');
    await expect(wakeTimeInput).toHaveAttribute('type', 'time');

    // Number inputs should use numeric keyboard
    const pulseInput = page.locator('input[name="pulseRate"]');
    await expect(pulseInput).toHaveAttribute('type', 'number');
  });
});
