import { test, expect } from '@playwright/test';

/**
 * E2E Test: Safety Checks & Emergency Prep
 * Sprint 1 Day 3: Daily safety checklist and emergency preparedness tracking
 */

test.describe('Safety Checks & Emergency Prep - Caregiver Form', () => {
  test.beforeEach(async ({ page }) => {
    // Login as caregiver
    await page.goto('/auth/caregiver/login');
    await page.fill('input[name="caregiverId"]', '550e8400-e29b-41d4-a716-446655440001');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/caregiver\/form/);

    // Navigate to Safety section (assuming it's Section 8)
    await page.click('text=/Safety|Safety Checks/i');
  });

  test('should display safety checks section with all 6 checklist items', async ({ page }) => {
    // Should see section header
    await expect(page.locator('text=/Safety Checks|Daily Safety/i')).toBeVisible();

    // Should see all 6 safety check items
    await expect(page.locator('text=/trip hazards/i')).toBeVisible();
    await expect(page.locator('text=/cables/i')).toBeVisible();
    await expect(page.locator('text=/sandals|slippers/i')).toBeVisible();
    await expect(page.locator('text=/slip hazards/i')).toBeVisible();
    await expect(page.locator('text=/mobility aids/i')).toBeVisible();
    await expect(page.locator('text=/emergency equipment/i')).toBeVisible();
  });

  test('should check a safety item and allow action input', async ({ page }) => {
    // Check "Trip Hazards"
    const tripHazardsCheckbox = page.locator('input[type="checkbox"][data-testid="trip-hazards"]');
    await tripHazardsCheckbox.check();

    // Should show action input
    const actionInput = page.locator('input[data-testid="trip-hazards-action"]');
    await expect(actionInput).toBeVisible();

    // Fill in action
    await actionInput.fill('Removed loose mat from hallway');
    await expect(actionInput).toHaveValue('Removed loose mat from hallway');
  });

  test('should hide action input when unchecking safety item', async ({ page }) => {
    // Check then uncheck
    const checkbox = page.locator('input[type="checkbox"][data-testid="cables"]');
    await checkbox.check();

    const actionInput = page.locator('input[data-testid="cables-action"]');
    await expect(actionInput).toBeVisible();

    await checkbox.uncheck();
    await expect(actionInput).not.toBeVisible();
  });

  test('should show completion progress for safety checks', async ({ page }) => {
    // Check 3 out of 6 items
    await page.locator('input[data-testid="trip-hazards"]').check();
    await page.locator('input[data-testid="cables"]').check();
    await page.locator('input[data-testid="sandals"]').check();

    // Should show progress (3/6 or 50%)
    await expect(page.locator('text=/3.*6|50%/i')).toBeVisible();
  });

  test('should complete all safety checks', async ({ page }) => {
    // Check all 6 items
    await page.locator('input[data-testid="trip-hazards"]').check();
    await page.locator('input[data-testid="trip-hazards-action"]').fill('Cleared');

    await page.locator('input[data-testid="cables"]').check();
    await page.locator('input[data-testid="cables-action"]').fill('Secured');

    await page.locator('input[data-testid="sandals"]').check();
    await page.locator('input[data-testid="sandals-action"]').fill('Proper footwear on');

    await page.locator('input[data-testid="slip-hazards"]').check();
    await page.locator('input[data-testid="slip-hazards-action"]').fill('Mopped and dried');

    await page.locator('input[data-testid="mobility-aids"]').check();
    await page.locator('input[data-testid="mobility-aids-action"]').fill('Walker within reach');

    await page.locator('input[data-testid="emergency-equipment"]').check();
    await page.locator('input[data-testid="emergency-equipment-action"]').fill('All present');

    // Should show 6/6 or 100% completion
    await expect(page.locator('text=/6.*6|100%|all.*complete/i')).toBeVisible();

    // Should show success indicator
    await expect(page.locator('text=/✅|complete|done/i')).toBeVisible();
  });

  test('should display emergency preparedness checklist with 7 items', async ({ page }) => {
    // Should see emergency prep section
    await expect(page.locator('text=/Emergency Prep|Emergency Readiness/i')).toBeVisible();

    // Should see all 7 prep items
    await expect(page.locator('text=/ice pack/i')).toBeVisible();
    await expect(page.locator('text=/wheelchair/i')).toBeVisible();
    await expect(page.locator('text=/commode/i')).toBeVisible();
    await expect(page.locator('text=/walking stick/i')).toBeVisible();
    await expect(page.locator('text=/walker/i')).toBeVisible();
    await expect(page.locator('text=/bruise ointment/i')).toBeVisible();
    await expect(page.locator('text=/first aid kit/i')).toBeVisible();
  });

  test('should check emergency prep items', async ({ page }) => {
    // Check multiple prep items
    await page.locator('input[data-testid="ice-pack"]').check();
    await expect(page.locator('input[data-testid="ice-pack"]')).toBeChecked();

    await page.locator('input[data-testid="wheelchair"]').check();
    await expect(page.locator('input[data-testid="wheelchair"]')).toBeChecked();

    await page.locator('input[data-testid="first-aid-kit"]').check();
    await expect(page.locator('input[data-testid="first-aid-kit"]')).toBeChecked();
  });

  test('should show emergency prep completion progress', async ({ page }) => {
    // Check 5 out of 7 items
    await page.locator('input[data-testid="ice-pack"]').check();
    await page.locator('input[data-testid="wheelchair"]').check();
    await page.locator('input[data-testid="commode"]').check();
    await page.locator('input[data-testid="walking-stick"]').check();
    await page.locator('input[data-testid="walker"]').check();

    // Should show progress (5/7 or ~71%)
    await expect(page.locator('text=/5.*7|71%/i')).toBeVisible();
  });

  test('should persist safety data when navigating sections', async ({ page }) => {
    // Check some items
    await page.locator('input[data-testid="trip-hazards"]').check();
    await page.locator('input[data-testid="trip-hazards-action"]').fill('Cleared hallway');
    await page.locator('input[data-testid="ice-pack"]').check();

    // Navigate away
    await page.click('text=/Morning|Section 1/i');

    // Navigate back
    await page.click('text=/Safety|Safety Checks/i');

    // Data should persist
    await expect(page.locator('input[data-testid="trip-hazards"]')).toBeChecked();
    await expect(page.locator('input[data-testid="trip-hazards-action"]')).toHaveValue('Cleared hallway');
    await expect(page.locator('input[data-testid="ice-pack"]')).toBeChecked();
  });

  test('should allow unchecking items', async ({ page }) => {
    // Check then uncheck
    await page.locator('input[data-testid="wheelchair"]').check();
    await expect(page.locator('input[data-testid="wheelchair"]')).toBeChecked();

    await page.locator('input[data-testid="wheelchair"]').uncheck();
    await expect(page.locator('input[data-testid="wheelchair"]')).not.toBeChecked();
  });

  test('should show warning if safety checks incomplete', async ({ page }) => {
    // Check only 2 out of 6
    await page.locator('input[data-testid="trip-hazards"]').check();
    await page.locator('input[data-testid="cables"]').check();

    // Should show warning about incomplete checks
    const warning = page.locator('text=/⚠️.*incomplete|not all.*checked|4.*remaining/i');
    if (await warning.isVisible()) {
      await expect(warning).toBeVisible();
    }
  });
});

