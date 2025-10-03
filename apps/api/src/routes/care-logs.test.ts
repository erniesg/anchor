import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index';
import { createDbClient } from '@anchor/database';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Care Logs API Tests
 * Tests CRUD operations, draft/submit workflow, and RBAC enforcement
 */

describe('Care Logs API', () => {
  let db: ReturnType<typeof createDbClient>;
  let mockD1: D1Database;
  let familyAdminToken: string;
  let familyMemberToken: string;
  let caregiverToken: string;
  let careRecipientId: string;
  let caregiverId: string;

  beforeEach(async () => {
    // Mock D1 database
    mockD1 = {
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as any;

    db = createDbClient(mockD1);

    // Setup test data
    familyAdminToken = 'mock-token-family-admin';
    familyMemberToken = 'mock-token-family-member';
    caregiverToken = 'mock-token-caregiver';
    careRecipientId = 'recipient-123';
    caregiverId = 'caregiver-123';
  });

  describe('POST /care-logs - Create Draft', () => {
    it('should create a care log as draft (caregiver only)', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-03',
        wakeTime: '07:30',
        mood: 'alert',
        showerTime: '08:00',
        hairWash: true,
        medications: [
          {
            name: 'Glucophage 500mg',
            given: true,
            time: '08:15',
            timeSlot: 'before_breakfast',
          },
        ],
        meals: {
          breakfast: {
            time: '09:00',
            appetite: 4,
            amountEaten: 80,
            swallowingIssues: [],
          },
        },
        bloodPressure: '120/80',
        pulseRate: 72,
        oxygenLevel: 98,
        bloodSugar: 110,
        vitalsTime: '09:30',
        toileting: {
          bowelFrequency: 1,
          urineFrequency: 5,
          diaperChanges: 3,
          accidents: '',
          assistance: 'partial',
          pain: 'none',
        },
        emergencyFlag: false,
        notes: 'Patient had a good morning',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe('draft');
      expect(data.wakeTime).toBe('07:30');
      expect(data.mood).toBe('alert');
      expect(data.emergencyFlag).toBe(false);
    });

    it('should reject care log creation without caregiver auth', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careRecipientId, logDate: '2025-10-03' }),
      });

      expect(res.status).toBe(401);
    });

    it('should reject care log creation by family members', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ careRecipientId, logDate: '2025-10-03' }),
      });

      expect(res.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ logDate: '2025-10-03' }), // Missing careRecipientId
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should validate medication schema', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          medications: [{ name: 'Test', given: true }], // Missing timeSlot
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should auto-save and preserve draft status', async () => {
      const res1 = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          wakeTime: '07:30',
        }),
      });

      expect(res1.status).toBe(201);
      const log1 = await res1.json();
      expect(log1.status).toBe('draft');

      // Auto-save update (simulated)
      const res2 = await app.request(`/care-logs/${log1.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          wakeTime: '07:45', // Updated time
        }),
      });

      expect(res2.status).toBe(200);
      const log2 = await res2.json();
      expect(log2.status).toBe('draft'); // Still draft
      expect(log2.wakeTime).toBe('07:45');
    });
  });

  describe('POST /care-logs/:id/submit - Submit Workflow', () => {
    let draftLogId: string;

    beforeEach(async () => {
      // Create a draft log first
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          wakeTime: '07:30',
        }),
      });
      const log = await res.json();
      draftLogId = log.id;
    });

    it('should submit draft care log (caregiver only)', async () => {
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Care log submitted successfully');
    });

    it('should lock submitted log (immutable)', async () => {
      // Submit the log
      await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      // Try to update submitted log
      const res = await app.request(`/care-logs/${draftLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ wakeTime: '08:00' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('submitted');
    });

    it('should reject submission by family members', async () => {
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('should reject double submission', async () => {
      // First submission
      await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      // Second submission attempt
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Only draft logs can be submitted');
    });
  });

  describe('POST /care-logs/:id/invalidate - Invalidation Workflow', () => {
    let submittedLogId: string;

    beforeEach(async () => {
      // Create and submit a log
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          wakeTime: '07:30',
        }),
      });
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      submittedLogId = log.id;
    });

    it('should invalidate submitted log (family_admin only)', async () => {
      const res = await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Incorrect wake time recorded' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Care log has been invalidated');
    });

    it('should reject invalidation by family_member', async () => {
      const res = await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyMemberToken}`,
        },
        body: JSON.stringify({ reason: 'Wrong data' }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject invalidation by caregiver', async () => {
      const res = await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ reason: 'My mistake' }),
      });

      expect(res.status).toBe(403);
    });

    it('should require invalidation reason', async () => {
      const res = await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({}), // Missing reason
      });

      expect(res.status).toBe(400);
    });

    it('should allow caregiver to edit after invalidation', async () => {
      // Invalidate log
      await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Incorrect data' }),
      });

      // Caregiver should be able to edit
      const res = await app.request(`/care-logs/${submittedLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ wakeTime: '08:00' }),
      });

      expect(res.status).toBe(200);
      const log = await res.json();
      expect(log.status).toBe('draft'); // Reverts to draft
      expect(log.wakeTime).toBe('08:00');
    });
  });

  describe('GET /care-logs/recipient/:recipientId - Family Access', () => {
    it('should return submitted logs only (family members)', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const logs = await res.json();
      expect(Array.isArray(logs)).toBe(true);
      logs.forEach((log: any) => {
        expect(log.status).toBe('submitted');
      });
    });

    it('should hide draft logs from family members', async () => {
      // Create draft log
      await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          wakeTime: '07:30',
        }),
      });

      // Family member tries to view
      const res = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      const logs = await res.json();
      const draftLogs = logs.filter((log: any) => log.status === 'draft');
      expect(draftLogs.length).toBe(0);
    });

    it('should reject unauthorized access', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: {},
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /care-logs/recipient/:recipientId/today - Today\'s Log', () => {
    it('should return today\'s submitted log', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create and submit today's log
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: today,
          wakeTime: '07:30',
        }),
      });
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      // Fetch today's log
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const todayLog = await res.json();
      expect(todayLog.logDate).toContain(today);
      expect(todayLog.status).toBe('submitted');
    });

    it('should return null if no log for today', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const todayLog = await res.json();
      expect(todayLog).toBeNull();
    });
  });

  describe('GET /care-logs/recipient/:recipientId/date/:date - Date-Specific Log', () => {
    it('should return log for specific date', async () => {
      const targetDate = '2025-10-01';

      // Create and submit log for target date
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: targetDate,
          wakeTime: '07:30',
        }),
      });
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      // Fetch log by date
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/date/${targetDate}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const dateLog = await res.json();
      expect(dateLog.logDate).toContain(targetDate);
    });

    it('should return null for date with no log', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/date/2025-01-01`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(200);
      const log = await res.json();
      expect(log).toBeNull();
    });
  });

  describe('Emergency Flags', () => {
    it('should create care log with emergency flag', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          emergencyFlag: true,
          emergencyNote: 'Patient had a fall',
        }),
      });

      expect(res.status).toBe(201);
      const log = await res.json();
      expect(log.emergencyFlag).toBe(true);
      expect(log.emergencyNote).toBe('Patient had a fall');
    });

    it('should trigger alert notification (TODO)', async () => {
      // TODO: Test alert creation when emergency flag is set
      // This will be implemented in Phase 3
    });
  });

  describe('JSON Field Parsing', () => {
    it('should parse medications JSON correctly', async () => {
      const medications = [
        { name: 'Med1', given: true, time: '08:00', timeSlot: 'before_breakfast' },
        { name: 'Med2', given: false, time: null, timeSlot: 'after_dinner' },
      ];

      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          medications,
        }),
      });

      const log = await createRes.json();
      const submitRes = await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      const fetchRes = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      const logs = await fetchRes.json();
      const fetchedLog = logs.find((l: any) => l.id === log.id);
      expect(fetchedLog.medications).toEqual(medications);
    });

    it('should parse meals JSON correctly', async () => {
      const meals = {
        breakfast: { time: '08:00', appetite: 4, amountEaten: 80, swallowingIssues: [] },
        lunch: { time: '12:00', appetite: 3, amountEaten: 60, swallowingIssues: ['coughing'] },
      };

      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
          meals,
        }),
      });

      const log = await createRes.json();
      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      });

      const fetchRes = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      const fetchedLog = await fetchRes.json();
      expect(fetchedLog.meals).toEqual(meals);
    });
  });

  describe('RBAC Permission Checks', () => {
    it('should enforce caregiver ownership', async () => {
      const otherCaregiverToken = 'mock-token-other-caregiver';

      // Create log with one caregiver
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: '2025-10-03',
        }),
      });
      const log = await createRes.json();

      // Try to submit with different caregiver
      const res = await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${otherCaregiverToken}` },
      });

      expect(res.status).toBe(403);
    });

    it('should enforce care recipient access', async () => {
      const otherRecipientId = 'other-recipient-123';

      const res = await app.request(`/care-logs/recipient/${otherRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      });

      expect(res.status).toBe(403);
    });
  });
});
