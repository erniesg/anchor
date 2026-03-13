const appetiteToPercentMap: Record<number, number> = {
  1: 0,
  2: 25,
  3: 50,
  4: 75,
  5: 100,
};

export function appetiteLevelToPercent(level: number): number {
  return appetiteToPercentMap[level] ?? 50;
}

export function persistedMealValueToAppetiteLevel(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 3;
  }

  // Older frontend builds stored the 1-5 appetite scale in amountEaten.
  if (value >= 1 && value <= 5) {
    return Math.round(value);
  }

  if (value <= 10) return 1;
  if (value <= 37) return 2;
  if (value <= 62) return 3;
  if (value <= 87) return 4;
  return 5;
}
