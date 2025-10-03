#!/bin/bash

# Populate test care log data directly into local D1 database
# Run this script to generate 7 days of care log entries for trend visualization

DB_PATH="/Users/erniesg/code/erniesg/anchor/apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d7e7dad26bda2eb41e10f2b5b0776873c53023ab37e537e0aca2622a0a57c851.sqlite"

CARE_RECIPIENT_ID="0725fbb9-21c5-46a4-9ed0-305b0a506f20"
CAREGIVER_ID="e80c2b2a-4688-4a29-9579-51b3219f20fc"

# Helper function to generate timestamp for N days ago
generate_timestamp() {
  local days_ago=$1
  local hour=${2:-8}
  local minute=${3:-0}

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS date command
    date -v-${days_ago}d -v${hour}H -v${minute}M -v0S "+%Y-%m-%d %H:%M:%S"
  else
    # Linux date command
    date -d "$days_ago days ago $hour:$minute:00" "+%Y-%m-%d %H:%M:%S"
  fi
}

echo "🌱 Seeding test care log data..."

# Day 1 (6 days ago) - Good day
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 6)',
  'morning',
  '07:30',
  'alert',
  '08:00',
  1,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:15","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:15","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:15","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"08:30","appetite":5,"amountEaten":90,"swallowingIssues":[]},"lunch":{"time":"12:30","appetite":4,"amountEaten":80,"swallowingIssues":[]},"dinner":{"time":"18:00","appetite":4,"amountEaten":85,"swallowingIssues":[]}}',
  '128/82',
  72,
  97,
  5.8,
  '09:00',
  '{"bowelFrequency":1,"urineFrequency":6,"diaperChanges":0,"accidents":"none","assistance":"minimal","pain":"none","urineColor":"clear_yellow","bowelConsistency":"normal"}',
  0,
  'Good day overall. Patient alert and cooperative.',
  '$(generate_timestamp 6)',
  '$(generate_timestamp 6)'
);
EOF

echo "✅ Day 1 seeded (6 days ago)"

# Day 2 (5 days ago) - Slight decline
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 5)',
  'morning',
  '08:00',
  'confused',
  '08:30',
  0,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:45","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:45","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:45","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"09:00","appetite":3,"amountEaten":70,"swallowingIssues":["coughing"]},"lunch":{"time":"13:00","appetite":3,"amountEaten":65,"swallowingIssues":["coughing"]},"dinner":{"time":"18:30","appetite":3,"amountEaten":70,"swallowingIssues":[]}}',
  '135/88',
  78,
  95,
  6.2,
  '09:30',
  '{"bowelFrequency":0,"urineFrequency":5,"diaperChanges":1,"accidents":"small urine leak","assistance":"moderate","pain":"none","urineColor":"yellow","bowelConsistency":"none"}',
  0,
  'Seemed more confused than usual. Some coughing during breakfast.',
  '$(generate_timestamp 5)',
  '$(generate_timestamp 5)'
);
EOF

echo "✅ Day 2 seeded (5 days ago)"

# Day 3 (4 days ago) - Medication timing issue
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 4)',
  'morning',
  '07:45',
  'sleepy',
  '08:15',
  0,
  '[{"name":"Levodopa 100mg","given":true,"time":"09:30","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":false,"time":null,"timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"09:30","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"09:00","appetite":4,"amountEaten":75,"swallowingIssues":[]},"lunch":{"time":"12:45","appetite":4,"amountEaten":80,"swallowingIssues":[]},"dinner":{"time":"18:15","appetite":3,"amountEaten":70,"swallowingIssues":["coughing"]}}',
  '132/85',
  74,
  96,
  5.9,
  '10:00',
  '{"bowelFrequency":1,"urineFrequency":7,"diaperChanges":0,"accidents":"none","assistance":"minimal","pain":"none","urineColor":"clear_yellow","bowelConsistency":"soft"}',
  0,
  'Donepezil missed - patient refused medication. Will try again tomorrow.',
  '$(generate_timestamp 4)',
  '$(generate_timestamp 4)'
);
EOF

echo "✅ Day 3 seeded (4 days ago)"

# Day 4 (3 days ago) - Better day
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 3)',
  'morning',
  '07:30',
  'calm',
  '08:00',
  1,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:20","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:20","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:20","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"08:40","appetite":5,"amountEaten":95,"swallowingIssues":[]},"lunch":{"time":"12:30","appetite":5,"amountEaten":90,"swallowingIssues":[]},"dinner":{"time":"18:00","appetite":4,"amountEaten":85,"swallowingIssues":[]}}',
  '125/80',
  70,
  98,
  5.6,
  '09:00',
  '{"bowelFrequency":1,"urineFrequency":6,"diaperChanges":0,"accidents":"none","assistance":"minimal","pain":"none","urineColor":"clear_yellow","bowelConsistency":"normal"}',
  0,
  'Excellent day. Patient very cooperative and ate well.',
  '$(generate_timestamp 3)',
  '$(generate_timestamp 3)'
);
EOF

