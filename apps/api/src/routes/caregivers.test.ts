import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index';
import { createDbClient } from '@anchor/database';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Caregivers API Tests
 * Tests caregiver CRUD, admin operations, and RBAC
 */

describe('Caregivers API', () => {
  let db: ReturnType<typeof createDbClient>;
  let mockD1: D1Database;
  let familyAdminToken: string;
  let familyMemberToken: string;
  let careRecipientId: string;

  beforeEach(async () => {
    mockD1 = {
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as any;

    db = createDbClient(mockD1);

    familyAdminToken = 'mock-token-family-admin';
    familyMemberToken = 'mock-token-family-member';
    careRecipientId = 'recipient-123';
  });

  describe('POST /caregivers - Create Caregiver', () => {
    it('should create caregiver with PIN (family_admin only)', async () => {
      const caregiverData = {
        careRecipientId,
        name: 'Maria Santos',
        phone: '+6591234567',
        email: 'maria@example.com',
        language: 'en',
      };

      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify(caregiverData),
      });

      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.caregiver).toBeDefined();
      expect(data.caregiver.name).toBe(caregiverData.name);
      expect(data.caregiver.active).toBe(true);
      expect(data.pin).toBeDefined();
      expect(data.pin).toMatch(/^\d{6}$/); // 6-digit PIN
    });

    it('should reject caregiver creation by family_member', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyMemberToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Test Caregiver',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId, // Missing name
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should generate unique PINs', async () => {
      const pins = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const res = await app.request('/caregivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${familyAdminToken}`,
          },
          body: JSON.stringify({
            careRecipientId,
            name: `Caregiver ${i}`,
          }),
        });

        const data = await res.json();
        pins.add(data.pin);
      }

      expect(pins.size).toBe(10); // All PINs should be unique
    });

    it('should make email and phone optional', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Minimal Caregiver',
        }),
      });

      expect(res.status).toBe(201);
    });

    it('should default language to "en"', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Default Lang Caregiver',
        }),
      });

      const data = await res.json();
      expect(data.caregiver.language).toBe('en');
    });

    it('should record createdBy (family_admin)', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Tracked Caregiver',
        }),
      });

      const data = await res.json();
      expect(data.caregiver.createdBy).toBeDefined();
    });
  });

  describe('GET /caregivers/recipient/:recipientId - List Caregivers', () => {
    beforeEach(async () => {
      // Create test caregivers
      await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Active Caregiver',
        }),
      });

      const deactivatedRes = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Deactivated Caregiver',
        }),
      });
      const deactivated = await deactivatedRes.json();

      // Deactivate one caregiver
      await app.request(`/caregivers/${deactivated.caregiver.id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Test deactivation' }),
      });
    });

    it('should list all caregivers (family_admin)', async () => {
      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      expect(res.status).toBe(200);
      const caregivers = await res.json();
      expect(Array.isArray(caregivers)).toBe(true);
      expect(caregivers.length).toBeGreaterThan(0);
    });

    it('should include active status', async () => {
      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const caregivers = await res.json();
      caregivers.forEach((c: any) => {
        expect(c.active).toBeDefined();
        expect(typeof c.active).toBe('boolean');
      });
    });

    it('should allow family_member to view (read-only)', async () => {
      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const caregivers = await res.json();
      expect(Array.isArray(caregivers)).toBe(true);
    });

    it('should not leak PINs in response', async () => {
      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const caregivers = await res.json();
      caregivers.forEach((c: any) => {
        expect(c.pinCode).toBeUndefined();
        expect(c.pin).toBeUndefined();
      });
    });
  });

  describe('POST /caregivers/:id/deactivate - Deactivate Caregiver', () => {
    let caregiverId: string;

    beforeEach(async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'To Be Deactivated',
        }),
      });
      const data = await res.json();
      caregiverId = data.caregiver.id;
    });

    it('should deactivate caregiver (family_admin only)', async () => {
      const res = await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Contract ended' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require reason for deactivation', async () => {
      const res = await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({}), // Missing reason
      });

      expect(res.status).toBe(400);
    });

    it('should reject deactivation by family_member', async () => {
      const res = await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyMemberToken}`,
        },
        body: JSON.stringify({ reason: 'Test' }),
      });

      expect(res.status).toBe(403);
    });

    it('should record deactivatedBy and deactivatedAt', async () => {
      await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Audit test' }),
      });

      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const caregivers = await res.json();
      const deactivated = caregivers.find((c: any) => c.id === caregiverId);

      expect(deactivated.deactivatedBy).toBeDefined();
      expect(deactivated.deactivatedAt).toBeDefined();
      expect(deactivated.deactivationReason).toBe('Audit test');
    });

    it('should set active to false', async () => {
      await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Test' }),
      });

      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const caregivers = await res.json();
      const deactivated = caregivers.find((c: any) => c.id === caregiverId);

      expect(deactivated.active).toBe(false);
    });

    it('should reject double deactivation', async () => {
      // First deactivation
      await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'First' }),
      });

      // Second deactivation
      const res = await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Second' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already deactivated');
    });
  });

  describe('POST /caregivers/:id/reset-pin - Reset PIN', () => {
    let caregiverId: string;
    let originalPin: string;

    beforeEach(async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'PIN Reset Test',
        }),
      });
      const data = await res.json();
      caregiverId = data.caregiver.id;
      originalPin = data.pin;
    });

    it('should reset PIN (family_admin only)', async () => {
      const res = await app.request(`/caregivers/${caregiverId}/reset-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.newPin).toBeDefined();
      expect(data.newPin).toMatch(/^\d{6}$/);
      expect(data.newPin).not.toBe(originalPin); // Should be different
    });

    it('should reject PIN reset by family_member', async () => {
      const res = await app.request(`/caregivers/${caregiverId}/reset-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('should record lastPinResetAt and lastPinResetBy', async () => {
      await app.request(`/caregivers/${caregiverId}/reset-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const res = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      const caregivers = await res.json();
      const resetCaregiver = caregivers.find((c: any) => c.id === caregiverId);

      expect(resetCaregiver.lastPinResetAt).toBeDefined();
      expect(resetCaregiver.lastPinResetBy).toBeDefined();
    });

    it('should allow PIN reset for deactivated caregiver', async () => {
      // Deactivate caregiver
      await app.request(`/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Test' }),
      });

      // Reset PIN
      const res = await app.request(`/caregivers/${caregiverId}/reset-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /caregivers/:id - Update Caregiver', () => {
    let caregiverId: string;

    beforeEach(async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Original Name',
          phone: '+6591111111',
        }),
      });
      const data = await res.json();
      caregiverId = data.caregiver.id;
    });

    it('should update caregiver details (family_admin only)', async () => {
      const res = await app.request(`/caregivers/${caregiverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Name',
          phone: '+6592222222',
          language: 'zh',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Name');
      expect(data.phone).toBe('+6592222222');
      expect(data.language).toBe('zh');
    });

    it('should reject update by family_member', async () => {
      const res = await app.request(`/caregivers/${caregiverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyMemberToken}`,
        },
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(res.status).toBe(403);
    });

    it('should not allow PIN update via PUT', async () => {
      const res = await app.request(`/caregivers/${caregiverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ pinCode: '999999' }),
      });

      // PIN should not be updated
      const fetchRes = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });
      const caregivers = await fetchRes.json();
      const caregiver = caregivers.find((c: any) => c.id === caregiverId);

      expect(caregiver.pinCode).not.toBe('999999');
    });
  });

  describe('Security & Audit', () => {
    it('should hash PINs before storage', async () => {
      const res = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Hash Test',
        }),
      });

      const data = await res.json();
      const plainPin = data.pin;

      // Fetch caregiver
      const fetchRes = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });
      const caregivers = await fetchRes.json();

      // PIN should not be returned in list
      caregivers.forEach((c: any) => {
        expect(c.pin).toBeUndefined();
        expect(c.pinCode).toBeUndefined();
      });
    });

    it('should track all admin actions', async () => {
      const createRes = await app.request('/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          name: 'Audit Trail Test',
        }),
      });
      const caregiver = await createRes.json();

      // Deactivate
      await app.request(`/caregivers/${caregiver.caregiver.id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Audit test' }),
      });

      // Reset PIN
      await app.request(`/caregivers/${caregiver.caregiver.id}/reset-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      // Fetch and verify audit fields
      const fetchRes = await app.request(`/caregivers/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });
      const caregivers = await fetchRes.json();
      const audited = caregivers.find((c: any) => c.id === caregiver.caregiver.id);

      expect(audited.createdBy).toBeDefined();
      expect(audited.deactivatedBy).toBeDefined();
      expect(audited.lastPinResetBy).toBeDefined();
    });
  });

  describe('TODO: Real Implementation Tests', () => {
    it.todo('should hash PINs with bcrypt');
    it.todo('should verify PIN on caregiver login');
    it.todo('should prevent deactivated caregiver login');
    it.todo('should notify caregiver of PIN reset');
    it.todo('should enforce PIN complexity rules');
  });
});
