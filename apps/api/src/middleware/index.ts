/**
 * Middleware Barrel Export
 * Centralized export for all middleware functions
 */

// Authentication
export {
  authUser,
  authCaregiver,
  authCaregiverToken,
  optionalAuth,
} from './auth';

// Role-Based Access Control
export {
  requireFamilyAdmin,
  requireFamilyMember,
  requireCaregiver,
  familyAdminOnly,
  familyMemberAccess,
  caregiverOnly,
} from './rbac';

// Permissions (Row-Level Security)
export {
  requireCareRecipientAccess,
  requireCaregiverManagement,
  requireLogInvalidation,
  requireCareLogOwnership,
  requireCaregiverRecipientAccess,
} from './permissions';
