import { eq, and, isNull } from 'drizzle-orm';
import type { createDbClient } from '@anchor/database';
import { users, careRecipients, careRecipientAccess, caregivers, careLogs } from '@anchor/database/schema';

/**
 * Access Control Library
 * Row-Level Security (RLS) helpers for RBAC system
 */

type DbClient = ReturnType<typeof createDbClient>;

/**
 * Check if user can access a care recipient
 * - family_admin has implicit access (owner)
 * - family_member needs explicit grant via care_recipient_access table
 */
export async function canAccessCareRecipient(
  db: DbClient,
  userId: string,
  careRecipientId: string
): Promise<boolean> {
  // Check if user is the family_admin (owner)
  const isOwner = await db
    .select({ id: careRecipients.id })
    .from(careRecipients)
    .where(
      and(
        eq(careRecipients.id, careRecipientId),
        eq(careRecipients.familyAdminId, userId)
      )
    )
    .get();

  if (isOwner) return true;

  // Check if user has explicit access (family_member)
  const hasAccess = await db
    .select({ id: careRecipientAccess.id })
    .from(careRecipientAccess)
    .where(
      and(
        eq(careRecipientAccess.careRecipientId, careRecipientId),
        eq(careRecipientAccess.userId, userId),
        isNull(careRecipientAccess.revokedAt) // Not revoked
      )
    )
    .get();

  return !!hasAccess;
}

/**
 * Check if user can manage caregivers for a care recipient
 * Only family_admin can manage caregivers
 */
export async function canManageCaregivers(
  db: DbClient,
  userId: string,
  careRecipientId: string
): Promise<boolean> {
  // Get user role
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user || user.role !== 'family_admin') {
    return false;
  }

  // Must be the owner of the care recipient
  const isOwner = await db
    .select({ id: careRecipients.id })
    .from(careRecipients)
    .where(
      and(
        eq(careRecipients.id, careRecipientId),
        eq(careRecipients.familyAdminId, userId)
      )
    )
    .get();

  return !!isOwner;
}

/**
 * Check if user can invalidate a care log
 * Only family_admin who owns the care recipient can invalidate
 */
export async function canInvalidateCareLog(
  db: DbClient,
  userId: string,
  careLogId: string
): Promise<boolean> {
  // Get user role
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user || user.role !== 'family_admin') {
    return false;
  }

  // Get care log's care recipient
  const careLog = await db
    .select({ careRecipientId: careLogs.careRecipientId })
    .from(careLogs)
    .where(eq(careLogs.id, careLogId))
    .get();

  if (!careLog) {
    return false;
  }

  // Check if user owns the care recipient
  return canAccessCareRecipient(db, userId, careLog.careRecipientId);
}

/**
 * Check if caregiver owns a care log
 * Caregivers can only edit/submit their own drafts
 */
export async function caregiverOwnsCareLog(
  db: DbClient,
  caregiverId: string,
  careLogId: string
): Promise<boolean> {
  const careLog = await db
    .select({ caregiverId: careLogs.caregiverId })
    .from(careLogs)
    .where(eq(careLogs.id, careLogId))
    .get();

  return careLog?.caregiverId === caregiverId;
}

/**
 * Check if caregiver is active and assigned to care recipient
 */
export async function caregiverHasAccess(
  db: DbClient,
  caregiverId: string,
  careRecipientId: string
): Promise<boolean> {
  const caregiver = await db
    .select({
      careRecipientId: caregivers.careRecipientId,
      active: caregivers.active,
    })
    .from(caregivers)
    .where(eq(caregivers.id, caregiverId))
    .get();

  if (!caregiver) {
    return false;
  }

  return caregiver.careRecipientId === careRecipientId && caregiver.active;
}

/**
 * Get all care recipients accessible by user
 * - family_admin: All care recipients they own
 * - family_member: Care recipients explicitly granted access
 */
export async function getAccessibleCareRecipients(
  db: DbClient,
  userId: string
): Promise<string[]> {
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return [];
  }

  if (user.role === 'family_admin') {
    // Family admin owns all their care recipients
    const recipients = await db
      .select({ id: careRecipients.id })
      .from(careRecipients)
      .where(eq(careRecipients.familyAdminId, userId))
      .all();

    return recipients.map((r) => r.id);
  }

  if (user.role === 'family_member') {
    // Family member has explicit grants
    const accessGrants = await db
      .select({ careRecipientId: careRecipientAccess.careRecipientId })
      .from(careRecipientAccess)
      .where(
        and(
          eq(careRecipientAccess.userId, userId),
          isNull(careRecipientAccess.revokedAt)
        )
      )
      .all();

    return accessGrants.map((g) => g.careRecipientId);
  }

  return [];
}

/**
 * Check if user can grant access to care recipient
 * Only family_admin who owns the care recipient can grant access
 */
export async function canGrantAccess(
  db: DbClient,
  userId: string,
  careRecipientId: string
): Promise<boolean> {
  return canManageCaregivers(db, userId, careRecipientId);
}

/**
 * Check if user can revoke access to care recipient
 * Only family_admin who owns the care recipient can revoke access
 */
export async function canRevokeAccess(
  db: DbClient,
  userId: string,
  careRecipientId: string
): Promise<boolean> {
  return canManageCaregivers(db, userId, careRecipientId);
}

/**
 * Verify user exists and is active
 */
export async function isActiveUser(db: DbClient, userId: string): Promise<boolean> {
  const user = await db
    .select({ active: users.active, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return !!(user && user.active && !user.deletedAt);
}

/**
 * Verify caregiver exists and is active
 */
export async function isActiveCaregiver(db: DbClient, caregiverId: string): Promise<boolean> {
  const caregiver = await db
    .select({ active: caregivers.active })
    .from(caregivers)
    .where(eq(caregivers.id, caregiverId))
    .get();

  return !!(caregiver && caregiver.active);
}
