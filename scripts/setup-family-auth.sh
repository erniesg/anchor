#!/bin/bash
# Setup family authentication for testing
# Date: 2025-10-09

set -e

API_URL="https://anchor-dev-api.erniesg.workers.dev"
USER_EMAIL="admin@example.com"
USER_PASSWORD="Admin123456"
USER_NAME="Admin User"
USER_ID="12345678-1234-1234-1234-123456789abc"
CARE_RECIPIENT_ID="0725fbb9-21c5-46a4-9ed0-305b0a506f20"

echo "🔐 Setting up family authentication..."
echo ""

# Check if user already exists in database
echo "1️⃣  Checking if user exists in database..."
DB_CHECK=$(npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, email, active FROM users WHERE id = '$USER_ID';" 2>&1)

if echo "$DB_CHECK" | grep -q "$USER_ID"; then
  echo "✅ User already exists in database"

  # Check if user has password hash
  HAS_PASSWORD=$(npx wrangler d1 execute anchor-dev-db --remote --env dev \
    --command="SELECT password_hash FROM users WHERE id = '$USER_ID';" 2>&1)

  if echo "$HAS_PASSWORD" | grep -q "null"; then
    echo "⚠️  User exists but has no password - will update via signup"
    NEEDS_SIGNUP=true
  else
    echo "✅ User has password configured"
    NEEDS_SIGNUP=false
  fi
else
  echo "⚠️  User does not exist - will create via signup"
  NEEDS_SIGNUP=true
fi

echo ""

# Try to signup (will fail if user exists with password)
if [ "$NEEDS_SIGNUP" = true ]; then
  echo "2️⃣  Creating family admin account..."

  SIGNUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$USER_EMAIL\",
      \"name\": \"$USER_NAME\",
      \"password\": \"$USER_PASSWORD\"
    }")

  if echo "$SIGNUP_RESPONSE" | grep -q '"token"'; then
    echo "✅ Signup successful!"
    TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "   Token: ${TOKEN:0:30}..."
  else
    echo "⚠️  Signup response:"
    echo "$SIGNUP_RESPONSE"

    # If user already exists, try login instead
    if echo "$SIGNUP_RESPONSE" | grep -q "already registered"; then
      echo ""
      echo "   User already registered, trying login instead..."
      NEEDS_LOGIN=true
    fi
  fi
fi

echo ""

# Login with credentials
echo "3️⃣  Testing family login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$USER_PASSWORD\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  echo "✅ Login successful!"
  echo "   User ID: $USER_ID"
  echo "   Token: ${TOKEN:0:30}..."
else
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""

# Check if user has access to care recipient
echo "4️⃣  Checking care recipient access..."
ACCESS_CHECK=$(npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT * FROM care_recipient_access WHERE user_id = '$USER_ID' AND care_recipient_id = '$CARE_RECIPIENT_ID';" 2>&1)

if echo "$ACCESS_CHECK" | grep -q "$CARE_RECIPIENT_ID"; then
  echo "✅ User already has access to care recipient"
else
  echo "⚠️  Granting access to care recipient..."

  npx wrangler d1 execute anchor-dev-db --remote --env dev \
    --command="INSERT OR REPLACE INTO care_recipient_access (user_id, care_recipient_id, granted_at) VALUES ('$USER_ID', '$CARE_RECIPIENT_ID', datetime('now'));" > /dev/null 2>&1

  echo "✅ Access granted"
fi

echo ""

# Test API access with token
echo "5️⃣  Testing API access to care logs..."
CARE_LOGS_RESPONSE=$(curl -s "$API_URL/care-logs/recipient/$CARE_RECIPIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CARE_LOGS_RESPONSE" | grep -q '\['; then
  LOG_COUNT=$(echo "$CARE_LOGS_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
  echo "✅ API access working! Found $LOG_COUNT care logs"
else
  echo "❌ API access failed!"
  echo "$CARE_LOGS_RESPONSE"
  exit 1
fi

echo ""
echo "🎉 Family authentication setup complete!"
echo ""
echo "📝 Test Credentials:"
echo "   Email: $USER_EMAIL"
echo "   Password: $USER_PASSWORD"
echo "   Token: $TOKEN"
echo ""
echo "🧪 Test URLs:"
echo "   Login: $API_URL/auth/login"
echo "   Dashboard: https://anchor-dev.erniesg.workers.dev/family/dashboard"
echo "   API: $API_URL/care-logs/recipient/$CARE_RECIPIENT_ID"
echo ""
echo "✅ You can now test family dashboard access!"
