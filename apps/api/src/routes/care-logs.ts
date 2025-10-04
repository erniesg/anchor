import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { careLogs } from '@anchor/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { caregiverOnly, familyAdminOnly, familyMemberAccess } from '../middleware/rbac';
import { requireCareLogOwnership, requireLogInvalidation, requireCareRecipientAccess } from '../middleware/permissions';

const careLogsRoute = new Hono<AppContext>();

// Validation schemas
const medicationLogSchema = z.object({
  name: z.string(),
  given: z.boolean(),
  time: z.string().nullable(),
  timeSlot: z.enum(['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime']),
});

const mealLogSchema = z.object({
  time: z.string(),
  appetite: z.number().min(1).max(5),
  amountEaten: z.number().min(0).max(100),
  swallowingIssues: z.array(z.string()).optional(),
});

const createCareLogSchema = z.object({
  careRecipientId: z.string().uuid(),
  caregiverId: z.string().uuid().optional(), // Optional, will use auth context if not provided
  logDate: z.string(), // ISO date string

  // Morning Routine
  wakeTime: z.string().optional(),
  mood: z.enum(['alert', 'confused', 'sleepy', 'agitated', 'calm']).optional(),
  showerTime: z.string().optional(),
  hairWash: z.boolean().optional(),

  // Medications
  medications: z.array(medicationLogSchema).optional(),

  // Meals
  meals: z.object({
    breakfast: mealLogSchema.optional(),
    lunch: mealLogSchema.optional(),
    dinner: mealLogSchema.optional(),
  }).optional(),

  // Vitals
  bloodPressure: z.string().optional(),
  pulseRate: z.number().optional(),
  oxygenLevel: z.number().min(0).max(100).optional(),
  bloodSugar: z.number().optional(),
  vitalsTime: z.string().optional(),

  // Toileting
  toileting: z.object({
    bowelFrequency: z.number().min(0),
    urineFrequency: z.number().min(0),
    diaperChanges: z.number().min(0),
    accidents: z.string().optional(),
    assistance: z.string().optional(),
    pain: z.string().optional(),
  }).optional(),

  // Safety
  emergencyFlag: z.boolean().default(false),
  emergencyNote: z.string().optional(),

  // Notes
  notes: z.string().optional(),
});

// Create care log (caregivers only) - creates as draft
careLogsRoute.post('/', ...caregiverOnly, async (c) => {
  try {
    const body = await c.req.json();
    const data = createCareLogSchema.parse(body);

    const db = c.get('db');
    const caregiverId = c.get('caregiverId')!; // From caregiverOnly middleware

    const newLog = await db
      .insert(careLogs)
      .values({
        careRecipientId: data.careRecipientId,
        caregiverId: data.caregiverId || caregiverId,
        logDate: new Date(data.logDate),
        status: 'draft' as const,
        wakeTime: data.wakeTime,
        mood: data.mood,
        showerTime: data.showerTime,
        hairWash: data.hairWash,
        medications: data.medications as any,
        meals: data.meals as any,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        toileting: data.toileting as any,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        notes: data.notes,
      } as any)
      .returning()
      .get();

    return c.json(newLog, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Create care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care logs for a care recipient (family members only see submitted logs)
careLogsRoute.get('/recipient/:recipientId', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    return c.json(logs);
  } catch (error) {
    console.error('Get care logs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get today's care log for a recipient (family members only)
careLogsRoute.get('/recipient/:recipientId/today', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const log = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate))
      .limit(1)
      .get();

    if (!log) {
      return c.json(null);
    }

    return c.json(log);
  } catch (error) {
    console.error('Get today log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care log for a specific date (family members only)
careLogsRoute.get('/recipient/:recipientId/date/:date', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const date = c.req.param('date'); // Expected format: YYYY-MM-DD
    const db = c.get('db');

    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    // Filter by date (compare YYYY-MM-DD portion)
    const targetDate = new Date(date).toISOString().split('T')[0];
    const matchingLog = logs.find(log => {
      const logDate = new Date(log.logDate).toISOString().split('T')[0];
      return logDate === targetDate;
    });

    if (!matchingLog) {
      return c.json(null);
    }

    return c.json(matchingLog);
  } catch (error) {
    console.error('Get date log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Submit care log (caregiver only, locks the log)
careLogsRoute.post('/:id/submit', ...caregiverOnly, requireCareLogOwnership, async (c) => {
  try {
    const logId = c.req.param('id');
    const db = c.get('db');

    // Get the log to verify it's a draft
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    if (log.status !== 'draft') {
      return c.json({ error: 'Only draft logs can be submitted' }, 400);
    }

    // Mark as submitted (immutable)
    await db
      .update(careLogs)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(careLogs.id, logId));

    return c.json({
      success: true,
      message: 'Care log submitted successfully',
    });
  } catch (error) {
    console.error('Submit care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Invalidate care log (family_admin only)
careLogsRoute.post('/:id/invalidate', ...familyAdminOnly, requireLogInvalidation, async (c) => {
  try {
    const logId = c.req.param('id');
    const userId = c.get('userId')!;
    const body = await c.req.json();
    const { reason } = body;

    const db = c.get('db');

    // Get the log to verify it's submitted
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    if (log.status !== 'submitted') {
      return c.json({ error: 'Only submitted logs can be invalidated' }, 400);
    }

    // Mark as invalidated
    await db
      .update(careLogs)
      .set({
        status: 'invalidated',
        invalidatedAt: new Date(),
        invalidatedBy: userId,
        invalidationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(careLogs.id, logId));

    // TODO: Send notification to caregiver

    return c.json({
      success: true,
      message: 'Care log has been invalidated',
    });
  } catch (error) {
    console.error('Invalidate care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default careLogsRoute;
