#!/bin/bash

# Anchor - Quick Smoke Test
# Tests critical API endpoints with real requests

echo "🧪 Anchor API Smoke Test"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function
test_endpoint() {
  local name=$1
  local response=$2
  local expected=$3

  if echo "$response" | grep -q "$expected"; then
    echo -e "${GREEN}✓${NC} $name"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $name"
    echo "  Response: $response"
    ((FAILED++))
  fi
}

# 1. Health Check
echo "1. Testing Health Endpoint..."
HEALTH=$(curl -s http://localhost:8787/health)
test_endpoint "Health check" "$HEALTH" "status"

# 2. API Info
echo ""
echo "2. Testing API Info..."
INFO=$(curl -s http://localhost:8787/)
test_endpoint "API info" "$INFO" "Anchor API"

# 3. Family Signup
echo ""
echo "3. Testing Family Signup..."
SIGNUP=$(curl -s -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "smoketest-'$(date +%s)'@example.com",
    "name": "Smoke Test User",
    "password": "testpass123"
  }')
test_endpoint "Family signup" "$SIGNUP" "token"

# Extract token
TOKEN=$(echo $SIGNUP | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "  Token: ${TOKEN:0:20}..."
fi

# 4. Login (if signup worked)
echo ""
echo "4. Testing Login..."
if [ -n "$TOKEN" ]; then
  LOGIN=$(curl -s -X POST http://localhost:8787/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "smoketest-'$(date +%s)'@example.com",
      "name": "Smoke Test User",
      "password": "testpass123"
    }')
  test_endpoint "Family login" "$LOGIN" "token"
else
  echo -e "${RED}✗${NC} Skipped (signup failed)"
  ((FAILED++))
fi

# 5. Protected Endpoint (requires auth)
echo ""
echo "5. Testing Protected Endpoint..."
if [ -n "$TOKEN" ]; then
  PROTECTED=$(curl -s http://localhost:8787/caregivers/recipient/test-id \
    -H "Authorization: Bearer $TOKEN")
  test_endpoint "Protected endpoint" "$PROTECTED" "[]"
else
  echo -e "${RED}✗${NC} Skipped (no token)"
  ((FAILED++))
fi

# 6. CORS Headers
echo ""
echo "6. Testing CORS Headers..."
CORS=$(curl -s -I http://localhost:8787/health | grep -i "access-control")
if [ -n "$CORS" ]; then
  echo -e "${GREEN}✓${NC} CORS headers present"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} CORS headers missing"
  ((FAILED++))
fi

# Summary
echo ""
echo "========================"
echo "Test Results"
echo "========================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
  exit 1
fi
