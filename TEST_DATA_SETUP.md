# Test Data Setup Guide
**Date:** 2025-10-10
**Environment:** Development (anchor-dev.erniesg.workers.dev)

---

## 🎯 Quick Start - Use Existing Test Data

The easiest way to test is using the pre-configured test accounts:

### Existing Test Accounts

**Care Recipient:**
```
Name: Grandmother Lee
ID: 0725fbb9-21c5-46a4-9ed0-305b0a506f20
Age: 80 years old (DOB: 1945-03-15)
Conditions: Dementia, Hypertension
```

**Caregiver:**
```
Name: Test Caregiver
ID: 88fef386-a0bd-452d-a8b6-be2844ef0bc6
PIN: 123456
URL: https://anchor-dev.erniesg.workers.dev/caregiver/login
```

**Family Admin:**
```
Name: Admin User
Email: admin@example.com
Password: Admin123456
User ID: 12345678-1234-1234-1234-123456789abc
URL: https://anchor-dev.erniesg.workers.dev/family/dashboard
```

**Seed 10 Days of Trend Data:**
```bash
cd /Users/erniesg/code/erniesg/anchor
./scripts/seed-trend-data.sh
```
Result: Creates Oct 01-10 logs with full trend visualization data

---

## 🆕 Creating New Test Data

### Step 1: Create a Care Recipient

**Option A: Via API**
```bash
API_URL="https://anchor-dev-api.erniesg.workers.dev"

# First login as family admin
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123456"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create care recipient
curl -X POST "$API_URL/care-recipients" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 12345678-1234-1234-1234-123456789abc" \
  -d '{
    "name": "John Doe",
    "dateOfBirth": "1940-01-15",
    "condition": "Alzheimer'\''s, Diabetes",
    "location": "Room 204",
    "emergencyContact": "+1-555-0123"
  }'
```

**Option B: Via Database**
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="INSERT INTO care_recipients (
    id,
    family_admin_id,
    name,
    date_of_birth,
    gender,
    condition,
    location,
    emergency_contact
  ) VALUES (
    '$(uuidgen | tr '[:upper:]' '[:lower:]')',
    '12345678-1234-1234-1234-123456789abc',
    'John Doe',
    '1940-01-15',
    'male',
    'Alzheimer'\''s, Diabetes',
    'Room 204',
    '+1-555-0123'
  );"
```

---

### Step 2: Create a Caregiver

**Option A: Via API**
```bash
CARE_RECIPIENT_ID="<care-recipient-id-from-step-1>"

curl -X POST "$API_URL/caregivers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Maria Rodriguez",
    "careRecipientId": "'$CARE_RECIPIENT_ID'",
    "pin": "654321",
    "phoneNumber": "+1-555-0456",
    "role": "primary"
  }'
```

**Option B: Via Database**
```bash
# Generate bcrypt hash for PIN (example for PIN "654321")
node -e "require('bcryptjs').hash('654321', 10).then(h => console.log(h));"
# Result: $2b$10$xyz...

npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="INSERT INTO caregivers (
    id,
    care_recipient_id,
    name,
    pin_hash,
    phone_number,
    role,
    active
  ) VALUES (
    '$(uuidgen | tr '[:upper:]' '[:lower:]')',
    '<CARE_RECIPIENT_ID>',
    'Maria Rodriguez',
    '\$2b\$10\$xyz...',  -- Use bcrypt hash from above
    '+1-555-0456',
    'primary',
    1
  );"
```

**Test Caregiver Login:**
```
URL: https://anchor-dev.erniesg.workers.dev/caregiver/login
Caregiver ID: <id-from-above>
PIN: 654321
```

---

### Step 3: Create a Family Admin User

**Option A: Via Signup API**
```bash
curl -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "family@example.com",
    "name": "Jane Doe",
    "password": "SecurePass123"
  }'
```

**Option B: Via Database**
```bash
# Generate bcrypt hash for password
node -e "require('bcryptjs').hash('SecurePass123', 10).then(h => console.log(h));"
# Result: $2b$10$abc...

USER_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="INSERT INTO users (
    id,
    email,
    name,
    password_hash,
    role,
    active
  ) VALUES (
    '$USER_ID',
    'family@example.com',
    'Jane Doe',
    '\$2b\$10\$abc...',  -- Use bcrypt hash from above
    'family_admin',
    1
  );"

# Grant access to care recipient
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="INSERT INTO care_recipient_access (
    user_id,
    care_recipient_id,
    granted_at
  ) VALUES (
    '$USER_ID',
    '<CARE_RECIPIENT_ID>',
    datetime('now')
  );"
```

**Test Family Login:**
```
URL: https://anchor-dev.erniesg.workers.dev/family/dashboard
Email: family@example.com
Password: SecurePass123
```

---

### Step 4: Seed Care Log Data

Create a custom seed script or modify the existing one:

```bash
#!/bin/bash
# Save as: scripts/seed-custom-data.sh

