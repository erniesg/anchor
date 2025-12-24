-- Progressive Section Submission
-- Migration: 0014_add_completed_sections
-- Date: 2025-12-23
-- Purpose: Add completed_sections column to care_logs for progressive submission tracking

-- Add completed_sections column to track which sections have been shared with family
ALTER TABLE care_logs ADD COLUMN completed_sections TEXT;
