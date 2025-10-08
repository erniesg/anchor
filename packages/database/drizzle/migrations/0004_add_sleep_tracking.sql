-- Sprint 2 Day 3: Add Sleep Tracking Fields
-- Migration: 0004_add_sleep_tracking
-- Date: 2025-10-08

ALTER TABLE care_logs ADD COLUMN afternoon_rest TEXT; -- JSON: { startTime, endTime, quality, notes }
ALTER TABLE care_logs ADD COLUMN night_sleep TEXT; -- JSON: { bedtime, quality, wakings, wakingReasons[], behaviors[], notes }
