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
}));

// Mock @anchor/database to bypass Drizzle ORM D1 calls in tests
vi.mock('@anchor/database', () => {
  // Store inserted values to return them properly
  let insertedValues: any = null;

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn((vals: any) => {
        // Capture inserted values
        insertedValues = {
          ...vals,
          id: vals.id || 'mock-id',
          createdAt: vals.createdAt || new Date(),
          updatedAt: vals.updatedAt || new Date(),
        };
        return {
          returning: vi.fn().mockReturnValue({
            get: vi.fn(async () => insertedValues),
            all: vi.fn().mockResolvedValue([insertedValues]),
          }),
        };
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn((vals: any) => {
        // Merge updated values with previous ones
        insertedValues = { ...insertedValues, ...vals };
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              get: vi.fn(async () => insertedValues),
            }),
          }),
        };
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({}),
        }),
      }),
    }),
  };

  return {
    createDbClient: vi.fn(() => mockDb),
  };
});

// Export mock environment for tests
export { mockEnv };
