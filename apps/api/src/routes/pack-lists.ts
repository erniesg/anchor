import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { packLists } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';
import { familyMemberAccess } from '../middleware/rbac';

const packListsRoute = new Hono<AppContext>();

// Pack list item schema
const packListItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  packed: z.boolean(),
  category: z.enum(['documents', 'medications', 'clothing', 'toiletries', 'medical_equipment', 'other']),
  priority: z.enum(['essential', 'important', 'optional']),
  notes: z.string().optional(),
  quantity: z.string().optional(),
});

// Create or update pack list schema
const upsertPackListSchema = z.object({
  careRecipientId: z.string().uuid(),
  items: z.array(packListItemSchema),
});

/**
 * Get pack list for a care recipient
 * Accessible by family members and caregivers
 */
packListsRoute.get('/recipient/:recipientId', ...familyMemberAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const packList = await db
      .select()
      .from(packLists)
      .where(eq(packLists.careRecipientId, recipientId))
      .get();

    // If no pack list exists yet, return empty structure
    if (!packList) {
      return c.json({
        careRecipientId: recipientId,
        items: [],
        lastVerifiedAt: null,
        lastVerifiedBy: null,
        createdAt: null,
        updatedAt: null,
      });
    }

    return c.json(packList);
  } catch (error) {
    console.error('Get pack list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Create or update pack list
 * Accessible by family members (creates/full update) and caregivers (updates only)
 */
packListsRoute.post('/', ...familyMemberAccess, async (c) => {
  try {
    const body = await c.req.json();
    const data = upsertPackListSchema.parse(body);

    const db = c.get('db');
    const userId = c.get('userId');

    // Check if pack list already exists
    const existing = await db
      .select()
      .from(packLists)
      .where(eq(packLists.careRecipientId, data.careRecipientId))
      .get();

    if (existing) {
      // Update existing pack list
      const updated = await db
        .update(packLists)
        .set({
          items: data.items,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(packLists.careRecipientId, data.careRecipientId))
        .returning()
        .get();

      return c.json(updated);
    } else {
      // Create new pack list
      const newPackList = await db
        .insert(packLists)
        .values({
          id: crypto.randomUUID(),
          careRecipientId: data.careRecipientId,
          items: data.items,
          createdAt: new Date(),
          createdBy: userId,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .returning()
        .get();

      return c.json(newPackList, 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Upsert pack list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Mark pack list as verified
 * Used when someone checks and confirms all items are packed
 */
packListsRoute.post('/:recipientId/verify', ...familyMemberAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');
    const userId = c.get('userId');

    const updated = await db
      .update(packLists)
      .set({
        lastVerifiedAt: new Date(),
        lastVerifiedBy: userId,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(packLists.careRecipientId, recipientId))
      .returning()
      .get();

    if (!updated) {
      return c.json({ error: 'Pack list not found' }, 404);
    }

    return c.json(updated);
  } catch (error) {
    console.error('Verify pack list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Delete pack list (rare, but available)
 * Only family admins should be able to do this
 */
packListsRoute.delete('/:recipientId', ...familyMemberAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    await db
      .delete(packLists)
      .where(eq(packLists.careRecipientId, recipientId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete pack list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default packListsRoute;
