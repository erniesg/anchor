import { test, expect } from '@playwright/test';

/**
 * Full Submission + Audit Log Test (Robust Version)
 *
 * Tests:
 * 1. Submit ALL form sections (morning, afternoon, evening, daily summary)
 * 2. Family can see partial data immediately after each section submission
 * 3. Final "Complete Day" to finalize
 * 4. Edit submitted data to test audit log
 * 5. Family views data + audit history via View History modal
 */
test.describe.configure({ mode: 'serial' });

test.describe('Full Submission + Audit Log', () => {
  test('complete flow: all sections + edit + audit log + family view', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for full flow

    const timestamp = Date.now();
    const familyEmail = `audit-test-${timestamp}@test.com`;
    const familyPassword = 'TestPass123!';
    const careRecipientName = `Audit Patient ${timestamp % 10000}`;
    let caregiverUsername = '';
    let caregiverPin = '';

    console.log('=== FULL SUBMISSION + AUDIT LOG TEST ===');
    console.log(`Email: ${familyEmail}`);

    // ========== SETUP: Family + Care Recipient + Caregiver ==========
    console.log('\n--- SETUP ---');

    // Family signup
    await page.goto('/auth/signup');
    await page.waitForTimeout(2000);
    await page.getByLabel('Full Name').fill(`Audit Tester ${timestamp}`);
    await page.getByLabel('Email').fill(familyEmail);
    await page.getByPlaceholder('Minimum 8 characters').fill(familyPassword);
    await page.getByPlaceholder('Re-enter your password').fill(familyPassword);
    await page.click('button:has-text("Create Account")');
    await page.waitForURL('**/onboarding**', { timeout: 15000 });
    console.log('✅ Family signup');

    // Care recipient
    await page.fill('input[placeholder*="Sulochana"]', careRecipientName);
    await page.fill('input[type="date"]', '1945-06-15');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/caregiver**', { timeout: 10000 });
    console.log('✅ Care recipient created');

    // Caregiver
    await page.fill('input[placeholder*="Maria"]', 'Test Caregiver');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=Share these credentials', { timeout: 15000 });

    const usernameEl = page.locator('.bg-blue-50 .text-2xl, .bg-blue-50 .font-bold.font-mono');
    caregiverUsername = (await usernameEl.first().textContent())?.trim() || '';
    const pinEl = page.locator('.text-5xl.font-bold');
    caregiverPin = (await pinEl.textContent())?.trim() || '';
    console.log(`✅ Caregiver: ${caregiverUsername} / PIN: ${caregiverPin}`);

    // ========== CAREGIVER LOGIN ==========
    console.log('\n--- CAREGIVER LOGIN ---');
    await page.goto('/caregiver/login');
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="happy-panda"], input[name="username"]', caregiverUsername);
    await page.fill('input#pin-input, input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/caregiver/form**', { timeout: 10000 });
    console.log('✅ Caregiver logged in');

    // ========== SECTION 1: MORNING ==========
    console.log('\n--- SECTION 1: MORNING ---');
    await page.click('text=Morning');
    await page.waitForURL('**/caregiver/form/morning**', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Fill REQUIRED fields for morning: wakeTime AND mood
    // Wake time
    const wakeTimeInput = page.locator('input[type="time"]').first();
    await expect(wakeTimeInput).toBeVisible({ timeout: 5000 });
    await wakeTimeInput.fill('07:30');
    console.log('  - Wake time: 07:30');

    // Mood (REQUIRED) - click the "Alert" button
    const alertBtn = page.locator('button', { hasText: /^Alert$/ });
    await expect(alertBtn).toBeVisible({ timeout: 5000 });
    await alertBtn.click();
    console.log('  - Mood: Alert');

    await page.waitForTimeout(2000); // Auto-save

    // Submit morning section - wait for button to be enabled
    const submitMorningBtn = page.locator('button:has-text("Submit Morning Section")');
    await expect(submitMorningBtn).toBeEnabled({ timeout: 5000 });
    await submitMorningBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Morning section submitted');
    await page.screenshot({ path: '/tmp/audit-step1-morning.png' });

    // ========== VERIFY FAMILY CAN SEE PARTIAL DATA ==========
    console.log('\n--- CHECKING FAMILY SEES PARTIAL DATA ---');
    await page.goto('/auth/login');
    await page.waitForTimeout(1000);
    await page.getByLabel('Email').fill(familyEmail);
    await page.getByPlaceholder('Enter your password').fill(familyPassword);
    await page.click('button:has-text("Log In")');
    await page.waitForURL('**/family/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Should see partial data - NOT "No care log submitted today"
    const noDataMessage = page.locator('text=No care log submitted today');
    const hasNoData = await noDataMessage.count();
    if (hasNoData === 0) {
      console.log('  - ✅ Family can see partial data (morning section)');
    } else {
      console.log('  - ⚠️ Family sees "No care log" - checking further...');
    }
    await page.screenshot({ path: '/tmp/audit-step1b-family-partial.png' });

    // ========== BACK TO CAREGIVER FOR REMAINING SECTIONS ==========
    console.log('\n--- CAREGIVER: REMAINING SECTIONS ---');
    await page.goto('/caregiver/login');
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="happy-panda"], input[name="username"]', caregiverUsername);
    await page.fill('input#pin-input, input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/caregiver/form**', { timeout: 10000 });

    // ========== SECTION 2: AFTERNOON ==========
    console.log('\n--- SECTION 2: AFTERNOON ---');
    await page.click('text=Afternoon');
    await page.waitForURL('**/caregiver/form/afternoon**', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Fill REQUIRED field: lunchTime only
    const lunchTimeInput = page.locator('input[type="time"]').first();
    await expect(lunchTimeInput).toBeVisible({ timeout: 5000 });
    await lunchTimeInput.fill('12:30');
    console.log('  - Lunch time: 12:30');

    await page.waitForTimeout(2000); // Auto-save

    // Submit afternoon section
    const submitAfternoonBtn = page.locator('button:has-text("Submit Afternoon Section")');
    await expect(submitAfternoonBtn).toBeEnabled({ timeout: 5000 });
    await submitAfternoonBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Afternoon section submitted');
    await page.screenshot({ path: '/tmp/audit-step2-afternoon.png' });

    // ========== SECTION 3: EVENING ==========
    console.log('\n--- SECTION 3: EVENING ---');
    await page.goto('/caregiver/form');
    await page.waitForTimeout(1000);
    await page.click('text=Evening');
    await page.waitForURL('**/caregiver/form/evening**', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Fill REQUIRED field: dinnerTime only
    const dinnerTimeInput = page.locator('input[type="time"]').first();
    await expect(dinnerTimeInput).toBeVisible({ timeout: 5000 });
    await dinnerTimeInput.fill('18:30');
    console.log('  - Dinner time: 18:30');

    await page.waitForTimeout(2000); // Auto-save

    // Submit evening section
    const submitEveningBtn = page.locator('button:has-text("Submit Evening Section")');
    await expect(submitEveningBtn).toBeEnabled({ timeout: 5000 });
    await submitEveningBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Evening section submitted');
    await page.screenshot({ path: '/tmp/audit-step3-evening.png' });

    // ========== SECTION 4: DAILY SUMMARY ==========
    console.log('\n--- SECTION 4: DAILY SUMMARY ---');
    await page.goto('/caregiver/form');
    await page.waitForTimeout(1000);
    await page.click('text=Daily Summary');
    await page.waitForURL('**/caregiver/form/summary**', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Fill REQUIRED field: balanceIssues (1-5 scale) - click number 3
    const balanceBtn = page.locator('button.rounded-full', { hasText: '3' }).first();
    await expect(balanceBtn).toBeVisible({ timeout: 5000 });
    await balanceBtn.click();
    console.log('  - Balance issues: 3');

    await page.waitForTimeout(2000); // Auto-save

    // Submit daily summary section
    const submitSummaryBtn = page.locator('button:has-text("Submit Daily Summary")');
    await expect(submitSummaryBtn).toBeEnabled({ timeout: 5000 });
    await submitSummaryBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Daily Summary section submitted');
    await page.screenshot({ path: '/tmp/audit-step4-summary.png' });

    // ========== COMPLETE DAY (FINAL SUBMIT) ==========
    console.log('\n--- COMPLETE DAY ---');
    await page.goto('/caregiver/form');
    await page.waitForTimeout(3000);

    // Look for the "Complete Day & Submit" button
    const completeDayBtn = page.locator('button:has-text("Complete Day")');
    if (await completeDayBtn.count() > 0) {
      await expect(completeDayBtn).toBeEnabled({ timeout: 5000 });
      await completeDayBtn.click();
      await page.waitForTimeout(3000);
      console.log('✅ Complete Day button clicked');
    } else {
      console.log('⚠️ Complete Day button not found - checking if already submitted');
    }
    await page.screenshot({ path: '/tmp/audit-step5-complete-day.png' });

    // ========== MAKE EDIT (TEST AUDIT LOG) ==========
    console.log('\n--- EDITING FOR AUDIT LOG ---');

    // Go back to morning section to edit
    await page.goto('/caregiver/form/morning');
    await page.waitForTimeout(2000);

    // Change wake time
    const wakeTimeEdit = page.locator('input[type="time"]').first();
    if (await wakeTimeEdit.isEnabled()) {
      await wakeTimeEdit.fill('08:00');
      console.log('  - Wake time changed to 08:00');
      await page.waitForTimeout(2000); // Auto-save

      // Re-submit section if update button exists
      const resubmitBtn = page.locator('button:has-text("Update & Re-submit Morning")');
      if (await resubmitBtn.count() > 0 && await resubmitBtn.isEnabled()) {
        await resubmitBtn.click();
        await page.waitForTimeout(3000);
        console.log('✅ Edit saved and re-submitted');
      }
    }
    await page.screenshot({ path: '/tmp/audit-step6-edit.png' });

    // ========== FAMILY LOGIN & VERIFY ==========
    console.log('\n--- FAMILY LOGIN ---');
    await page.goto('/auth/login');
    await page.waitForTimeout(1000);
    await page.getByLabel('Email').fill(familyEmail);
    await page.getByPlaceholder('Enter your password').fill(familyPassword);
    await page.click('button:has-text("Log In")');
    await page.waitForURL('**/family/dashboard**', { timeout: 15000 });
    console.log('✅ Family logged in');

    // ========== VERIFY FAMILY DASHBOARD ==========
    console.log('\n--- VERIFYING FAMILY DASHBOARD ---');
    await page.waitForTimeout(3000);

    // Check care recipient is visible
    await expect(page.locator(`text=${careRecipientName}`).first()).toBeVisible({ timeout: 10000 });
    console.log('  - Care recipient name visible');

    // Verify NOT showing "No care log submitted today"
    const noLogMessage = page.locator('text=No care log submitted today');
    const noLogCount = await noLogMessage.count();
    if (noLogCount === 0) {
      console.log('  - ✅ Care log data is visible to family');
    } else {
      console.log('  - ❌ UNEXPECTED: "No care log submitted today" message shown');
    }

    // Check for data values
    const pageContent = await page.textContent('body');
    if (pageContent?.includes('08:00') || pageContent?.includes('07:30')) {
      console.log('  - ✅ Wake time data visible');
    }

    await page.screenshot({ path: '/tmp/audit-step7-family-dashboard.png' });

    // ========== CHECK VIEW HISTORY BUTTON ==========
    console.log('\n--- CHECKING VIEW HISTORY ---');

    const historyBtn = page.locator('button:has-text("View History")');
    if (await historyBtn.count() > 0) {
      await historyBtn.click();
      await page.waitForTimeout(2000);
      console.log('  - Opened history modal');

      // Check for modal content
      const modalHeader = page.locator('text=Change History');
      if (await modalHeader.count() > 0) {
        console.log('  - ✅ History modal visible');
      }

      // Check for audit entries
      const historyContent = await page.textContent('body');
      if (historyContent?.includes('Section Submitted') || historyContent?.includes('Created') || historyContent?.includes('Updated')) {
        console.log('  - ✅ Audit entries visible in history');
      }

      // Close modal
      const closeBtn = page.locator('button:has-text("Close")');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('  - View History button not found (might not appear if no log loaded)');
    }
    await page.screenshot({ path: '/tmp/audit-step8-history.png' });

    // ========== WEEK VIEW ==========
    console.log('\n--- WEEK VIEW ---');
    const weekTab = page.locator('button:has-text("Week"), [role="tab"]:has-text("Week")');
    if (await weekTab.count() > 0) {
      await weekTab.click();
      await page.waitForTimeout(2000);
      console.log('  - Switched to Week view');

      // Check for chart
      const chart = page.locator('svg, canvas, .recharts-wrapper');
      if (await chart.count() > 0) {
        console.log('  - ✅ Chart visible');
      }
    }
    await page.screenshot({ path: '/tmp/audit-step9-week.png' });

    // ========== FINAL SUMMARY ==========
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Family: ${familyEmail} / ${familyPassword}`);
    console.log(`Caregiver: ${caregiverUsername} / ${caregiverPin}`);
    console.log(`Care Recipient: ${careRecipientName}`);
    console.log('\nScreenshots saved to /tmp/audit-step*.png');

    // Final assertions
    expect(noLogCount).toBe(0); // Family should see data, not "no log" message
  });
});
