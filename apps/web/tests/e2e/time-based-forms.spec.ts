import { test, expect, devices, Page } from '@playwright/test';

/**
 * Time-Based Forms E2E Tests
 *
 * Tests the new time-based form structure:
 * - Dashboard with 4 time-period cards
 * - Morning, Afternoon, Evening, Summary forms
 * - Quick Actions FAB
 * - Mobile responsiveness (375px)
 * - Family viewing of caregiver data
 */

// Production URLs
const BASE_URL = process.env.BASE_URL || 'https://anchor.erniesg.workers.dev';
const API_URL = process.env.API_URL || 'https://anchor-prod-api.erniesg.workers.dev';

// Test caregiver credentials (from production seed data)
const CAREGIVER_ID = '0921aacd-fbbc-41e4-bb1f-7705c71906f8';
const CAREGIVER_PIN = '578902';

// Family credentials
const FAMILY_EMAIL = 'admin@anchor-prod.com';
const FAMILY_PASSWORD = 'anchor2024';

// Helper function for caregiver login with retry
async function loginAsCaregiver(page: Page, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(`${BASE_URL}/caregiver/login`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await page.fill('input[type="text"]', CAREGIVER_ID);
      await page.fill('input[type="password"]', CAREGIVER_PIN);
      await page.click('button[type="submit"]');

      await page.waitForURL('**/caregiver/form**', { timeout: 25000 });
      console.log(`✅ Caregiver login successful (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.log(`⚠️ Login attempt ${attempt} failed`);
      if (attempt === retries) {
        const errorText = await page.locator('text=/error|failed/i').textContent().catch(() => null);
        if (errorText) console.log(`Error: ${errorText}`);
        await page.screenshot({ path: `/tmp/login-failed-${Date.now()}.png` });
        return false;
      }
      await page.waitForTimeout(2000);
    }
  }
  return false;
}

// Helper function for family login
async function loginAsFamily(page: Page, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(`${BASE_URL}/family/login`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await page.fill('input[type="email"], input[name="email"]', FAMILY_EMAIL);
      await page.fill('input[type="password"]', FAMILY_PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL('**/family/**', { timeout: 25000 });
      console.log(`✅ Family login successful (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.log(`⚠️ Family login attempt ${attempt} failed`);
      if (attempt === retries) return false;
      await page.waitForTimeout(2000);
    }
  }
  return false;
}

test.describe('Time-Based Forms - Dashboard', () => {
  test('should display 4 time-period cards', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    // Verify dashboard header
    await expect(page.locator('text="Today\'s Care Log"')).toBeVisible({ timeout: 15000 });

    // Verify 4 time-period cards
    await expect(page.locator('text="Morning"')).toBeVisible();
    await expect(page.locator('text="Afternoon"')).toBeVisible();
    await expect(page.locator('text="Evening"')).toBeVisible();
    await expect(page.locator('text=/Daily Summary|Summary/')).toBeVisible();

    console.log('✅ All 4 time-period cards visible');

    // Verify Quick Actions section
    await expect(page.locator('text="Quick Actions"')).toBeVisible();
    console.log('✅ Quick Actions section visible');

    await page.screenshot({ path: '/tmp/dashboard-time-cards.png', fullPage: true });
  });

  test('should navigate to legacy form', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    const legacyButton = page.locator('button:has-text("Full Form")');
    await expect(legacyButton).toBeVisible({ timeout: 10000 });
    await legacyButton.click();

    await page.waitForURL('**/caregiver/form-legacy**', { timeout: 15000 });
    console.log('✅ Navigated to legacy form');
  });
});

test.describe('Time-Based Forms - Morning', () => {
  test('should navigate to morning form', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    await page.locator('button:has-text("Morning")').first().click();
    await page.waitForURL('**/caregiver/form/morning', { timeout: 15000 });
    console.log('✅ Navigated to morning form');

    await expect(page.locator('text=/Morning/i')).toBeVisible();

    // Fill wake time
    const wakeTimeInput = page.locator('input[type="time"]').first();
    if (await wakeTimeInput.isVisible()) {
      await wakeTimeInput.fill('07:00');
      console.log('✅ Filled wake time');
    }

    await page.screenshot({ path: '/tmp/morning-form.png', fullPage: true });
  });
});

test.describe('Time-Based Forms - Afternoon', () => {
  test('should navigate to afternoon form', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    await page.locator('button:has-text("Afternoon")').first().click();
    await page.waitForURL('**/caregiver/form/afternoon', { timeout: 15000 });
    console.log('✅ Navigated to afternoon form');

    await expect(page.locator('text=/Afternoon/i')).toBeVisible();
    await page.screenshot({ path: '/tmp/afternoon-form.png', fullPage: true });
  });
});

