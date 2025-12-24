-- Migration: 0005_progressive_section_submission.sql
-- Progressive Section Submission Feature
-- Created: 2025-12-23
--
-- Allows caregivers to "share" sections with family throughout the day
-- without locking themselves out. Final "Submit All" locks the form.
--
-- Section Types:
-- - morning: Wake up, mood, shower, AM medications, breakfast, AM vitals
-- - afternoon: PM medications, lunch, PM vitals, afternoon rest, exercise
-- - evening: Evening medications, dinner, bedtime meds, night sleep
-- - dailySummary: Toileting, fall risk, unaccompanied time, safety checks, notes

-- Add completed_sections JSON field to track per-section submissions
ALTER TABLE care_logs ADD COLUMN completed_sections TEXT;

-- Example JSON structure:
-- {
--   "morning": { "submittedAt": "2025-12-23T09:30:00Z", "submittedBy": "caregiver-uuid" },
--   "afternoon": { "submittedAt": "2025-12-23T15:00:00Z", "submittedBy": "caregiver-uuid" },
--   "evening": { "submittedAt": "2025-12-23T20:30:00Z", "submittedBy": "caregiver-uuid" },
--   "dailySummary": { "submittedAt": "2025-12-23T21:00:00Z", "submittedBy": "caregiver-uuid" }
-- }

-- Create index for querying logs with completed sections
-- (SQLite JSON functions can use this for queries like json_extract)
CREATE INDEX IF NOT EXISTS idx_care_logs_completed_sections ON care_logs(completed_sections);
