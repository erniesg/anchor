-- Pack Lists Feature
-- Migration: 0011_add_pack_lists
-- Date: 2025-11-06
-- Purpose: Add pack lists (hospital bag/emergency bag) tracking per care recipient

-- Create pack_lists table
CREATE TABLE IF NOT EXISTS pack_lists (
  id TEXT PRIMARY KEY NOT NULL,
  care_recipient_id TEXT NOT NULL UNIQUE REFERENCES care_recipients(id) ON DELETE CASCADE,
  items TEXT NOT NULL DEFAULT '[]',
  last_verified_at INTEGER,
  last_verified_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  updated_by TEXT REFERENCES users(id)
);

-- JSON structure for items:
-- [
--   {
--     id: string,
--     name: string,
--     packed: boolean,
--     category: 'documents' | 'medications' | 'clothing' | 'toiletries' | 'medical_equipment' | 'other',
--     priority: 'essential' | 'important' | 'optional',
--     notes?: string,
--     quantity?: string
--   }
-- ]
