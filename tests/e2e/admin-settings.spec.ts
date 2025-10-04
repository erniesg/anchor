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
    await page.click('button:has-text("Log in")');

    // Navigate to settings page
    await page.goto('/family/settings');
    await expect(page).toHaveURL(/\/family\/settings/);
  });

  test('should display caregiver management section', async ({ page }) => {
    // Check that Caregivers card is visible on settings page
    const caregiversCard = page.getByRole('link', { name: /Caregivers/i });
    await expect(caregiversCard).toBeVisible();
    await expect(page.getByText('Manage caregivers, reset PINs, and deactivate accounts')).toBeVisible();
  });

  test('should list all caregivers with status', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Should show page title
    await expect(page.getByRole('heading', { name: 'Manage Caregivers' })).toBeVisible();

    // Should show active caregivers section
    await expect(page.getByRole('heading', { name: /Active Caregivers/i })).toBeVisible();
  });

  test('should deactivate caregiver', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Click deactivate button (if any caregivers exist)
    const deactivateBtn = page.getByRole('button', { name: /Deactivate/i }).first();
    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click();

      // Should show confirmation modal
      await expect(page.getByRole('heading', { name: 'Deactivate Caregiver' })).toBeVisible();
      await expect(page.getByText(/Are you sure you want to deactivate/i)).toBeVisible();

      // Enter reason
      await page.getByPlaceholder(/e.g., Resigned/i).fill('Contract ended');

      // Confirm
      await page.getByRole('button', { name: /^Deactivate$/i }).click();

      // Wait for modal to close and check for inactive section
      await expect(page.getByRole('heading', { name: /Inactive Caregivers/i })).toBeVisible();
    }
  });

  test('should reset caregiver PIN', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Click reset PIN button (if any caregivers exist)
    const resetBtn = page.getByRole('button', { name: /Reset PIN/i }).first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();

      // Should show success modal with new PIN
      await expect(page.getByRole('heading', { name: 'PIN Reset Successful' })).toBeVisible();
      await expect(page.getByText(/New PIN for/i)).toBeVisible();

      // PIN should be displayed in a readonly input
      const pinInput = page.locator('input[readonly]').first();
      await expect(pinInput).toBeVisible();

      // Should have copy button (check icon)
      const copyBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(1);
      await expect(copyBtn).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: 'Done' }).click();
    }
  });

  test.skip('should create new caregiver', async ({ page }) => {
    // NOTE: Add Caregiver feature is implemented via onboarding flow, not in settings
    // This test is skipped as the feature location changed
  });

  test.skip('should edit caregiver details', async ({ page }) => {
    // NOTE: Edit caregiver feature not yet implemented in settings UI
    // Caregiver management currently supports: Reset PIN, Deactivate, Reactivate only
  });

  test.skip('should view caregiver audit trail', async ({ page }) => {
    // NOTE: Audit trail detail view not yet implemented
    // Currently shows basic info (name, phone, email, created date) in list view only
  });

  test('should reactivate deactivated caregiver', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Check if there are inactive caregivers section visible
    const inactiveHeading = page.getByRole('heading', { name: /Inactive Caregivers/i });
    if (await inactiveHeading.isVisible()) {
      // Find reactivate button
      const reactivateBtn = page.getByRole('button', { name: /Reactivate/i }).first();
      if (await reactivateBtn.isVisible()) {
        await reactivateBtn.click();

        // Should show confirmation modal
        await expect(page.getByRole('heading', { name: 'Reactivate Caregiver' })).toBeVisible();

        // Confirm
        await page.getByRole('button', { name: /^Reactivate$/i }).click();

        // Modal should close
        await expect(page.getByRole('heading', { name: 'Reactivate Caregiver' })).not.toBeVisible();
      }
    }
  });
});

test.describe('RBAC - family_member restrictions', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family_member (read-only)
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'member@example.com');
    await page.fill('input[name="password"]', 'member123');
    await page.click('button:has-text("Log in")');

    await page.goto('/family/settings');
  });

  test('should view but not edit caregivers', async ({ page }) => {
    // Navigate to caregivers page
    await page.click('text=Caregivers');
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

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
    await page.click('button:has-text("Log in")');
    await page.goto('/family/settings');
  });

  test('should navigate to all settings sections', async ({ page }) => {
    // Caregiver Management
    // Navigate to caregivers page
    await page.click('text=Caregivers');
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Family Invitations (placeholder)
    await page.click('text=Family Invitations');
    await expect(page).toHaveURL(/\/family\/settings\/invitations/);

    // Profile Settings (placeholder)
    await page.click('text=Profile Settings');
    await expect(page).toHaveURL(/\/family\/settings\/profile/);
  });

  test('should show breadcrumb navigation', async ({ page }) => {
    // Navigate to caregivers page
    await page.click('text=Caregivers');
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

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
    await page.click('button:has-text("Log in")');
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
    await page.click('button:has-text("Log in")');
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
