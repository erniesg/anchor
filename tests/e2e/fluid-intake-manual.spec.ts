import { test, expect } from '@playwright/test';

/**
 * Manual Visual Testing for Fluid Intake
 * This test runs slowly with screenshots to verify UI
 */

// Configure for visual testing
test.use({
  headless: false, // Show browser
  slowMo: 1000,    // Slow down by 1 second per action
});

test.describe('Manual Visual Test - Fluid Intake Complete Flow', () => {

  test('Complete fluid intake flow with visual verification', async ({ page }) => {
    console.log('\n🧪 Starting Manual Visual Test for Fluid Intake\n');

    // Step 1: Login
    console.log('1️⃣  Navigating to caregiver login...');
    await page.goto('/caregiver/login');
    await page.screenshot({ path: 'test-results/manual/01-login-page.png' });

    console.log('   Filling caregiver credentials...');
    await page.fill('input[name="caregiverId"]', 'e80c2b2a-4688-4a29-9579-51b3219f20fc');
    await page.fill('input[name="pin"]', '123456');
    await page.screenshot({ path: 'test-results/manual/02-credentials-filled.png' });

    console.log('   Clicking login...');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/\/caregiver\/form/);
    await page.screenshot({ path: 'test-results/manual/03-form-loaded.png' });

    // Step 2: Navigate to Section 4
    console.log('\n2️⃣  Navigating to Fluid Intake section...');
    console.log('   Section 1 → 2');
    await page.click('button:has-text("Next")');
    await page.screenshot({ path: 'test-results/manual/04-section-2.png' });

    console.log('   Section 2 → 3');
    await page.click('button:has-text("Next")');
    await page.screenshot({ path: 'test-results/manual/05-section-3.png' });

    console.log('   Section 3 → 4 (Fluid Intake)');
    await page.click('button:has-text("Next: Fluid Intake")');
    await expect(page.locator('h2:has-text("Fluid Intake Monitoring")')).toBeVisible();
    await page.screenshot({ path: 'test-results/manual/06-fluid-section-empty.png' });
    console.log('   ✅ Reached Fluid Intake section');

    // Step 3: Verify empty state
    console.log('\n3️⃣  Verifying empty state...');
    await expect(page.locator('text=No fluid entries yet')).toBeVisible();
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('0 ml');
    console.log('   ✅ Empty state verified');

    // Step 4: Add first fluid entry
    console.log('\n4️⃣  Adding first fluid entry (Glucerna Milk, 250ml)...');
    await page.click('button:has-text("Add Fluid Entry")');
    await page.screenshot({ path: 'test-results/manual/07-first-entry-form.png' });

    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');
    await page.screenshot({ path: 'test-results/manual/08-first-entry-filled.png' });

    // Verify total updated
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('250 ml');
    console.log('   ✅ First entry added, total: 250ml');

    // Step 5: Add second entry
    console.log('\n5️⃣  Adding second fluid entry (Plain Water, 150ml)...');
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.1.name"]', 'Plain Water');
    await page.fill('input[name="fluids.1.time"]', '10:00');
    await page.fill('input[name="fluids.1.amountMl"]', '150');
    await page.screenshot({ path: 'test-results/manual/09-second-entry-filled.png' });

    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('400 ml');
    console.log('   ✅ Second entry added, total: 400ml');

    // Step 6: Add third entry
    console.log('\n6️⃣  Adding third fluid entry (Orange Juice, 200ml)...');
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.2.name"]', 'Orange Juice');
    await page.fill('input[name="fluids.2.time"]', '14:00');
    await page.fill('input[name="fluids.2.amountMl"]', '200');
    await page.screenshot({ path: 'test-results/manual/10-third-entry-filled.png' });

    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('600 ml');
    console.log('   ✅ Third entry added, total: 600ml');

    // Step 7: Verify low fluid warning
    console.log('\n7️⃣  Verifying low fluid warning (<1000ml)...');
    await expect(page.locator('[data-testid="low-fluid-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-fluid-warning"]')).toContainText('Low fluid intake');
    await page.screenshot({ path: 'test-results/manual/11-low-fluid-warning.png' });
    console.log('   ✅ Low fluid warning displayed');

    // Step 8: Add swallowing issues
    console.log('\n8️⃣  Adding swallowing issues to first entry...');
    await page.check('input[name="fluids.0.swallowingIssues.coughing"]');
    await page.check('input[name="fluids.0.swallowingIssues.slow"]');
    await page.screenshot({ path: 'test-results/manual/12-swallowing-issues.png' });
    console.log('   ✅ Swallowing issues marked');

    // Step 9: Add fourth entry to reach adequate hydration
    console.log('\n9️⃣  Adding fourth entry to reach adequate hydration (Moringa Water, 500ml)...');
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.3.name"]', 'Moringa Water');
    await page.fill('input[name="fluids.3.time"]', '16:00');
    await page.fill('input[name="fluids.3.amountMl"]', '500');
    await page.screenshot({ path: 'test-results/manual/13-fourth-entry-filled.png' });

    await expect(page.locator('[data-testid="total-fluid-intake"]')).toContainText('1100 ml');
    console.log('   ✅ Fourth entry added, total: 1100ml');

    // Step 10: Verify adequate hydration status
    console.log('\n🔟 Verifying adequate hydration status...');
    await expect(page.locator('[data-testid="low-fluid-warning"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="fluid-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="fluid-status"]')).toContainText('Adequate hydration');
    await page.screenshot({ path: 'test-results/manual/14-adequate-hydration.png' });
    console.log('   ✅ Adequate hydration status displayed');

    // Step 11: Test remove functionality
    console.log('\n1️⃣1️⃣  Testing remove entry...');
    const beforeRemove = await page.locator('[data-testid="total-fluid-intake"]').textContent();
    await page.click('[data-testid="remove-fluid-1"]');
    await page.screenshot({ path: 'test-results/manual/15-after-remove.png' });

    const afterRemove = await page.locator('[data-testid="total-fluid-intake"]').textContent();
    expect(beforeRemove).not.toBe(afterRemove);
    console.log(`   ✅ Entry removed, total changed from ${beforeRemove} to ${afterRemove}`);

    // Final screenshot
    await page.screenshot({ path: 'test-results/manual/16-final-state.png', fullPage: true });

    console.log('\n✅ Manual Visual Test Complete!');
    console.log('📸 Screenshots saved to test-results/manual/');
    console.log('\nTest Summary:');
    console.log('- Login: ✅');
    console.log('- Navigation: ✅');
    console.log('- Add entries: ✅');
    console.log('- Auto-calculation: ✅');
    console.log('- Low fluid warning: ✅');
    console.log('- Adequate hydration: ✅');
    console.log('- Swallowing issues: ✅');
    console.log('- Remove entry: ✅');
    console.log('\n🎉 All visual tests passed!\n');

    // Keep browser open for 5 seconds to view
    await page.waitForTimeout(5000);
  });
});
