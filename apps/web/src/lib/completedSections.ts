interface CompletedSection {
  submittedAt: string;
  submittedBy: string;
}

export interface NormalizedCompletedSections {
  morning?: CompletedSection;
  afternoon?: CompletedSection;
  evening?: CompletedSection;
  dailySummary?: CompletedSection;
}

export function normalizeCompletedSections(value: unknown): NormalizedCompletedSections {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return normalizeCompletedSections(JSON.parse(value));
    } catch {
      return {};
    }
  }

  if (typeof value !== 'object') {
    return {};
  }

  return value as NormalizedCompletedSections;
}
