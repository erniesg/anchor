-- Sprint 3 Day 1: Spiritual & Emotional Well-Being
-- Migration: 0006_add_spiritual_emotional
-- Date: 2025-10-08
-- Source: Daily Care Report Template page 12

-- Add spiritual and emotional tracking
ALTER TABLE care_logs ADD COLUMN spiritual_emotional TEXT;
-- JSON: {
--   prayerTime?: { start: string, end: string }, // Time range for prayer
--   prayerExpression?: string, // speaking_out_loud/whispering/mumbling/silent_worship
--   overallMood?: number, // 1-5 scale
--   communicationScale?: number, // 1-5 scale
--   socialInteraction?: string // engaged/responsive/withdrawn/aggressive_hostile
-- }
