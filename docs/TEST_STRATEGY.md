# Anchor - Practical Test Strategy
**Focus on Integration & E2E Testing**

---

## 🎯 Testing Philosophy

Based on the Cloudflare Workers environment, here's the **practical testing approach**:

### ❌ What Won't Work Well
- **Unit tests with complex D1 mocking** - Too difficult to mock Cloudflare Workers runtime
- **Isolated component tests** - Frontend needs real API responses
- **Mock-heavy tests** - Defeats the purpose, creates maintenance burden

### ✅ What Will Work Best
- **Integration tests** - Test API endpoints with real local D1 database
- **E2E tests** - Test complete user workflows with Playwright
- **Contract tests** - Ensure frontend-backend communication works
- **Manual smoke tests** - Critical paths before deployment

---

## 🚀 Recommended Testing Approach

### Phase 1: Local Integration Testing (NOW)

#### Setup Local Test Environment
```bash
# 1. Start local dev environment
pnpm dev

# This starts:
# - API on http://localhost:8787 (with local D1)
# - Web on http://localhost:5173
# - Drizzle Studio on http://localhost:4983
```

#### Manual Integration Tests (Critical Paths)
Test these workflows manually with real API:

**1. Authentication Flow**
```bash
# Terminal 1: Watch API logs
cd apps/api && pnpm dev

# Terminal 2: Use curl or Postman
# Test signup
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'

# Test login
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**2. Care Log Workflow**
```bash
# Create draft (caregiver)
curl -X POST http://localhost:8787/care-logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <caregiver-token>" \
  -d '{
    "careRecipientId": "<recipient-id>",
    "logDate": "2025-10-03",
    "wakeTime": "07:30",
    "mood": "alert"
  }'

# Submit log
curl -X POST http://localhost:8787/care-logs/<log-id>/submit \
  -H "Authorization: Bearer <caregiver-token>"

# Invalidate (family_admin)
curl -X POST http://localhost:8787/care-logs/<log-id>/invalidate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Incorrect data"}'
```

**3. Admin Operations**
```bash
# Create caregiver
curl -X POST http://localhost:8787/caregivers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "careRecipientId": "<recipient-id>",
    "name": "Maria Santos",
    "phone": "+6591234567"
  }'

# Deactivate caregiver
curl -X POST http://localhost:8787/caregivers/<caregiver-id>/deactivate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Contract ended"}'

# Reset PIN
curl -X POST http://localhost:8787/caregivers/<caregiver-id>/reset-pin \
  -H "Authorization: Bearer <admin-token>"
```

---

### Phase 2: Playwright E2E Tests (BEST APPROACH)

The E2E tests we created test **real frontend-backend integration**:

```bash
# Install Playwright
pnpm exec playwright install

# Run E2E tests (tests real app)
pnpm test:e2e

# Run in headed mode (watch)
pnpm test:e2e:headed

# Run specific workflow
pnpm test:e2e caregiver-workflow.spec.ts
```

**What E2E Tests Cover:**
- ✅ Real API calls (no mocking)
- ✅ Real database operations
- ✅ Complete user workflows
- ✅ Frontend-backend integration
- ✅ Mobile responsiveness
- ✅ Error handling

---

## 📋 Critical Test Scenarios (Manual + E2E)

### 1. Family Onboarding Flow
**Manual Test:**
1. Open http://localhost:5173
2. Click "Get Started"
3. Fill signup form (email, name, password, phone)
4. Add care recipient details
5. Create caregiver (generate PIN)
6. Verify PIN shown (6 digits)
7. Verify redirect to dashboard

**E2E Test:** `tests/e2e/family-onboarding.spec.ts`

---

### 2. Caregiver Daily Workflow
**Manual Test:**
1. Login as caregiver (caregiverId + PIN)
2. Fill care log form:
   - Morning routine (wake time, mood, shower)
   - Medications (mark as given/not given)
   - Meals (time, appetite, amount)
   - Vitals (BP, pulse, O2, blood sugar)
   - Toileting (frequency, assistance)
   - Safety notes
3. Wait 30 seconds → verify auto-save indicator
4. Refresh page → verify data persists
5. Submit form
6. Verify form is locked (can't edit)

**E2E Test:** `tests/e2e/caregiver-workflow.spec.ts`

---

### 3. Family Dashboard & Admin
**Manual Test:**
1. Login as family_admin
2. View today's care log
   - Verify status badge (draft/submitted/invalidated)
   - Verify all data displays correctly
3. Navigate to Settings
4. View caregiver list
5. Deactivate caregiver (with reason)
6. Reset caregiver PIN (get new 6-digit PIN)
7. Create new caregiver
8. Logout and login as family_member
9. Verify read-only access (no admin buttons)

**E2E Test:** `tests/e2e/admin-settings.spec.ts`

---

### 4. Draft/Submit/Invalidate Workflow
**Manual Test:**
1. Caregiver creates draft (auto-saves)
2. Caregiver submits draft → Status: "Submitted"
3. Family_admin views submitted log
4. Family_admin invalidates with reason
5. Caregiver sees invalidation notice
6. Caregiver edits and resubmits
7. Verify log is submitted again

**E2E Test:** Covered in `caregiver-workflow.spec.ts`

---

### 5. RBAC Enforcement
**Manual Test:**
1. **Caregiver:**
   - ✅ Can create/edit draft logs
   - ✅ Can submit own logs
   - ❌ Cannot view other caregivers' logs
   - ❌ Cannot invalidate logs
   - ❌ Cannot access admin settings

2. **family_member:**
   - ✅ Can view submitted logs
   - ✅ Can view dashboard
   - ❌ Cannot create/edit caregivers
   - ❌ Cannot deactivate caregivers
   - ❌ Cannot reset PINs
   - ❌ Cannot invalidate logs

3. **family_admin:**
   - ✅ All family_member permissions
   - ✅ Can create/edit/deactivate caregivers
   - ✅ Can reset PINs
   - ✅ Can invalidate logs
   - ✅ Full admin settings access

**E2E Test:** Covered in `admin-settings.spec.ts`

---

## 🧪 Quick Smoke Test Checklist

**Before Every Deployment:**

### Backend API Health
```bash
# 1. Health check
curl http://localhost:8787/health

