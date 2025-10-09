-- Sprint 3 Day 3: Oral Care & Hygiene
-- Migration: 0008_add_oral_care
-- Date: 2025-10-09
-- Source: Daily Care Report Template page 10

-- Add oral care and hygiene tracking
ALTER TABLE care_logs ADD COLUMN oral_care TEXT;
-- JSON: {
--   teethBrushed?: boolean,
--   timesBrushed?: number, // How many times today
--   denturesCleaned?: boolean,
--   mouthRinsed?: boolean,
--   assistanceLevel?: string, // none/minimal/moderate/full
--   oralHealthIssues?: string[], // bleeding_gums/dry_mouth/sores/pain/bad_breath/none
--   painOrBleeding?: boolean,
--   notes?: string
-- }
