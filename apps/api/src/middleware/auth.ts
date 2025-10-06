import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../index';
import { verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { caregivers } from '@anchor/database/schema';
import { isActiveUser, isActiveCaregiver } from '../lib/access-control';

/**
 * Authentication Middleware
 * Extracts and validates user/caregiver from JWT or PIN
 */

/**
 * Extract user from JWT token (family_admin or family_member)
 * Sets: c.set('userId', userId) and c.set('userRole', role)
 */
export const authUser = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify JWT
    const payload = await verify(token, c.env.JWT_SECRET);

    if (!payload.sub || !payload.role) {
      return c.json({ error: 'Unauthorized', message: 'Invalid token payload' }, 401);
    }

    const userId = payload.sub as string;
    const role = payload.role as 'family_admin' | 'family_member';

    // Verify user exists and is active
    const db = c.get('db');
    const active = await isActiveUser(db, userId);

    if (!active) {
      return c.json({ error: 'Unauthorized', message: 'User account is inactive or deleted' }, 401);
    }

    // Set user context
    c.set('userId', userId);
    c.set('userRole', role);

    await next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
  }
});

/**
 * Extract caregiver from PIN-based authentication
 * Expects: POST body with { caregiverId, pin }
 * Sets: c.set('caregiverId', caregiverId)
 */
export const authCaregiver = createMiddleware<AppContext>(async (c, next) => {
  const body = await c.req.json();
  const { caregiverId, pin } = body;

  if (!caregiverId || !pin) {
    return c.json({ error: 'Unauthorized', message: 'Missing caregiver ID or PIN' }, 401);
  }

  const db = c.get('db');

  // Get caregiver from database
  const caregiver = await db
    .select({
      id: caregivers.id,
      pinCode: caregivers.pinCode,
      active: caregivers.active,
    })
    .from(caregivers)
    .where(eq(caregivers.id, caregiverId))
    .get();

  if (!caregiver) {
    return c.json({ error: 'Unauthorized', message: 'Caregiver not found' }, 401);
  }

  if (!caregiver.active) {
    return c.json({ error: 'Unauthorized', message: 'Caregiver account is inactive' }, 401);
  }

  // Verify PIN (in production, use bcrypt.compare)
  // For now, direct comparison (PIN should be hashed in real implementation)
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(pin).digest('hex');

  if (hash !== caregiver.pinCode) {
    return c.json({ error: 'Unauthorized', message: 'Invalid PIN' }, 401);
  }

  // Set caregiver context
  c.set('caregiverId', caregiverId);

  await next();
});

/**
 * Extract caregiver from Authorization header (after PIN login)
 * Expects: Authorization: Bearer <JWT with caregiverId>
 * Sets: c.set('caregiverId', caregiverId) and c.set('careRecipientId', careRecipientId)
 */
export const authCaregiverToken = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid caregiver authorization' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify JWT
    const payload = await verify(token, c.env.JWT_SECRET);

    if (!payload.caregiverId) {
      return c.json({ error: 'Unauthorized', message: 'Invalid caregiver token' }, 401);
    }

    const caregiverId = payload.caregiverId as string;
    const careRecipientId = payload.careRecipientId as string | undefined;

    // Verify caregiver exists and is active
    const db = c.get('db');
    const active = await isActiveCaregiver(db, caregiverId);

    if (!active) {
      return c.json({ error: 'Unauthorized', message: 'Caregiver account is inactive' }, 401);
    }

    // Set caregiver context
    c.set('caregiverId', caregiverId);
    if (careRecipientId) {
      c.set('careRecipientId', careRecipientId);
    }

    await next();
  } catch (error) {
    console.error('Caregiver JWT verification failed:', error);
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired caregiver token' }, 401);
  }
});

/**
 * Optional authentication - doesn't fail if no auth provided
 * Useful for public endpoints that want to know who's calling but don't require auth
 */
export const optionalAuth = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    // No auth provided, continue without setting user
    await next();
    return;
  }

  if (authHeader.startsWith('Bearer caregiver_')) {
    // Try caregiver auth
    try {
      const token = authHeader.substring(7);
      const parts = token.split('_');

      if (parts.length >= 2 && parts[0] === 'caregiver') {
        const caregiverId = parts[1]!; // Safe: checked length above
        const db = c.get('db');
        const active = await isActiveCaregiver(db, caregiverId);

        if (active) {
          c.set('caregiverId', caregiverId);
        }
      }
    } catch (error) {
      // Ignore auth errors for optional auth
    }
  } else if (authHeader.startsWith('Bearer ')) {
    // Try user JWT auth
    try {
      const token = authHeader.substring(7);
      const payload = await verify(token, c.env.JWT_SECRET);

      if (payload.sub && payload.role && typeof payload.sub === 'string') {
        const userId = payload.sub;
        const db = c.get('db');
        const active = await isActiveUser(db, userId);

        if (active) {
          c.set('userId', userId);
          c.set('userRole', payload.role as 'family_admin' | 'family_member');
        }
      }
    } catch (error) {
      // Ignore auth errors for optional auth
    }
  }

  await next();
});

