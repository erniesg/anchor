-- Migration: Add Sprint 1 Fall Risk Assessment Columns
-- Created: 2025-10-07
-- Description: Add detailed fall risk assessment and safety tracking columns

-- Add balance_issues (1-5 scale, separate from legacy balance_scale)
ALTER TABLE care_logs ADD COLUMN balance_issues INTEGER;

-- Add granular fall tracking (replaces generic falls JSON)
ALTER TABLE care_logs ADD COLUMN near_falls TEXT CHECK(near_falls IN ('none', 'once_or_twice', 'multiple'));
ALTER TABLE care_logs ADD COLUMN actual_falls TEXT CHECK(actual_falls IN ('none', 'minor', 'major'));

-- Add unaccompanied time tracking (new structure)
ALTER TABLE care_logs ADD COLUMN unaccompanied_time TEXT; -- JSON array
ALTER TABLE care_logs ADD COLUMN unaccompanied_incidents TEXT;

-- Add safety checks and emergency prep
ALTER TABLE care_logs ADD COLUMN safety_checks TEXT; -- JSON object
ALTER TABLE care_logs ADD COLUMN emergency_prep TEXT; -- JSON object
