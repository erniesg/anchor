-- Sprint 3 Day 5: Special Concerns & Incidents
-- Migration: 0010_add_special_concerns
-- Date: 2025-10-09
-- Source: Daily Care Report Template page 13

-- Add special concerns and incidents tracking
ALTER TABLE care_logs ADD COLUMN special_concerns TEXT;
-- JSON: {
--   priorityLevel?: string, // emergency/urgent/routine
--   behaviouralChanges?: string[], // Array of 13 possible changes
--   physicalChanges?: string, // Free text for physical symptoms
--   incidentDescription?: string, // Detailed incident description
--   actionsTaken?: string, // What was done in response
--   notes?: string // Additional notes
-- }

-- Note: emergency_flag and emergency_note columns already exist for backward compatibility
-- The new special_concerns field provides more granular tracking
