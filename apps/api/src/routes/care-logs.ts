import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { careLogs } from '@anchor/database/schema';
import { eq, desc } from 'drizzle-orm';

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

// Create care log
careLogsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data = createCareLogSchema.parse(body);

    const db = c.get('db');

    const newLog = await db
      .insert(careLogs)
      .values({
        id: crypto.randomUUID(),
        careRecipientId: data.careRecipientId,
        logDate: new Date(data.logDate),
        wakeTime: data.wakeTime,
        mood: data.mood,
        showerTime: data.showerTime,
        hairWash: data.hairWash,
        medications: data.medications ? JSON.stringify(data.medications) : null,
        meals: data.meals ? JSON.stringify(data.meals) : null,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        toileting: data.toileting ? JSON.stringify(data.toileting) : null,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
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

// Get care logs for a care recipient
careLogsRoute.get('/recipient/:recipientId', async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const logs = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.careRecipientId, recipientId))
      .orderBy(desc(careLogs.logDate))
      .all();

    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      medications: log.medications ? JSON.parse(log.medications as string) : null,
      meals: log.meals ? JSON.parse(log.meals as string) : null,
      toileting: log.toileting ? JSON.parse(log.toileting as string) : null,
    }));

    return c.json(parsedLogs);
  } catch (error) {
    console.error('Get care logs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get today's care log for a recipient
careLogsRoute.get('/recipient/:recipientId/today', async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const today = new Date().toISOString().split('T')[0];

    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.careRecipientId, recipientId))
      .orderBy(desc(careLogs.logDate))
      .limit(1)
      .get();

    if (!log) {
      return c.json(null);
    }

    // Parse JSON fields
    const parsedLog = {
      ...log,
      medications: log.medications ? JSON.parse(log.medications as string) : null,
      meals: log.meals ? JSON.parse(log.meals as string) : null,
      toileting: log.toileting ? JSON.parse(log.toileting as string) : null,
    };

    return c.json(parsedLog);
  } catch (error) {
    console.error('Get today log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care log for a specific date
careLogsRoute.get('/recipient/:recipientId/date/:date', async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const date = c.req.param('date'); // Expected format: YYYY-MM-DD
    const db = c.get('db');

    const logs = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.careRecipientId, recipientId))
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

    // Parse JSON fields
    const parsedLog = {
      ...matchingLog,
      medications: matchingLog.medications ? JSON.parse(matchingLog.medications as string) : null,
      meals: matchingLog.meals ? JSON.parse(matchingLog.meals as string) : null,
      toileting: matchingLog.toileting ? JSON.parse(matchingLog.toileting as string) : null,
    };

    return c.json(parsedLog);
  } catch (error) {
    console.error('Get date log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default careLogsRoute;
