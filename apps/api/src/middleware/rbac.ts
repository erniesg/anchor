import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../index';
import { authUser, authCaregiverToken } from './auth';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces role requirements for routes
 */

/**
 * Require family_admin role
 * Must be called after authUser middleware
 */
export const requireFamilyAdmin = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  if (!userId || !userRole) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  if (userRole !== 'family_admin') {
    return c.json({
      error: 'Forbidden',
      message: 'This action requires family_admin role',
    }, 403);
  }

  await next();
});

/**
 * Require family_member role (allows both family_admin and family_member)
 * Must be called after authUser middleware
 */
export const requireFamilyMember = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  if (!userId || !userRole) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  if (userRole !== 'family_admin' && userRole !== 'family_member') {
    return c.json({
      error: 'Forbidden',
      message: 'This action requires family member access',
    }, 403);
  }

  await next();
});

/**
 * Require caregiver authentication
 * Must be called after authCaregiverToken middleware
 */
export const requireCaregiver = createMiddleware<AppContext>(async (c, next) => {
  const caregiverId = c.get('caregiverId');

  if (!caregiverId) {
    return c.json({ error: 'Unauthorized', message: 'Caregiver authentication required' }, 401);
  }

  await next();
});

/**
 * Combined middleware: Auth + Role check for family_admin
 */
export const familyAdminOnly = [authUser, requireFamilyAdmin];

/**
 * Combined middleware: Auth + Role check for family_member (includes family_admin)
 */
export const familyMemberAccess = [authUser, requireFamilyMember];

/**
 * Combined middleware: Auth for caregiver
 */
export const caregiverOnly = [authCaregiverToken, requireCaregiver];