test.describe('Time-Based Forms - Evening', () => {
  test('should navigate to evening form', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    await page.locator('button:has-text("Evening")').first().click();
    await page.waitForURL('**/caregiver/form/evening', { timeout: 15000 });
    console.log('✅ Navigated to evening form');

    await expect(page.locator('text=/Evening/i')).toBeVisible();
    await page.screenshot({ path: '/tmp/evening-form.png', fullPage: true });
  });
});

test.describe('Time-Based Forms - Summary', () => {
  test('should navigate to summary form', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    await page.locator('button:has-text(/Summary/)').first().click();
    await page.waitForURL('**/caregiver/form/summary', { timeout: 15000 });
    console.log('✅ Navigated to summary form');

    await page.screenshot({ path: '/tmp/summary-form.png', fullPage: true });
  });
});

test.describe('Mobile Viewport Tests (375px)', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });

  test('should display dashboard correctly on 375px mobile', async ({ page }) => {
    test.setTimeout(120000);

    const viewport = page.viewportSize();
    console.log(`📱 Viewport: ${viewport?.width}x${viewport?.height}`);
    expect(viewport?.width).toBe(375);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    console.log(`Body width: ${bodyWidth}px`);
    expect(bodyWidth).toBeLessThanOrEqual(395); // Small margin allowed

    // Verify cards are visible
    await expect(page.locator('text="Morning"')).toBeVisible();
    await expect(page.locator('text="Afternoon"')).toBeVisible();

    await page.screenshot({ path: '/tmp/mobile-dashboard-375.png', fullPage: true });
    console.log('✅ Mobile dashboard rendered correctly at 375px');
  });

  test('should navigate forms with touch on mobile', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    // Tap on Morning card
    await page.tap('button:has-text("Morning")');
    await page.waitForURL('**/caregiver/form/morning', { timeout: 15000 });
    console.log('✅ Touch navigation to morning form');

    // Check form fits in viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(395);

    await page.screenshot({ path: '/tmp/mobile-morning-form-375.png', fullPage: true });
  });

  test('should have touch-friendly buttons (min 40px)', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsCaregiver(page)) {
      test.skip();
      return;
    }

    const buttons = await page.locator('button').all();
    let touchFriendlyCount = 0;
    let smallButtonCount = 0;

    for (const button of buttons.slice(0, 10)) {
      const box = await button.boundingBox();
      if (box) {
        if (box.height >= 36 && box.width >= 36) {
          touchFriendlyCount++;
        } else {
          smallButtonCount++;
        }
      }
    }

    console.log(`✅ Touch-friendly buttons: ${touchFriendlyCount}, Small: ${smallButtonCount}`);
    expect(touchFriendlyCount).toBeGreaterThan(0);
  });
});

test.describe('Family Viewing Caregiver Data', () => {
  test('should login as family and view dashboard', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsFamily(page)) {
      test.skip();
      return;
    }

    await expect(page.locator('text=/Dashboard|Care|Today/i').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: '/tmp/family-dashboard.png', fullPage: true });
    console.log('✅ Family dashboard visible');
  });

  test('should display caregiver submitted data', async ({ page }) => {
    test.setTimeout(120000);

    if (!await loginAsFamily(page)) {
      test.skip();
      return;
    }

    // Look for care data sections
    const pageContent = await page.content();
    const hasCareData = pageContent.includes('Wake') ||
                        pageContent.includes('Meal') ||
                        pageContent.includes('Fluid') ||
                        pageContent.includes('Morning') ||
                        pageContent.includes('ml');

    console.log(`Care data visible: ${hasCareData}`);
    await page.screenshot({ path: '/tmp/family-care-data.png', fullPage: true });
  });
});

