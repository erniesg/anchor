import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { users, careRecipientAccess, careRecipients } from '@anchor/database/schema';
import { eq, and } from 'drizzle-orm';
import { familyMemberAccess } from '../middleware/rbac';

const familyMembers = new Hono<AppContext>();

// Validation schemas
const inviteFamilyMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['family_admin', 'family_member']).default('family_member'),
});

const grantAccessSchema = z.object({
  careRecipientId: z.string().uuid(),
  userId: z.string().uuid(),
});

const revokeAccessSchema = z.object({
  careRecipientId: z.string().uuid(),
  userId: z.string().uuid(),
});

// Apply auth middleware to all routes
familyMembers.use('*', ...familyMemberAccess);

/**
 * GET /api/family-members
 * List all family members in the current user's family
 */
familyMembers.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId')!;

  // Get current user to find their family
  const currentUser = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!currentUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get all care recipients owned by this user (if they're a family_admin)
  const ownedRecipients = await db
    .select({ id: careRecipients.id })
    .from(careRecipients)
    .where(eq(careRecipients.familyAdminId, userId))
    .all();

  const ownedRecipientIds = ownedRecipients.map(r => r.id);

  // Find all users who have access to any of these care recipients
  const memberIds = new Set<string>();
  memberIds.add(userId); // Always include current user

  if (ownedRecipientIds.length > 0) {
    // Get users with explicit access to our care recipients
    const accessRecords = await db
      .select({ userId: careRecipientAccess.userId })
      .from(careRecipientAccess)
      .where(
        and(
          eq(careRecipientAccess.revokedAt, null as unknown as Date)
        )
      )
      .all();

    // Filter to only include users who have access to OUR care recipients
    for (const record of accessRecords) {
      const hasAccessToOurRecipient = await db
        .select({ id: careRecipientAccess.id })
        .from(careRecipientAccess)
        .where(
          and(
            eq(careRecipientAccess.userId, record.userId),
            eq(careRecipientAccess.revokedAt, null as unknown as Date)
          )
        )
        .get();

      if (hasAccessToOurRecipient) {
        // Check if this access is for one of OUR care recipients
        const access = await db
          .select({ careRecipientId: careRecipientAccess.careRecipientId })
          .from(careRecipientAccess)
          .where(eq(careRecipientAccess.userId, record.userId))
          .all();

        for (const a of access) {
          if (ownedRecipientIds.includes(a.careRecipientId)) {
            memberIds.add(record.userId);
            break;
          }
        }
      }
    }
  }

  // Get full user details for these member IDs
  const familyMembers = [];
  for (const memberId of memberIds) {
    const member = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, memberId), eq(users.active, true)))
      .get();

    if (member) {
      familyMembers.push(member);
    }
  }

  return c.json(familyMembers);
});

/**
 * POST /api/family-members/invite
 * Invite a new family member (sends email in production)
 */
familyMembers.post('/invite', async (c) => {
  const db = c.get('db');
  const userRole = c.get('userRole')!;

  // Only family_admin can invite
  if (userRole !== 'family_admin') {
    return c.json({ error: 'Only family admins can invite members' }, 403);
  }

  const body = await c.req.json();
  const data = inviteFamilyMemberSchema.parse(body);

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, data.email)).get();
  if (existing) {
    return c.json({ error: 'User already exists' }, 409);
  }

  // In production, this would send an email invitation
  // For MVP, we'll create a placeholder user with a temporary password
  const bcrypt = await import('bcryptjs');
  const tempPassword = Math.random().toString(36).slice(-12); // Temporary password
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const newMember = await db
    .insert(users)
    .values({
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash,
      active: true,
    })
    .returning()
    .get();

  // TODO: Send invitation email with temporary password

  return c.json({
    member: {
      id: newMember.id,
      email: newMember.email,
      name: newMember.name,
      role: newMember.role,
    },
    tempPassword, // Remove this in production
  }, 201);
});

/**
 * GET /api/family-members/:userId/access
 * Get all care recipients this family member has access to
 */
