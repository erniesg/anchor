import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Env } from '../index';
import { getTestTokens } from '../test-setup';

vi.mock('../lib/access-control', () => ({
  isActiveUser: vi.fn(async () => true),
  isActiveCaregiver: vi.fn(async () => true),
  caregiverHasAccess: vi.fn(async () => true),
  caregiverOwnsCareLog: vi.fn(async () => true),
  canAccessCareRecipient: vi.fn(async (_db: unknown, _userId: string, recipientId: string) => {
    return recipientId !== 'other-recipient-123';
  }),
  canInvalidateCareLog: vi.fn(async () => true),
  canManageCaregivers: vi.fn(async () => true),
  getAccessibleCareRecipients: vi.fn(async () => [
    { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Test Recipient' }
  ]),
  canGrantAccess: vi.fn(async () => true),
  canRevokeAccess: vi.fn(async () => true),
}));

import app from '../index';

describe('Medication Schedules API', () => {
  let mockD1: D1Database;
  let mockEnv: Env;
  let familyAdminToken: string;
  let familyMemberToken: string;
  let careRecipientId: string;

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
      JWT_SECRET: 'test-secret-key',
      LOGTO_APP_SECRET: 'test-logto-secret',
    };

    const tokens = getTestTokens();
    familyAdminToken = tokens.familyAdmin;
    familyMemberToken = tokens.familyMember;
    careRecipientId = '550e8400-e29b-41d4-a716-446655440000';
  });

  it('should list medication schedules for a care recipient', async () => {
    const res = await app.request(`/medication-schedules/recipient/${careRecipientId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${familyMemberToken}`,
      },
    }, mockEnv);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it('should create and normalize a medication schedule', async () => {
    const res = await app.request('/medication-schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyAdminToken}`,
      },
      body: JSON.stringify({
        careRecipientId,
        medicationName: 'Metformin',
        dosage: '500mg',
        purpose: 'Diabetes control',
        timeSlot: 'after_breakfast',
        scheduledTime: '08:00',
        repeatDays: ['fri', 'mon', 'fri'],
        active: true,
      }),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.medicationName).toBe('Metformin');
    expect(data.dosage).toBe('500mg');
    expect(data.repeatDays).toEqual(['mon', 'fri']);
    expect(data.scheduledTime).toBe('08:00');
    expect(data.active).toBe(true);
  });

  it('should update and delete a medication schedule', async () => {
    const createRes = await app.request('/medication-schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyAdminToken}`,
      },
      body: JSON.stringify({
        careRecipientId,
        medicationName: 'Aspirin',
        dosage: '100mg',
        timeSlot: 'afternoon',
        scheduledTime: '13:00',
        repeatDays: [],
        active: true,
      }),
    }, mockEnv);

    const created = await createRes.json();

    const updateRes = await app.request(`/medication-schedules/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyAdminToken}`,
      },
      body: JSON.stringify({
        careRecipientId,
        medicationName: 'Aspirin',
        dosage: '81mg',
        purpose: 'Blood thinner',
        timeSlot: 'after_dinner',
        scheduledTime: '19:30',
        repeatDays: ['mon', 'wed', 'fri'],
        active: false,
      }),
    }, mockEnv);

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.dosage).toBe('81mg');
    expect(updated.timeSlot).toBe('after_dinner');
    expect(updated.repeatDays).toEqual(['mon', 'wed', 'fri']);
    expect(updated.active).toBe(false);

    const deleteRes = await app.request(`/medication-schedules/${created.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${familyAdminToken}`,
      },
    }, mockEnv);

    expect(deleteRes.status).toBe(200);

    const listRes = await app.request(`/medication-schedules/recipient/${careRecipientId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${familyAdminToken}`,
      },
    }, mockEnv);

    const schedules = await listRes.json();
    expect(schedules).toEqual([]);
  });

  it('should reject schedule creation by family members', async () => {
    const res = await app.request('/medication-schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyMemberToken}`,
      },
      body: JSON.stringify({
        careRecipientId,
        medicationName: 'Aspirin',
        dosage: '100mg',
        timeSlot: 'afternoon',
        repeatDays: [],
      }),
    }, mockEnv);

    expect(res.status).toBe(403);
  });
});
