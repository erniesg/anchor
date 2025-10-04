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

  test('should edit caregiver details', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Wait for caregivers list to load
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    // Click edit button (if any caregivers exist)
    const editBtn = page.getByRole('button', { name: /^Edit$/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();

      // Should show edit modal
      await expect(page.getByRole('heading', { name: 'Edit Caregiver Details' })).toBeVisible();

      // Edit the name
      const nameInput = page.locator('input[placeholder*="Caregiver name"]');
      await nameInput.clear();
      await nameInput.fill('Updated Caregiver Name');

      // Save changes
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Should show success toast
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/updated successfully/i')).toBeVisible();

      // Modal should close
      await expect(page.getByRole('heading', { name: 'Edit Caregiver Details' })).not.toBeVisible();

      // Updated name should appear in the list
      await expect(page.locator('text=Updated Caregiver Name')).toBeVisible();
    }
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

    // Wait for navigation to dashboard after successful login
    await page.waitForURL(/\/family\/dashboard/, { timeout: 10000 });

    // Verify login was successful by checking localStorage
    const hasToken = await page.evaluate(() => !!localStorage.getItem('token'));
    if (!hasToken) {
      throw new Error('Login failed - no token in localStorage');
    }

    // Navigate to settings
    await page.goto('/family/settings');
  });

  test('should view but not edit caregivers', async ({ page }) => {
    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Can see caregiver list
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    // Cannot see admin action buttons
    await expect(page.locator('button:has-text("Deactivate")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Reset PIN")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Reactivate")')).not.toBeVisible();
  });

  test('should show read-only indicator', async ({ page }) => {
    // Verify localStorage has the user role
    const userRole = await page.evaluate(() => {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData).role : null;
    });
    console.log('User role in localStorage:', userRole);

    // Navigate to caregivers page
    await page.getByRole('link', { name: /Caregivers/i }).click();
    await expect(page).toHaveURL(/\/family\/settings\/caregivers/);

    // Wait for content to load
    await page.waitForSelector('[data-testid="caregiver-list"]');

    // Should show read-only subtitle (family_member sees different text than admin)
    await expect(page.locator('text=View caregiver information')).toBeVisible();

    // Should NOT show admin subtitle
    await expect(page.locator('text=Reset PINs, deactivate, or reactivate caregivers')).not.toBeVisible();

    // If role is family_member, badge should be visible
    if (userRole === 'family_member') {
      const badge = page.locator('span:has-text("View Only")');
      await expect(badge).toBeVisible();
    }
  });
});

test.describe('Settings Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Log in")');

    // Wait for navigation after successful login
    await page.waitForURL(/\/family\/dashboard/, { timeout: 10000 });

    await page.goto('/family/settings');
  });

  test.skip('should navigate to all settings sections', async ({ page }) => {
    // NOTE: Family Invitations and Profile Settings pages do not exist yet
    // Currently only have: Caregivers, Family Members

    // Caregiver Management
    await page.click('text=Caregivers');
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

    // Wait for page to load
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    // Should show breadcrumbs within the breadcrumb nav
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.locator('text=Home')).toBeVisible();
    await expect(breadcrumb.locator('text=Settings')).toBeVisible();
    await expect(breadcrumb.locator('text=Caregiver Management')).toBeVisible();
  });
});

test.describe('Caregiver Search & Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Log in")');

    // Wait for navigation after successful login
    await page.waitForURL(/\/family\/dashboard/, { timeout: 10000 });

    await page.goto('/family/settings/caregivers');

    // Wait for caregivers list to load
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();
  });

  test('should search caregivers by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Get initial count of caregivers
    const initialCount = await page.locator('[data-testid="caregiver-item"]').count();

    // Search for a specific caregiver (if any exist)
    if (initialCount > 0) {
      const firstName = await page.locator('[data-testid="caregiver-item"]').first().locator('h3').textContent();
      if (firstName) {
        await searchInput.fill(firstName.split(' ')[0]);

        // Should show the searched caregiver
        await expect(page.locator(`text=${firstName}`)).toBeVisible();
      }
    }
  });

  test('should filter by status', async ({ page }) => {
    // Click Active filter button
    await page.click('button:has-text("Active")');

    // Should only show active caregivers section
    const activeList = page.locator('[data-caregiver-status="active"]');
    await expect(activeList).toBeVisible();

    // Should not show inactive caregivers section
    const inactiveList = page.locator('[data-caregiver-status="inactive"]');
    await expect(inactiveList).not.toBeVisible();

    // Click Inactive filter button
    await page.click('button:has-text("Inactive")');

    // Now active section should not be visible
    await expect(activeList).not.toBeVisible();

    // Click All to reset
    await page.click('button:has-text("All")');

    // Active section should be visible again
    await expect(activeList).toBeVisible();
  });

  test('should sort caregivers', async ({ page }) => {
    // Check initial sort button
    const sortBtn = page.locator('button:has-text("Sort:")');
    await expect(sortBtn).toBeVisible();

    // Get initial caregiver names
    const initialNames = await page.locator('[data-testid="caregiver-item"] h3').allTextContents();

    if (initialNames.length > 1) {
      // Click sort button to toggle direction
      await sortBtn.click();

      // Get new order
      const newNames = await page.locator('[data-testid="caregiver-item"] h3').allTextContents();

      // Names should be in different order (reversed)
      expect(newNames).toEqual([...initialNames].reverse());
    }
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Log in")');

    // Wait for navigation after successful login
    await page.waitForURL(/\/family\/dashboard/, { timeout: 10000 });

    await page.goto('/family/settings/caregivers');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Wait for caregivers list to load first
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    // Now mock API failure for deactivation
    await page.route('**/api/caregivers/**/deactivate', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );

    // Try to deactivate - first get the button then click it
    const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click();

      // Fill in deactivation reason
      await page.fill('input[placeholder*="e.g., Resigned"]', 'Test');
      await page.click('button:has-text("Deactivate")');

      // Should show error toast notification
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/failed to deactivate/i')).toBeVisible();
    }
  });

  test('should retry failed operations', async ({ page }) => {
    // Wait for caregivers list to load first
    await expect(page.locator('[data-testid="caregiver-list"]')).toBeVisible();

    let attempts = 0;

    await page.route('**/api/caregivers/**/reset-pin', route => {
      attempts++;
      if (attempts < 2) {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Temporary server error' }) });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ pin: '123456' }),
        });
      }
    });

    // Try to reset PIN - first get the button then click it
    const resetBtn = page.locator('button:has-text("Reset PIN")').first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();

      // Should eventually succeed (PIN reset happens automatically on button click)
      await expect(page.locator('text=/New PIN/i')).toBeVisible({ timeout: 10000 });
    }
  });
});
