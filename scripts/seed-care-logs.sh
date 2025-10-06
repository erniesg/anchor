#!/bin/bash

# Seed Care Logs for Testing Trends
# Creates 6 days of realistic care log data (day 7 already exists)

CARE_RECIPIENT_ID="e2ad983e-18f6-4471-ab11-3b55d5927355"
CAREGIVER_ID="88fef386-a0bd-452d-a8b6-be2844ef0bc6"

echo "🌱 Seeding care logs for last 6 days..."

# Day 1 (6 days ago) - Normal vitals
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-6 days')),
  'submitted',
  '07:30', 'happy', '08:00', 1,
  '[{\"meal\":\"breakfast\",\"time\":\"08:30\",\"appetite\":4,\"amount\":85}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"08:00\"},{\"name\":\"Forxiga 10mg\",\"given\":true,\"time\":\"08:45\"}]',
  '{\"bowel\":1,\"urine\":4,\"diaper\":2}',
  '118/75', 72, 98, 5.2, '09:00',
  unixepoch('now', '-6 days', '+1 hour'),
  unixepoch('now', '-6 days', '+1 hour'),
  unixepoch('now', '-6 days', '+2 hours')
);" && echo "✅ Day 1 (6 days ago) - Normal vitals: BP 118/75, Pulse 72, O₂ 98%, Sugar 5.2"

# Day 2 (5 days ago) - Stage 1 Hypertension
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-5 days')),
  'submitted',
  '07:15', 'neutral', '08:15', 0,
  '[{\"meal\":\"breakfast\",\"time\":\"08:45\",\"appetite\":3,\"amount\":70}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"08:15\"},{\"name\":\"Forxiga 10mg\",\"given\":true,\"time\":\"09:00\"}]',
  '{\"bowel\":1,\"urine\":5,\"diaper\":3}',
  '132/82', 78, 97, 6.1, '09:15',
  unixepoch('now', '-5 days', '+1 hour'),
  unixepoch('now', '-5 days', '+1 hour'),
  unixepoch('now', '-5 days', '+2 hours')
);" && echo "✅ Day 2 (5 days ago) - Stage 1 Hypertension: BP 132/82 ⚠️"

# Day 3 (4 days ago) - Mild Hypoxemia
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  notes,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-4 days')),
  'submitted',
  '07:45', 'tired', '08:30', 1,
  '[{\"meal\":\"breakfast\",\"time\":\"09:00\",\"appetite\":3,\"amount\":60}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"08:30\"},{\"name\":\"Forxiga 10mg\",\"given\":true,\"time\":\"09:15\"}]',
  '{\"bowel\":0,\"urine\":4,\"diaper\":2}',
  '125/78', 82, 93, 5.8, '09:30',
  'Patient seemed tired today. Oxygen level slightly low. Encouraged deep breathing exercises.',
  unixepoch('now', '-4 days', '+1 hour'),
  unixepoch('now', '-4 days', '+1 hour'),
  unixepoch('now', '-4 days', '+2 hours')
);" && echo "✅ Day 3 (4 days ago) - Mild Hypoxemia: O₂ 93% ⚠️"

# Day 4 (3 days ago) - Hyperglycemia
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  notes,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-3 days')),
  'submitted',
  '07:00', 'happy', '07:45', 1,
  '[{\"meal\":\"breakfast\",\"time\":\"08:15\",\"appetite\":5,\"amount\":95}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"07:45\"},{\"name\":\"Forxiga 10mg\",\"given\":true,\"time\":\"08:30\"}]',
  '{\"bowel\":1,\"urine\":6,\"diaper\":2}',
  '120/76', 75, 98, 12.3, '09:00',
  'Blood sugar elevated after breakfast. Patient ate very well today (extra toast and jam).',
  unixepoch('now', '-3 days', '+1 hour'),
  unixepoch('now', '-3 days', '+1 hour'),
  unixepoch('now', '-3 days', '+2 hours')
);" && echo "✅ Day 4 (3 days ago) - Hyperglycemia: Sugar 12.3 mmol/L ⚠️"

# Day 5 (2 days ago) - Tachycardia + Elevated BP
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  notes,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-2 days')),
  'submitted',
  '06:45', 'anxious', '07:30', 0,
  '[{\"meal\":\"breakfast\",\"time\":\"08:00\",\"appetite\":2,\"amount\":50}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"07:30\"},{\"name\":\"Forxiga 10mg\",\"given\":false,\"time\":null}]',
  '{\"bowel\":1,\"urine\":5,\"diaper\":3}',
  '138/85', 105, 96, 5.5, '08:45',
  'Patient seemed anxious this morning. Pulse elevated. Tried calming activities - music and gentle conversation.',
  unixepoch('now', '-2 days', '+1 hour'),
  unixepoch('now', '-2 days', '+1 hour'),
  unixepoch('now', '-2 days', '+2 hours')
);" && echo "✅ Day 5 (2 days ago) - Tachycardia: Pulse 105 bpm, BP 138/85 ⚠️"

# Day 6 (yesterday) - Back to normal
wrangler d1 execute anchor-dev-db --env dev --remote --command "
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, status,
  wake_time, mood, shower_time, hair_wash,
  meals, medications, toileting,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  created_at, updated_at, submitted_at
) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  unixepoch(date('now', '-1 day')),
  'submitted',
  '07:20', 'happy', '08:00', 1,
  '[{\"meal\":\"breakfast\",\"time\":\"08:30\",\"appetite\":4,\"amount\":80}]',
  '[{\"name\":\"Glucophage 500mg\",\"given\":true,\"time\":\"08:00\"},{\"name\":\"Forxiga 10mg\",\"given\":true,\"time\":\"08:45\"}]',
  '{\"bowel\":1,\"urine\":5,\"diaper\":2}',
  '122/77', 74, 98, 5.4, '09:00',
  unixepoch('now', '-1 day', '+1 hour'),
  unixepoch('now', '-1 day', '+1 hour'),
  unixepoch('now', '-1 day', '+2 hours')
);" && echo "✅ Day 6 (yesterday) - Normal vitals: All readings back to normal ✓"

echo ""
echo "🎉 Successfully seeded 6 days of care log data!"
echo ""
echo "📊 Vital Sign Variations:"
echo "   Day 1 (6 days ago): Normal - BP 118/75, Pulse 72, O₂ 98%, Sugar 5.2"
echo "   Day 2 (5 days ago): ⚠️ Stage 1 Hypertension - BP 132/82"
echo "   Day 3 (4 days ago): ⚠️ Mild Hypoxemia - O₂ 93%"
echo "   Day 4 (3 days ago): ⚠️ Hyperglycemia - Sugar 12.3 mmol/L"
echo "   Day 5 (2 days ago): ⚠️ Tachycardia - Pulse 105 bpm, BP 138/85"
echo "   Day 6 (yesterday):  ✓ Normal - All vitals stable"
echo "   Day 7 (today):      Existing submitted log"
echo ""
echo "🔍 View trends: https://anchor-dev.erniesg.workers.dev/family/dashboard"
echo "   (Login as: admin@test.com / password123)"
