import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { AppContext } from '../index';
import { medicationSchedules } from '@anchor/database/schema';
import { familyAdminOnly, familyMemberAccess } from '../middleware/rbac';
import { requireCareRecipientAccess } from '../middleware/permissions';
import { canManageCaregivers } from '../lib/access-control';

const medicationSchedulesRoute = new Hono<AppContext>();

const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const medicationTimeSlotOrder = ['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime'] as const;

const medicationScheduleSchema = z.object({
  careRecipientId: z.string().uuid(),
  medicationName: z.string().trim().min(1, 'Medication name is required'),
  dosage: z.string().trim().min(1, 'Dosage is required'),
  purpose: z.string().trim().optional(),
  timeSlot: z.enum(['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime']),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)').optional(),
  repeatDays: z.array(z.enum(dayCodes)).default([]),
  active: z.boolean().default(true),
});

type DayCode = typeof dayCodes[number];

function normalizeRepeatDays(days: DayCode[]): DayCode[] {
  const unique = new Set(days);
  return dayCodes.filter((day) => unique.has(day));
}

function parseRepeatDaysValue(value: string | null | undefined): DayCode[] {
  if (!value) return [];

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'daily' || normalized === 'everyday' || normalized === 'selected_days') {
    return [];
  }

  if (normalized === 'weekdays') {
    return ['mon', 'tue', 'wed', 'thu', 'fri'];
  }

  if (normalized === 'weekends') {
    return ['sat', 'sun'];
  }

  const explicitMatches = normalized.match(/sun|mon|tue|wed|thu|fri|sat/g);
  if (explicitMatches?.length) {
    return dayCodes.filter((day) => explicitMatches.includes(day));
  }

  const compact = normalized.replace(/[^a-z]/g, '');
  const legacyPatterns: Record<string, DayCode[]> = {
    mwf: ['mon', 'wed', 'fri'],
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weekends: ['sat', 'sun'],
  };

  return legacyPatterns[compact] || [];
}

function parseRepeatDays(dayRestriction: string | null | undefined, frequency: string | null | undefined): DayCode[] {
  const explicitDays = parseRepeatDaysValue(dayRestriction);
  if (explicitDays.length > 0) {
    return explicitDays;
  }

  return parseRepeatDaysValue(frequency);
}

function serializeRepeatDays(repeatDays: DayCode[]): { frequency: string; dayRestriction: string | null } {
  const normalizedDays = normalizeRepeatDays(repeatDays);

  if (normalizedDays.length === 0 || normalizedDays.length === 7) {
    return { frequency: 'daily', dayRestriction: null };
  }

  return {
    frequency: 'selected_days',
    dayRestriction: normalizedDays.join(','),
  };
}

