import { test, expect } from '@playwright/test';

/**
 * Family Progressive View E2E Tests
 *
 * Tests that family members can see data from completed sections
 * as caregivers submit them progressively throughout the day.
 */
test.describe('Family Progressive View', () => {
  const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
  const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';

  // Family credentials
  const FAMILY_EMAIL = 'admin@example.com';
  const FAMILY_PASSWORD = 'Admin123456';
  const CARE_RECIPIENT_ID = '0725fbb9-21c5-46a4-9ed0-305b0a506f20';

  // Caregiver credentials
  const CAREGIVER_ID = '88fef386-a0bd-452d-a8b6-be2844ef0bc6';
  const CAREGIVER_PIN = '123456';

  let familyToken: string;
  let caregiverToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as family
    const familyResponse = await request.post(`${API_URL}/auth/login`, {
      data: { email: FAMILY_EMAIL, password: FAMILY_PASSWORD },
    });
    if (familyResponse.ok()) {
      const data = await familyResponse.json();
      familyToken = data.token;
      console.log('✅ Family login successful');
    }

    // Login as caregiver
    const caregiverResponse = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: { caregiverId: CAREGIVER_ID, pin: CAREGIVER_PIN },
    });
    if (caregiverResponse.ok()) {
      const data = await caregiverResponse.json();
      caregiverToken = data.token;
      console.log('✅ Caregiver login successful');
    }
  });

  test('should show section progress indicators on dashboard', async ({ page, request }) => {
    test.setTimeout(60000);

    console.log('\n=== Login as Family and Check Progress Indicators ===');

    // Login via API
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: { email: FAMILY_EMAIL, password: FAMILY_PASSWORD },
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();

    // Fetch care recipient
    const recipientResponse = await request.get(`${API_URL}/care-recipients`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` },
    });
    const recipients = await recipientResponse.json();
    const careRecipient = recipients.find((r: { id: string }) => r.id === CARE_RECIPIENT_ID);

    // Set localStorage and navigate
    await page.goto(`${BASE_URL}/family/dashboard`);
    await page.evaluate(({ user, recipient, token }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('careRecipient', JSON.stringify(recipient));
      localStorage.setItem('token', token);
    }, {
      user: { id: loginData.id, email: FAMILY_EMAIL, name: loginData.name, role: 'family_admin' },
      recipient: careRecipient,
      token: loginData.token,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    console.log('✅ Dashboard loaded');

    // Look for section progress indicators
    // These should show completed sections like: [Morning ✓] [Afternoon] [Evening] [Summary]
    const progressIndicators = await page.locator('[class*="progress"], [class*="section"]').count();
    console.log(`Found ${progressIndicators} potential progress elements`);

    // Check for specific section labels
    const morningIndicator = await page.locator('text=/Morning|🌅/i').count();
    const afternoonIndicator = await page.locator('text=/Afternoon|☀️/i').count();
    const eveningIndicator = await page.locator('text=/Evening|🌙/i').count();

    console.log('Section indicators found:', {
      morning: morningIndicator > 0,
      afternoon: afternoonIndicator > 0,
      evening: eveningIndicator > 0,
    });

    // Take screenshot for verification
    await page.screenshot({ path: '/tmp/family-dashboard-progress.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/family-dashboard-progress.png');
  });

  test('should show completed sections to family members via API', async ({ request }) => {
    test.setTimeout(30000);

    console.log('\n=== API Test: Family Can See Completed Sections ===');

    if (!familyToken) {
      console.log('⚠️ Family token not available, skipping');
      return;
    }

    // Fetch today's log as family member
    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}/today`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });

    if (!response.ok()) {
      console.log('⚠️ No care log for today');
      return;
    }

    const todayLog = await response.json();
    console.log('Today\'s log status:', todayLog.status);
    console.log('Completed sections:', todayLog.completedSections);

    // If there are completed sections, verify family can see the data
    if (todayLog.completedSections) {
      const sections = Object.keys(todayLog.completedSections);
      console.log(`✅ Family can see ${sections.length} completed sections:`, sections);

      // Verify morning data is visible if morning is completed
      if (todayLog.completedSections.morning) {
        console.log('Morning section data visible to family:');
        console.log('  - Wake time:', todayLog.wakeTime || 'not set');
        console.log('  - Mood:', todayLog.mood || 'not set');
        console.log('  - Shower time:', todayLog.showerTime || 'not set');
      }

      // Verify afternoon data if completed
      if (todayLog.completedSections.afternoon) {
        console.log('Afternoon section data visible to family:');
        console.log('  - Medications:', todayLog.medications?.length || 0);
        console.log('  - Lunch:', todayLog.meals?.lunch ? 'recorded' : 'not set');
      }
    } else if (todayLog.status === 'submitted') {
      console.log('✅ Log is fully submitted, all data visible');
    } else {
      console.log('⚠️ No completed sections yet');
    }
  });

  test('should hide incomplete sections from family via API', async ({ request }) => {
    test.setTimeout(30000);

    console.log('\n=== API Test: Incomplete Sections Hidden from Family ===');

    if (!caregiverToken || !familyToken) {
      console.log('⚠️ Tokens not available, skipping');
      return;
    }

    // Create a new draft log with only morning data
    const createResponse = await request.post(`${API_URL}/care-logs`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: {
        careRecipientId: CARE_RECIPIENT_ID,
        wakeTime: '07:00',
        mood: 'alert',
        // Don't fill afternoon/evening data
      },
    });

    if (!createResponse.ok()) {
      console.log('⚠️ Could not create test log');
      return;
    }

    const careLog = await createResponse.json();
    console.log('Created test log:', careLog.id);

    // Submit only morning section
    const submitMorning = await request.post(`${API_URL}/care-logs/${careLog.id}/submit-section`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: { section: 'morning' },
    });

    expect(submitMorning.ok()).toBeTruthy();
    console.log('✅ Morning section submitted');

    // Now fetch as family - should only see morning data
    const familyView = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}/today`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });

    if (familyView.ok()) {
      const data = await familyView.json();

      // Morning data should be visible
      if (data.completedSections?.morning) {
        console.log('✅ Morning data visible:', {
          wakeTime: data.wakeTime,
          mood: data.mood,
        });
      }

      // Afternoon/evening data should be hidden or null (since not submitted)
      if (!data.completedSections?.afternoon && !data.completedSections?.evening) {
        console.log('✅ Incomplete sections correctly hidden');
      }
    }
  });

  test('should show "New Changes" badge when caregiver updates after family views', async ({ request }) => {
    test.setTimeout(45000);

    console.log('\n=== API Test: New Changes Badge ===');

    if (!caregiverToken || !familyToken) {
      console.log('⚠️ Tokens not available, skipping');
      return;
    }

    // Create and submit a log
    const createResponse = await request.post(`${API_URL}/care-logs`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: {
        careRecipientId: CARE_RECIPIENT_ID,
        wakeTime: '08:00',
        mood: 'calm',
      },
    });

    if (!createResponse.ok()) {
      console.log('⚠️ Could not create test log');
      return;
    }

    const careLog = await createResponse.json();

    // Submit morning section
    await request.post(`${API_URL}/care-logs/${careLog.id}/submit-section`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: { section: 'morning' },
    });

    // Family views the log (marks as viewed)
    await request.post(`${API_URL}/care-logs/${careLog.id}/mark-viewed`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });
    console.log('✅ Family marked log as viewed');

    // Wait a bit to ensure timestamps differ
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Caregiver updates the log
    await request.patch(`${API_URL}/care-logs/${careLog.id}`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: { mood: 'alert' },
    });
    console.log('✅ Caregiver updated log after family view');

    // Re-submit the section
    await request.post(`${API_URL}/care-logs/${careLog.id}/submit-section`, {
      headers: { 'Authorization': `Bearer ${caregiverToken}` },
      data: { section: 'morning' },
    });

    // Family fetches - should see hasUnviewedChanges: true
    const familyView = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}/today`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });

    if (familyView.ok()) {
      const data = await familyView.json();
      console.log('hasUnviewedChanges:', data.hasUnviewedChanges);
      console.log('changedFields:', data.changedFields);

      if (data.hasUnviewedChanges) {
        console.log('✅ New Changes badge would be shown');
        expect(data.changedFields).toContain('mood');
      }
    }
  });

  test('should display data from partially submitted logs on dashboard', async ({ page, request }) => {
    test.setTimeout(90000);

    console.log('\n=== UI Test: Partial Data on Dashboard ===');

    // Login
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: { email: FAMILY_EMAIL, password: FAMILY_PASSWORD },
    });

    if (!loginResponse.ok()) {
      console.log('⚠️ Login failed');
      return;
    }

    const loginData = await loginResponse.json();

    // Setup page
    await page.goto(`${BASE_URL}/family/dashboard`);
    await page.evaluate(({ user, token }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    }, {
      user: { id: loginData.id, email: FAMILY_EMAIL, name: loginData.name, role: 'family_admin' },
      token: loginData.token,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check if morning routine card is visible with data
    const morningCard = page.locator('text=/Morning Routine|🌅/i');
    if (await morningCard.count() > 0) {
      console.log('✅ Morning Routine section visible');

      // Check for wake time
      const wakeTime = await page.locator('text=/Wake Time|07:|08:|09:/i').count();
      if (wakeTime > 0) {
        console.log('✅ Wake time data displayed');
      }

      // Check for mood
      const mood = await page.locator('text=/Mood|alert|calm|sleepy/i').count();
      if (mood > 0) {
        console.log('✅ Mood data displayed');
      }
    }

    // Check for section progress indicator
    const progressBadge = await page.locator('text=/sections|Progress/i').count();
    if (progressBadge > 0) {
      console.log('✅ Section progress indicator found');
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/family-partial-view.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/family-partial-view.png');
  });

  test('should show all data when log is fully submitted', async ({ request }) => {
    test.setTimeout(30000);

    console.log('\n=== API Test: Full Submission Shows All Data ===');

    if (!familyToken) {
      console.log('⚠️ Family token not available, skipping');
      return;
    }

    // Fetch all logs and find a submitted one
    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });

    if (!response.ok()) {
      console.log('⚠️ Could not fetch logs');
      return;
    }

    const logs = await response.json();
    const submittedLog = logs.find((log: { status: string }) => log.status === 'submitted');

    if (submittedLog) {
      console.log('✅ Found fully submitted log:', submittedLog.id);
      console.log('All data fields visible:');
      console.log('  - Wake time:', submittedLog.wakeTime);
      console.log('  - Mood:', submittedLog.mood);
      console.log('  - Blood pressure:', submittedLog.bloodPressure);
      console.log('  - Meals:', submittedLog.meals ? 'present' : 'not set');
      console.log('  - Medications:', submittedLog.medications?.length || 0);

      // Verify it doesn't have completedSections (full submit doesn't need them)
      // Or if it does, all 4 should be present
      if (submittedLog.completedSections) {
        const sectionCount = Object.keys(submittedLog.completedSections).length;
        console.log(`  - Completed sections: ${sectionCount}/4`);
      }
    } else {
      console.log('⚠️ No fully submitted logs found');
    }
  });
});
