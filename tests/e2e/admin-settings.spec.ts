import { test, expect } from '@playwright/test';

/**
 * E2E Test: Admin Settings & Caregiver Management
 * Tests family_admin operations
 */

test.describe('Admin Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family_admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Navigate to settings
    await page.click('text=Settings');
    await expect(page).toHaveURL(/\/family\/settings/);
  });

  test('should display caregiver management section', async ({ page }) => {
    await expect(page.locator('text=Caregiver Management')).toBeVisible();
    await expect(page.locator('text=Active Caregivers')).toBeVisible();
  });

  test('should list all caregivers with status', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Should show caregiver list
    const caregiverList = page.locator('[data-testid="caregiver-list"]');
    await expect(caregiverList).toBeVisible();

    // Each caregiver should have status badge
    const statusBadges = page.locator('[data-testid="status-badge"]');
    await expect(statusBadges.first()).toBeVisible();
  });

  test('should deactivate caregiver', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Click deactivate button
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    await deactivateBtn.click();

    // Should show confirmation modal
    await expect(page.locator('text=/confirm.*deactivation/i')).toBeVisible();

    // Enter reason
    await page.fill('textarea[name="reason"]', 'Contract ended');

    // Confirm
    await page.click('button:has-text("Confirm Deactivation")');

    // Should show success message
    await expect(page.locator('text=/deactivated.*successfully/i')).toBeVisible();

    // Caregiver should show "Inactive" status
    await expect(page.locator('text=Inactive').first()).toBeVisible();
  });

  test('should reset caregiver PIN', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Click reset PIN button
    const resetBtn = page.locator('button:has-text("Reset PIN")').first();
    await resetBtn.click();

    // Should show confirmation modal
    await expect(page.locator('text=/confirm.*PIN.*reset/i')).toBeVisible();

    // Confirm
    await page.click('button:has-text("Confirm Reset")');

    // Should show new PIN
    await expect(page.locator('text=/New PIN:/i')).toBeVisible();
    const newPin = page.locator('[data-testid="new-pin"]');
    await expect(newPin).toHaveText(/\d{6}/);

    // Should have copy button
    const copyBtn = page.locator('button:has-text("Copy PIN")');
    await expect(copyBtn).toBeVisible();
  });

  test('should create new caregiver', async ({ page }) => {
    await page.click('text=Caregiver Management');
    await page.click('button:has-text("Add Caregiver")');

    // Fill caregiver form
    await page.fill('input[name="name"]', 'New Caregiver');
    await page.fill('input[name="phone"]', '+6591111111');
    await page.fill('input[name="email"]', 'newcaregiver@example.com');
    await page.selectOption('select[name="language"]', 'en');

    // Create
    await page.click('button:has-text("Create Caregiver")');

    // Should show PIN
    await expect(page.locator('text=/PIN:/i')).toBeVisible();
    await expect(page.locator('[data-testid="new-pin"]')).toHaveText(/\d{6}/);

    // Should appear in caregiver list
    await page.click('button:has-text("Done")');
    await expect(page.locator('text=New Caregiver')).toBeVisible();
  });

  test('should edit caregiver details', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Click edit button
    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.click();

    // Update details
    await page.fill('input[name="name"]', 'Updated Name');
    await page.fill('input[name="phone"]', '+6599999999');
    await page.selectOption('select[name="language"]', 'zh');

    // Save
    await page.click('button:has-text("Save Changes")');

    // Should show success message
    await expect(page.locator('text=/updated.*successfully/i')).toBeVisible();

    // Changes should be reflected
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should view caregiver audit trail', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Click on caregiver to view details
    await page.click('text=Maria Santos');

    // Should show audit information
    await expect(page.locator('text=Created By')).toBeVisible();
    await expect(page.locator('text=Created At')).toBeVisible();
    await expect(page.locator('text=Last PIN Reset')).toBeVisible();
  });

  test('should reactivate deactivated caregiver', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Filter to show deactivated caregivers
    await page.click('button:has-text("Show Inactive")');

    // Find deactivated caregiver
    const reactivateBtn = page.locator('button:has-text("Reactivate")').first();
    await reactivateBtn.click();

    // Confirm
    await page.click('button:has-text("Confirm")');

    // Should show success
    await expect(page.locator('text=/reactivated.*successfully/i')).toBeVisible();

    // Should show as active
    await expect(page.locator('text=Active').first()).toBeVisible();
  });
});

