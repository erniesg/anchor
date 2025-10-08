-- Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
-- Migration: 0005_add_toileting_tracking
-- Date: 2025-10-08

-- Add separate bowel movements and urination tracking columns
ALTER TABLE care_logs ADD COLUMN bowel_movements TEXT; -- JSON: { frequency, timesUsedToilet, diaperChanges, diaperStatus, accidents, assistance, pain, consistency, concerns }
ALTER TABLE care_logs ADD COLUMN urination TEXT; -- JSON: { frequency, timesUsedToilet, diaperChanges, diaperStatus, accidents, assistance, pain, urineColor, concerns }

-- Note: The old 'toileting' column can remain for backward compatibility
-- Data migration is not needed as the old column was never populated in production
