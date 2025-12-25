-- Add username field to caregivers table
-- Format: adjective-animal-number (e.g., "happy-panda-42")
-- Easier to remember than UUID for caregiver login

-- SQLite doesn't support UNIQUE in ALTER TABLE, so add column then create index
ALTER TABLE caregivers ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_caregivers_username ON caregivers(username);
