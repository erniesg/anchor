/**
 * Username Generator
 * Generates memorable, easy-to-type usernames in format: adjective-animal-number
 * Example: "happy-panda-42", "brave-tiger-17", "calm-dolphin-88"
 */

// Simple, positive adjectives (easy to pronounce in multiple languages)
const ADJECTIVES = [
  'happy', 'brave', 'calm', 'kind', 'wise',
  'swift', 'bright', 'warm', 'cool', 'gentle',
  'bold', 'smart', 'keen', 'quick', 'steady',
  'sunny', 'lucky', 'merry', 'jolly', 'lively',
  'strong', 'sweet', 'pure', 'soft', 'light',
];

// Common, friendly animals (recognizable globally)
const ANIMALS = [
  'panda', 'tiger', 'eagle', 'dolphin', 'owl',
  'lion', 'bear', 'fox', 'wolf', 'deer',
  'rabbit', 'koala', 'otter', 'seal', 'swan',
  'hawk', 'crane', 'dove', 'finch', 'robin',
  'turtle', 'whale', 'shark', 'salmon', 'crab',
];

/**
 * Generate a random username in format: adjective-animal-number
 */
export function generateUsername(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 100); // 0-99

  return `${adjective}-${animal}-${number.toString().padStart(2, '0')}`;
}

/**
 * Validate username format
 * Must be: lowercase letters, numbers, and hyphens only
 * Length: 5-30 characters
 */
export function isValidUsername(username: string): boolean {
  if (!username || username.length < 5 || username.length > 30) {
    return false;
  }
  // Only lowercase letters, numbers, and hyphens
  // Must start and end with letter/number (no leading/trailing hyphens)
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username);
}

/**
 * Normalize username (lowercase, trim)
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}