API_URL="https://anchor-dev-api.erniesg.workers.dev"
CAREGIVER_ID="<your-caregiver-id>"
CARE_RECIPIENT_ID="<your-care-recipient-id>"
CAREGIVER_PIN="654321"

# Login
echo "🔐 Logging in..."
TOKEN=$(curl -s -X POST "$API_URL/auth/caregiver/login" \
  -H "Content-Type: application/json" \
  -d '{"caregiverId":"'$CAREGIVER_ID'","pin":"'$CAREGIVER_PIN'"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "✅ Token: ${TOKEN:0:30}..."

# Create a single care log
DATE=$(date +%Y-%m-%d)
echo "📅 Creating care log for $DATE..."

curl -s -X POST "$API_URL/care-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "careRecipientId": "'$CARE_RECIPIENT_ID'",
    "logDate": "'$DATE'",
    "wakeTime": "07:30",
    "mood": "alert",
    "bloodPressure": "120/78",
    "pulseRate": 68,
    "bloodSugar": 5.5,
    "vitalsTime": "10:00",
    "balanceIssues": 4,
    "nearFalls": "none",
    "actualFalls": "none",
    "nightSleep": {
      "bedtime": "22:00",
      "quality": "deep",
      "wakings": 0
    },
    "medications": [{
      "name": "Metformin",
      "time": "08:00",
      "given": true,
      "timeSlot": "after_breakfast"
    }]
  }' | grep -o '"id":"[^"]*' | cut -d'"' -f4

echo "✅ Log created!"
```

Make it executable and run:
```bash
chmod +x scripts/seed-custom-data.sh
./scripts/seed-custom-data.sh
```

---

## 🔍 Verification Commands

### Check Care Recipients
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, name, condition FROM care_recipients;"
```

### Check Caregivers
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, name, care_recipient_id, active FROM caregivers;"
```

### Check Family Users
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, email, name, role FROM users;"
```

### Check Care Recipient Access
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT * FROM care_recipient_access;"
```

### Check Care Logs
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, log_date, status, wake_time, mood
  FROM care_logs
  WHERE care_recipient_id='<CARE_RECIPIENT_ID>'
  ORDER BY log_date DESC
  LIMIT 10;"
```

---

## 🧪 Testing Checklist

After setting up new test data, verify:

- [ ] **Caregiver Login:** Can login with ID + PIN
- [ ] **Caregiver Form:** Can access and submit care logs
- [ ] **Family Login:** Can login with email + password
- [ ] **Family Dashboard:** Can view care recipient's data
- [ ] **Trend Data:** Dashboard shows trend charts (needs 7+ days of data)
- [ ] **API Access:** Both caregiver and family APIs return correct data

---

## 📚 Reference Scripts

All setup scripts are located in `/scripts/`:

1. **`setup-family-auth.sh`** - Configures existing family account
2. **`seed-trend-data.sh`** - Seeds 10 days of care logs with trend data
3. **`populate-test-data.sh`** - Creates comprehensive test data

---

## 🐛 Troubleshooting

### "Invalid credentials" error
- Check bcrypt hash is properly escaped in database (`\$2b\$10\$...`)
- Verify password/PIN is correct
- Check user/caregiver is active (`active = 1`)

### "Unauthorized" API access
- Verify care_recipient_access table has entry linking user to care recipient
- Check JWT token is valid and not expired
- Ensure role is correct (`family_admin` or `caregiver`)

### No trend data showing
- Need at least 7 days of care logs
- Check logs have `balanceIssues`, `nearFalls`, `actualFalls`, `nightSleep`, `medications` fields
- Run: `./scripts/seed-trend-data.sh` to populate

### Dashboard shows wrong dates
- Seed script creates logs for past 10 days from today
- Dashboard shows weekly view (current week Mon-Sun)
- Refresh page after seeding data

---

## 🎓 Learning Resources

**API Endpoints:**
- `POST /auth/signup` - Create family user
- `POST /auth/login` - Family login
- `POST /auth/caregiver/login` - Caregiver login
- `GET /care-recipients` - List care recipients
- `POST /care-recipients` - Create care recipient
- `POST /caregivers` - Create caregiver
- `POST /care-logs` - Create care log
- `POST /care-logs/{id}/submit` - Submit care log

**Database Schema:**
- `users` - Family admin accounts
- `care_recipients` - Care recipients
- `caregivers` - Caregiver accounts
- `care_recipient_access` - Links users to care recipients
- `care_logs` - Daily care reports

---

**Last Updated:** 2025-10-10
**Maintained by:** Claude Code
**Questions?** Check existing test data first, or create custom scripts based on examples above.
