import { test, expect } from '@playwright/test';

test.describe('Family Weekly View', () => {
  test('should show care logs in weekly view', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log('BROWSER:', msg.text());
    });

    page.on('response', async response => {
      if (response.url().includes('care-logs')) {
        console.log(`API: ${response.status()} ${response.url()}`);
        if (response.status() >= 400) {
          const body = await response.text();
          console.log('Error body:', body);
        }
      }
    });

    console.log('\n=== STEP 1: Login as Family Member ===');
    await page.goto('https://anchor-dev.erniesg.workers.dev/auth/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', '123456');

    console.log('Submitting login...');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/family/dashboard', { timeout: 10000 });
    console.log('✅ Login successful, redirected to dashboard');

    // Check localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    const careRecipient = await page.evaluate(() => localStorage.getItem('careRecipient'));

    console.log('token exists:', !!token);
    console.log('user:', user ? JSON.parse(user).email : 'MISSING');
    console.log('careRecipient:', careRecipient ? JSON.parse(careRecipient).name : 'MISSING');

    console.log('\n=== STEP 2: Switch to Week View ===');
    await page.waitForTimeout(1000); // Wait for initial data load

    // Click Week button
    await page.locator('button:has-text("Week")').click();
    console.log('Switched to Week view');

    await page.waitForTimeout(2000); // Wait for API calls

    // Take screenshot
    await page.screenshot({ path: '/tmp/family-weekly-view.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/family-weekly-view.png');

    // Check page content
    const pageContent = await page.locator('body').textContent();
    console.log('Page contains "No data":', pageContent?.includes('No data for this week'));

    // Try to navigate to previous week
    console.log('\n=== STEP 3: Navigate to Previous Week ===');
    const prevWeekButton = page.locator('button:has-text("←")');
    await prevWeekButton.click();
    console.log('Clicked previous week button');

    await page.waitForTimeout(2000); // Wait for API calls

    // Take screenshot
    await page.screenshot({ path: '/tmp/family-weekly-view-prev.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/family-weekly-view-prev.png');

    // Check if data appears
    const pageContent2 = await page.locator('body').textContent();
    console.log('Page contains "No data" after navigation:', pageContent2?.includes('No data for this week'));
  });
});