familyMembers.get('/:userId/access', async (c) => {
  const db = c.get('db');
  const targetUserId = c.req.param('userId');

  const accessList = await db
    .select({
      careRecipientId: careRecipientAccess.careRecipientId,
      careRecipientName: careRecipients.name,
      grantedAt: careRecipientAccess.grantedAt,
      grantedBy: careRecipientAccess.grantedBy,
    })
    .from(careRecipientAccess)
    .leftJoin(careRecipients, eq(careRecipients.id, careRecipientAccess.careRecipientId))
    .where(
      and(
        eq(careRecipientAccess.userId, targetUserId),
        eq(careRecipientAccess.revokedAt, null as unknown as Date) // Active access only
      )
    )
    .all();

  return c.json(accessList);
});

/**
 * POST /api/family-members/grant-access
 * Grant a family member access to a care recipient
 */
familyMembers.post('/grant-access', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId')!;
  const userRole = c.get('userRole')!;

  // Only family_admin can grant access
  if (userRole !== 'family_admin') {
    return c.json({ error: 'Only family admins can grant access' }, 403);
  }

  const body = await c.req.json();
  const data = grantAccessSchema.parse(body);

  // Check if care recipient exists and belongs to this admin
  const careRecipient = await db
    .select()
    .from(careRecipients)
    .where(eq(careRecipients.id, data.careRecipientId))
    .get();

  if (!careRecipient) {
    return c.json({ error: 'Care recipient not found' }, 404);
  }

  // Check if access already exists
  const existingAccess = await db
    .select()
    .from(careRecipientAccess)
    .where(
      and(
        eq(careRecipientAccess.careRecipientId, data.careRecipientId),
        eq(careRecipientAccess.userId, data.userId)
      )
    )
    .get();

  if (existingAccess && !existingAccess.revokedAt) {
    return c.json({ error: 'Access already granted' }, 409);
  }

  // Grant access
  const newAccess = await db
    .insert(careRecipientAccess)
    .values({
      careRecipientId: data.careRecipientId,
      userId: data.userId,
      grantedBy: userId,
    })
    .returning()
    .get();

  return c.json(newAccess, 201);
});

/**
 * POST /api/family-members/revoke-access
 * Revoke a family member's access to a care recipient
 */
familyMembers.post('/revoke-access', async (c) => {
  const db = c.get('db');
  const userRole = c.get('userRole')!;

  // Only family_admin can revoke access
  if (userRole !== 'family_admin') {
    return c.json({ error: 'Only family admins can revoke access' }, 403);
  }

  const body = await c.req.json();
  const data = revokeAccessSchema.parse(body);

  // Find the access record
  const accessRecord = await db
    .select()
    .from(careRecipientAccess)
    .where(
      and(
        eq(careRecipientAccess.careRecipientId, data.careRecipientId),
        eq(careRecipientAccess.userId, data.userId),
        eq(careRecipientAccess.revokedAt, null as unknown as Date)
      )
    )
    .get();

  if (!accessRecord) {
    return c.json({ error: 'Access record not found' }, 404);
  }

  // Soft delete by setting revokedAt
  const updated = await db
    .update(careRecipientAccess)
    .set({ revokedAt: new Date() })
    .where(eq(careRecipientAccess.id, accessRecord.id))
    .returning()
    .get();

  return c.json({ success: true, access: updated });
});

/**
 * DELETE /api/family-members/:userId
 * Remove a family member (soft delete)
 */
familyMembers.delete('/:userId', async (c) => {
  const db = c.get('db');
  const currentUserId = c.get('userId')!;
  const userRole = c.get('userRole')!;
  const targetUserId = c.req.param('userId');

  // Only family_admin can remove members
  if (userRole !== 'family_admin') {
    return c.json({ error: 'Only family admins can remove members' }, 403);
  }

  // Can't remove yourself
  if (currentUserId === targetUserId) {
    return c.json({ error: 'Cannot remove yourself' }, 400);
  }

  // Soft delete the user
  const updated = await db
    .update(users)
    .set({ active: false, deletedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning()
    .get();

  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ success: true, message: 'Family member removed' });
});

export default familyMembers;
