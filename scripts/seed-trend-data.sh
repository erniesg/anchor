#!/bin/bash
# Seed 7 days of care logs for trend visualization testing
# Date: 2025-10-09

set -e

API_URL="https://anchor-dev-api.erniesg.workers.dev"
CAREGIVER_ID="88fef386-a0bd-452d-a8b6-be2844ef0bc6"
CARE_RECIPIENT_ID="0725fbb9-21c5-46a4-9ed0-305b0a506f20"

# Login to get caregiver token
echo "🔐 Logging in as caregiver..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/caregiver/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"caregiverId\": \"$CAREGIVER_ID\",
    \"pin\": \"123456\"
  }")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful, token: ${TOKEN:0:20}..."

# Function to create and submit care log for a specific date
create_care_log() {
  local DATE=$1
  local DAY_OFFSET=$2

  # Vary the data slightly for each day to show trends
  local WAKE_HOUR=$((7 + (DAY_OFFSET % 3)))
  local BP_SYSTOLIC=$((120 + (DAY_OFFSET * 3)))
  local BP_DIASTOLIC=$((78 + (DAY_OFFSET * 2)))
  local BLOOD_SUGAR=$(echo "5.5 + ($DAY_OFFSET * 0.3)" | bc)
  local APPETITE=$((3 + (DAY_OFFSET % 3)))
  local MOOD_OPTIONS=("alert" "calm" "sleepy" "confused" "agitated")
  local MOOD=${MOOD_OPTIONS[$((DAY_OFFSET % 5))]}
  local HAIR_WASH=$([ $((DAY_OFFSET % 2)) -eq 0 ] && echo "true" || echo "false")

  echo ""
  echo "📅 Creating care log for $DATE (Day $DAY_OFFSET)..."

  # Create draft care log
  CREATE_RESPONSE=$(curl -s -X POST "$API_URL/care-logs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"careRecipientId\": \"$CARE_RECIPIENT_ID\",
      \"logDate\": \"$DATE\",
      \"wakeTime\": \"0${WAKE_HOUR}:30\",
      \"mood\": \"$MOOD\",
      \"showerTime\": \"0$((WAKE_HOUR + 1)):00\",
      \"hairWash\": $HAIR_WASH,
      \"meals\": {
        \"breakfast\": {
          \"time\": \"09:30\",
          \"appetite\": $APPETITE,
          \"amountEaten\": $((60 + (DAY_OFFSET * 5)))
        }
      },
      \"bloodPressure\": \"${BP_SYSTOLIC}/${BP_DIASTOLIC}\",
      \"pulseRate\": $((68 + (DAY_OFFSET * 2))),
      \"oxygenLevel\": $((95 + (DAY_OFFSET % 4))),
      \"bloodSugar\": ${BLOOD_SUGAR},
      \"vitalsTime\": \"10:00\",
      \"bowelMovements\": {
        \"frequency\": $((1 + (DAY_OFFSET % 2))),
        \"timesUsedToilet\": $((3 + (DAY_OFFSET % 3))),
        \"diaperChanges\": $((1 + (DAY_OFFSET % 3)))
      },
      \"afternoonRest\": {
        \"startTime\": \"14:00\",
        \"endTime\": \"15:30\",
        \"quality\": \"light\"
      },
      \"safetyChecks\": {
        \"tripHazards\": {\"checked\": true, \"action\": \"\"},
        \"cables\": {\"checked\": true, \"action\": \"\"},
        \"sandals\": {\"checked\": true, \"action\": \"\"},
        \"slipHazards\": {\"checked\": true, \"action\": \"\"},
        \"mobilityAids\": {\"checked\": true, \"action\": \"\"},
        \"emergencyEquipment\": {\"checked\": true, \"action\": \"\"}
      },
      \"fluids\": [
        {\"name\": \"Water\", \"time\": \"09:00\", \"amountMl\": 250},
        {\"name\": \"Juice\", \"time\": \"12:00\", \"amountMl\": 200},
        {\"name\": \"Tea\", \"time\": \"15:00\", \"amountMl\": 300},
        {\"name\": \"Water\", \"time\": \"18:00\", \"amountMl\": $((200 + (DAY_OFFSET * 50)))}
      ],
      \"notes\": \"Regular day $DAY_OFFSET - Patient doing well\"
    }")

  LOG_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

  if [ -z "$LOG_ID" ]; then
    echo "❌ Failed to create care log for $DATE"
    echo "$CREATE_RESPONSE"
    return 1
  fi

  echo "  ✅ Created draft: $LOG_ID"

  # Submit the care log
  SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/care-logs/$LOG_ID/submit" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$SUBMIT_RESPONSE" | grep -q '"success":true'; then
    echo "  ✅ Submitted successfully"
  else
    echo "  ❌ Failed to submit"
    echo "$SUBMIT_RESPONSE"
  fi
}

# Create care logs for the past 7 days
echo ""
echo "🌱 Seeding 7 days of care log data..."

for i in {0..6}; do
  DATE=$(date -v-${i}d +%Y-%m-%d)
  create_care_log "$DATE" $i
  sleep 0.5  # Small delay between requests
done

echo ""
echo "🎉 Seeding complete!"
echo ""
echo "📊 Verify data at:"
echo "  - API: $API_URL/care-logs/recipient/$CARE_RECIPIENT_ID"
echo "  - UI: https://anchor-dev.erniesg.workers.dev/family/dashboard"
echo ""
echo "🧪 Test manual login:"
echo "  - Caregiver: ID=$CAREGIVER_ID, PIN=123456"
echo "  - Family: Check user credentials in database"
