import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { caregivers } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';

const caregiversRoute = new Hono<AppContext>();

const createCaregiverSchema = z.object({
  careRecipientId: z.string().uuid(),
  name: z.string().min(2),
  phone: z.string().optional(),
  language: z.string().default('en'),
});

// Generate random 6-digit PIN
const generatePin = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create caregiver with auto-generated PIN
caregiversRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data = createCaregiverSchema.parse(body);

    const db = c.get('db');
    const pin = generatePin();

    const newCaregiver = await db
      .insert(caregivers)
      .values({
        id: crypto.randomUUID(),
        careRecipientId: data.careRecipientId,
        name: data.name,
        phone: data.phone,
        language: data.language,
        pinCode: pin, // TODO: Hash this in production
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    return c.json({
      ...newCaregiver,
      pin, // Return unhashed PIN only on creation so family can share it
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Create caregiver error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get caregivers for a care recipient
caregiversRoute.get('/recipient/:recipientId', async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const caregiverList = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.careRecipientId, recipientId))
      .all();

    return c.json(caregiverList);
  } catch (error) {
    console.error('Get caregivers error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default caregiversRoute;
