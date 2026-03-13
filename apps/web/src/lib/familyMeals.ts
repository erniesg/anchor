import { appetiteLevelToPercent, persistedMealValueToAppetiteLevel } from '@/lib/mealScales';

export interface FamilyMealSlot {
  time?: string;
  appetite?: number;
  amountEaten?: number;
  assistance?: string;
  swallowingIssues?: string[];
}

export interface FamilyMealsData {
  breakfast?: FamilyMealSlot;
  lunch?: FamilyMealSlot;
  teaBreak?: FamilyMealSlot;
  dinner?: FamilyMealSlot;
  foodPreferences?: string;
  foodRefusals?: string;
}

export interface RecordedMeal extends FamilyMealSlot {
  key: 'breakfast' | 'lunch' | 'teaBreak' | 'dinner';
  label: string;
  appetiteLevel: number | null;
  amountPercent: number | null;
}

const MEAL_SLOTS: Array<{ key: RecordedMeal['key']; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'teaBreak', label: 'Tea Break' },
  { key: 'dinner', label: 'Dinner' },
];

function normalizeAmountPercent(meal?: FamilyMealSlot): number | null {
  if (!meal) {
    return null;
  }

  if (typeof meal.amountEaten === 'number' && !Number.isNaN(meal.amountEaten)) {
    return meal.amountEaten > 5 ? meal.amountEaten : appetiteLevelToPercent(meal.amountEaten);
  }

  if (typeof meal.appetite === 'number' && !Number.isNaN(meal.appetite)) {
    return appetiteLevelToPercent(meal.appetite);
  }

  return null;
}

function normalizeAppetiteLevel(meal?: FamilyMealSlot): number | null {
  if (!meal) {
    return null;
  }

  if (typeof meal.appetite === 'number' && !Number.isNaN(meal.appetite)) {
    return meal.appetite;
  }

  if (typeof meal.amountEaten === 'number' && !Number.isNaN(meal.amountEaten)) {
    return persistedMealValueToAppetiteLevel(meal.amountEaten);
  }

  return null;
}

export function getRecordedMeals(meals?: FamilyMealsData): RecordedMeal[] {
  if (!meals) {
    return [];
  }

  return MEAL_SLOTS.flatMap(({ key, label }) => {
    const meal = meals[key];
    if (!meal) {
      return [];
    }

    return [{
      ...meal,
      key,
      label,
      appetiteLevel: normalizeAppetiteLevel(meal),
      amountPercent: normalizeAmountPercent(meal),
    }];
  });
}

export function summarizeMeals(meals?: FamilyMealsData): {
  averageAppetite: number | null;
  averageAmountPercent: number | null;
  recordedMeals: number;
} | null {
  const recordedMeals = getRecordedMeals(meals);

  if (recordedMeals.length === 0) {
    return null;
  }

  const appetiteValues = recordedMeals
    .map((meal) => meal.appetiteLevel)
    .filter((value): value is number => value !== null);
  const amountValues = recordedMeals
    .map((meal) => meal.amountPercent)
    .filter((value): value is number => value !== null);

  return {
    averageAppetite: appetiteValues.length > 0
      ? Math.round((appetiteValues.reduce((sum, value) => sum + value, 0) / appetiteValues.length) * 10) / 10
      : null,
    averageAmountPercent: amountValues.length > 0
      ? Math.round(amountValues.reduce((sum, value) => sum + value, 0) / amountValues.length)
      : null,
    recordedMeals: recordedMeals.length,
  };
}
