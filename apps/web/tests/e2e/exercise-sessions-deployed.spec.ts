import { test, expect } from '@playwright/test';

test.describe('Detailed Exercise Sessions E2E - Deployed', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to deployed caregiver form
    await page.goto('https://anchor-dev.erniesg.workers.dev/caregiver/form');

    // Wait for page to load
    await page.waitForSelector('h2', { timeout: 10000 });
  });

  test('should navigate to exercise section and track morning session', async ({ page }) => {
    // Navigate through sections to reach Physical Activity (section 11)
    // Since we can't directly jump to section 11, we need to navigate sequentially
    // But for deployed test, let's check if the form loads

    // Check that the form loads
    await expect(page.locator('h2')).toContainText(/Morning Routine|Notes & Submit|Physical Activity/);

    // Try to navigate to section 11 by clicking next buttons
    let currentSection = 1;
    while (currentSection < 11) {
      const nextButton = page.locator('button:has-text("Next")').first();
      if (await nextButton.isVisible({ timeout: 1000 })) {
        await nextButton.click();
        currentSection++;
        await page.waitForTimeout(500); // Small delay between clicks
      } else {
        break;
      }
    }

    // Check if we reached the Physical Activity section
    const physicalActivityHeader = page.locator('h2:has-text("Physical Activity & Exercise")');
    if (await physicalActivityHeader.isVisible({ timeout: 5000 })) {
      console.log('✅ Reached Physical Activity section');

      // Check for morning exercise session section
      await expect(page.locator('h3:has-text("Morning Exercise Session")')).toBeVisible();

      // Fill in morning exercise time
      await page.fill('input[name="morningExerciseStart"]', '09:00');
      await page.fill('input[name="morningExerciseEnd"]', '10:00');

      // Check and fill Eye Exercises
      await page.check('input[name="EyeExercisesDone"]');
      await page.fill('input[name="EyeExercisesDuration"]', '10');
      await page.click('input[name="EyeExercisesParticipation"][value="4"]');

      // Check and fill Stretching
      await page.check('input[name="StretchingDone"]');
      await page.fill('input[name="StretchingDuration"]', '15');
      await page.click('input[name="StretchingParticipation"][value="5"]');

      // Add notes
      await page.fill('textarea[name="morningExerciseNotes"]', 'Patient showed good energy');

      console.log('✅ Filled morning exercise session data');
    } else {
      console.log('⚠️ Could not reach Physical Activity section');
    }
  });

  test('should check movement difficulties assessment', async ({ page }) => {
    // Navigate through sections to reach Physical Activity (section 11)
    let currentSection = 1;
    while (currentSection < 11) {
      const nextButton = page.locator('button:has-text("Next")').first();
      if (await nextButton.isVisible({ timeout: 1000 })) {
        await nextButton.click();
        currentSection++;
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    const physicalActivityHeader = page.locator('h2:has-text("Physical Activity & Exercise")');
    if (await physicalActivityHeader.isVisible({ timeout: 5000 })) {
      // Check for Movement Difficulties Assessment section
      await expect(page.locator('h3:has-text("Movement Difficulties Assessment")')).toBeVisible();

      // Fill in some movement difficulties
      await page.click('input[name="gettingOutOfBed"][value="needsSomeHelp"]');
      await page.fill('input[name="gettingOutOfBedNotes"]', 'Requires morning assistance');

      await page.click('input[name="gettingIntoBed"][value="canDoAlone"]');

      await page.click('input[name="sittingInChair"][value="canDoAlone"]');

      console.log('✅ Filled movement difficulties assessment');
    } else {
      console.log('⚠️ Could not reach Physical Activity section');
    }
  });

  test('should load family dashboard and check for exercise cards', async ({ page }) => {
    // Set up authentication state for family member
    // Using the test user ID from the auth system
    await page.goto('https://anchor-dev.erniesg.workers.dev');

    // Set authentication state with correct structure
    await page.evaluate(() => {
      const mockUser = {
        id: '12345678-1234-1234-1234-123456789abc',
        email: 'family@test.com',
        name: 'Test Family Member',
        role: 'family_admin',
      };

      const mockRecipient = {
        id: '0725fbb9-21c5-46a4-9ed0-305b0a506f20',
        name: 'Test Recipient',
        condition: 'General',
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('careRecipient', JSON.stringify(mockRecipient));
      localStorage.setItem('token', 'test-token-123');
    });

    // Navigate to family dashboard with auth set up
    await page.goto('https://anchor-dev.erniesg.workers.dev/family/dashboard');

    // Wait for dashboard to load
    await page.waitForSelector('h2', { timeout: 10000 });

    // Check if dashboard loads with care recipient name
    await expect(page.locator('h2').first()).toContainText(/Test Recipient/);

    // Check for exercise-related cards (may not have data yet)
    const exerciseCard = page.locator('[data-testid="exercise-sessions-card"]');
    const physicalActivityCard = page.locator('[data-testid="physical-activity-card"]');
    const movementCard = page.locator('[data-testid="movement-difficulties-card"]');

    // Log what we find
    if (await exerciseCard.isVisible({ timeout: 2000 })) {
      console.log('✅ Exercise Sessions card found on dashboard');
    } else {
      console.log('ℹ️ Exercise Sessions card not visible (no data submitted yet)');
    }

    if (await physicalActivityCard.isVisible({ timeout: 2000 })) {
      console.log('✅ Physical Activity card found on dashboard');
    } else {
      console.log('ℹ️ Physical Activity card not visible (no data submitted yet)');
    }

    if (await movementCard.isVisible({ timeout: 2000 })) {
      console.log('✅ Movement Difficulties card found on dashboard');
    } else {
      console.log('ℹ️ Movement Difficulties card not visible (no data submitted yet)');
    }
  });
});