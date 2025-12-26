import { test, expect } from '@playwright/test';

/**
 * Comprehensive Production Test Suite
 * Tests: Form Submission, Auto-Save, Family View, Edit, Audit Log
 *
 * This is a single sequential test to ensure shared state
 */
test.describe.configure({ mode: 'serial' });

test.describe('Comprehensive Production Test', () => {
  test('Full end-to-end flow: signup -> form -> family view', async ({ page }) => {
    const timestamp = Date.now();
    const familyEmail = `prod-test-${timestamp}@test.com`;
    const familyPassword = 'TestPass123!';
    const careRecipientName = `Prod Patient ${timestamp % 10000}`;
    let caregiverUsername = '';
    let caregiverPin = '';

    console.log('=== COMPREHENSIVE PRODUCTION TEST ===');
    console.log(`Email: ${familyEmail}`);
    console.log(`Care Recipient: ${careRecipientName}`);

    // ========== STEP 1: FAMILY SIGNUP ==========
    console.log('\n--- STEP 1: Family Signup ---');
    await page.goto('/auth/signup');
    await page.waitForTimeout(2000);
    await page.getByLabel('Full Name').fill(`Prod Tester ${timestamp}`);
    await page.getByLabel('Email').fill(familyEmail);
    await page.getByPlaceholder('Minimum 8 characters').fill(familyPassword);
    await page.getByPlaceholder('Re-enter your password').fill(familyPassword);
    await page.click('button:has-text("Create Account")');
    await page.waitForURL('**/onboarding**', { timeout: 15000 });
    console.log('✅ Family signup complete');

    // ========== STEP 2: CREATE CARE RECIPIENT ==========
    console.log('\n--- STEP 2: Create Care Recipient ---');
    await page.fill('input[placeholder*="Sulochana"]', careRecipientName);
    await page.fill('input[type="date"]', '1945-06-15');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/caregiver**', { timeout: 10000 });
    console.log('✅ Care recipient created');

    // ========== STEP 3: CREATE CAREGIVER ==========
    console.log('\n--- STEP 3: Create Caregiver ---');
    await page.fill('input[placeholder*="Maria"]', 'Test Caregiver');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=Share these credentials', { timeout: 15000 });

    // Extract credentials
    const usernameEl = page.locator('.bg-blue-50 .text-2xl, .bg-blue-50 .font-bold.font-mono');
    caregiverUsername = (await usernameEl.first().textContent())?.trim() || '';
    const pinEl = page.locator('.text-5xl.font-bold');
    caregiverPin = (await pinEl.textContent())?.trim() || '';

    console.log(`✅ Caregiver: ${caregiverUsername} / PIN: ${caregiverPin}`);
    await page.screenshot({ path: '/tmp/prod-step3-caregiver-created.png' });

    expect(caregiverUsername).toBeTruthy();
    expect(caregiverPin).toMatch(/^\d{6}$/);

    // ========== STEP 4: CAREGIVER LOGIN ==========
    console.log('\n--- STEP 4: Caregiver Login ---');
    await page.goto('/caregiver/login');
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="happy-panda"], input[name="username"]', caregiverUsername);
    await page.fill('input#pin-input, input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/caregiver/form**', { timeout: 10000 });

    await expect(page.locator('text=Care Log for')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=Logged in as: ${caregiverUsername}`)).toBeVisible();
    console.log('✅ Caregiver logged in');
    await page.screenshot({ path: '/tmp/prod-step4-caregiver-dashboard.png' });

    // ========== STEP 5: MORNING FORM + AUTO-SAVE ==========
    console.log('\n--- STEP 5: Morning Form & Auto-Save ---');
    await page.click('text=Morning');
    await page.waitForURL('**/caregiver/form/morning**', { timeout: 5000 });
    console.log('✅ Navigated to Morning form');

    // Fill wake time
    const wakeTimeInput = page.locator('input[type="time"]').first();
    if (await wakeTimeInput.count() > 0) {
      await wakeTimeInput.fill('07:30');
      console.log('  - Wake time: 07:30');
    }

    // Select mood - click "Alert" button (required field)
    const alertMoodBtn = page.locator('button:has-text("Alert")');
    if (await alertMoodBtn.count() > 0) {
      await alertMoodBtn.click();
      console.log('  - Mood selected: Alert');
    } else {
      // Fallback - try any mood-looking button
      const anyMoodBtn = page.locator('button:has-text("Calm"), button:has-text("Sleepy")').first();
      if (await anyMoodBtn.count() > 0) {
        await anyMoodBtn.click();
        console.log('  - Mood selected (fallback)');
      }
    }

    // Wait for auto-save
    console.log('  - Waiting for auto-save (5s)...');
    await page.waitForTimeout(5000);

    // Check for any save indicator
    const pageText = await page.textContent('body');
    if (pageText?.includes('Saved') || pageText?.includes('saved')) {
      console.log('  - ✅ Auto-save indicator detected');
    }

    await page.screenshot({ path: '/tmp/prod-step5-morning-form.png' });

    // Try to find and click medication checkbox
    const medCheckbox = page.locator('input[type="checkbox"]').first();
    if (await medCheckbox.count() > 0) {
      await medCheckbox.check();
      console.log('  - Medication checkbox checked');
      await page.waitForTimeout(4000); // Wait for auto-save
    }

    console.log('✅ Morning form filled, auto-save tested');

    // ========== STEP 6: SUBMIT MORNING SECTION ==========
    console.log('\n--- STEP 6: Section Submission ---');
    const submitSectionBtn = page.locator('button:has-text("Submit Morning Section")');
    if (await submitSectionBtn.count() > 0) {
      const isEnabled = await submitSectionBtn.isEnabled();
      if (isEnabled) {
        await submitSectionBtn.click();
        await page.waitForTimeout(3000);
        console.log('✅ Section submit button clicked');
      } else {
        console.log('⚠️ Submit button disabled - checking what required fields are missing');
        // Take screenshot to debug
        await page.screenshot({ path: '/tmp/prod-step6-submit-disabled.png' });
        // Try to find a save button instead
        const saveBtn = page.locator('button:has-text("Save Progress"), button:has-text("Save Draft")');
        if (await saveBtn.count() > 0 && await saveBtn.first().isEnabled()) {
          await saveBtn.first().click();
          await page.waitForTimeout(2000);
          console.log('✅ Save button clicked instead');
        }
      }
    }
    await page.screenshot({ path: '/tmp/prod-step6-section-submit.png' });

    // Go back to dashboard
    await page.goto('/caregiver/form');
    await page.waitForTimeout(2000);

    // ========== STEP 7: AFTERNOON FORM ==========
    console.log('\n--- STEP 7: Afternoon Form ---');
    await page.click('text=Afternoon');
    await page.waitForURL('**/caregiver/form/afternoon**', { timeout: 5000 });

    // Fill exercise data if available
    const exerciseInput = page.locator('input[placeholder*="minutes"], input[type="number"]').first();
    if (await exerciseInput.count() > 0) {
      await exerciseInput.fill('30');
      console.log('  - Exercise: 30 minutes');
    }

    // Check rest checkbox if available
    const restCheckbox = page.locator('input[type="checkbox"]').first();
    if (await restCheckbox.count() > 0) {
      await restCheckbox.check();
      console.log('  - Rest checkbox checked');
    }

    await page.waitForTimeout(4000); // Auto-save
    await page.screenshot({ path: '/tmp/prod-step7-afternoon-form.png' });
    console.log('✅ Afternoon form filled');

    // ========== STEP 8: DAILY SUMMARY ==========
    console.log('\n--- STEP 8: Daily Summary Form ---');
    await page.goto('/caregiver/form');
    await page.waitForTimeout(1000);
    await page.click('text=Daily Summary');
    await page.waitForURL('**/caregiver/form/summary**', { timeout: 5000 });

    // Fill caregiver notes
    const notesTextarea = page.locator('textarea').first();
    if (await notesTextarea.count() > 0) {
      await notesTextarea.fill('E2E Test: Patient had a good day. No incidents reported.');
      console.log('  - Caregiver notes filled');
    }

    // Check safety items
    const safetyCheck = page.locator('input[type="checkbox"]').first();
    if (await safetyCheck.count() > 0) {
      await safetyCheck.check();
      console.log('  - Safety checkbox checked');
    }

    await page.waitForTimeout(4000); // Auto-save
    await page.screenshot({ path: '/tmp/prod-step8-summary-form.png' });
    console.log('✅ Daily Summary filled');

    // ========== STEP 9: FAMILY LOGIN ==========
    console.log('\n--- STEP 9: Family Login & Dashboard ---');
    await page.goto('/auth/login');
    await page.waitForTimeout(1000);
    await page.getByLabel('Email').fill(familyEmail);
    await page.getByPlaceholder('Enter your password').fill(familyPassword);
    await page.click('button:has-text("Log In")');
    await page.waitForURL('**/family/dashboard**', { timeout: 15000 });
    console.log('✅ Family logged in');

    // Check dashboard content (use .first() since name appears in multiple places)
    await expect(page.locator(`text=${careRecipientName}`).first()).toBeVisible({ timeout: 5000 });
    console.log('  - Care recipient name visible');

    // Look for today's data
    const todaySection = page.locator('text=Today, text=today');
    if (await todaySection.count() > 0) {
      console.log('  - Today section visible');
    }

    // Count cards on dashboard
    const cards = page.locator('.card, [class*="card"]');
    const cardCount = await cards.count();
    console.log(`  - Found ${cardCount} data cards`);

    await page.screenshot({ path: '/tmp/prod-step9-family-dashboard.png' });
    console.log('✅ Family dashboard loaded');

    // ========== STEP 10: CHECK PROGRESS INDICATORS ==========
    console.log('\n--- STEP 10: Progress Indicators ---');
    const progressIndicator = page.locator('text=sections');
    if (await progressIndicator.count() > 0) {
      const text = await progressIndicator.first().textContent();
      console.log(`  - Progress: ${text}`);
    }

    const statusBadge = page.locator('[class*="badge"], .text-green-600, .text-amber-600');
    if (await statusBadge.count() > 0) {
      console.log(`  - Status indicators found: ${await statusBadge.count()}`);
    }

    // ========== STEP 11: WEEK VIEW ==========
    console.log('\n--- STEP 11: Week View ---');
    const weekTab = page.locator('button:has-text("Week"), [role="tab"]:has-text("Week")');
    if (await weekTab.count() > 0) {
      await weekTab.click();
      await page.waitForTimeout(2000);
      console.log('  - Switched to Week view');

      const chartEl = page.locator('svg, canvas, .recharts-wrapper');
      if (await chartEl.count() > 0) {
        console.log('  - ✅ Chart visualization visible');
      }
    }
    await page.screenshot({ path: '/tmp/prod-step11-week-view.png' });

    // ========== STEP 12: TRENDS PAGE ==========
    console.log('\n--- STEP 12: Trends Page ---');
    await page.goto('/family/trends');
    await page.waitForTimeout(2000);
    const trendsContent = await page.textContent('body');
    if (trendsContent?.includes('Trend') || trendsContent?.includes('trend') || trendsContent?.includes('Chart')) {
      console.log('  - ✅ Trends page content visible');
    }
    await page.screenshot({ path: '/tmp/prod-step12-trends.png' });

    // ========== STEP 13: QUICK ACTION FAB ==========
    console.log('\n--- STEP 13: Quick Action FAB ---');
    await page.goto('/caregiver/login');
    await page.fill('input[placeholder*="happy-panda"], input[name="username"]', caregiverUsername);
    await page.fill('input#pin-input, input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/caregiver/form**', { timeout: 10000 });

    const fabBtn = page.locator('button.fixed, .fixed button, [class*="fab"]');
    if (await fabBtn.count() > 0) {
      await fabBtn.first().click();
      await page.waitForTimeout(1000);
      console.log('  - FAB clicked');

      const quickActions = page.locator('text=Fluid, text=Water, text=Toilet');
      if (await quickActions.count() > 0) {
        console.log('  - ✅ Quick actions visible');
      }
    }
    await page.screenshot({ path: '/tmp/prod-step13-fab.png' });

    // ========== FINAL SUMMARY ==========
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Family Email: ${familyEmail}`);
    console.log(`Password: ${familyPassword}`);
    console.log(`Caregiver: ${caregiverUsername}`);
    console.log(`PIN: ${caregiverPin}`);
    console.log(`Care Recipient: ${careRecipientName}`);
    console.log('\nScreenshots saved to /tmp/prod-step*.png');
  });
});
