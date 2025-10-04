#!/bin/bash

# Seed E2E test caregiver with known PIN
# Creates a caregiver specifically for E2E tests with PIN: 123456

DB_PATH="/Users/erniesg/code/erniesg/anchor/apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d7e7dad26bda2eb41e10f2b5b0776873c53023ab37e537e0aca2622a0a57c851.sqlite"

# Test caregiver credentials
CAREGIVER_ID="e80c2b2a-4688-4a29-9579-51b3219f20fc"
CARE_RECIPIENT_ID="0725fbb9-21c5-46a4-9ed0-305b0a506f20"
# Bcrypt hash for "123456" (10 rounds)
PIN_HASH='$2b$10$sIptDw7oAyjGKs/O/asqzuENgSlGUedFmH0Gk57BB1vEmZ7k8.JZu'

echo "🌱 Seeding E2E test caregiver..."

sqlite3 "$DB_PATH" <<EOF
-- Update existing test caregiver with known PIN
UPDATE caregivers
SET
  pin_code = '$PIN_HASH',
  name = 'E2E Test Caregiver',
  active = 1,
  updated_at = datetime('now')
WHERE id = '$CAREGIVER_ID';

-- Verify update
SELECT
  id,
  name,
  care_recipient_id,
  active,
  'PIN: 123456' as pin_info
FROM caregivers
WHERE id = '$CAREGIVER_ID';
EOF

echo ""
echo "✅ E2E test caregiver seeded!"
echo ""
echo "📋 Credentials for E2E tests:"
echo "   Caregiver ID: $CAREGIVER_ID"
echo "   PIN: 123456"
echo "   Care Recipient: $CARE_RECIPIENT_ID"
echo ""
echo "🧪 Use in tests:"
echo "   await page.fill('input[name=\"caregiverId\"]', '$CAREGIVER_ID');"
echo "   await page.fill('input[name=\"pin\"]', '123456');"
echo ""
