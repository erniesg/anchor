-- Prevent duplicate care logs for the same caregiver + care recipient + date
-- Clean up any existing duplicates first (keep the one with latest updated_at)
DELETE FROM care_logs
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY caregiver_id, care_recipient_id, date(log_date, 'unixepoch')
      ORDER BY updated_at DESC
    ) as rn
    FROM care_logs
  ) WHERE rn = 1
);

-- Create unique index on caregiver + care recipient + date
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_logs_unique_daily
ON care_logs (caregiver_id, care_recipient_id, date(log_date, 'unixepoch'));