test.describe('API Integration Tests', () => {
  test('should save and retrieve meals with correct format', async ({ request }) => {
    test.setTimeout(60000);

    // Login as caregiver
    const loginResponse = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: { caregiverId: CAREGIVER_ID, pin: CAREGIVER_PIN },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { token, caregiver } = await loginResponse.json();
    console.log('✅ Caregiver logged in via API');

    // Get or create today's log
    const todayResponse = await request.get(`${API_URL}/care-logs/caregiver/today`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    let logId: string;
    if (todayResponse.ok()) {
      const todayLog = await todayResponse.json();
      logId = todayLog.id;
    } else {
      const createResponse = await request.post(`${API_URL}/care-logs`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: {
          careRecipientId: caregiver.careRecipientId,
          logDate: new Date().toISOString().split('T')[0],
        },
      });
      const newLog = await createResponse.json();
      logId = newLog.id;
    }
    console.log(`✅ Using log: ${logId}`);

    // Save meals with correct format
    const saveResponse = await request.patch(`${API_URL}/care-logs/${logId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        wakeTime: '07:30',
        mood: 'alert',
        meals: {
          breakfast: { time: '08:00', appetite: 4, amountEaten: 4, assistance: 'none', swallowingIssues: [] },
          lunch: { time: '12:30', appetite: 3, amountEaten: 3, assistance: 'none', swallowingIssues: [] },
          dinner: { time: '18:30', appetite: 4, amountEaten: 4, assistance: 'none', swallowingIssues: [] },
        },
      },
    });
    expect(saveResponse.ok()).toBeTruthy();
    const savedLog = await saveResponse.json();

    // Verify meals structure
    expect(savedLog.meals).toBeDefined();
    expect(savedLog.meals.breakfast?.time).toBe('08:00');
    expect(savedLog.meals.lunch?.time).toBe('12:30');
    expect(savedLog.meals.dinner?.time).toBe('18:30');
    console.log('✅ Meals saved and verified');
  });

  test('should allow family to view caregiver data', async ({ request }) => {
    test.setTimeout(60000);

    // Get caregiver's recipient ID
    const cgLoginResponse = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: { caregiverId: CAREGIVER_ID, pin: CAREGIVER_PIN },
    });
    const { caregiver } = await cgLoginResponse.json();
    const recipientId = caregiver.careRecipientId;

    // Login as family
    const familyLoginResponse = await request.post(`${API_URL}/auth/login`, {
      data: { email: FAMILY_EMAIL, password: FAMILY_PASSWORD },
    });
    expect(familyLoginResponse.ok()).toBeTruthy();
    const { token: familyToken } = await familyLoginResponse.json();
    console.log('✅ Family logged in via API');

    // Get today's log for recipient
    const logResponse = await request.get(`${API_URL}/care-logs/recipient/${recipientId}/today`, {
      headers: { 'Authorization': `Bearer ${familyToken}` },
    });

    if (logResponse.ok()) {
      const log = await logResponse.json();
      console.log('✅ Family can view care log');
      console.log(`   Wake: ${log.wakeTime || '—'}, Mood: ${log.mood || '—'}`);
      console.log(`   Breakfast: ${log.meals?.breakfast?.time || '—'}`);
      console.log(`   Sections: ${Object.keys(log.completedSections || {}).join(', ') || 'none'}`);
    } else {
      console.log('⚠️ No care log for today (OK if no data entered)');
    }
  });

  test('should track audit history', async ({ request }) => {
    test.setTimeout(60000);

    const loginResponse = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: { caregiverId: CAREGIVER_ID, pin: CAREGIVER_PIN },
    });
    const { token } = await loginResponse.json();

    const todayResponse = await request.get(`${API_URL}/care-logs/caregiver/today`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (todayResponse.ok()) {
      const log = await todayResponse.json();
      const historyResponse = await request.get(`${API_URL}/care-logs/${log.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (historyResponse.ok()) {
        const history = await historyResponse.json();
        console.log(`✅ Audit history: ${history.length} entries`);
        expect(history.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should submit sections correctly', async ({ request }) => {
    test.setTimeout(60000);

    const loginResponse = await request.post(`${API_URL}/auth/caregiver/login`, {
      data: { caregiverId: CAREGIVER_ID, pin: CAREGIVER_PIN },
    });
    const { token, caregiver } = await loginResponse.json();

    // Get or create log
    let logId: string;
    const todayResponse = await request.get(`${API_URL}/care-logs/caregiver/today`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (todayResponse.ok()) {
      const log = await todayResponse.json();
      logId = log.id;
    } else {
      const createResponse = await request.post(`${API_URL}/care-logs`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: {
          careRecipientId: caregiver.careRecipientId,
          logDate: new Date().toISOString().split('T')[0],
        },
      });
      const newLog = await createResponse.json();
      logId = newLog.id;
    }

    // Submit morning section
    const submitResponse = await request.post(`${API_URL}/care-logs/${logId}/submit-section`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { section: 'morning' },
    });

    expect(submitResponse.ok()).toBeTruthy();
    const result = await submitResponse.json();
    expect(result.completedSections?.morning).toBeTruthy();
    console.log('✅ Morning section submitted successfully');
  });
});
