import { test, expect } from '@playwright/test';

test.describe('Family Dashboard', () => {
  const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';
  const API_URL = 'https://anchor-dev-api.erniesg.workers.dev';
  const FAMILY_EMAIL = 'admin@example.com';
  const FAMILY_PASSWORD = 'Admin123456';
  const CARE_RECIPIENT_ID = '0725fbb9-21c5-46a4-9ed0-305b0a506f20';

  let familyToken: string;

  test.beforeAll(async ({ request }) => {
    // Login to get family token
    console.log('🔐 Logging in as family member...');
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: FAMILY_EMAIL,
        password: FAMILY_PASSWORD,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    familyToken = data.token;
    console.log('✅ Family login successful');
  });

  test('should login and access family dashboard', async ({ page, request }) => {
    test.setTimeout(60000);

    console.log('\n=== STEP 1: Login via API and set localStorage ===');

    // Login via API
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: FAMILY_EMAIL,
        password: FAMILY_PASSWORD,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.id;

    console.log('✅ API login successful');

    // Fetch care recipient data
    const recipientResponse = await request.get(`${API_URL}/care-recipients`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect(recipientResponse.ok()).toBeTruthy();
    const recipients = await recipientResponse.json();
    const careRecipient = Array.isArray(recipients)
      ? recipients.find((r: any) => r.id === CARE_RECIPIENT_ID)
      : null;

    console.log('✅ Care recipient fetched:', careRecipient?.name || 'Not found');

    // Set localStorage before navigating
    await page.goto(`${BASE_URL}/family/dashboard`);
    await page.evaluate(({ user, recipient, authToken }) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('careRecipient', JSON.stringify(recipient));
      localStorage.setItem('token', authToken);
    }, {
      user: { id: userId, email: FAMILY_EMAIL, name: loginData.name, role: 'family_admin' },
      recipient: careRecipient,
      authToken: token,
    });

    // Reload to apply localStorage
    await page.reload();
    await page.waitForLoadState('networkidle');

    console.log('\n=== STEP 2: Verify Dashboard Loaded ===');

    // Verify we're on dashboard with care recipient name visible
    await expect(page.locator('h2:has-text("Grandmother Lee")')).toBeVisible({ timeout: 10000 });
    console.log('✅ Dashboard page loaded with care recipient data');
  });

  test('should fetch and display care logs via API', async ({ request }) => {
    console.log('\n=== STEP 2: Fetch Care Logs ===');

    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${familyToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const careLogs = await response.json();

    console.log(`✅ API returned ${careLogs.length} care logs`);
    expect(careLogs.length).toBeGreaterThan(0);

    // Verify data structure
    const latestLog = careLogs[0];
    console.log('Latest log ID:', latestLog.id);
    console.log('Latest log date:', latestLog.logDate);
    console.log('Latest log status:', latestLog.status);

    expect(latestLog).toHaveProperty('id');
    expect(latestLog).toHaveProperty('status', 'submitted');
    expect(latestLog).toHaveProperty('wakeTime');
    expect(latestLog).toHaveProperty('mood');
  });

  test('should display today\'s care log data', async ({ request }) => {
    console.log('\n=== STEP 3: Fetch Today\'s Log ===');

    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}/today`, {
      headers: {
        'Authorization': `Bearer ${familyToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const todayLog = await response.json();

    if (todayLog) {
      console.log('✅ Today\'s log found:');
      console.log('  Wake time:', todayLog.wakeTime);
      console.log('  Mood:', todayLog.mood);
      console.log('  Blood pressure:', todayLog.bloodPressure);
      console.log('  Pulse rate:', todayLog.pulseRate);
      console.log('  Blood sugar:', todayLog.bloodSugar);

      // Verify key fields
      expect(todayLog).toHaveProperty('id');
      expect(todayLog).toHaveProperty('status', 'submitted');
      expect(todayLog.wakeTime).toBeTruthy();
      expect(todayLog.mood).toBeTruthy();
    } else {
      console.log('⚠️  No care log for today');
    }
  });

  test('should fetch care log by specific date', async ({ request }) => {
    console.log('\n=== STEP 4: Fetch Log by Date ===');

    // Get a date from our seeded data
    const testDate = '2025-10-08'; // Yesterday's data

    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}/date/${testDate}`, {
      headers: {
        'Authorization': `Bearer ${familyToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const dateLog = await response.json();

    if (dateLog) {
      console.log(`✅ Log found for ${testDate}:`);
      console.log('  Wake time:', dateLog.wakeTime);
      console.log('  Mood:', dateLog.mood);
      console.log('  Blood pressure:', dateLog.bloodPressure);

      expect(dateLog).toHaveProperty('id');
      expect(dateLog).toHaveProperty('status', 'submitted');
    } else {
      console.log(`⚠️  No log found for ${testDate}`);
    }
  });

  test('should verify trend data is available', async ({ request }) => {
    console.log('\n=== STEP 5: Verify Trend Data ===');

    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${familyToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const careLogs = await response.json();

    console.log(`📊 Analyzing ${careLogs.length} logs for trends...`);

    // Extract vital signs for trend analysis
    const vitalsData = careLogs
      .filter((log: any) => log.bloodPressure && log.pulseRate)
      .map((log: any) => ({
        date: log.logDate,
        bp: log.bloodPressure,
        pulse: log.pulseRate,
        bloodSugar: log.bloodSugar,
        mood: log.mood,
      }));

    console.log('\nVitals Trend Summary:');
    vitalsData.slice(0, 5).forEach((v: any) => {
      console.log(`  Date: ${v.date} | BP: ${v.bp} | Pulse: ${v.pulse} | Sugar: ${v.bloodSugar} | Mood: ${v.mood}`);
    });

    // Verify we have enough data for trends (at least 5 days)
    expect(vitalsData.length).toBeGreaterThanOrEqual(5);
    console.log(`\n✅ Sufficient data for trends (${vitalsData.length} data points)`);

    // Check for data variation (indicates realistic trends)
    const bloodPressures = vitalsData.map((v: any) => v.bp).filter(Boolean);
    const uniqueBPs = new Set(bloodPressures);
    expect(uniqueBPs.size).toBeGreaterThan(1);
    console.log(`✅ Blood pressure shows variation (${uniqueBPs.size} unique values)`);

    const moods = vitalsData.map((v: any) => v.mood).filter(Boolean);
    const uniqueMoods = new Set(moods);
    expect(uniqueMoods.size).toBeGreaterThan(1);
    console.log(`✅ Mood shows variation (${uniqueMoods.size} unique values: ${Array.from(uniqueMoods).join(', ')})`);
  });

  test('should verify all required data fields are present', async ({ request }) => {
    console.log('\n=== STEP 6: Data Completeness Check ===');

    const response = await request.get(`${API_URL}/care-logs/recipient/${CARE_RECIPIENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${familyToken}`,
      },
    });

    const careLogs = await response.json();
    const latestLog = careLogs[0];

    console.log('Checking data completeness for latest log...');

    // Required fields
    const requiredFields = ['id', 'status', 'wakeTime', 'mood'];
    requiredFields.forEach(field => {
      expect(latestLog).toHaveProperty(field);
      console.log(`  ✅ ${field}: ${latestLog[field]}`);
    });

    // Optional but commonly filled fields
    const commonFields = ['bloodPressure', 'meals', 'safetyChecks', 'afternoonRest'];
    commonFields.forEach(field => {
      if (latestLog[field]) {
        console.log(`  ✅ ${field}: Present`);
      } else {
        console.log(`  ⏭️  ${field}: Not filled`);
      }
    });

    console.log('\n✅ Data completeness verified');
  });
});
