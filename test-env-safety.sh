#!/bin/bash
set -e
API="http://localhost:8787"

echo "1. Login as caregiver..."
TOKEN=$(curl -s -X POST "$API/auth/caregiver/login" -H "Content-Type: application/json" -d '{"caregiverId":"e80c2b2a-4688-4a29-9579-51b3219f20fc","pin":"123456"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Got token: ${TOKEN:0:20}..."

echo ""
echo "2. Submit care log with Environment & Safety fields..."
RESPONSE=$(curl -s -X POST "$API/care-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "careRecipientId":"0725fbb9-21c5-46a4-9ed0-305b0a506f20",
    "logDate":"2025-11-13",
    "status":"submitted",
    "wakeTime":"07:00",
    "mood":"alert",
    "roomMaintenance":{"cleaningStatus":"completed_by_maid","roomComfort":"good_temperature"},
    "personalItemsCheck":{"spectaclesCleaned":{"checked":true,"status":"clean"},"jewelryAccountedFor":{"checked":true,"status":"all_present"},"handbagOrganized":{"checked":true,"status":"organized"}},
    "hospitalBagStatus":{"bagReady":true,"location":"Top shelf","lastChecked":true,"notes":"All ready"},
    "safetyChecks":{"tripHazards":{"checked":true,"action":"Cleared"}},
    "emergencyPrep":{"icePack":true,"wheelchair":true}
  }')

LOG_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$LOG_ID" ]; then
  echo "❌ Failed to create log"
  echo "$RESPONSE"
  exit 1
fi
echo "✅ Created log: $LOG_ID"

echo ""
echo "3. Retrieve and verify..."
curl -s "$API/care-logs/$LOG_ID" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | grep -A 3 -E "roomMaintenance|personalItemsCheck|hospitalBagStatus"

echo ""
echo "✅ Test complete!"
