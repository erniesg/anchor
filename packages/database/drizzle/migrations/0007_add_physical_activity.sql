-- Sprint 3 Day 2: Physical Activity & Exercise
-- Migration: 0007_add_physical_activity
-- Date: 2025-10-08
-- Source: Daily Care Report Template pages 8-9

-- Add physical activity and exercise tracking
ALTER TABLE care_logs ADD COLUMN physical_activity TEXT;
-- JSON: {
--   exerciseDuration?: number, // Minutes of exercise/activity
--   exerciseType?: string[], // walking/stretching/chair_exercises/outdoor_activity/physical_therapy
--   walkingDistance?: string, // e.g., "around house", "to mailbox", "2 blocks"
--   assistanceLevel?: string, // none/minimal/moderate/full
--   painDuringActivity?: string, // none/mild/moderate/severe
--   energyAfterActivity?: string, // energized/tired/exhausted/same
--   participationWillingness?: string, // enthusiastic/willing/reluctant/refused
--   equipmentUsed?: string[], // walker/cane/wheelchair/none
--   mobilityNotes?: string // Notes on mobility changes or observations
-- }
