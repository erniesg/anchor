import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index';
import { createDbClient } from '@anchor/database';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../index';

/**
 * Care Logs API Tests
 * Tests CRUD operations, draft/submit workflow, and RBAC enforcement
 */

describe('Care Logs API', () => {
  let db: ReturnType<typeof createDbClient>;
  let mockD1: D1Database;
  let mockEnv: Env;
  let familyAdminToken: string;
  let familyMemberToken: string;
  let caregiverToken: string;
  let careRecipientId: string;
  let caregiverId: string;

  beforeEach(async () => {
    // Note: Database is already set up in test-setup.ts with fresh data per test
    // No need to clearTestData() - beforeEach in test-setup.ts handles it

    // Mock D1 database (for compatibility with Env interface)
    mockD1 = {
      prepare: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as any;

    mockEnv = {
      DB: mockD1,
      STORAGE: {} as any,
      ENVIRONMENT: 'dev',
      JWT_SECRET: 'test-secret',
      LOGTO_APP_SECRET: 'test-logto-secret',
    };

    db = createDbClient(mockD1); // Returns testDb from test-setup.ts

    // Setup test data references (actual data seeded in test-setup.ts)
    familyAdminToken = 'mock-token-family-admin';
    familyMemberToken = 'mock-token-family-member';
    caregiverToken = 'mock-token-caregiver';
    careRecipientId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
    caregiverId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID
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
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      expect(res.status).toBe(401); // Caregiver auth required
    });

    it('should validate required fields', async () => {
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ logDate: '2025-10-03' }), // Missing careRecipientId
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      expect(res1.status).toBe(201);
      const log1 = await res1.json();
      expect(log1.status).toBe('draft');

      // Auto-save update (simulated)
      const res2 = await app.request(`/care-logs/${log1.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          wakeTime: '07:45', // Updated time
        }),
      }, mockEnv);

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
      }, mockEnv);
      const log = await res.json();
      draftLogId = log.id;
    });

    it('should submit draft care log (caregiver only)', async () => {
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

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
      }, mockEnv);

      // Try to update submitted log
      const res = await app.request(`/care-logs/${draftLogId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ wakeTime: '08:00' }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('draft'); // Error message is "Can only update draft logs"
    });

    it('should reject submission by family members', async () => {
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${familyAdminToken}` },
      }, mockEnv);

      expect(res.status).toBe(401); // Caregiver auth required
    });

    it('should reject double submission', async () => {
      // First submission
      await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      // Second submission attempt
      const res = await app.request(`/care-logs/${draftLogId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

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
      }, mockEnv);
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      expect(res.status).toBe(401); // Family admin auth required
    });

    it('should require invalidation reason', async () => {
      const res = await app.request(`/care-logs/${submittedLogId}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${familyAdminToken}`,
        },
        body: JSON.stringify({}), // Missing reason
      }, mockEnv);

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
      }, mockEnv);

      // Caregiver should be able to edit
      const res = await app.request(`/care-logs/${submittedLogId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({ wakeTime: '08:00' }),
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      // Family member tries to view
      const res = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      const logs = await res.json();
      const draftLogs = logs.filter((log: any) => log.status === 'draft');
      expect(draftLogs.length).toBe(0);
    });

    it('should reject unauthorized access', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: {},
      }, mockEnv);

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
      }, mockEnv);
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      // Fetch today's log
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const todayLog = await res.json();
      expect(todayLog.logDate).toContain(today);
      expect(todayLog.status).toBe('submitted');
    });

    it('should return null if no log for today', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

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
      }, mockEnv);
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      // Fetch log by date
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/date/${targetDate}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const dateLog = await res.json();
      expect(dateLog.logDate).toContain(targetDate);
    });

    it('should return null for date with no log', async () => {
      const res = await app.request(`/care-logs/recipient/${careRecipientId}/date/2025-01-01`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      const log = await createRes.json();
      const submitRes = await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      const fetchRes = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

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
      }, mockEnv);

      const log = await createRes.json();
      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      const fetchRes = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

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
      }, mockEnv);
      const log = await createRes.json();

      // Try to submit with different caregiver
      const res = await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${otherCaregiverToken}` },
      }, mockEnv);

      expect(res.status).toBe(403);
    });

    it('should enforce care recipient access', async () => {
      const otherRecipientId = 'other-recipient-123';

      const res = await app.request(`/care-logs/recipient/${otherRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      expect(res.status).toBe(403);
    });
  });

  describe('Sprint 1: Fall Risk Assessment', () => {
    it('should accept valid fall risk data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        // Sprint 1: Fall Risk fields
        balanceIssues: 3,
        nearFalls: 'once_or_twice',
        actualFalls: 'none',
        walkingPattern: ['shuffling', 'slow'],
        freezingEpisodes: 'mild',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.balanceIssues).toBe(3);
      expect(data.nearFalls).toBe('once_or_twice');
      expect(data.actualFalls).toBe('none');
      expect(data.walkingPattern).toEqual(['shuffling', 'slow']);
      expect(data.freezingEpisodes).toBe('mild');
    });

    it('should validate balance issues range (1-5)', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        balanceIssues: 6, // Invalid: out of range
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should validate nearFalls enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        nearFalls: 'invalid_value',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should validate actualFalls enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        actualFalls: 'invalid',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should log major fall alert to console', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');

      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        actualFalls: 'major', // Should trigger alert
        balanceIssues: 5,
        walkingPattern: ['stumbling', 'cannot_lift_feet'],
      };

      await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MAJOR FALL ALERT'),
        expect.anything()
      );

      consoleLogSpy.mockRestore();
    });

    it('should accept valid unaccompanied time data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        wakeTime: '07:00',
        mood: 'calm',
        unaccompaniedTime: [
          {
            startTime: '14:00',
            endTime: '14:30',
            reason: 'Emergency break',
            replacementPerson: 'Family member',
            durationMinutes: 30,
            notes: '',
          },
        ],
        unaccompaniedIncidents: '',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      if (res.status !== 201) {
        const error = await res.json();
        console.log('Validation error:', JSON.stringify(error, null, 2));
      }

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.unaccompaniedTime).toHaveLength(1);
      expect(data.unaccompaniedTime[0].durationMinutes).toBe(30);
    });

    it('should validate time period start < end', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [
          {
            startTime: '14:30',  // Invalid: start after end
            endTime: '14:00',
            reason: 'Break',
            replacementPerson: 'Sister',
            durationMinutes: -30,
            notes: '',
          },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error.error).toBe('Validation failed');
      const errorMessage = error.details.map((d: any) => d.message).join(' ');
      expect(errorMessage).toContain('Start time must be before end time');
    });

    it('should validate duration is positive', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [
          {
            startTime: '14:00',
            endTime: '14:30',
            reason: 'Break',
            replacementPerson: 'Sister',
            durationMinutes: -10,  // Invalid
            notes: '',
          },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error.error).toBe('Validation failed');
      const errorMessage = error.details.map((d: any) => d.message).join(' ');
      expect(errorMessage).toContain('Duration must be positive');
    });

    it('should require reason when time period added', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [
          {
            startTime: '14:00',
            endTime: '14:30',
            reason: '',  // Invalid: empty
            replacementPerson: 'Sister',
            durationMinutes: 30,
            notes: '',
          },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error.error).toBe('Validation failed');
      const errorMessage = error.details.map((d: any) => d.message).join(' ');
      expect(errorMessage).toContain('Reason');
    });

    it('should accept empty unaccompanied time array', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [],  // Valid: never left alone
        unaccompaniedIncidents: '',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
    });

    it('should calculate total unaccompanied time', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [
          {
            startTime: '10:00',
            endTime: '10:30',
            reason: 'Break 1',
            replacementPerson: 'Sister',
            durationMinutes: 30,
            notes: '',
          },
          {
            startTime: '15:00',
            endTime: '15:45',
            reason: 'Break 2',
            replacementPerson: 'Nephew',
            durationMinutes: 45,
            notes: '',
          },
        ],
        unaccompaniedIncidents: '',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.totalUnaccompaniedMinutes).toBe(75);  // 30 + 45
    });

    it('should accept incidents report', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        unaccompaniedTime: [
          {
            startTime: '14:00',
            endTime: '14:30',
            reason: 'Emergency leave',
            replacementPerson: 'Neighbor',
            durationMinutes: 30,
            notes: 'Called replacement immediately',
          },
        ],
        unaccompaniedIncidents: 'Care recipient tried to get up alone but replacement person assisted',
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.unaccompaniedIncidents).toBe(careLogData.unaccompaniedIncidents);
    });

    it('should accept safety checks and emergency prep data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-06',
        safetyChecks: {
          tripHazards: { checked: true, action: 'removed' },
          cables: { checked: true, action: 'secured' },
        },
        emergencyPrep: {
          icePack: true,
          wheelchair: true,
          commode: true,
        },
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.safetyChecks.tripHazards.checked).toBe(true);
      expect(data.emergencyPrep.wheelchair).toBe(true);
    });
  });

  describe('Sprint 2 Day 1: Fluid Intake Monitoring', () => {
    it('should accept valid fluid entries', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          {
            name: 'Glucerna Milk',
            time: '08:30',
            amountMl: 250,
            swallowingIssues: [],
          },
          {
            name: 'Plain Water',
            time: '10:00',
            amountMl: 150,
            swallowingIssues: [],
          },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fluids).toHaveLength(2);
      expect(data.fluids[0].name).toBe('Glucerna Milk');
      expect(data.fluids[0].amountMl).toBe(250);
    });

    it('should auto-calculate total fluid intake', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          { name: 'Moringa Water', time: '08:00', amountMl: 200, swallowingIssues: [] },
          { name: 'Orange Juice', time: '10:00', amountMl: 150, swallowingIssues: [] },
          { name: 'Plain Water', time: '14:00', amountMl: 100, swallowingIssues: [] },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.totalFluidIntake).toBe(450); // Auto-calculated: 200 + 150 + 100
    });

    it('should validate fluid amount is positive', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          { name: 'Water', time: '10:00', amountMl: -100, swallowingIssues: [] },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error.error).toBe('Validation failed');
      expect(JSON.stringify(error.details)).toContain('positive');
    });

    it('should require fluid name when entry added', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          { name: '', time: '10:00', amountMl: 100, swallowingIssues: [] },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error.error).toBe('Validation failed');
      expect(JSON.stringify(error.details)).toContain('required');
    });

    it('should accept empty fluids array', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fluids).toEqual([]);
      expect(data.totalFluidIntake).toBe(0);
    });

    it('should track swallowing issues per fluid', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          {
            name: 'Glucerna Milk',
            time: '08:30',
            amountMl: 250,
            swallowingIssues: ['coughing', 'slow'],
          },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fluids[0].swallowingIssues).toEqual(['coughing', 'slow']);
    });

    it('should add low fluid warning flag when intake <1000ml', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          { name: 'Water', time: '08:00', amountMl: 300, swallowingIssues: [] },
          { name: 'Juice', time: '12:00', amountMl: 200, swallowingIssues: [] },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.totalFluidIntake).toBe(500);
      expect(data.lowFluidWarning).toBe(true); // Dehydration risk
    });

    it('should not add warning flag when intake >=1000ml', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-07',
        fluids: [
          { name: 'Water', time: '08:00', amountMl: 500, swallowingIssues: [] },
          { name: 'Juice', time: '12:00', amountMl: 300, swallowingIssues: [] },
          { name: 'Milk', time: '16:00', amountMl: 250, swallowingIssues: [] },
        ],
      };

      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify(careLogData),
      }, mockEnv);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.totalFluidIntake).toBe(1050);
      expect(data.lowFluidWarning).toBe(false);
    });
  });
});
