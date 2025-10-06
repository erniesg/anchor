import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { AppContext } from '../index';
import { users } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';
import { familyMemberAccess } from '../middleware/rbac';

const usersRoute = new Hono<AppContext>();

// Validation schema
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// Apply auth middleware to all routes
usersRoute.use('*', ...familyMemberAccess);

/**
 * GET /api/users/:userId
 * Get user profile
 */
usersRoute.get('/:userId', async (c) => {
  const db = c.get('db');
  const currentUserId = c.get('userId')!;
  const targetUserId = c.req.param('userId');

  // Users can only view their own profile (for now)
  if (currentUserId !== targetUserId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      timezone: users.timezone,
      emailNotifications: users.emailNotifications,
      smsNotifications: users.smsNotifications,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .get();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(user);
});

/**
 * PUT /api/users/:userId
 * Update user profile
 */
usersRoute.put('/:userId', async (c) => {
  const db = c.get('db');
  const currentUserId = c.get('userId')!;
  const targetUserId = c.req.param('userId');

  // Users can only update their own profile
  if (currentUserId !== targetUserId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const data = updateProfileSchema.parse(body);

  // If email is being changed, check if it's already taken
  if (data.email) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .get();

    if (existing && existing.id !== targetUserId) {
      return c.json({ error: 'Email already in use' }, 409);
    }
  }

  // Update user
  const updated = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      timezone: users.timezone,
      emailNotifications: users.emailNotifications,
      smsNotifications: users.smsNotifications,
    })
    .get();

  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(updated);
});

/**
 * POST /api/users/:userId/change-password
 * Change user password
 */
usersRoute.post('/:userId/change-password', async (c) => {
  const db = c.get('db');
  const currentUserId = c.get('userId')!;
  const targetUserId = c.req.param('userId');

  // Users can only change their own password
  if (currentUserId !== targetUserId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const data = changePasswordSchema.parse(body);

  // Get current user with password hash
  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();

  if (!user || !user.passwordHash) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Verify current password
  const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

  // Update password
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .run();

  return c.json({ success: true, message: 'Password changed successfully' });
});

export default usersRoute;
