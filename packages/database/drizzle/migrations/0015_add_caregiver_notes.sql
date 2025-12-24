-- Sprint 3 Day 3: Add Caregiver Notes (structured daily summary)
-- Stores: whatWentWell, challengesFaced, recommendationsForTomorrow, importantInfoForFamily, caregiverSignature
ALTER TABLE care_logs ADD COLUMN caregiver_notes TEXT;
