import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, runMigrations, seedTestData } from './test/db-helper';
import { sign } from 'hono/jwt';

/**
 * Test Setup
 * Global test configuration using real in-memory SQLite database
 *
 * Architecture:
 * - better-sqlite3 in-memory database (real SQLite, not mocks)
 * - Drizzle ORM for queries (same API as production)
 * - Fresh database per test for isolation
 * - Real JWT tokens signed with test secret (no mock interception needed)
 *
 * Based on Drizzle community best practices (2025)
 */

// Consistent JWT secret used across test setup, mockEnv, and token generation
const TEST_JWT_SECRET = 'test-secret-key';

// Global test database instance
let testDb: unknown;
let testSqlite: { close: () => void } | null;

// Pre-generated JWT tokens (populated in beforeAll)
let generatedTokens: {
  familyAdmin: string;
  familyMember: string;
  caregiver: string;
  otherCaregiver: string;
};

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
  JWT_SECRET: TEST_JWT_SECRET,
  LOGTO_APP_SECRET: 'test-logto-secret',
};

// Global setup - generate real JWT tokens once
beforeAll(async () => {
  // Set environment variables
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.ENVIRONMENT = 'test';
  process.env.NODE_ENV = 'test';

  // Generate real JWT tokens signed with the test secret
  const exp = Math.floor(Date.now() / 1000) + 86400; // 24h expiry

  generatedTokens = {
    familyAdmin: await sign(
      { sub: 'user-123', role: 'family_admin', iat: Math.floor(Date.now() / 1000), exp },
      TEST_JWT_SECRET
    ),
    familyMember: await sign(
      { sub: 'user-456', role: 'family_member', iat: Math.floor(Date.now() / 1000), exp },
      TEST_JWT_SECRET
    ),
    caregiver: await sign(
      {
        caregiverId: '550e8400-e29b-41d4-a716-446655440001',
        careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Caregiver',
        iat: Math.floor(Date.now() / 1000),
        exp,
      },
      TEST_JWT_SECRET
    ),
    otherCaregiver: await sign(
      {
        caregiverId: 'caregiver-999',
        careRecipientId: 'recipient-999',
        name: 'Other Caregiver',
        iat: Math.floor(Date.now() / 1000),
        exp,
      },
      TEST_JWT_SECRET
    ),
  };
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
global.fetch = vi.fn() as typeof fetch;

// Mock crypto.randomUUID while preserving crypto.subtle for JWT verification
let mockIdCounter = 0;
beforeEach(() => {
  mockIdCounter = Date.now(); // Reset counter for each test
});

// Preserve the native crypto.subtle - hono/jwt needs it for HMAC verification
const nativeCrypto = (globalThis as typeof globalThis & {
  crypto: Record<string, unknown> & { subtle: unknown };
}).crypto;
Object.defineProperty(global, 'crypto', {
  value: {
    ...nativeCrypto,
    subtle: nativeCrypto.subtle,
    randomUUID: vi.fn(() => `mock-id-${mockIdCounter++}`),
  },
  writable: true,
});

// No need to mock hono/jwt - we use real JWTs signed with the test secret
// The real verify() function will validate them properly

// NOTE: vi.mock for access-control is done in individual test files (not here)
// because vitest's vi.mock hoisting doesn't reliably intercept ESM imports
// when declared in setup files. Each test file must declare its own vi.mock().

// Mock @anchor/database to return real in-memory SQLite database
vi.mock('@anchor/database', () => ({
  createDbClient: vi.fn(() => testDb),
}));

// Helper to get test tokens (for use in test files)
function getTestTokens() {
  return generatedTokens;
}

// Export mock environment and token helper for tests
export { mockEnv, getTestTokens };
