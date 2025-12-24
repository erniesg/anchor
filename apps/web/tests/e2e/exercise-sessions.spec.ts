import { test, expect } from '@playwright/test';

test.describe('Detailed Exercise Sessions E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to caregiver form
    await page.goto('/caregiver/form');

    // Navigate to Physical Activity section (id: 11)
    await page.getByRole('button', { name: /Physical Activity/i }).click();
  });

  test('should track morning exercise session with all exercise types', async ({ page }) => {
    // Test data based on template pages 5-6
    const exerciseTypes = [
      'Eye Exercises',
      'Arm/Shoulder Strengthening',
      'Leg Strengthening',
      'Balance Training',
      'Stretching',
      'Arm Pedalling (Cycling)',
      'Leg Pedalling (Cycling)',
      'Physiotherapist Exercises'
    ];

    // Morning Exercise Session
    await expect(page.locator('h3:has-text("Morning Exercise Session")')).toBeVisible();

    // Set time range
    await page.fill('input[name="morningExerciseStart"]', '09:00');
    await page.fill('input[name="morningExerciseEnd"]', '10:00');

    // Test each exercise type
    for (const exercise of exerciseTypes) {
      const exerciseName = exercise.replace(/[^a-zA-Z]/g, '');

      // Check the "Done" checkbox
      await page.check(`input[name="${exerciseName}Done"]`);

      // Enter duration
      await page.fill(`input[name="${exerciseName}Duration"]`, '10');

      // Select participation level (1-5 scale)
      await page.click(`input[name="${exerciseName}Participation"][value="4"]`);
    }

    // Add exercise notes
    await page.fill('textarea[name="morningExerciseNotes"]', 'Patient showed good energy and completed most exercises');

    // Submit form
    await page.click('button:has-text("Submit Report")');

    // Verify success
    await expect(page.locator('text=Report submitted successfully')).toBeVisible({ timeout: 10000 });
    console.log('✅ Morning exercise session test passed');
  });

  test('should track afternoon exercise session separately', async ({ page }) => {
    // Afternoon Exercise Session
    await expect(page.locator('h3:has-text("Afternoon Exercise Session")')).toBeVisible();

    // Set time range
    await page.fill('input[name="afternoonExerciseStart"]', '14:00');
    await page.fill('input[name="afternoonExerciseEnd"]', '14:45');

    // Test partial participation
    const selectedExercises = ['EyeExercises', 'Stretching', 'BalanceTraining'];

    for (const exercise of selectedExercises) {
      await page.check(`input[name="${exercise}AfternoonDone"]`);
      await page.fill(`input[name="${exercise}AfternoonDuration"]`, '15');
      await page.click(`input[name="${exercise}AfternoonParticipation"][value="3"]`);
    }

    // Add notes about limited participation
    await page.fill('textarea[name="afternoonExerciseNotes"]', 'Patient was tired, did only light exercises');

    // Submit form
    await page.click('button:has-text("Submit Report")');

    // Verify success
    await expect(page.locator('text=Report submitted successfully')).toBeVisible({ timeout: 10000 });
    console.log('✅ Afternoon exercise session test passed');
  });

  test('should track movement difficulties assessment', async ({ page }) => {
    // Movement Difficulties Assessment table from template page 5
    const activities = [
      { name: 'gettingOutOfBed', label: 'Getting out of bed' },
      { name: 'gettingIntoBed', label: 'Getting into bed' },
      { name: 'sittingInChair', label: 'Sitting down in chair' },
      { name: 'gettingUpFromChair', label: 'Getting up from chair' },
      { name: 'gettingInCar', label: 'Getting in car' },
      { name: 'gettingOutOfCar', label: 'Getting out of car' }
    ];

    await expect(page.locator('h3:has-text("Movement Difficulties Assessment")')).toBeVisible();

    for (const activity of activities) {
      // Select difficulty level: Can Do Alone, Needs Some Help, Needs Full Help, Falls/Drops Hard
      const difficultyLevel = Math.floor(Math.random() * 4);
      const levels = ['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard'];

      await page.click(`input[name="${activity.name}"][value="${levels[difficultyLevel]}"]`);

      // Add notes for activities with difficulties
      if (difficultyLevel > 0) {
        await page.fill(`input[name="${activity.name}Notes"]`, 'Requires assistance');
      }
    }

    // Submit form
    await page.click('button:has-text("Submit Report")');

    // Verify success
    await expect(page.locator('text=Report submitted successfully')).toBeVisible({ timeout: 10000 });
    console.log('✅ Movement difficulties assessment test passed');
  });

  test('should validate participation scale (1-5)', async ({ page }) => {
    // Try to enter invalid participation value
    await page.check('input[name="EyeExercisesDone"]');
    await page.fill('input[name="EyeExercisesDuration"]', '10');

    // Participation scale should only allow 1-5
    const invalidValues = ['0', '6', '-1'];
    for (const value of invalidValues) {
      await page.fill('input[name="EyeExercisesParticipation"]', value);
      await page.click('button:has-text("Submit Report")');

      // Should show validation error
      await expect(page.locator('text=/Participation must be between 1 and 5/i')).toBeVisible();
    }

    // Valid value should work
    await page.click('input[name="EyeExercisesParticipation"][value="3"]');
    await page.click('button:has-text("Submit Report")');

    // Should not show error for valid value
    await expect(page.locator('text=/Participation must be between 1 and 5/i')).not.toBeVisible();
    console.log('✅ Participation scale validation test passed');
  });

  test('should display exercise data on family dashboard', async ({ page }) => {
    // First submit exercise data as caregiver
    await page.fill('input[name="morningExerciseStart"]', '09:00');
    await page.fill('input[name="morningExerciseEnd"]', '10:00');

    // Add some exercises
    await page.check('input[name="EyeExercisesDone"]');
    await page.fill('input[name="EyeExercisesDuration"]', '10');
    await page.click('input[name="EyeExercisesParticipation"][value="4"]');

    await page.check('input[name="StretchingDone"]');
    await page.fill('input[name="StretchingDuration"]', '15');
    await page.click('input[name="StretchingParticipation"][value="5"]');

    await page.click('button:has-text("Submit Report")');
    await expect(page.locator('text=Report submitted successfully')).toBeVisible({ timeout: 10000 });

    // Navigate to family dashboard
    await page.goto('/family/dashboard');

    // Check exercise card is displayed
    await expect(page.locator('h3:has-text("Exercise Sessions")')).toBeVisible();

    // Verify morning session details
    await expect(page.locator('text=Morning: 09:00 - 10:00')).toBeVisible();
    await expect(page.locator('text=Eye Exercises (10 min)')).toBeVisible();
    await expect(page.locator('text=Stretching (15 min)')).toBeVisible();

    // Check participation indicators
    await expect(page.locator('text=Participation: Good')).toBeVisible(); // Average of 4 and 5

    console.log('✅ Dashboard display test passed');
  });
});