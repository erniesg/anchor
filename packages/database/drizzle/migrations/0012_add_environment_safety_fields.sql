-- Environment & Safety Completions
-- Migration: 0012_add_environment_safety_fields
-- Date: 2025-11-13
-- Purpose: Add missing fields from Template pages 13-14 (Room Maintenance, Personal Items, Hospital Bag status)

-- Add room maintenance tracking
ALTER TABLE care_logs ADD COLUMN room_maintenance TEXT;
-- JSON structure: { cleaningStatus: 'completed_by_maid' | 'caregiver_assisted' | 'not_done', roomComfort: 'good_temperature' | 'too_hot' | 'too_cold' }

-- Add personal items daily check
ALTER TABLE care_logs ADD COLUMN personal_items_check TEXT;
-- JSON structure: { spectaclesCleaned: { checked: boolean, status: 'clean' | 'need_cleaning' }, jewelryAccountedFor: { checked: boolean, status: 'all_present' | 'missing_item', notes?: string }, handbagOrganized: { checked: boolean, status: 'organized' | 'need_organizing' } }

-- Add hospital bag daily status check
ALTER TABLE care_logs ADD COLUMN hospital_bag_status TEXT;
-- JSON structure: { bagReady: boolean, location?: string, lastChecked?: boolean, notes?: string }
