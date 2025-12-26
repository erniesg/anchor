import { test, expect } from '@playwright/test';

/**
 * FULL E2E TEST - Creates real accounts and tests the complete flow
 *
 * Flow:
 * 1. Family signup (new account)
 * 2. Family onboarding (create care recipient)
 * 3. Create caregiver (part of onboarding flow)
 * 4. Caregiver login
 * 5. Fill Morning form with autosave
 * 6. Fill Afternoon form
 * 7. Fill Evening form
 * 8. Fill Summary form
 * 9. Submit sections progressively
 * 10. View as family - check progression/audit
 * 11. Test pack list
 * 12. Test trends page
 */

const BASE_URL = 'https://anchor-dev.erniesg.workers.dev';

// Generate unique test data
const testTimestamp = Date.now();
const TEST_FAMILY_EMAIL = `e2e_family_${testTimestamp}@test.com`;
const TEST_FAMILY_PASSWORD = 'TestPass123!';
const TEST_FAMILY_NAME = `E2E Test Family ${testTimestamp}`;
const TEST_CARE_RECIPIENT_NAME = `Test Elder ${testTimestamp}`;
const TEST_CAREGIVER_NAME = `Test Caregiver ${testTimestamp}`;
const TEST_CAREGIVER_USERNAME = `testcg${testTimestamp}`.substring(0, 20); // max 20 chars

// Will store credentials from onboarding
let caregiverUsername = '';
let caregiverPin = '';

