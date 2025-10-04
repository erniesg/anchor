-- Migration: Add Authentication Support
-- Created: 2025-10-04
-- Description: Add password_hash column to users table for JWT authentication

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';

-- Note: DEFAULT '' is temporary for existing rows
-- In production, you should:
-- 1. Add the column as nullable first
-- 2. Populate it with hashed passwords
-- 3. Make it NOT NULL after all rows are updated