# Expected: {"status":"ok","environment":"dev",...}

# 2. Database connection
curl http://localhost:8787/

# Expected: {"name":"Anchor API","version":"0.1.0",...}
```

### Frontend-Backend Integration
- [ ] Signup creates user in database
- [ ] Login returns valid token
- [ ] Caregiver PIN login works
- [ ] Care log creation succeeds
- [ ] Auto-save works (wait 30 sec)
- [ ] Submit locks the log
- [ ] Dashboard shows submitted logs only
- [ ] Invalidation allows re-edit
- [ ] Admin operations require family_admin role

### Critical User Journeys (10-min test)
- [ ] Family onboarding (signup → caregiver → dashboard)
- [ ] Caregiver daily form (fill → auto-save → submit)
- [ ] Admin settings (deactivate → reset PIN)
- [ ] Mobile view works (test on phone size)

---

## 📊 E2E Test Execution

### Run All E2E Tests
```bash
# Full test suite
pnpm test:e2e

# Generate report
pnpm test:e2e --reporter=html

# Open report
open playwright-report/index.html
```

### Run Specific Workflows
```bash
# Family onboarding
pnpm test:e2e family-onboarding

# Caregiver workflow
pnpm test:e2e caregiver-workflow

# Admin settings
pnpm test:e2e admin-settings
```

### Debug Tests
```bash
# Run in debug mode
pnpm test:e2e:debug

# Run in headed mode (watch browser)
pnpm test:e2e:headed

# Run on specific device
pnpm test:e2e --project="Mobile Chrome"
pnpm test:e2e --project="Mobile Safari"
```

---

## 🔍 Integration Test Script

Create a quick integration test script:

```bash
#!/bin/bash
# test-integration.sh

echo "🧪 Running Integration Tests..."

# 1. Health check
echo "\n1. API Health Check"
curl -s http://localhost:8787/health | jq

# 2. Signup test
echo "\n2. Testing Signup"
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "integration-test@example.com",
    "name": "Integration Test",
    "password": "testpass123"
  }')
echo $SIGNUP_RESPONSE | jq

# 3. Login test
echo "\n3. Testing Login"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "integration-test@example.com",
    "password": "testpass123"
  }')
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 4. Test authenticated endpoint
echo "\n4. Testing Authenticated Endpoint"
curl -s http://localhost:8787/caregivers/recipient/test-id \
  -H "Authorization: Bearer $TOKEN" | jq

echo "\n✅ Integration tests complete!"
```

---

## 📈 Testing Priorities

### Priority 1: E2E Tests (HIGHEST VALUE)
- **Why:** Tests real integration, catches real bugs
- **What:** Use Playwright tests we created
- **When:** Before every deployment

### Priority 2: Manual Smoke Tests
- **Why:** Quick confidence check
- **What:** 10-minute critical path test
- **When:** After code changes

### Priority 3: API Contract Tests
- **Why:** Ensure frontend-backend agreement
- **What:** Test request/response shapes
- **When:** When API changes

### Priority 4: Unit Tests (LOW PRIORITY)
- **Why:** Complex to set up with Cloudflare Workers
- **What:** Skip for now, focus on integration
- **When:** Post-MVP if needed

---

## 🚀 Next Actions

### TODAY
1. **Run Playwright E2E tests:**
   ```bash
   pnpm exec playwright install
   pnpm test:e2e
   ```

2. **Manual smoke test:**
   - Test family onboarding
   - Test caregiver workflow
   - Test admin operations

3. **Fix any issues found**

### THIS WEEK
1. **Set up CI/CD** to run E2E tests
2. **Add Sentry** for error tracking
3. **Implement real JWT auth**

---

## 🎯 Success Criteria

### Before Production
- [ ] All E2E tests passing
- [ ] Manual smoke test passes
- [ ] No critical bugs
- [ ] Performance acceptable (<2s page load)
- [ ] Mobile works

### Production Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] User analytics
- [ ] API response times

---

**Bottom Line:**
- ✅ **Focus on E2E tests** (Playwright) - Real integration testing
- ✅ **Manual smoke tests** - Quick confidence checks
- ✅ **Local integration testing** - Use real dev environment
- ❌ **Skip complex unit tests** - Not worth the mocking effort

**Next Command:** `pnpm test:e2e` (after `pnpm exec playwright install`)
