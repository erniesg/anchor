import { beforeAll, vi } from 'vitest';

/**
 * Test Setup
 * Global test configuration and mocks
 */

// Mock Cloudflare environment
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

// Mock fetch for external API calls
global.fetch = vi.fn() as any;

// Mock crypto.randomUUID and crypto.createHash
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => `mock-uuid-${Math.random().toString(36).substring(7)}`),
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
        caregiverId: 'caregiver-123',
        careRecipientId: 'recipient-123',
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
  familyMemberHasAccess: vi.fn(async () => true),
  caregiverOwnsCareLog: vi.fn(async () => true),
  canAccessCareRecipient: vi.fn(async () => true),
  canInvalidateCareLog: vi.fn(async () => true),
}));

// Global test database store (cleared in test beforeEach)
const testDataStore: Map<string, any> = new Map();

// Mock @anchor/database to bypass Drizzle ORM D1 calls in tests
vi.mock('@anchor/database', () => {
  // Reference the global testDataStore
  const dataStore = testDataStore;

  const mockDb = {
    // INSERT operation
    insert: vi.fn().mockReturnValue({
      values: vi.fn((vals: any) => {
        // Capture inserted values with defaults
        const record = {
          ...vals,
          id: vals.id || `mock-id-${Date.now()}`,
          createdAt: vals.createdAt || new Date(),
          updatedAt: vals.updatedAt || new Date(),
        };

        // Store in mock database
        dataStore.set(record.id, record);

        return {
          returning: vi.fn().mockReturnValue({
            get: vi.fn(async () => record),
            all: vi.fn().mockResolvedValue([record]),
          }),
        };
      }),
    }),

    // SELECT operation
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn((condition: any) => {
          // Return records from store
          // Since we can't parse SQL conditions, return most recent record for .get()
          // and all records for .all() (tests will filter if needed)
          const records = Array.from(dataStore.values());
          const mostRecent = records[records.length - 1] || null; // Last inserted

          return {
            get: vi.fn(async () => mostRecent),
            all: vi.fn(async () => records),
            orderBy: vi.fn(() => ({
              all: vi.fn(async () => records),
            })),
          };
        }),
        orderBy: vi.fn(() => ({
          all: vi.fn(async () => Array.from(dataStore.values())),
        })),
      }),
    }),

    // UPDATE operation
    update: vi.fn().mockReturnValue({
      set: vi.fn((vals: any) => {
        return {
          where: vi.fn((condition: any) => {
            // Update the first matching record in store
            const records = Array.from(dataStore.values());
            let updated = null;
            if (records.length > 0) {
              // Filter out undefined values from vals to avoid overwriting existing data
              const filteredVals = Object.fromEntries(
                Object.entries(vals).filter(([_, v]) => v !== undefined)
              );
              updated = { ...records[0], ...filteredVals, updatedAt: new Date() };
              dataStore.set(updated.id, updated);
            }

            // Create a thenable object that supports both patterns:
            // 1. await db.update().set().where()  (direct await)
            // 2. await db.update().set().where().returning().get()  (with returning)

            // Create a Promise that has .returning() method
            const promise = Promise.resolve(updated);
            (promise as any).returning = vi.fn().mockReturnValue({
              get: vi.fn(async () => updated),
            });
            return promise;
          }),
        };
      }),
    }),

    // DELETE operation
    delete: vi.fn().mockReturnValue({
      where: vi.fn((condition: any) => {
        // Remove from store
        const records = Array.from(dataStore.values());
        if (records.length > 0) {
          dataStore.delete(records[0].id);
          return {
            returning: vi.fn().mockReturnValue({
              get: vi.fn(async () => records[0]),
            }),
          };
        }
        return {
          returning: vi.fn().mockReturnValue({
            get: vi.fn(async () => null),
          }),
        };
      }),
    }),

  };

  return {
    createDbClient: vi.fn(() => mockDb),
  };
});

// Export helper to clear test data between tests
export const clearTestData = () => testDataStore.clear();

// Export mock environment for tests
export { mockEnv };
