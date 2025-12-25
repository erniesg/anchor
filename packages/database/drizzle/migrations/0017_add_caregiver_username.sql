-- Add username field to caregivers table
-- Format: adjective-animal-number (e.g., "happy-panda-42")
-- Easier to remember than UUID for caregiver login

ALTER TABLE caregivers ADD COLUMN username TEXT UNIQUE;