test.describe('RBAC - family_member restrictions', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family_member (read-only)
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'member@example.com');
    await page.fill('input[name="password"]', 'member123');
    await page.click('button:has-text("Login")');

    await page.goto('/family/settings');
  });

  test('should view but not edit caregivers', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Can see caregiver list
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    // Cannot see admin actions
    await expect(page.locator('button:has-text("Deactivate")')).toBeHidden();
    await expect(page.locator('button:has-text("Reset PIN")')).toBeHidden();
    await expect(page.locator('button:has-text("Add Caregiver")')).toBeHidden();
  });

  test('should not access admin-only sections', async ({ page }) => {
    // Try to access admin settings
    await page.goto('/family/settings/admin');

    // Should redirect or show forbidden message
    await expect(page.locator('text=/forbidden|unauthorized|admin.*only/i')).toBeVisible();
  });

  test('should show read-only indicator', async ({ page }) => {
    await expect(page.locator('text=/Read.*Only|View.*Only/i')).toBeVisible();
  });
});

test.describe('Settings Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.goto('/family/settings');
  });

  test('should navigate to all settings sections', async ({ page }) => {
    // Caregiver Management
    await page.click('text=Caregiver Management');
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Family Invitations (placeholder)
    await page.click('text=Family Invitations');
    await expect(page).toHaveURL(/\/family\/settings\/invitations/);

    // Profile Settings (placeholder)
    await page.click('text=Profile Settings');
    await expect(page).toHaveURL(/\/family\/settings\/profile/);
  });

  test('should show breadcrumb navigation', async ({ page }) => {
    await page.click('text=Caregiver Management');

    // Should show breadcrumbs
    await expect(page.locator('text=Home')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Caregiver Management')).toBeVisible();
  });
});

test.describe('Caregiver Search & Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.goto('/family/settings/caregivers');
  });

  test('should search caregivers by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Maria');

    // Should filter list
    await expect(page.locator('text=Maria Santos')).toBeVisible();
    await expect(page.locator('text=John Doe')).toBeHidden();
  });

  test('should filter by status', async ({ page }) => {
    // Filter active only
    await page.click('button:has-text("Active")');

    // Should only show active caregivers
    const activeList = page.locator('[data-status="active"]');
    await expect(activeList).toBeVisible();

    // Filter inactive only
    await page.click('button:has-text("Inactive")');

    // Should only show inactive caregivers
    const inactiveList = page.locator('[data-status="inactive"]');
    await expect(inactiveList).toBeVisible();
  });

  test('should sort caregivers', async ({ page }) => {
    await page.click('button:has-text("Sort")');

    // Sort by name
    await page.click('text=Name (A-Z)');

    // First caregiver should be alphabetically first
    const firstCaregiver = page.locator('[data-testid="caregiver-item"]').first();
    // Add specific assertion based on your test data
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.goto('/family/settings/caregivers');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/caregivers/**/deactivate', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );

    // Try to deactivate
    await page.click('button:has-text("Deactivate")').first();
    await page.fill('textarea[name="reason"]', 'Test');
    await page.click('button:has-text("Confirm Deactivation")');

    // Should show error message
    await expect(page.locator('text=/error|failed/i')).toBeVisible();
  });

  test('should retry failed operations', async ({ page }) => {
    let attempts = 0;

    await page.route('**/api/caregivers/**/reset-pin', route => {
      attempts++;
      if (attempts < 2) {
        route.fulfill({ status: 500 });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ newPin: '123456' }),
        });
      }
    });

    // Try to reset PIN
    await page.click('button:has-text("Reset PIN")').first();
    await page.click('button:has-text("Confirm Reset")');

    // Should eventually succeed
    await expect(page.locator('text=/New PIN/i')).toBeVisible({ timeout: 10000 });
  });
});
