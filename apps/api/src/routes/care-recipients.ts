import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { careRecipients } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';

const careRecipientsRoute = new Hono<AppContext>();

const createCareRecipientSchema = z.object({
  name: z.string().min(2),
  dateOfBirth: z.string().optional(),
  condition: z.string().optional(),
  location: z.string().optional(),
  emergencyContact: z.string().optional(),
});

// Create care recipient
careRecipientsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const data = createCareRecipientSchema.parse(body);

    // TODO: Get userId from JWT token instead of header
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    const newRecipient = await db
      .insert(careRecipients)
      .values({
        familyAdminId: userId,
        name: data.name,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        condition: data.condition,
        location: data.location,
        emergencyContact: data.emergencyContact,
      })
      .returning()
      .get();

    return c.json(newRecipient, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Create care recipient error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all care recipients for user
careRecipientsRoute.get('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');
    const recipients = await db
      .select()
      .from(careRecipients)
      .where(eq(careRecipients.familyAdminId, userId))
      .all();

    return c.json(recipients);
  } catch (error) {
    console.error('Get care recipients error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single care recipient
careRecipientsRoute.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.get('db');

    const recipient = await db
      .select()
      .from(careRecipients)
      .where(eq(careRecipients.id, id))
      .get();

    if (!recipient) {
      return c.json({ error: 'Care recipient not found' }, 404);
    }

    return c.json(recipient);
  } catch (error) {
    console.error('Get care recipient error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default careRecipientsRoute;
