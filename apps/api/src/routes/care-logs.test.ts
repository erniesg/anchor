import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Env } from '../index';

/**
 * Care Logs API Tests
 * Tests CRUD operations, draft/submit workflow, and RBAC enforcement
 */

describe('Care Logs API', () => {
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
    } as Partial<D1Database> as D1Database;

    mockEnv = {
      DB: mockD1,
      STORAGE: {} as R2Bucket,
      ENVIRONMENT: 'dev',
      JWT_SECRET: 'test-secret',
      LOGTO_APP_SECRET: 'test-logto-secret',
    };

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
      logs.forEach((log: { status: string }) => {
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
      const draftLogs = logs.filter((log: { status: string }) => log.status === 'draft');
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

  describe('GET /care-logs/caregiver/today - Caregiver Draft Loading', () => {
    it('should return today\'s draft log for caregiver', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create a draft log
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
          mood: 'alert',
          meals: {
            breakfast: { time: '08:00', appetite: 4, amountEaten: 75 },
            lunch: { time: '12:30', appetite: 3, amountEaten: 60 },
          },
        }),
      }, mockEnv);
      expect(createRes.status).toBe(201);

      // Fetch caregiver's today draft
      const res = await app.request('/care-logs/caregiver/today', {
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const draft = await res.json();
      expect(draft).not.toBeNull();
      expect(draft.logDate).toContain(today);
      expect(draft.status).toBe('draft');
      expect(draft.wakeTime).toBe('07:30');
      expect(draft.mood).toBe('alert');
      expect(draft.meals.breakfast.time).toBe('08:00');
      expect(draft.meals.lunch.time).toBe('12:30');
    });

    it('should return null if no draft for today', async () => {
      const res = await app.request('/care-logs/caregiver/today', {
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const draft = await res.json();
      expect(draft).toBeNull();
    });

    it('should return submitted log if exists (not just drafts)', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create and submit a log
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: today,
          wakeTime: '07:00',
        }),
      }, mockEnv);
      const log = await createRes.json();

      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      // Fetch should still return the submitted log
      const res = await app.request('/care-logs/caregiver/today', {
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const todayLog = await res.json();
      expect(todayLog.status).toBe('submitted');
    });

    it('should reject non-caregiver access', async () => {
      const res = await app.request('/care-logs/caregiver/today', {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      // Family member tokens return 401 (Unauthorized) not 403 (Forbidden)
      expect(res.status).toBe(401);
    });

    it('should return all meal data including lunch, tea break, dinner', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create draft with all meals
      await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          logDate: today,
          meals: {
            breakfast: { time: '08:00', appetite: 4, amountEaten: 80 },
            lunch: { time: '12:30', appetite: 3, amountEaten: 70 },
            teaBreak: { time: '15:00', appetite: 2, amountEaten: 50 },
            dinner: { time: '18:30', appetite: 4, amountEaten: 85 },
            foodPreferences: 'Liked the soup',
            foodRefusals: 'Refused vegetables',
          },
        }),
      }, mockEnv);

      const res = await app.request('/care-logs/caregiver/today', {
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const draft = await res.json();
      expect(draft.meals.breakfast.time).toBe('08:00');
      expect(draft.meals.lunch.time).toBe('12:30');
      expect(draft.meals.teaBreak.time).toBe('15:00');
      expect(draft.meals.dinner.time).toBe('18:30');
      expect(draft.meals.foodPreferences).toBe('Liked the soup');
      expect(draft.meals.foodRefusals).toBe('Refused vegetables');
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
      await app.request(`/care-logs/${log.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${caregiverToken}` },
      }, mockEnv);

      const fetchRes = await app.request(`/care-logs/recipient/${careRecipientId}`, {
        headers: { Authorization: `Bearer ${familyMemberToken}` },
      }, mockEnv);

      const logs = await fetchRes.json();
      const fetchedLog = logs.find((l: { id: string }) => l.id === log.id);
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
      const errorMessage = error.details.map((d: { message: string }) => d.message).join(' ');
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
      const errorMessage = error.details.map((d: { message: string }) => d.message).join(' ');
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
      const errorMessage = error.details.map((d: { message: string }) => d.message).join(' ');
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

  describe('Sprint 2 Day 3: Sleep Tracking', () => {
    it('should accept valid afternoon rest data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        afternoonRest: {
          startTime: '14:00',
          endTime: '15:30',
          quality: 'deep' as const,
          notes: 'Slept peacefully',
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
      expect(data.afternoonRest).toEqual({
        startTime: '14:00',
        endTime: '15:30',
        quality: 'deep',
        notes: 'Slept peacefully',
      });
    });

    it('should accept valid night sleep data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        nightSleep: {
          bedtime: '21:00',
          quality: 'light' as const,
          wakings: 2,
          wakingReasons: ['toilet', 'pain'],
          behaviors: ['snoring', 'restless'],
          notes: 'Woke up twice during the night',
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
      expect(data.nightSleep).toEqual({
        bedtime: '21:00',
        quality: 'light',
        wakings: 2,
        wakingReasons: ['toilet', 'pain'],
        behaviors: ['snoring', 'restless'],
        notes: 'Woke up twice during the night',
      });
    });

    it('should validate afternoon rest quality enum', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        afternoonRest: {
          startTime: '14:00',
          endTime: '15:30',
          quality: 'invalid' as unknown as 'deep' | 'light' | 'restless' | 'no_sleep',
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

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('quality');
    });

    it('should validate night sleep wakings is non-negative', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        nightSleep: {
          bedtime: '21:00',
          quality: 'light' as const,
          wakings: -1,
          wakingReasons: [],
          behaviors: [],
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

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('wakings');
    });

    it('should accept both afternoon rest and night sleep', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        afternoonRest: {
          startTime: '14:00',
          endTime: '15:30',
          quality: 'deep' as const,
        },
        nightSleep: {
          bedtime: '21:00',
          quality: 'restless' as const,
          wakings: 3,
          wakingReasons: ['toilet', 'confusion', 'unknown'],
          behaviors: ['talking', 'mumbling', 'restless'],
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
      expect(data.afternoonRest).toBeDefined();
      expect(data.nightSleep).toBeDefined();
      expect(data.nightSleep.wakings).toBe(3);
      expect(data.nightSleep.wakingReasons).toHaveLength(3);
      expect(data.nightSleep.behaviors).toHaveLength(3);
    });

    it('should allow optional afternoon rest and night sleep', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
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
      expect(data.afternoonRest).toBeNull();
      expect(data.nightSleep).toBeNull();
    });

    it('should accept no_sleep quality for poor sleep', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        afternoonRest: {
          startTime: '14:00',
          endTime: '15:00',
          quality: 'no_sleep' as const,
          notes: 'Tried to rest but could not sleep',
        },
        nightSleep: {
          bedtime: '21:00',
          quality: 'no_sleep' as const,
          wakings: 0,
          wakingReasons: [],
          behaviors: ['restless', 'mumbling'],
          notes: 'Very restless, no actual sleep',
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
      expect(data.afternoonRest.quality).toBe('no_sleep');
      expect(data.nightSleep.quality).toBe('no_sleep');
    });
  });

  describe('Sprint 2 Day 4: Enhanced Medication Tracking', () => {
    it('should accept medications with purpose field', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          {
            name: 'Metformin 500mg',
            given: true,
            time: '08:00',
            timeSlot: 'before_breakfast' as const,
            purpose: 'Diabetes control',
          },
          {
            name: 'Atorvastatin 20mg',
            given: true,
            time: '20:00',
            timeSlot: 'after_dinner' as const,
            purpose: 'Cholesterol management',
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
      expect(data.medications).toHaveLength(2);
      expect(data.medications[0].purpose).toBe('Diabetes control');
      expect(data.medications[1].purpose).toBe('Cholesterol management');
    });

    it('should accept medications with notes field', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          {
            name: 'Metformin 500mg',
            given: true,
            time: '08:00',
            timeSlot: 'before_breakfast' as const,
            notes: 'Take with food to avoid stomach upset',
          },
          {
            name: 'Simvastatin 40mg',
            given: false,
            time: null,
            timeSlot: 'before_bedtime' as const,
            notes: 'Patient refused - said too tired',
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
      expect(data.medications[0].notes).toBe('Take with food to avoid stomach upset');
      expect(data.medications[1].notes).toBe('Patient refused - said too tired');
    });

    it('should calculate medication adherence percentage', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          { name: 'Med1', given: true, time: '08:00', timeSlot: 'before_breakfast' as const },
          { name: 'Med2', given: true, time: '09:00', timeSlot: 'after_breakfast' as const },
          { name: 'Med3', given: false, time: null, timeSlot: 'afternoon' as const },
          { name: 'Med4', given: true, time: '20:00', timeSlot: 'after_dinner' as const },
          { name: 'Med5', given: false, time: null, timeSlot: 'before_bedtime' as const },
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
      expect(data.medicationAdherence).toBeDefined();
      expect(data.medicationAdherence.total).toBe(5);
      expect(data.medicationAdherence.given).toBe(3);
      expect(data.medicationAdherence.missed).toBe(2);
      expect(data.medicationAdherence.percentage).toBe(60); // 3/5 = 60%
    });

    it('should handle 100% medication adherence', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          { name: 'Med1', given: true, time: '08:00', timeSlot: 'before_breakfast' as const },
          { name: 'Med2', given: true, time: '09:00', timeSlot: 'after_breakfast' as const },
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
      expect(data.medicationAdherence.percentage).toBe(100);
      expect(data.medicationAdherence.missed).toBe(0);
    });

    it('should handle 0% medication adherence', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          { name: 'Med1', given: false, time: null, timeSlot: 'before_breakfast' as const },
          { name: 'Med2', given: false, time: null, timeSlot: 'after_breakfast' as const },
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
      expect(data.medicationAdherence.percentage).toBe(0);
      expect(data.medicationAdherence.missed).toBe(2);
    });

    it('should accept medications with both purpose and notes', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          {
            name: 'Metformin 500mg',
            given: true,
            time: '08:00',
            timeSlot: 'before_breakfast' as const,
            purpose: 'Type 2 Diabetes',
            notes: 'Patient tolerated well, no side effects',
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
      expect(data.medications[0].purpose).toBe('Type 2 Diabetes');
      expect(data.medications[0].notes).toBe('Patient tolerated well, no side effects');
    });

    it('should allow empty medications array with 0% adherence', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [],
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
      expect(data.medicationAdherence).toBeDefined();
      expect(data.medicationAdherence.total).toBe(0);
      expect(data.medicationAdherence.percentage).toBe(0);
    });

    it('should allow medication without purpose or notes (backward compatibility)', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: '2025-10-08',
        mood: 'alert' as const,
        medications: [
          {
            name: 'Aspirin 100mg',
            given: true,
            time: '08:00',
            timeSlot: 'before_breakfast' as const,
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
      expect(data.medications[0].name).toBe('Aspirin 100mg');
      expect(data.medications[0].purpose).toBeUndefined();
      expect(data.medications[0].notes).toBeUndefined();
    });
  });

  // Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
  describe('Sprint 2 Day 5: Complete Toileting & Hygiene Tracking', () => {
    it('should accept complete bowel movement data with all fields', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        bowelMovements: {
          frequency: 2,
          timesUsedToilet: 1,
          diaperChanges: 1,
          diaperStatus: 'soiled' as const,
          accidents: 'none' as const,
          assistance: 'partial' as const,
          pain: 'no_pain' as const,
          consistency: 'normal' as const,
          concerns: 'Regular bowel movement pattern',
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
      expect(data.bowelMovements).toBeDefined();
      expect(data.bowelMovements.frequency).toBe(2);
      expect(data.bowelMovements.consistency).toBe('normal');
      expect(data.bowelMovements.diaperStatus).toBe('soiled');
      expect(data.bowelMovements.concerns).toBe('Regular bowel movement pattern');
    });

    it('should accept complete urination data with all fields', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        urination: {
          frequency: 6,
          timesUsedToilet: 5,
          diaperChanges: 2,
          diaperStatus: 'wet' as const,
          accidents: 'minor' as const,
          assistance: 'full' as const,
          pain: 'some_pain' as const,
          urineColor: 'yellow' as const,
          concerns: 'Slight discomfort during urination',
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
      expect(data.urination).toBeDefined();
      expect(data.urination.frequency).toBe(6);
      expect(data.urination.urineColor).toBe('yellow');
      expect(data.urination.pain).toBe('some_pain');
      expect(data.urination.concerns).toBe('Slight discomfort during urination');
    });

    it('should validate bowel movement consistency enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        bowelMovements: {
          frequency: 1,
          consistency: 'invalid_value' as unknown as 'normal' | 'hard' | 'soft' | 'diarrhea',
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

      expect(res.status).toBe(400);
    });

    it('should validate urination color enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        urination: {
          frequency: 3,
          urineColor: 'invalid_color' as unknown as 'light_clear' | 'yellow' | 'dark',
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

      expect(res.status).toBe(400);
    });

    it('should validate accidents enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        bowelMovements: {
          frequency: 1,
          accidents: 'invalid' as unknown as 'none' | 'minor' | 'major',
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

      expect(res.status).toBe(400);
    });

    it('should accept both bowel movements and urination together', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        bowelMovements: {
          frequency: 1,
          consistency: 'soft' as const,
          diaperStatus: 'soiled' as const,
        },
        urination: {
          frequency: 5,
          urineColor: 'light_clear' as const,
          diaperStatus: 'wet' as const,
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
      expect(data.bowelMovements).toBeDefined();
      expect(data.urination).toBeDefined();
      expect(data.bowelMovements.consistency).toBe('soft');
      expect(data.urination.urineColor).toBe('light_clear');
    });

    it('should allow optional toileting fields', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
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
      expect(data.bowelMovements).toBeNull();
      expect(data.urination).toBeNull();
    });

    it('should accept diarrhea consistency with concerns', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        bowelMovements: {
          frequency: 4,
          consistency: 'diarrhea' as const,
          concerns: 'Frequent loose stools, possible dehydration risk',
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
      expect(data.bowelMovements.consistency).toBe('diarrhea');
      expect(data.bowelMovements.frequency).toBe(4);
    });

    it('should accept dark urine color with concerns', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        urination: {
          frequency: 2,
          urineColor: 'dark' as const,
          concerns: 'Dark urine - possible dehydration, encourage fluids',
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
      expect(data.urination.urineColor).toBe('dark');
      expect(data.urination.concerns).toContain('dehydration');
    });
  });

  // Sprint 3 Day 1: Spiritual & Emotional Well-Being
  describe('Sprint 3 Day 1: Spiritual & Emotional Well-Being', () => {
    it('should accept complete spiritual & emotional data', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'alert' as const,
        spiritualEmotional: {
          prayerTime: { start: '09:00', end: '09:30' },
          prayerExpression: 'speaking_out_loud' as const,
          overallMood: 4,
          communicationScale: 3,
          socialInteraction: 'engaged' as const,
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
      expect(data.spiritualEmotional).toBeDefined();
      expect(data.spiritualEmotional.prayerTime).toEqual({ start: '09:00', end: '09:30' });
      expect(data.spiritualEmotional.prayerExpression).toBe('speaking_out_loud');
      expect(data.spiritualEmotional.overallMood).toBe(4);
      expect(data.spiritualEmotional.communicationScale).toBe(3);
      expect(data.spiritualEmotional.socialInteraction).toBe('engaged');
    });

    it('should validate prayer expression enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        spiritualEmotional: {
          prayerExpression: 'invalid_expression' as unknown as 'speaking_out_loud' | 'whispering' | 'mumbling' | 'silent_worship',
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

      expect(res.status).toBe(400);
    });

    it('should validate overall mood scale (1-5)', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        spiritualEmotional: {
          overallMood: 6, // Out of range
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

      expect(res.status).toBe(400);
    });

    it('should validate communication scale (1-5)', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        spiritualEmotional: {
          communicationScale: 0, // Out of range
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

      expect(res.status).toBe(400);
    });

    it('should validate social interaction enum values', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        spiritualEmotional: {
          socialInteraction: 'invalid_interaction' as unknown as 'engaged' | 'responsive' | 'withdrawn' | 'aggressive_hostile',
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

      expect(res.status).toBe(400);
    });

    it('should accept all prayer expression types', async () => {
      const expressions = ['speaking_out_loud', 'whispering', 'mumbling', 'silent_worship'] as const;

      for (const expression of expressions) {
        const careLogData = {
          careRecipientId,
          caregiverId,
          logDate: new Date().toISOString(),
          spiritualEmotional: {
            prayerExpression: expression,
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
        expect(data.spiritualEmotional.prayerExpression).toBe(expression);
      }
    });

    it('should accept all social interaction types', async () => {
      const interactions = ['engaged', 'responsive', 'withdrawn', 'aggressive_hostile'] as const;

      for (const interaction of interactions) {
        const careLogData = {
          careRecipientId,
          caregiverId,
          logDate: new Date().toISOString(),
          spiritualEmotional: {
            socialInteraction: interaction,
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
        expect(data.spiritualEmotional.socialInteraction).toBe(interaction);
      }
    });

    it('should allow all spiritual & emotional fields to be optional', async () => {
      const careLogData = {
        careRecipientId,
        caregiverId,
        logDate: new Date().toISOString(),
        wakeTime: '07:00',
        mood: 'calm' as const,
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
  });

  // Progressive Section Submission
  describe('Progressive Section Submission', () => {
    let draftLogId: string;

    beforeEach(async () => {
      // Create a draft log with morning data
      const res = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId,
          caregiverId,
          logDate: new Date().toISOString().split('T')[0],
          wakeTime: '07:30',
          mood: 'alert',
          showerTime: '08:00',
          bloodPressure: '120/80',
          pulseRate: 72,
          meals: {
            breakfast: { time: '09:00', appetite: 4, amountEaten: 80 },
          },
        }),
      }, mockEnv);
      const log = await res.json();
      draftLogId = log.id;
    });

    describe('POST /care-logs/:id/submit-section', () => {
      it('should submit morning section successfully', async () => {
        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.completedSections).toBeDefined();
        expect(data.completedSections.morning).toBeDefined();
        expect(data.completedSections.morning.submittedAt).toBeDefined();
        expect(data.completedSections.morning.submittedBy).toBe(caregiverId);
      });

      it('should submit afternoon section successfully', async () => {
        // Add afternoon data first
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            meals: {
              breakfast: { time: '09:00', appetite: 4, amountEaten: 80 },
              lunch: { time: '12:30', appetite: 3, amountEaten: 70 },
            },
            afternoonRest: {
              startTime: '14:00',
              endTime: '15:30',
              quality: 'deep',
            },
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'afternoon' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.completedSections.afternoon).toBeDefined();
      });

      it('should submit evening section successfully', async () => {
        // Add evening data first
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            meals: {
              breakfast: { time: '09:00', appetite: 4, amountEaten: 80 },
              dinner: { time: '18:30', appetite: 4, amountEaten: 85 },
            },
            nightSleep: {
              bedtime: '21:00',
              quality: 'deep',
              wakings: 0,
              wakingReasons: [],
              behaviors: [],
            },
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'evening' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.completedSections.evening).toBeDefined();
      });

      it('should submit dailySummary section successfully', async () => {
        // Add daily summary data first
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            bowelMovements: {
              frequency: 2,
              consistency: 'normal',
            },
            urination: {
              frequency: 6,
              urineColor: 'yellow',
            },
            balanceIssues: 2,
            nearFalls: 'none',
            actualFalls: 'none',
            notes: 'Overall a good day',
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'dailySummary' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.completedSections.dailySummary).toBeDefined();
      });

      it('should allow submitting sections in any order', async () => {
        // Submit evening first
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            nightSleep: { bedtime: '21:00', quality: 'deep', wakings: 0, wakingReasons: [], behaviors: [] },
          }),
        }, mockEnv);

        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'evening' }),
        }, mockEnv);

        // Then submit morning
        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.completedSections.morning).toBeDefined();
        expect(data.completedSections.evening).toBeDefined();
      });

      it('should preserve previously submitted sections', async () => {
        // Submit morning
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Submit afternoon
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            afternoonRest: { startTime: '14:00', endTime: '15:30', quality: 'light' },
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'afternoon' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.completedSections.morning).toBeDefined();
        expect(data.completedSections.afternoon).toBeDefined();
      });

      it('should allow re-submitting a section to update timestamp', async () => {
        // Submit morning first time
        const res1 = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        const data1 = await res1.json();
        const firstTimestamp = data1.completedSections.morning.submittedAt;

        // Wait a bit and re-submit
        await new Promise(resolve => setTimeout(resolve, 10));

        const res2 = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.completedSections.morning.submittedAt).not.toBe(firstTimestamp);
      });

      it('should validate section parameter', async () => {
        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'invalid_section' }),
        }, mockEnv);

        expect(res.status).toBe(400);
      });

      it('should reject section submission without caregiver auth', async () => {
        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${familyAdminToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res.status).toBe(401);
      });

      it('should reject section submission for non-existent log', async () => {
        const res = await app.request('/care-logs/non-existent-id/submit-section', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res.status).toBe(404);
      });

      it('should allow editing data after section submission (sections are not locked)', async () => {
        // Submit morning section
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Should still be able to edit morning data
        const res = await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ wakeTime: '08:00' }),
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.wakeTime).toBe('08:00');
      });
    });

    describe('Family Access with Completed Sections', () => {
      it('should show completed sections to family members', async () => {
        // Submit morning section
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Family member should see the log
        const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const log = await res.json();
        expect(log).not.toBeNull();
        expect(log.completedSections).toBeDefined();
        expect(log.completedSections.morning).toBeDefined();
        // Morning data should be visible
        expect(log.wakeTime).toBe('07:30');
      });

      it('should hide incomplete sections from family view', async () => {
        // Submit only morning section
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Add evening data but don't submit evening section
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            nightSleep: { bedtime: '21:00', quality: 'deep', wakings: 0, wakingReasons: [], behaviors: [] },
          }),
        }, mockEnv);

        // Family member fetches the log
        const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const log = await res.json();
        // Morning data should be visible (section submitted)
        expect(log.wakeTime).toBeDefined();
        // Evening data should be hidden (section not submitted)
        expect(log.nightSleep).toBeUndefined();
      });

      it('should not show logs without any completed sections to family', async () => {
        // Create a draft without submitting any sections
        const createRes = await app.request('/care-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            careRecipientId,
            caregiverId,
            logDate: '2025-12-25', // Different date
            wakeTime: '07:00',
          }),
        }, mockEnv);
        await createRes.json();

        // Family member should not see this draft
        const res = await app.request(`/care-logs/recipient/${careRecipientId}/date/2025-12-25`, {
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const log = await res.json();
        expect(log).toBeNull();
      });

      it('should show all data when all sections are submitted', async () => {
        // Add all section data
        await app.request(`/care-logs/${draftLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            meals: {
              breakfast: { time: '09:00', appetite: 4, amountEaten: 80 },
              lunch: { time: '12:30', appetite: 3, amountEaten: 70 },
              dinner: { time: '18:30', appetite: 4, amountEaten: 85 },
            },
            afternoonRest: { startTime: '14:00', endTime: '15:30', quality: 'deep' },
            nightSleep: { bedtime: '21:00', quality: 'deep', wakings: 0, wakingReasons: [], behaviors: [] },
            bowelMovements: { frequency: 2, consistency: 'normal' },
            notes: 'Great day!',
          }),
        }, mockEnv);

        // Submit all sections
        for (const section of ['morning', 'afternoon', 'evening', 'dailySummary']) {
          await app.request(`/care-logs/${draftLogId}/submit-section`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${caregiverToken}`,
            },
            body: JSON.stringify({ section }),
          }, mockEnv);
        }

        // Family should see everything
        const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const log = await res.json();
        expect(log.wakeTime).toBeDefined();
        expect(log.afternoonRest).toBeDefined();
        expect(log.nightSleep).toBeDefined();
        expect(log.bowelMovements).toBeDefined();
        expect(log.notes).toBe('Great day!');
      });
    });

    describe('Final Submit with Completed Sections', () => {
      it('should still allow full submit after section submissions', async () => {
        // Submit morning section
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Final submit
        const res = await app.request(`/care-logs/${draftLogId}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${caregiverToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      });

      it('should lock log after final submit (no more edits)', async () => {
        // Submit morning section
        await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Final submit
        await app.request(`/care-logs/${draftLogId}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${caregiverToken}` },
        }, mockEnv);

        // Try to edit - should fail
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
        expect(data.error).toContain('draft');
      });

      it('should lock section submission after final submit', async () => {
        // Final submit first
        await app.request(`/care-logs/${draftLogId}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${caregiverToken}` },
        }, mockEnv);

        // Try to submit section - should fail
        const res = await app.request(`/care-logs/${draftLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('finalized');
      });
    });
  });

  describe('Audit History & Change Tracking', () => {
    let auditTestLogId: string;

    beforeEach(async () => {
      // Use fixed values to avoid scope issues with outer beforeEach
      const testCareRecipientId = '550e8400-e29b-41d4-a716-446655440000';
      const testCaregiverToken = 'mock-token-caregiver';

      // Create a care log for testing
      const createRes = await app.request('/care-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testCaregiverToken}`,
        },
        body: JSON.stringify({
          careRecipientId: testCareRecipientId,
          logDate: new Date().toISOString().split('T')[0],
          wakeTime: '07:00',
          mood: 'alert', // Valid mood value
        }),
      }, mockEnv);
      const log = await createRes.json();
      auditTestLogId = log.id;
    });

    describe('GET /care-logs/:id/history - Audit History Endpoint', () => {
      it('should return audit history for a care log', async () => {
        // First update the log to create an audit entry
        await app.request(`/care-logs/${auditTestLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            mood: 'calm',
            wakeTime: '07:30',
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: `Bearer ${familyAdminToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const history = await res.json();
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThanOrEqual(1);
      });

      it('should include create action in history', async () => {
        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: `Bearer ${familyAdminToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const history = await res.json();
        const createAction = history.find((h: { action: string }) => h.action === 'create');
        expect(createAction).toBeDefined();
        expect(createAction.changedBy).toBe(caregiverId);
      });

      it('should include update actions with field changes', async () => {
        // Update the log (using valid mood values from enum)
        await app.request(`/care-logs/${auditTestLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({
            mood: 'calm', // Valid mood enum value
          }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: `Bearer ${familyAdminToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const history = await res.json();
        const updateAction = history.find((h: { action: string }) => h.action === 'update');
        expect(updateAction).toBeDefined();
        expect(updateAction.changes).toBeDefined();
        expect(updateAction.changes.mood).toBeDefined();
        expect(updateAction.changes.mood.old).toBe('alert'); // Initial mood from beforeEach
        expect(updateAction.changes.mood.new).toBe('calm');
      });

      it('should include submit_section actions', async () => {
        // Submit a section
        await app.request(`/care-logs/${auditTestLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: `Bearer ${familyAdminToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const history = await res.json();
        const submitSectionAction = history.find((h: { action: string }) => h.action === 'submit_section');
        expect(submitSectionAction).toBeDefined();
        expect(submitSectionAction.sectionSubmitted).toBe('morning');
      });

      it('should order history by most recent first', async () => {
        // Make multiple updates
        await app.request(`/care-logs/${auditTestLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ mood: 'calm' }),
        }, mockEnv);

        await app.request(`/care-logs/${auditTestLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ mood: 'tired' }),
        }, mockEnv);

        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: `Bearer ${familyAdminToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const history = await res.json();
        // Most recent should be first
        for (let i = 0; i < history.length - 1; i++) {
          expect(new Date(history[i].createdAt).getTime()).toBeGreaterThanOrEqual(
            new Date(history[i + 1].createdAt).getTime()
          );
        }
      });

      it('should restrict history access to authorized users only', async () => {
        // Create a different family member token without access
        const unauthorizedToken = 'Bearer unauthorized-token';

        const res = await app.request(`/care-logs/${auditTestLogId}/history`, {
          headers: { Authorization: unauthorizedToken },
        }, mockEnv);

        expect(res.status).toBe(401);
      });
    });

    describe('POST /care-logs/:id/mark-viewed - View Tracking', () => {
      it('should record when family member views a care log', async () => {
        const res = await app.request(`/care-logs/${auditTestLogId}/mark-viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.viewedAt).toBeDefined();
      });

      it('should update existing view timestamp on repeat view', async () => {
        // First view
        const firstRes = await app.request(`/care-logs/${auditTestLogId}/mark-viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);
        const firstView = await firstRes.json();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        // Second view
        const secondRes = await app.request(`/care-logs/${auditTestLogId}/mark-viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);
        const secondView = await secondRes.json();

        expect(new Date(secondView.viewedAt).getTime()).toBeGreaterThan(
          new Date(firstView.viewedAt).getTime()
        );
      });

      it('should reject caregiver access to mark-viewed', async () => {
        const res = await app.request(`/care-logs/${auditTestLogId}/mark-viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${caregiverToken}` },
        }, mockEnv);

        // Caregivers should not mark views - this is for family only
        expect(res.status).toBe(401);
      });
    });

    describe('Family Dashboard - Unviewed Changes', () => {
      it('should indicate unviewed changes for family members', async () => {
        // Submit morning section to make log visible to family
        await app.request(`/care-logs/${auditTestLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Family views the log
        await app.request(`/care-logs/${auditTestLogId}/mark-viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        // Delay > 1 second to ensure timestamps differ (Drizzle stores timestamps in seconds)
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Caregiver makes an update (using valid mood enum value)
        await app.request(`/care-logs/${auditTestLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ mood: 'sleepy' }), // Valid mood enum value
        }, mockEnv);

        // Re-submit morning section
        await app.request(`/care-logs/${auditTestLogId}/submit-section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${caregiverToken}`,
          },
          body: JSON.stringify({ section: 'morning' }),
        }, mockEnv);

        // Family fetches today's log - should indicate unviewed changes
        const res = await app.request(`/care-logs/recipient/${careRecipientId}/today`, {
          headers: { Authorization: `Bearer ${familyMemberToken}` },
        }, mockEnv);

        expect(res.status).toBe(200);
        const log = await res.json();
        expect(log.hasUnviewedChanges).toBe(true);
      });
    });
  });
});