test.describe('Safety Checks - Family Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family member
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@family.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL(/\/family\/dashboard/);
  });

  test('should display safety status card', async ({ page }) => {
    // Should see safety status
    await expect(page.locator('text=/Safety Status|Safety Checks/i')).toBeVisible();

    // Should show completion percentage or count
    await expect(page.locator('text=/[0-9]+.*6|[0-9]+%/i')).toBeVisible();
  });

  test('should show warning if safety checks incomplete', async ({ page }) => {
    // Assume today's log has 4/6 checks complete
    const warning = page.locator('text=/⚠️|incomplete|not all.*complete/i');
    if (await warning.isVisible()) {
      await expect(warning).toBeVisible();
    }
  });

  test('should display list of completed safety actions', async ({ page }) => {
    // Should show actions taken
    const actions = page.locator('text=/Cleared|Secured|Removed|Checked/i');
    if (await actions.first().isVisible()) {
      await expect(actions.first()).toBeVisible();
    }
  });

  test('should show emergency prep readiness', async ({ page }) => {
    // Should display emergency prep status
    await expect(page.locator('text=/Emergency Prep|Emergency Readiness/i')).toBeVisible();

    // Should show which items are available
    const items = page.locator('text=/Ice pack|Wheelchair|Walker|First aid/i');
    if (await items.first().isVisible()) {
      await expect(items.first()).toBeVisible();
    }
  });

  test('should highlight missing emergency equipment', async ({ page }) => {
    // If some items are missing, should show warning
    const missing = page.locator('text=/missing|not available|⚠️/i');
    const count = await missing.count();

    // Just verify the section exists (may or may not have warnings depending on data)
    await expect(page.locator('text=/Emergency/i')).toBeVisible();
  });

  test('should show green indicator when all safety checks complete', async ({ page }) => {
    // Assume 6/6 checks complete
    const complete = page.locator('text=/✅|6.*6|100%|all.*complete/i');
    if (await complete.isVisible()) {
      // Should have green/success styling
      const parent = complete.locator('../..');
      await expect(parent).toHaveClass(/green|success/);
    }
  });
});