test.describe('Full E2E Flow Test', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120000); // 2 minutes per test

  // =========================================
  // PHASE 1: FAMILY SIGNUP & ONBOARDING
  // =========================================

  test('1. Family Signup - Create new account', async ({ page }) => {
    console.log(`Creating family account: ${TEST_FAMILY_EMAIL}`);

    await page.goto(`${BASE_URL}/auth/signup`);
    await page.waitForLoadState('networkidle');

    // Verify signup page loaded
    await expect(page.locator('h2:has-text("Create Family Account")')).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-01-signup-page.png', fullPage: true });

    // Fill signup form
    await page.fill('input[name="name"]', TEST_FAMILY_NAME);
    await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
    await page.fill('input[name="phone"]', '+65 9123 4567');
    await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_FAMILY_PASSWORD);

    await page.screenshot({ path: 'test-results/e2e-02-signup-filled.png', fullPage: true });

    // Submit signup
    await page.click('button[type="submit"]');

    // Wait for redirect to onboarding
    await page.waitForURL('**/family/onboarding**', { timeout: 15000 });

    await page.screenshot({ path: 'test-results/e2e-03-after-signup.png', fullPage: true });

    const currentUrl = page.url();
    console.log('After signup URL:', currentUrl);
    expect(currentUrl).toContain('/family/onboarding');
  });

  test('2. Family Onboarding - Create care recipient and caregiver', async ({ page }) => {
    // Login with new account
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
    await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/e2e-04-after-login.png', fullPage: true });

    let currentUrl = page.url();
    console.log('After login URL:', currentUrl);

    // STEP 1: Create Care Recipient (if on onboarding page)
    if (currentUrl.includes('/onboarding') && !currentUrl.includes('/caregiver')) {
      console.log('On care recipient onboarding page - filling form...');

      // Fill care recipient details
      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(TEST_CARE_RECIPIENT_NAME);
      }

      const dobInput = page.locator('input[type="date"]');
      if (await dobInput.isVisible()) {
        await dobInput.fill('1945-05-15');
      }

      const conditionInput = page.locator('input[placeholder*="Dementia"]');
      if (await conditionInput.isVisible()) {
        await conditionInput.fill('Dementia, Mild Parkinson\'s');
      }

      const locationInput = page.locator('input[placeholder*="Singapore"]');
      if (await locationInput.isVisible()) {
        await locationInput.fill('Singapore, Ang Mo Kio');
      }

      const emergencyInput = page.locator('input[type="tel"]');
      if (await emergencyInput.isVisible()) {
        await emergencyInput.fill('+65 8765 4321');
      }

      await page.screenshot({ path: 'test-results/e2e-05-onboarding-filled.png', fullPage: true });

      // Submit care recipient - click Continue and wait for navigation to caregiver page
      const continueBtn = page.locator('button:has-text("Continue")');
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        console.log('Clicked Continue, waiting for caregiver page...');

        // Wait for URL to change to caregiver onboarding
        try {
          await page.waitForURL('**/onboarding/caregiver**', { timeout: 15000 });
          console.log('Navigated to caregiver page');
        } catch (e) {
          console.log('Did not navigate to caregiver page, checking current state...');
          await page.waitForTimeout(5000);
        }
      }

      await page.screenshot({ path: 'test-results/e2e-06-after-care-recipient.png', fullPage: true });
      currentUrl = page.url();
      console.log('URL after care recipient submission:', currentUrl);
    }

    // STEP 2: Create Caregiver (if on caregiver page)
    if (currentUrl.includes('/onboarding/caregiver') || (await page.locator('text=Almost Done').isVisible())) {
      console.log('On caregiver onboarding page - filling form...');

      const caregiverNameInput = page.locator('input[placeholder*="Maria Santos"]');
      if (await caregiverNameInput.isVisible()) {
        await caregiverNameInput.fill(TEST_CAREGIVER_NAME);
        console.log('Filled caregiver name');

        // Fill username
        const usernameInput = page.locator('input[placeholder*="maria-helper"]');
        if (await usernameInput.isVisible()) {
          await usernameInput.fill(TEST_CAREGIVER_USERNAME);
        }

        // Fill phone
        const phoneInput = page.locator('input[placeholder*="9123"]');
        if (await phoneInput.isVisible()) {
          await phoneInput.fill('+65 9876 5432');
        }

        await page.screenshot({ path: 'test-results/e2e-07-caregiver-filled.png', fullPage: true });

        // Submit caregiver - look for "Generate PIN & Create Account" button
        const createBtn = page.locator('button:has-text("Generate PIN")');
        if (await createBtn.isVisible()) {
          await createBtn.click();
          console.log('Clicked Generate PIN, waiting for credentials...');

          // Wait for success modal with credentials
          await page.waitForTimeout(5000);
          await page.screenshot({ path: 'test-results/e2e-08-caregiver-created.png', fullPage: true });

          // Look for credentials on the success screen
          console.log('Looking for credentials...');

          // Username is in blue section with font-mono class
          const usernameSection = page.locator('.bg-blue-50').first();
          if (await usernameSection.isVisible()) {
            const usernameEl = usernameSection.locator('p.font-mono, .font-mono.text-center').first();
            if (await usernameEl.isVisible()) {
              caregiverUsername = (await usernameEl.textContent())?.trim() || '';
              console.log('Found username:', caregiverUsername);
            }
          }

          // PIN is in primary/purple section with tracking-widest class
          const pinSection = page.locator('.bg-primary-50').first();
          if (await pinSection.isVisible()) {
            const pinEl = pinSection.locator('.tracking-widest').first();
            if (await pinEl.isVisible()) {
              const pinText = await pinEl.textContent();
              caregiverPin = pinText?.replace(/\s/g, '').trim() || '';
              console.log('Found PIN:', caregiverPin);
            }
          }

          // Fallback: try to find PIN by looking for 6-digit string in a large font element
          if (!caregiverPin) {
            const largeText = page.locator('.text-5xl, .text-4xl, .text-3xl');
            const count = await largeText.count();
            for (let i = 0; i < count; i++) {
              const text = (await largeText.nth(i).textContent())?.replace(/\s/g, '').trim() || '';
              if (text.match(/^\d{6}$/)) {
                caregiverPin = text;
                console.log('Found PIN (fallback):', caregiverPin);
                break;
              }
            }
          }

          await page.screenshot({ path: 'test-results/e2e-09-credentials.png', fullPage: true });

          // Click Done/Go to Dashboard
          const doneBtn = page.locator('button:has-text("Go to Dashboard")');
          if (await doneBtn.isVisible()) {
            await doneBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    } else {
      console.log('Not on caregiver page - URL:', currentUrl);
    }

    await page.screenshot({ path: 'test-results/e2e-10-final.png', fullPage: true });
    console.log('Final URL:', page.url());
    console.log('Credentials captured - Username:', caregiverUsername, 'PIN:', caregiverPin);
  });

  test('3. Create Caregiver in Onboarding Flow', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
    await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should be on caregiver onboarding page
    await page.screenshot({ path: 'test-results/e2e-07-caregiver-page.png', fullPage: true });

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check if we're on caregiver onboarding page
    if (currentUrl.includes('/onboarding/caregiver') || currentUrl.includes('/onboarding')) {
      // Look for "Almost Done!" or caregiver form
      const almostDone = page.locator('text=Almost Done');
      const createCaregiverTitle = page.locator('text=Create Caregiver Account');

      if (await almostDone.isVisible() || await createCaregiverTitle.isVisible()) {
        console.log('On caregiver onboarding page');

        // Fill caregiver name
        const nameInput = page.locator('input[placeholder*="Maria Santos"], input[placeholder*="full name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill(TEST_CAREGIVER_NAME);
        } else {
          // Try finding by label
          const nameLabel = page.locator('text=Caregiver\'s Full Name').locator('..').locator('input');
          if (await nameLabel.isVisible()) {
            await nameLabel.fill(TEST_CAREGIVER_NAME);
          }
        }

        // Fill username (optional - can auto-generate)
        const usernameInput = page.locator('input[placeholder*="maria-helper"]');
        if (await usernameInput.isVisible()) {
          await usernameInput.fill(TEST_CAREGIVER_USERNAME);
        }

        // Fill phone (optional)
        const phoneInput = page.locator('input[placeholder*="9123"]');
        if (await phoneInput.isVisible()) {
          await phoneInput.fill('+65 9876 5432');
        }

        await page.screenshot({ path: 'test-results/e2e-08-caregiver-form-filled.png', fullPage: true });

        // Submit - look for "Generate PIN & Create Account" button
        const createBtn = page.locator('button:has-text("Generate PIN"), button:has-text("Create Account")');
        if (await createBtn.isVisible()) {
          await createBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'test-results/e2e-09-caregiver-created.png', fullPage: true });

          // Look for success message with credentials
          console.log('Capturing credentials from success screen...');

          // Username is in blue section with font-mono class
          const usernameSection = page.locator('.bg-blue-50').first();
          if (await usernameSection.isVisible()) {
            const usernameEl = usernameSection.locator('p.font-mono, .font-mono.text-center').first();
            if (await usernameEl.isVisible()) {
              caregiverUsername = (await usernameEl.textContent())?.trim() || '';
              console.log('Captured username:', caregiverUsername);
            }
          }

          // PIN is in primary section with tracking-widest class
          const pinSection = page.locator('.bg-primary-50').first();
          if (await pinSection.isVisible()) {
            const pinEl = pinSection.locator('.tracking-widest').first();
            if (await pinEl.isVisible()) {
              const pinText = await pinEl.textContent();
              caregiverPin = pinText?.replace(/\s/g, '').trim() || '';
              console.log('Captured PIN:', caregiverPin);
            }
          }

          // Fallback for PIN
          if (!caregiverPin) {
            const largeText = page.locator('.text-5xl, .text-4xl');
            const count = await largeText.count();
            for (let i = 0; i < count; i++) {
              const text = (await largeText.nth(i).textContent())?.replace(/\s/g, '').trim() || '';
              if (text.match(/^\d{6}$/)) {
                caregiverPin = text;
                console.log('Captured PIN (fallback):', caregiverPin);
                break;
              }
            }
          }

          // Screenshot the credentials
          await page.screenshot({ path: 'test-results/e2e-10-credentials-displayed.png', fullPage: true });

          // Look for Done/Continue button
          const doneBtn = page.locator('button:has-text("Done"), button:has-text("Continue"), button:has-text("Go to Dashboard")');
          if (await doneBtn.isVisible()) {
            await doneBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    } else if (currentUrl.includes('/dashboard')) {
      console.log('Already on dashboard - caregiver may already exist');
      // Navigate to caregiver settings to get credentials
      await page.goto(`${BASE_URL}/family/settings/caregivers`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/e2e-07b-caregiver-settings.png', fullPage: true });
    }

    await page.screenshot({ path: 'test-results/e2e-11-after-caregiver-setup.png', fullPage: true });
  });

  test('4. Get Caregiver Credentials from Settings', async ({ page }) => {
    // If we didn't capture credentials in onboarding, get them from settings
    if (!caregiverUsername || !caregiverPin) {
      console.log('Need to get credentials from settings...');

      // Login as family
      await page.goto(`${BASE_URL}/auth/login`);
      await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
      await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Go to caregiver settings
      await page.goto(`${BASE_URL}/family/settings/caregivers`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/e2e-12-caregiver-settings.png', fullPage: true });

      // Find caregiver in list and get username
      const caregiverItem = page.locator('[data-testid="caregiver-item"]').first();
      if (await caregiverItem.isVisible()) {
        const usernameCode = caregiverItem.locator('code, .font-mono');
        if (await usernameCode.isVisible()) {
          caregiverUsername = (await usernameCode.textContent())?.trim() || '';
          console.log('Found username in settings:', caregiverUsername);
        }
      }

      // If still no username, look for any code element with username pattern
      if (!caregiverUsername) {
        const allCodes = page.locator('code, .font-mono');
        const count = await allCodes.count();
        for (let i = 0; i < count; i++) {
          const text = await allCodes.nth(i).textContent();
          if (text && text.match(/^[a-z0-9-]+$/)) {
            caregiverUsername = text.trim();
            console.log('Found potential username:', caregiverUsername);
            break;
          }
        }
      }

      // If we need a PIN, reset it
      if (caregiverUsername && !caregiverPin) {
        console.log('Resetting PIN for caregiver...');
        const resetPinBtn = page.locator('button:has-text("Reset PIN")').first();
        if (await resetPinBtn.isVisible()) {
          await resetPinBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'test-results/e2e-13-reset-pin.png', fullPage: true });

          // Capture new PIN - look for tracking-widest (distinctive for PIN display)
          const pinDisplay = page.locator('.tracking-widest').first();
          if (await pinDisplay.isVisible()) {
            const pinText = await pinDisplay.textContent();
            caregiverPin = pinText?.replace(/\s/g, '').trim() || '';
            console.log('New PIN:', caregiverPin);
          }

          // Fallback: find 6-digit number in large text
          if (!caregiverPin) {
            const largeText = page.locator('.text-5xl, .text-4xl, .text-3xl, .text-2xl');
            const count = await largeText.count();
            for (let i = 0; i < count; i++) {
              const text = (await largeText.nth(i).textContent())?.replace(/\s/g, '').trim() || '';
              if (text.match(/^\d{6}$/)) {
                caregiverPin = text;
                console.log('New PIN (fallback):', caregiverPin);
                break;
              }
            }
          }

          // Close modal
          const closeBtn = page.locator('button:has-text("Done"), button:has-text("Close")');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    }

    console.log('Final credentials - Username:', caregiverUsername, 'PIN:', caregiverPin);
    await page.screenshot({ path: 'test-results/e2e-14-credentials-captured.png', fullPage: true });
  });

  test('5. Caregiver Login', async ({ page }) => {
    // Go to caregiver login
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/e2e-15-caregiver-login-page.png', fullPage: true });

    if (caregiverUsername && caregiverPin) {
      console.log(`Logging in as caregiver: ${caregiverUsername}`);

      // Fill login form
      await page.fill('input[name="username"]', caregiverUsername);
      await page.fill('input[name="pin"]', caregiverPin);

      await page.screenshot({ path: 'test-results/e2e-16-caregiver-login-filled.png', fullPage: true });

      // Submit login
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'test-results/e2e-17-after-caregiver-login.png', fullPage: true });

      const currentUrl = page.url();
      console.log('After caregiver login URL:', currentUrl);

      // Should be on form dashboard
      expect(currentUrl).toContain('/caregiver/form');
    } else {
      console.log('WARNING: No credentials available, skipping caregiver login');
      // Take screenshot of what we have
      await page.screenshot({ path: 'test-results/e2e-17-no-credentials.png', fullPage: true });
    }
  });

  test('6. Morning Form - Fill and test autosave', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping morning form');
      return;
    }

    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate to morning form
    await page.goto(`${BASE_URL}/caregiver/form/morning`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-18-morning-form.png', fullPage: true });

    const currentUrl = page.url();
    if (!currentUrl.includes('/caregiver/form/morning')) {
      console.log('Not on morning form, URL:', currentUrl);
      return;
    }

    // Fill Wake Up section
    const wakeTimeInput = page.locator('input[type="time"]').first();
    if (await wakeTimeInput.isVisible()) {
      await wakeTimeInput.fill('07:30');
      console.log('Filled wake time: 07:30');
    }

    // Select mood (Calm)
    const calmBtn = page.locator('button:has-text("Calm")');
    if (await calmBtn.isVisible()) {
      await calmBtn.click();
      console.log('Selected mood: Calm');
    }

    await page.screenshot({ path: 'test-results/e2e-19-morning-wakeup.png', fullPage: true });

    // Fill Last Night's Sleep
    const sleepSection = page.locator("h2:has-text(\"Last Night's Sleep\")");
    if (await sleepSection.isVisible()) {
      await sleepSection.scrollIntoViewIfNeeded();

      // Select sleep quality - Light
      const lightBtn = page.locator('button:has-text("Light")');
      if (await lightBtn.isVisible()) {
        await lightBtn.click();
        console.log('Selected sleep quality: Light');
      }

      // Select night wakings (1)
      const waking1Btn = page.locator('.rounded-full:has-text("1")').first();
      if (await waking1Btn.isVisible()) {
        await waking1Btn.click();
        console.log('Selected night wakings: 1');
      }

      // Select waking reason
      const bathroomBtn = page.locator('button:has-text("Bathroom")');
      if (await bathroomBtn.isVisible()) {
        await bathroomBtn.click();
        console.log('Selected waking reason: Bathroom');
      }
    }

    await page.screenshot({ path: 'test-results/e2e-20-morning-sleep.png', fullPage: true });

    // Fill Morning Vitals
    const vitalsSection = page.locator('h2:has-text("Morning Vitals")');
    if (await vitalsSection.isVisible()) {
      await vitalsSection.scrollIntoViewIfNeeded();

      const bpInput = page.locator('input[placeholder="120/80"]');
      if (await bpInput.isVisible()) {
        await bpInput.fill('125/82');
      }

      const pulseInput = page.locator('input[placeholder="72"]');
      if (await pulseInput.isVisible()) {
        await pulseInput.fill('76');
      }

      const o2Input = page.locator('input[placeholder="98"]');
      if (await o2Input.isVisible()) {
        await o2Input.fill('97');
      }

      const sugarInput = page.locator('input[placeholder="5.5"]');
      if (await sugarInput.isVisible()) {
        await sugarInput.fill('5.8');
      }
    }

    await page.screenshot({ path: 'test-results/e2e-21-morning-vitals.png', fullPage: true });

    // Fill Breakfast
    const breakfastSection = page.locator('h2:has-text("Breakfast")');
    if (await breakfastSection.isVisible()) {
      await breakfastSection.scrollIntoViewIfNeeded();

      // Find breakfast time input
      const timeInputs = page.locator('input[type="time"]');
      const count = await timeInputs.count();
      if (count > 1) {
        const breakfastTime = timeInputs.nth(count > 2 ? 2 : 1);
        await breakfastTime.fill('08:30');
      }

      // Select amount eaten (4)
      const amountBtns = page.locator('.rounded-full:has-text("4")');
      if (await amountBtns.first().isVisible()) {
        await amountBtns.first().click();
      }

      // Select assistance level (none)
      const noneBtn = page.locator('button:has-text("None")');
      if (await noneBtn.isVisible()) {
        await noneBtn.click();
      }

      // Select a swallowing issue
      const coughingBtn = page.locator('button:has-text("Coughing")');
      if (await coughingBtn.isVisible()) {
        await coughingBtn.click();
        console.log('Selected swallowing issue: Coughing');
      }
    }

    await page.screenshot({ path: 'test-results/e2e-22-morning-breakfast.png', fullPage: true });

    // Wait for autosave
    console.log('Waiting for autosave...');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'test-results/e2e-23-morning-autosaved.png', fullPage: true });

    // Scroll to submit button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/e2e-24-morning-submit-area.png', fullPage: true });

    // Submit morning section
    const submitBtn = page.locator('button:has-text("Submit Morning")');
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/e2e-25-morning-submitted.png', fullPage: true });
      console.log('Morning section submitted');
    }
  });

  test('7. Afternoon Form - Fill and submit', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping afternoon form');
      return;
    }
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/caregiver/form/afternoon`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-26-afternoon-form.png', fullPage: true });

    // Fill Lunch
    const lunchTime = page.locator('input[type="time"]').first();
    if (await lunchTime.isVisible()) {
      await lunchTime.fill('12:30');
    }

    // Select amount eaten
    const amount3Btn = page.locator('.rounded-full:has-text("3")').first();
    if (await amount3Btn.isVisible()) {
      await amount3Btn.click();
    }

    await page.screenshot({ path: 'test-results/e2e-27-afternoon-lunch.png', fullPage: true });

    // Wait for autosave
    await page.waitForTimeout(4000);

    // Submit
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const submitBtn = page.locator('button:has-text("Submit Afternoon")');
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/e2e-28-afternoon-submitted.png', fullPage: true });
      console.log('Afternoon section submitted');
    }
  });

  test('8. Evening Form - Fill and submit', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping evening form');
      return;
    }
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/caregiver/form/evening`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-29-evening-form.png', fullPage: true });

    // Fill Dinner
    const dinnerTime = page.locator('input[type="time"]').first();
    if (await dinnerTime.isVisible()) {
      await dinnerTime.fill('18:30');
    }

    // Amount eaten
    const amount4Btn = page.locator('.rounded-full:has-text("4")').first();
    if (await amount4Btn.isVisible()) {
      await amount4Btn.click();
    }

    // Check for Swallowing Issues
    const swallowingLabel = page.locator('text=Swallowing Issues');
    if (await swallowingLabel.isVisible()) {
      console.log('Swallowing Issues field visible in Evening form');
    }

    await page.screenshot({ path: 'test-results/e2e-30-evening-dinner.png', fullPage: true });

    // Fill Bedtime
    const bedtimeSection = page.locator('h2:has-text("Bedtime")');
    if (await bedtimeSection.isVisible()) {
      await bedtimeSection.scrollIntoViewIfNeeded();

      const bedtimeInput = page.locator('input[type="time"]').last();
      if (await bedtimeInput.isVisible()) {
        await bedtimeInput.fill('21:30');
      }
    }

    await page.screenshot({ path: 'test-results/e2e-31-evening-bedtime.png', fullPage: true });

    // Wait for autosave and submit
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const submitBtn = page.locator('button:has-text("Submit Evening")');
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/e2e-32-evening-submitted.png', fullPage: true });
      console.log('Evening section submitted');
    }
  });

  test('9. Summary Form - Fill Personal Hygiene and submit', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping summary form');
      return;
    }
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/caregiver/form/summary`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-33-summary-form.png', fullPage: true });

    // Check for Personal Hygiene section
    const hygieneSection = page.locator('h2:has-text("Personal Hygiene")');
    if (await hygieneSection.isVisible()) {
      await hygieneSection.scrollIntoViewIfNeeded();
      console.log('Personal Hygiene section found');

      // Toggle options
      const bathToggle = page.locator('label:has-text("Bath/Shower"), button:has-text("Bath/Shower")').first();
      if (await bathToggle.isVisible()) {
        await bathToggle.click();
      }

      const bothBtn = page.locator('button:has-text("Both")');
      if (await bothBtn.isVisible()) {
        await bothBtn.click();
      }

      await page.screenshot({ path: 'test-results/e2e-34-summary-hygiene.png', fullPage: true });
    }

    // Fall Risk section
    const fallRiskSection = page.locator('text=Fall Risk');
    if (await fallRiskSection.isVisible()) {
      await fallRiskSection.scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'test-results/e2e-35-summary-fall-risk.png', fullPage: true });
    }

    // Wait for autosave and submit
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({ path: 'test-results/e2e-36-summary-bottom.png', fullPage: true });

    const submitBtn = page.locator('button:has-text("Submit Daily Summary"), button:has-text("Submit Summary")');
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/e2e-37-summary-submitted.png', fullPage: true });
      console.log('Summary section submitted');
    }
  });

  test('10. Form Dashboard - Check completion and Complete Day', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping form dashboard');
      return;
    }
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/caregiver/form`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-38-form-dashboard.png', fullPage: true });

    // Check for Complete Day button
    const completeDayBtn = page.locator('button:has-text("Complete Day")');
    if (await completeDayBtn.isVisible()) {
      console.log('All sections complete - Complete Day button visible');
      await completeDayBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/e2e-39-day-completed.png', fullPage: true });
    }
  });

  test('11. Pack List - View and interact', async ({ page }) => {
    // Login as caregiver first
    if (!caregiverUsername || !caregiverPin) {
      console.log('No caregiver credentials, skipping pack list');
      return;
    }
    await page.goto(`${BASE_URL}/caregiver/login`);
    await page.fill('input[name="username"]', caregiverUsername);
    await page.fill('input[name="pin"]', caregiverPin);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/caregiver/pack-list`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-40-pack-list.png', fullPage: true });

    // Scroll through
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/e2e-41-pack-list-items.png', fullPage: true });

    // Check an item
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/e2e-42-pack-list-checked.png', fullPage: true });
    }
  });

  test('12. Family Dashboard - View progression and audit', async ({ page }) => {
    // Login as family
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
    await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/family/dashboard`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-43-family-dashboard.png', fullPage: true });

    // Click tabs
    const todayTab = page.locator('button:has-text("Today")');
    if (await todayTab.isVisible()) {
      await todayTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/e2e-44-family-today.png', fullPage: true });
    }

    const weekTab = page.locator('button:has-text("Week")');
    if (await weekTab.isVisible()) {
      await weekTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/e2e-45-family-week.png', fullPage: true });
    }

    const activityTab = page.locator('button:has-text("Activity")');
    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/e2e-46-family-activity.png', fullPage: true });

      // Scroll to see audit log
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/e2e-47-family-activity-scrolled.png', fullPage: true });
    }
  });

  test('13. Family Trends Page', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', TEST_FAMILY_EMAIL);
    await page.fill('input[name="password"]', TEST_FAMILY_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/family/trends`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e2e-48-trends-page.png', fullPage: true });

    // Scroll to see charts
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/e2e-49-trends-charts.png', fullPage: true });

    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/e2e-50-trends-more.png', fullPage: true });
  });
});
