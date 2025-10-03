-- Migration: Add RBAC (Role-Based Access Control) and Draft/Submit Workflow
-- Created: 2025-10-03
-- Description:
--   1. Update user roles (family_admin, family_member)
--   2. Add timezone support
--   3. Create care_recipient_access junction table
--   4. Rename familyId to familyAdminId in care_recipients
--   5. Add caregiver management fields (deactivation tracking, PIN reset)
--   6. Add draft/submit/invalidated status to care_logs

-- Step 1: Update users table
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN sms_notifications INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Singapore' NOT NULL;

-- Step 2: Update care_recipients table
-- Rename family_id to family_admin_id (preserves data)
ALTER TABLE care_recipients RENAME COLUMN family_id TO family_admin_id;
ALTER TABLE care_recipients ADD COLUMN timezone TEXT DEFAULT 'Asia/Singapore' NOT NULL;

-- Step 3: Create care_recipient_access junction table
CREATE TABLE care_recipient_access (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  granted_by TEXT,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Step 4: Update caregivers table
ALTER TABLE caregivers ADD COLUMN email TEXT;
ALTER TABLE caregivers ADD COLUMN deactivated_at INTEGER;
ALTER TABLE caregivers ADD COLUMN deactivated_by TEXT REFERENCES users(id);
ALTER TABLE caregivers ADD COLUMN deactivation_reason TEXT;
ALTER TABLE caregivers ADD COLUMN last_pin_reset_at INTEGER;
ALTER TABLE caregivers ADD COLUMN last_pin_reset_by TEXT REFERENCES users(id);
ALTER TABLE caregivers ADD COLUMN created_by TEXT REFERENCES users(id);

-- Step 5: Update care_logs table - Add draft/submit status
ALTER TABLE care_logs ADD COLUMN status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft', 'submitted', 'invalidated'));
ALTER TABLE care_logs ADD COLUMN submitted_at INTEGER;
ALTER TABLE care_logs ADD COLUMN invalidated_at INTEGER;
ALTER TABLE care_logs ADD COLUMN invalidated_by TEXT REFERENCES users(id);
ALTER TABLE care_logs ADD COLUMN invalidation_reason TEXT;

-- Step 6: Create indexes for performance
CREATE INDEX idx_care_recipient_access_care_recipient ON care_recipient_access(care_recipient_id);
CREATE INDEX idx_care_recipient_access_user ON care_recipient_access(user_id);
CREATE INDEX idx_care_logs_status ON care_logs(status);
CREATE INDEX idx_care_logs_submitted_at ON care_logs(submitted_at);
CREATE INDEX idx_caregivers_active ON caregivers(active);
CREATE INDEX idx_users_active ON users(active);

-- Step 7: Data migration - Update existing roles
-- Change 'family' role to 'family_admin' and 'admin' to 'family_admin'
UPDATE users SET role = 'family_admin' WHERE role IN ('family', 'admin');

-- Step 8: Mark all existing care_logs as 'submitted' (they were already submitted before this migration)
UPDATE care_logs SET status = 'submitted', submitted_at = created_at WHERE status = 'draft';

-- Rollback instructions (for documentation):
-- DROP INDEX IF EXISTS idx_users_active;
-- DROP INDEX IF EXISTS idx_caregivers_active;
-- DROP INDEX IF EXISTS idx_care_logs_submitted_at;
-- DROP INDEX IF EXISTS idx_care_logs_status;
-- DROP INDEX IF EXISTS idx_care_recipient_access_user;
-- DROP INDEX IF EXISTS idx_care_recipient_access_care_recipient;
-- DROP TABLE IF EXISTS care_recipient_access;
-- ALTER TABLE users DROP COLUMN timezone;
-- ALTER TABLE users DROP COLUMN sms_notifications;
-- ALTER TABLE users DROP COLUMN email_notifications;
-- ALTER TABLE users DROP COLUMN deleted_at;
-- ALTER TABLE users DROP COLUMN active;
-- ALTER TABLE care_recipients RENAME COLUMN family_admin_id TO family_id;
-- ALTER TABLE care_recipients DROP COLUMN timezone;
-- (etc - full rollback would be complex due to SQLite limitations)
