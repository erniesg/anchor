import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, runMigrations, seedTestData } from './test/db-helper';

/**
 * Test Setup
 * Global test configuration using real in-memory SQLite database
 *
 * Architecture:
 * - better-sqlite3 in-memory database (real SQLite, not mocks)
 * - Drizzle ORM for queries (same API as production)
 * - Fresh database per test for isolation
 *
 * Based on Drizzle community best practices (2025)
 */

// Global test database instance
let testDb: any;
let testSqlite: any;

// Mock Cloudflare environment (for D1 interface compatibility)
const mockEnv = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    batch: vi.fn(),
    exec: vi.fn(),
    dump: vi.fn(),
  },
  STORAGE: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  },
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret-key',
  LOGTO_APP_SECRET: 'test-logto-secret',
};

// Global setup
beforeAll(() => {
  // Set environment variables
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.ENVIRONMENT = 'test';
  process.env.NODE_ENV = 'test';
});

// Create fresh database for each test
beforeEach(() => {
  const { db, sqlite } = createTestDb();
  testDb = db;
  testSqlite = sqlite;

  // Apply schema
  runMigrations(sqlite);

  // Seed test data
  seedTestData(db);
});

// Clean up after each test
afterEach(() => {
  testSqlite?.close();
  testDb = null;
  testSqlite = null;
});

// Mock fetch for external API calls
global.fetch = vi.fn() as any;

// Mock crypto.randomUUID with incremental IDs for test predictability
let mockIdCounter = 0;
beforeEach(() => {
  mockIdCounter = Date.now(); // Reset counter for each test
});

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => `mock-id-${mockIdCounter++}`),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hash'),
    })),
  },
  writable: true,
});

// Mock hono/jwt for tests
vi.mock('hono/jwt', () => ({
  verify: vi.fn(async (token: string, secret: string) => {
    // Mock JWT verification based on token prefix
    if (token.startsWith('mock-token-family-admin')) {
      return {
        sub: 'user-123',
        role: 'family_admin',
      };
    } else if (token.startsWith('mock-token-family-member')) {
      return {
        sub: 'user-456',
        role: 'family_member',
      };
    } else if (token.startsWith('mock-token-other-caregiver')) {
      return {
        caregiverId: 'caregiver-999', // Different caregiver
        careRecipientId: 'recipient-999',
      };
    } else if (token.startsWith('mock-token-caregiver')) {
      return {
        caregiverId: '550e8400-e29b-41d4-a716-446655440001', // Matches seeded caregiver
        careRecipientId: '550e8400-e29b-41d4-a716-446655440000', // Matches seeded recipient
      };
    }
    throw new Error('Invalid JWT token');
  }),
  sign: vi.fn(async (payload: any, secret: string) => {
    return 'mock-jwt-token';
  }),
}));

// Mock access control functions
vi.mock('./lib/access-control', () => ({
  isActiveUser: vi.fn(async () => true),
  isActiveCaregiver: vi.fn(async () => true),
  caregiverHasAccess: vi.fn(async () => true),
  // Context-aware: reject if different caregiver (caregiver-999)
  caregiverOwnsCareLog: vi.fn(async (db: any, caregiverId: string, logId: string) => {
    return caregiverId !== 'caregiver-999';
  }),
  // Context-aware: reject if recipientId is 'other-recipient-123'
  canAccessCareRecipient: vi.fn(async (db: any, userId: string, recipientId: string) => {
    return recipientId !== 'other-recipient-123';
  }),
  canInvalidateCareLog: vi.fn(async () => true),
  canManageCaregivers: vi.fn(async () => true),
  getAccessibleCareRecipients: vi.fn(async (db: any, userId: string) => [
    { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Test Recipient' }
  ]),
  canGrantAccess: vi.fn(async () => true),
  canRevokeAccess: vi.fn(async () => true),
}));

// Mock @anchor/database to return real in-memory SQLite database
vi.mock('@anchor/database', () => ({
  createDbClient: vi.fn(() => testDb),
}));

// Export mock environment for tests
export { mockEnv };