function mapSchedule(schedule: typeof medicationSchedules.$inferSelect) {
  const repeatDays = parseRepeatDays(schedule.dayRestriction, schedule.frequency);
  const scheduledTime = Array.isArray(schedule.timeSlots) ? schedule.timeSlots[0] || undefined : undefined;

  return {
    id: schedule.id,
    careRecipientId: schedule.careRecipientId,
    medicationName: schedule.medicationName,
    dosage: schedule.dosage,
    purpose: schedule.purpose || undefined,
    timeSlot: schedule.timeSlot,
    scheduledTime,
    repeatDays,
    active: schedule.active,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

function sortSchedules(a: typeof medicationSchedules.$inferSelect, b: typeof medicationSchedules.$inferSelect): number {
  const slotOrderDiff = medicationTimeSlotOrder.indexOf(a.timeSlot) - medicationTimeSlotOrder.indexOf(b.timeSlot);

  if (slotOrderDiff !== 0) {
    return slotOrderDiff;
  }

  const aTime = Array.isArray(a.timeSlots) ? a.timeSlots[0] || '' : '';
  const bTime = Array.isArray(b.timeSlots) ? b.timeSlots[0] || '' : '';

  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }

  return a.medicationName.localeCompare(b.medicationName);
}

async function hasMedicationScheduleManagementAccess(
  userId: string | undefined,
  db: AppContext['Variables']['db'],
  careRecipientId: string
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  return canManageCaregivers(db, userId, careRecipientId);
}

medicationSchedulesRoute.get('/recipient/:recipientId', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const schedules = await db
      .select()
      .from(medicationSchedules)
      .where(eq(medicationSchedules.careRecipientId, recipientId))
      .all();

    return c.json(schedules.sort(sortSchedules).map(mapSchedule));
  } catch (error) {
    console.error('Get medication schedules error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

medicationSchedulesRoute.post('/', ...familyAdminOnly, async (c) => {
  try {
    const body = await c.req.json();
    const data = medicationScheduleSchema.parse(body);
    const db = c.get('db');

    const canManage = await hasMedicationScheduleManagementAccess(c.get('userId'), db, data.careRecipientId);
    if (!canManage) {
      return c.json({
        error: 'Forbidden',
        message: 'You do not have permission to manage medication schedules for this care recipient',
      }, 403);
    }

    const { frequency, dayRestriction } = serializeRepeatDays(data.repeatDays);
    const now = new Date();

    const created = await db
      .insert(medicationSchedules)
      .values({
        careRecipientId: data.careRecipientId,
        medicationName: data.medicationName,
        dosage: data.dosage,
        purpose: data.purpose || null,
        frequency,
        timeSlot: data.timeSlot,
        timeSlots: data.scheduledTime ? [data.scheduledTime] : null,
        dayRestriction,
        active: data.active,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(mapSchedule(created), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }

    console.error('Create medication schedule error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

medicationSchedulesRoute.patch('/:id', ...familyAdminOnly, async (c) => {
  try {
    const scheduleId = c.req.param('id');
    const body = await c.req.json();
    const data = medicationScheduleSchema.parse(body);
    const db = c.get('db');

    const existing = await db
      .select()
      .from(medicationSchedules)
      .where(eq(medicationSchedules.id, scheduleId))
      .get();

    if (!existing) {
      return c.json({ error: 'Medication schedule not found' }, 404);
    }

    const canManage = await hasMedicationScheduleManagementAccess(c.get('userId'), db, existing.careRecipientId);
    if (!canManage) {
      return c.json({
        error: 'Forbidden',
        message: 'You do not have permission to manage medication schedules for this care recipient',
      }, 403);
    }

    if (data.careRecipientId !== existing.careRecipientId) {
      return c.json({ error: 'Cannot move medication schedules between care recipients' }, 400);
    }

    const { frequency, dayRestriction } = serializeRepeatDays(data.repeatDays);

    const updated = await db
      .update(medicationSchedules)
      .set({
        medicationName: data.medicationName,
        dosage: data.dosage,
        purpose: data.purpose || null,
        frequency,
        timeSlot: data.timeSlot,
        timeSlots: data.scheduledTime ? [data.scheduledTime] : null,
        dayRestriction,
        active: data.active,
        updatedAt: new Date(),
      })
      .where(eq(medicationSchedules.id, scheduleId))
      .returning()
      .get();

    return c.json(mapSchedule(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }

    console.error('Update medication schedule error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

medicationSchedulesRoute.delete('/:id', ...familyAdminOnly, async (c) => {
  try {
    const scheduleId = c.req.param('id');
    const db = c.get('db');

    const existing = await db
      .select()
      .from(medicationSchedules)
      .where(eq(medicationSchedules.id, scheduleId))
      .get();

    if (!existing) {
      return c.json({ error: 'Medication schedule not found' }, 404);
    }

    const canManage = await hasMedicationScheduleManagementAccess(c.get('userId'), db, existing.careRecipientId);
    if (!canManage) {
      return c.json({
        error: 'Forbidden',
        message: 'You do not have permission to manage medication schedules for this care recipient',
      }, 403);
    }

    await db
      .delete(medicationSchedules)
      .where(eq(medicationSchedules.id, scheduleId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete medication schedule error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default medicationSchedulesRoute;