echo "✅ Day 4 seeded (3 days ago)"

# Day 5 (2 days ago) - Vitals spike (EMERGENCY)
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, emergency_note, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 2)',
  'morning',
  '06:30',
  'agitated',
  '07:30',
  0,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:00","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:00","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:00","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"08:15","appetite":2,"amountEaten":50,"swallowingIssues":["refused food"]},"lunch":{"time":"12:30","appetite":3,"amountEaten":60,"swallowingIssues":[]},"dinner":{"time":"18:00","appetite":3,"amountEaten":65,"swallowingIssues":[]}}',
  '148/92',
  88,
  94,
  7.1,
  '08:30',
  '{"bowelFrequency":0,"urineFrequency":4,"diaperChanges":2,"accidents":"moderate","assistance":"full","pain":"mild","urineColor":"dark_yellow","bowelConsistency":"none"}',
  1,
  'BP elevated at 148/92. Patient agitated and refused breakfast. Monitored closely.',
  'Patient woke up agitated. BP higher than normal. Gave extra fluids.',
  '$(generate_timestamp 2)',
  '$(generate_timestamp 2)'
);
EOF

echo "✅ Day 5 seeded (2 days ago) - EMERGENCY FLAG"

# Day 6 (yesterday) - Recovery
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 1)',
  'morning',
  '07:45',
  'calm',
  '08:15',
  0,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:30","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:30","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:30","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"08:45","appetite":4,"amountEaten":80,"swallowingIssues":[]},"lunch":{"time":"12:30","appetite":4,"amountEaten":85,"swallowingIssues":[]},"dinner":{"time":"18:00","appetite":4,"amountEaten":80,"swallowingIssues":[]}}',
  '130/84',
  75,
  96,
  6.0,
  '09:00',
  '{"bowelFrequency":1,"urineFrequency":6,"diaperChanges":0,"accidents":"none","assistance":"minimal","pain":"none","urineColor":"clear_yellow","bowelConsistency":"soft"}',
  0,
  'BP back to normal. Patient calmer today.',
  '$(generate_timestamp 1)',
  '$(generate_timestamp 1)'
);
EOF

echo "✅ Day 6 seeded (yesterday)"

# Day 7 (today) - Current day
sqlite3 "$DB_PATH" <<EOF
INSERT INTO care_logs (
  id, care_recipient_id, caregiver_id, log_date, time_period,
  wake_time, mood, shower_time, hair_wash,
  medications, meals,
  blood_pressure, pulse_rate, oxygen_level, blood_sugar, vitals_time,
  toileting, emergency_flag, notes,
  created_at, updated_at
) VALUES (
  '$(uuidgen | tr '[:upper:]' '[:lower:]')',
  '$CARE_RECIPIENT_ID',
  '$CAREGIVER_ID',
  '$(generate_timestamp 0)',
  'morning',
  '07:30',
  'alert',
  '08:00',
  1,
  '[{"name":"Levodopa 100mg","given":true,"time":"08:15","timeSlot":"after_breakfast"},{"name":"Donepezil 5mg","given":true,"time":"08:15","timeSlot":"after_breakfast"},{"name":"Multivitamin","given":true,"time":"08:15","timeSlot":"after_breakfast"}]',
  '{"breakfast":{"time":"08:30","appetite":5,"amountEaten":90,"swallowingIssues":[]},"lunch":{"time":"12:30","appetite":4,"amountEaten":85,"swallowingIssues":[]},"dinner":{"time":"18:00","appetite":4,"amountEaten":85,"swallowingIssues":[]}}',
  '126/82',
  72,
  97,
  5.7,
  '09:00',
  '{"bowelFrequency":1,"urineFrequency":6,"diaperChanges":0,"accidents":"none","assistance":"minimal","pain":"none","urineColor":"clear_yellow","bowelConsistency":"normal"}',
  0,
  'Good morning routine. Patient alert and cooperative.',
  '$(generate_timestamp 0)',
  '$(generate_timestamp 0)'
);
EOF

echo "✅ Day 7 seeded (today)"

echo ""
echo "🎉 Successfully seeded 7 days of test care log data!"
echo ""
echo "📊 Data Summary:"
echo "   - 7 care log entries"
echo "   - Covers past 6 days + today"
echo "   - Includes 1 emergency flag (Day 5)"
echo "   - Shows realistic trends in vitals, mood, and medication adherence"
echo ""
echo "🔍 Verify with:"
echo "   sqlite3 '$DB_PATH' 'SELECT log_date, mood, blood_pressure, emergency_flag FROM care_logs ORDER BY log_date DESC LIMIT 7'"
echo ""
