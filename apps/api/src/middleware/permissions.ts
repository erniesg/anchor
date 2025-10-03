import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../index';
import {
  canAccessCareRecipient,
  canManageCaregivers,
  canInvalidateCareLog,
  caregiverOwnsCareLog,
  caregiverHasAccess,
} from '../lib/access-control';

/**
 * Permissions Middleware
 * Enforces row-level security (RLS) checks
 */

/**
 * Require access to care recipient
 * Expects: careRecipientId in route params or request body
 * Must be called after authUser middleware
 */
export const requireCareRecipientAccess = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');

  if (!userId) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  // Try to get careRecipientId from params or body
  const careRecipientId =
    c.req.param('careRecipientId') ||
    c.req.param('recipientId') ||
    (await c.req.json().catch(() => ({})))?.careRecipientId;

  if (!careRecipientId) {
    return c.json({ error: 'Bad Request', message: 'Missing care recipient ID' }, 400);
  }

  const db = c.get('db');
  const hasAccess = await canAccessCareRecipient(db, userId, careRecipientId);

  if (!hasAccess) {
    return c.json({
      error: 'Forbidden',
      message: 'You do not have access to this care recipient',
    }, 403);
  }

  // Store careRecipientId in context for use in handlers
  c.set('careRecipientId', careRecipientId);

  await next();
});

/**
 * Require permission to manage caregivers
 * Expects: careRecipientId in route params or request body
 * Must be called after authUser and requireFamilyAdmin middleware
 */
export const requireCaregiverManagement = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');

  if (!userId) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  // Try to get careRecipientId from params or body
  const careRecipientId =
    c.req.param('careRecipientId') ||
    (await c.req.json().catch(() => ({})))?.careRecipientId;

  if (!careRecipientId) {
    return c.json({ error: 'Bad Request', message: 'Missing care recipient ID' }, 400);
  }

  const db = c.get('db');
  const canManage = await canManageCaregivers(db, userId, careRecipientId);

  if (!canManage) {
    return c.json({
      error: 'Forbidden',
      message: 'You do not have permission to manage caregivers for this care recipient',
    }, 403);
  }

  await next();
});

/**
 * Require permission to invalidate care log
 * Expects: logId in route params
 * Must be called after authUser and requireFamilyAdmin middleware
 */
export const requireLogInvalidation = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');
  const logId = c.req.param('logId') || c.req.param('id');

  if (!userId) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
  }

  if (!logId) {
    return c.json({ error: 'Bad Request', message: 'Missing care log ID' }, 400);
  }

  const db = c.get('db');
  const canInvalidate = await canInvalidateCareLog(db, userId, logId);

  if (!canInvalidate) {
    return c.json({
      error: 'Forbidden',
      message: 'You do not have permission to invalidate this care log',
    }, 403);
  }

  await next();
});

/**
 * Require caregiver owns the care log
 * Expects: logId in route params
 * Must be called after authCaregiverToken middleware
 */
export const requireCareLogOwnership = createMiddleware<AppContext>(async (c, next) => {
  const caregiverId = c.get('caregiverId');
  const logId = c.req.param('logId') || c.req.param('id');

  if (!caregiverId) {
    return c.json({ error: 'Unauthorized', message: 'Caregiver authentication required' }, 401);
  }

  if (!logId) {
    return c.json({ error: 'Bad Request', message: 'Missing care log ID' }, 400);
  }

  const db = c.get('db');
  const owns = await caregiverOwnsCareLog(db, caregiverId, logId);

  if (!owns) {
    return c.json({
      error: 'Forbidden',
      message: 'You can only edit your own care logs',
    }, 403);
  }

  await next();
});

/**
 * Require caregiver has access to care recipient
 * Expects: careRecipientId in route params or request body
 * Must be called after authCaregiverToken middleware
 */
export const requireCaregiverRecipientAccess = createMiddleware<AppContext>(async (c, next) => {
  const caregiverId = c.get('caregiverId');

  if (!caregiverId) {
    return c.json({ error: 'Unauthorized', message: 'Caregiver authentication required' }, 401);
  }

  // Try to get careRecipientId from params or body
  const careRecipientId =
    c.req.param('careRecipientId') ||
    c.req.param('recipientId') ||
    (await c.req.json().catch(() => ({})))?.careRecipientId;

  if (!careRecipientId) {
    return c.json({ error: 'Bad Request', message: 'Missing care recipient ID' }, 400);
  }

  const db = c.get('db');
  const hasAccess = await caregiverHasAccess(db, caregiverId, careRecipientId);

  if (!hasAccess) {
    return c.json({
      error: 'Forbidden',
      message: 'You are not assigned to this care recipient',
    }, 403);
  }

  await next();
});
