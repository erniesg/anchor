-- Audit History & Change Tracking
-- Migration: 0013_add_audit_history
-- Date: 2025-12-23
-- Purpose: Track changes to care logs for family visibility and audit trail

-- Care Log Audit Table
-- Stores a snapshot of changes made to care logs
CREATE TABLE IF NOT EXISTS care_log_audit (
  id TEXT PRIMARY KEY,
  care_log_id TEXT NOT NULL REFERENCES care_logs(id) ON DELETE CASCADE,

  -- Who made the change
  changed_by TEXT NOT NULL, -- caregiver_id who made the change
  changed_by_name TEXT, -- Caregiver name at time of change (denormalized for history)

  -- What changed
  action TEXT NOT NULL CHECK(action IN ('create', 'update', 'submit', 'submit_section')),
  section_submitted TEXT, -- For submit_section action: 'morning', 'afternoon', 'evening', 'dailySummary'

  -- Change details (JSON)
  -- For 'update' action: { fieldName: { old: value, new: value }, ... }
  -- For 'submit_section': { section: 'morning', fields: ['wakeTime', 'mood', ...] }
  changes TEXT, -- JSON object of field changes

  -- Full snapshot of the care log at this point (for rollback/comparison)
  snapshot TEXT, -- Full JSON of care_log data at this point

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for fast lookups by care log
CREATE INDEX IF NOT EXISTS idx_care_log_audit_care_log_id ON care_log_audit(care_log_id);
CREATE INDEX IF NOT EXISTS idx_care_log_audit_created_at ON care_log_audit(created_at);

-- Family View Tracking Table
-- Tracks when family members last viewed each care log
CREATE TABLE IF NOT EXISTS care_log_views (
  id TEXT PRIMARY KEY,
  care_log_id TEXT NOT NULL REFERENCES care_logs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Last viewed timestamp
  viewed_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Unique constraint: one record per user per care log
  UNIQUE(care_log_id, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_care_log_views_user_id ON care_log_views(user_id);
CREATE INDEX IF NOT EXISTS idx_care_log_views_care_log_id ON care_log_views(care_log_id);
