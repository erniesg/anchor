import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { AppContext } from '../index';
import { caregivers } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';
import { familyAdminOnly, familyMemberAccess } from '../middleware/rbac';
import { requireCaregiverManagement } from '../middleware/permissions';
import { generateUsername, isValidUsername, normalizeUsername } from '../utils/username-generator';

const caregiversRoute = new Hono<AppContext>();

const createCaregiverSchema = z.object({
  careRecipientId: z.string().uuid(),
  name: z.string().min(2),
  username: z.string().min(5).max(30).optional(), // Optional custom username
  phone: z.string().optional(),
  email: z.string().email().optional(),
  language: z.string().default('en'),
});

// Generate random 6-digit PIN
const generatePin = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash PIN using bcrypt (consistent with user password hashing)
const hashPin = async (pin: string): Promise<string> => {
  return bcrypt.hash(pin, 10);
};

// Create caregiver with auto-generated PIN and username (family_admin only)
caregiversRoute.post('/', ...familyAdminOnly, requireCaregiverManagement, async (c) => {
  try {
    const body = await c.req.json();
    const data = createCaregiverSchema.parse(body);

    const db = c.get('db');
    const userId = c.get('userId')!; // From familyAdminOnly middleware
    const pin = generatePin();
    const hashedPin = await hashPin(pin);

    let username: string;

    if (data.username) {
      // Custom username provided - validate and check availability
      username = normalizeUsername(data.username);

      if (!isValidUsername(username)) {
        return c.json({
          error: 'Invalid username format. Use lowercase letters, numbers, and hyphens only (5-30 chars).',
        }, 400);
      }

      // Check if username is already taken
      const existing = await db
        .select({ id: caregivers.id })
        .from(caregivers)
        .where(eq(caregivers.username, username))
        .get();

      if (existing) {
        return c.json({ error: 'Username is already taken' }, 409);
      }
    } else {
      // Auto-generate unique username (retry if collision)
      username = generateUsername();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db
          .select({ id: caregivers.id })
          .from(caregivers)
          .where(eq(caregivers.username, username))
          .get();
        if (!existing) break;
        username = generateUsername();
        attempts++;
      }
    }

    const newCaregiver = await db
      .insert(caregivers)
      .values({
        id: crypto.randomUUID(),
        careRecipientId: data.careRecipientId,
        name: data.name,
        username, // Auto-generated username
        phone: data.phone,
        email: data.email,
        language: data.language,
        pinCode: hashedPin,
        active: true,
        createdBy: userId, // Track who created the caregiver
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    return c.json({
      ...newCaregiver,
      pinCode: undefined, // Don't return hashed PIN
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

// Get caregivers for a care recipient (family members can view)
caregiversRoute.get('/recipient/:recipientId', ...familyMemberAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const caregiverList = await db
      .select({
        id: caregivers.id,
        name: caregivers.name,
        username: caregivers.username,
        phone: caregivers.phone,
        email: caregivers.email,
        active: caregivers.active,
        language: caregivers.language,
        createdAt: caregivers.createdAt,
        createdBy: caregivers.createdBy,
        deactivatedAt: caregivers.deactivatedAt,
        deactivatedBy: caregivers.deactivatedBy,
        deactivationReason: caregivers.deactivationReason,
        lastPinResetAt: caregivers.lastPinResetAt,
        lastPinResetBy: caregivers.lastPinResetBy,
      })
      .from(caregivers)
      .where(eq(caregivers.careRecipientId, recipientId))
      .all();

    return c.json(caregiverList);
  } catch (error) {
    console.error('Get caregivers error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Reset caregiver PIN (family_admin only)
caregiversRoute.post('/:id/reset-pin', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const userId = c.get('userId')!;
    const db = c.get('db');

    // Generate new PIN
    const newPin = generatePin();
    const hashedPin = await hashPin(newPin);

    // Update caregiver
    await db
      .update(caregivers)
      .set({
        pinCode: hashedPin,
        lastPinResetAt: new Date(),
        lastPinResetBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(caregivers.id, caregiverId));

    return c.json({
      success: true,
      pin: newPin, // Return unhashed PIN so family can share it
      message: 'PIN has been reset successfully',
    });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Generate new username for caregiver (family_admin only)
caregiversRoute.post('/:id/generate-username', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const db = c.get('db');

    // Check if caregiver exists
    const caregiver = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    if (!caregiver) {
      return c.json({ error: 'Caregiver not found' }, 404);
    }

    // Generate unique username (retry if collision)
    let username = generateUsername();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select({ id: caregivers.id })
        .from(caregivers)
        .where(eq(caregivers.username, username))
        .get();
      if (!existing) break;
      username = generateUsername();
      attempts++;
    }

    // Update caregiver username
    await db
      .update(caregivers)
      .set({
        username,
        updatedAt: new Date(),
      })
      .where(eq(caregivers.id, caregiverId));

    return c.json({
      success: true,
      username,
      message: 'Username has been generated successfully',
    });
  } catch (error) {
    console.error('Generate username error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update caregiver username (family_admin only)
const updateUsernameSchema = z.object({
  username: z.string().min(5).max(30),
});

caregiversRoute.put('/:id/username', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const body = await c.req.json();
    const data = updateUsernameSchema.parse(body);
    const db = c.get('db');

    const username = normalizeUsername(data.username);

    // Validate username format
    if (!isValidUsername(username)) {
      return c.json({
        error: 'Invalid username format. Use lowercase letters, numbers, and hyphens only.',
      }, 400);
    }

    // Check if username is already taken
    const existing = await db
      .select({ id: caregivers.id })
      .from(caregivers)
      .where(eq(caregivers.username, username))
      .get();

    if (existing && existing.id !== caregiverId) {
      return c.json({ error: 'Username is already taken' }, 409);
    }

    // Update caregiver username
    await db
      .update(caregivers)
      .set({
        username,
        updatedAt: new Date(),
      })
      .where(eq(caregivers.id, caregiverId));

    return c.json({
      success: true,
      username,
      message: 'Username has been updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Update username error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Deactivate caregiver (family_admin only)
caregiversRoute.post('/:id/deactivate', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const userId = c.get('userId')!;
    const body = await c.req.json();
    const { reason } = body;

    // Validate reason is provided
    if (!reason || reason.trim() === '') {
      return c.json({ error: 'Deactivation reason is required' }, 400);
    }

    const db = c.get('db');

    // Check if caregiver is already deactivated
    const caregiver = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    if (!caregiver) {
      return c.json({ error: 'Caregiver not found' }, 404);
    }

    if (!caregiver.active) {
      return c.json({ error: 'Caregiver is already deactivated' }, 400);
    }

    // Deactivate caregiver
    await db
      .update(caregivers)
      .set({
        active: false,
        deactivatedAt: new Date(),
        deactivatedBy: userId,
        deactivationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(caregivers.id, caregiverId));

    return c.json({
      success: true,
      message: 'Caregiver has been deactivated',
    });
  } catch (error) {
    console.error('Deactivate caregiver error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Reactivate caregiver (family_admin only)
caregiversRoute.post('/:id/reactivate', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const db = c.get('db');

    // Reactivate caregiver
    await db
      .update(caregivers)
      .set({
        active: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        updatedAt: new Date(),
      })
      .where(eq(caregivers.id, caregiverId));

    return c.json({
      success: true,
      message: 'Caregiver has been reactivated',
    });
  } catch (error) {
    console.error('Reactivate caregiver error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update caregiver details (family_admin only)
const updateCaregiverSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  language: z.string().optional(),
});

caregiversRoute.put('/:id', ...familyAdminOnly, async (c) => {
  try {
    const caregiverId = c.req.param('id');
    const body = await c.req.json();
    const data = updateCaregiverSchema.parse(body);

    const db = c.get('db');

    // Build update object with only provided fields
    const updateData: Partial<typeof caregivers.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.language !== undefined) updateData.language = data.language;

    // Update caregiver
    const updated = await db
      .update(caregivers)
      .set(updateData)
      .where(eq(caregivers.id, caregiverId))
      .returning()
      .get();

    return c.json({
      ...updated,
      pinCode: undefined, // Don't return hashed PIN
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Update caregiver error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default caregiversRoute;
