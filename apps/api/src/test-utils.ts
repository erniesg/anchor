import { vi } from 'vitest';
import type { Env } from './index';

/**
 * Test Utilities
 * Helpers for mocking Cloudflare Workers environment
 */

export function createMockEnv(): Env {
  const mockDB = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      get: vi.fn().mockResolvedValue(null),
    }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ results: [] }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };

  const mockStorage = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    head: vi.fn().mockResolvedValue(null),
  };

  return {
    DB: mockDB as unknown as Env['DB'],
    STORAGE: mockStorage as unknown as Env['STORAGE'],
    ENVIRONMENT: 'dev',
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    LOGTO_APP_SECRET: 'test-logto-secret',
  };
}

export function createTestRequest(
  path: string,
  options: RequestInit = {}
): Request {
  const url = `http://localhost${path}`;
  return new Request(url, options);
}
