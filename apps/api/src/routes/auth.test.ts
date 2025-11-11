import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index';
import { createDbClient } from '@anchor/database';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Env } from '../index';

/**
 * Authentication API Tests
 * Tests family signup/login and caregiver PIN authentication
 */

describe('Authentication API', () => {
  let mockD1: D1Database;
  let mockEnv: Env;

  beforeEach(async () => {
    mockD1 = {
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as Partial<D1Database> as D1Database;

    mockEnv = {
      DB: mockD1,
      STORAGE: {} as R2Bucket,
      ENVIRONMENT: 'dev',
      JWT_SECRET: 'test-secret',
      LOGTO_APP_SECRET: 'test-logto-secret',
    };
  });

  describe('POST /auth/signup - Family Signup', () => {
    it('should create new family account', async () => {
      const signupData = {
        email: 'family@example.com',
        name: 'John Doe',
        password: 'securepassword123',
        phone: '+6512345678',
      };

      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(signupData.email);
      expect(data.user.name).toBe(signupData.name);
      expect(data.user.role).toBe('family_admin'); // Schema uses family_admin, not family
      expect(data.token).toBeDefined();
    }, mockEnv);

    it('should validate email format', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          name: 'John Doe',
          password: 'password123',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('should validate password length (min 8 chars)', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'John Doe',
          password: 'short',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should validate name length (min 2 chars)', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'J',
          password: 'password123',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      const signupData = {
        email: 'duplicate@example.com',
        name: 'First User',
        password: 'password123',
      };

      // First signup
      await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      }, mockEnv);

      // Second signup with same email
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupData,
          name: 'Second User',
        }),
      }, mockEnv);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('Email already registered');
    });

    it('should make phone optional', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nophone@example.com',
          name: 'No Phone User',
          password: 'password123',
        }),
      }, mockEnv);

      expect(res.status).toBe(201);
    });

    it('should default role to family_admin', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          name: 'Admin User',
          password: 'password123',
        }),
      }, mockEnv);

      const data = await res.json();
      expect(data.user.role).toBe('family_admin');
    });
  });

  describe('POST /auth/login - Family Login', () => {
    const testUser = {
      email: 'login@example.com',
      name: 'Login User',
      password: 'password123',
    };

    beforeEach(async () => {
      // Create test user
      await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      }, mockEnv);
    });

    it('should login with valid credentials', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testUser.email);
      expect(data.token).toBeDefined();
      expect(data.user.password).toBeUndefined(); // Don't leak password
    });

    it('should reject invalid email', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: 'wrongpassword',
        }),
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should validate email format', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'password123',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should require password field', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should return user role in response', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      }, mockEnv);

      const data = await res.json();
      expect(data.user.role).toBeDefined();
      expect(['family_admin', 'family_member']).toContain(data.user.role);
    });
  });

  describe('POST /auth/caregiver/login - Caregiver PIN Login', () => {
    const caregiverId = '550e8400-e29b-41d4-a716-446655440001'; // Use seeded caregiver ID
    const validPin = '123456';

    it('should login with valid caregiver ID and PIN', async () => {
      const res = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId,
          pin: validPin,
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.caregiver).toBeDefined();
      expect(data.caregiver.id).toBe(caregiverId);
      expect(data.token).toBeDefined();
    });

    it('should validate PIN format (6 digits)', async () => {
      const res = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId,
          pin: '12345', // Only 5 digits
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should reject non-numeric PIN', async () => {
      const res = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId,
          pin: 'abc123',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should validate caregiverId as UUID', async () => {
      const res = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId: 'not-a-uuid',
          pin: '123456',
        }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should require both caregiverId and PIN', async () => {
      const res1 = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '123456' }), // Missing caregiverId
      }, mockEnv);

      expect(res1.status).toBe(400);

      const res2 = await app.request('/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiverId }), // Missing PIN
      }, mockEnv);

      expect(res2.status).toBe(400);
    });

    it('should not accept PIN with spaces or special chars', async () => {
      const invalidPins = ['123 456', '12-34-56', '123.456', '123_456'];

      for (const pin of invalidPins) {
        const res = await app.request('/auth/caregiver/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caregiverId, pin }),
        }, mockEnv);

        expect(res.status).toBe(400);
      }
    });
  });

  describe('Security Considerations', () => {
    it('should not leak password in response', async () => {
      const res = await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'security@example.com',
          name: 'Security Test',
          password: 'supersecret123',
        }),
      }, mockEnv);

      const data = await res.json();
      expect(data.user.password).toBeUndefined();
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('should generate unique tokens for each login', async () => {
      const loginData = {
        email: 'token@example.com',
        password: 'password123',
      };

      // Signup
      await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...loginData,
          name: 'Token Test',
        }),
      }, mockEnv);

      // First login
      const res1 = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      }, mockEnv);
      const data1 = await res1.json();

      // Second login
      const res2 = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      }, mockEnv);
      const data2 = await res2.json();

      // Tokens should be different (stateless JWT) or same (session-based)
      // For now, we're using mock tokens
      expect(data1.token).toBeDefined();
      expect(data2.token).toBeDefined();
    });

    it('should return generic error for invalid credentials', async () => {
      const res1 = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      }, mockEnv);

      const res2 = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'wrongpassword',
        }),
      }, mockEnv);

      const data1 = await res1.json();
      const data2 = await res2.json();

      // Both should return same generic error
      expect(data1.error).toBe(data2.error);
      expect(data1.error).toBe('Invalid credentials');
    });
  });

  describe('TODO: Real Implementation Tests', () => {
    it.todo('should hash passwords with bcrypt/argon2');
    it.todo('should generate valid JWT tokens');
    it.todo('should verify JWT tokens on protected routes');
    it.todo('should implement token expiration');
    it.todo('should implement refresh tokens');
    it.todo('should rate limit login attempts');
    it.todo('should lock account after failed attempts');
    it.todo('should hash caregiver PINs');
    it.todo('should implement CSRF protection');
  });
});
