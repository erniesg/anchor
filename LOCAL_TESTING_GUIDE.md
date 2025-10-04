# Local Testing Guide - Post-Auth Implementation

## ✅ Step 1: JWT_SECRET Added (DONE)

The `.dev.vars` file has been created at `apps/api/.dev.vars` with:
```bash
JWT_SECRET="dev-secret-key-change-this-in-production-1234567890"
```

---

## 🚀 Step 2: Run Everything Locally (Automated)

### Option A: Full Stack with Database Setup (First Time)

```bash
# Stop any running servers
# Press Ctrl+C in terminals or run:
pkill -f "wrangler dev"
pkill -f "vite"

# 1. Generate database schema
pnpm db:generate

# 2. Run migration (adds passwordHash column)
pnpm db:migrate:dev

# 3. Start all servers (frontend + API)
pnpm dev
```

**Expected output**:
```
✓ API server running on http://localhost:8787
✓ Frontend running on http://localhost:5173
```

### Option B: Just Restart Servers (If DB Already Set Up)

```bash
# Stop current servers
pkill -f "wrangler dev" && pkill -f "vite"

# Restart
pnpm dev
```

---

## 🧪 Step 3: Test Authentication (Manual Smoke Test)

### Test 1: Family Signup
```bash
# In a new terminal:
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'
```

**Expected**: Returns `{"user": {...}, "token": "eyJ..."}`

### Test 2: Family Login
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected**: Returns JWT token

### Test 3: Frontend Auth Flow
1. Open http://localhost:5173/auth/signup
2. Fill form (name, email, password)
3. Click "Create Account"
4. Should redirect to `/family/dashboard`

---

## 🎭 Step 4: Run E2E Tests (Automated)

```bash
# In a new terminal (while servers are running):
pnpm test:e2e
```

**What this tests**:
- ✅ Family signup flow
- ✅ Family login flow
- ✅ Caregiver login flow
- ✅ Admin settings (caregiver management)
- ✅ Dashboard functionality
- ✅ Care log submission

**Expected**: Many tests should pass now (forms have proper names, auth works)

---

## 🐛 Troubleshooting

### Issue: "API not responding"
```bash
# Check if API is running:
curl http://localhost:8787/health

# If not, restart:
cd apps/api
pnpm dev
```

### Issue: "Database error"
```bash
# Reset database:
rm -rf apps/api/.wrangler/state  # Clear Cloudflare local state
pnpm db:migrate:dev              # Re-run migration
```

### Issue: "JWT_SECRET not found"
```bash
# Verify file exists:
cat apps/api/.dev.vars

# Should show:
# JWT_SECRET="dev-secret-key-..."
```

### Issue: "Password hash error"
```bash
# Check bcrypt is installed:
cd apps/api
npm list bcryptjs

# If missing:
pnpm add bcryptjs
```

---

## 📊 Quick Validation Checklist

Run these to verify everything works:

```bash
# 1. Check servers are running
curl http://localhost:8787/health  # API
curl http://localhost:5173         # Frontend

# 2. Test signup (creates user with hashed password)
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","name":"User","password":"test123"}'

# 3. Test login (verifies password hash)
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"test123"}'

# 4. Run E2E tests
pnpm test:e2e
```

---

## 🎯 What's Automated vs Manual

### ✅ Automated (No Action Needed)
- Database schema generation (`pnpm db:generate`)
- Database migration (`pnpm db:migrate:dev`)
- Server startup (`pnpm dev`)
- E2E test execution (`pnpm test:e2e`)

### 🖐️ Manual (You Do This)
1. ✅ Create `.dev.vars` file (DONE)
2. Run the commands above
3. Review test results
4. Fix any failures (if needed)

---

## 📝 Complete Workflow (Copy-Paste Ready)

```bash
# From project root (/Users/erniesg/code/erniesg/anchor):

# 1. Setup database (if first time)
pnpm db:generate && pnpm db:migrate:dev

# 2. Start servers
pnpm dev

# 3. In a new terminal, test auth
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"pass123"}'

# 4. Run E2E tests
pnpm test:e2e

# Done! ✅
```

---

## 🚀 Expected Timeline

| Step | Time | Automated? |
|------|------|------------|
| Create .dev.vars | ✅ Done | Manual |
| Database setup | 1 min | Auto (`pnpm db:migrate:dev`) |
| Start servers | 30 sec | Auto (`pnpm dev`) |
| Manual smoke test | 2 min | You run curl commands |
| E2E tests | 5-10 min | Auto (`pnpm test:e2e`) |

**Total Time**: ~10 minutes

---

## 💡 Pro Tips

1. **Keep servers running** in one terminal, run tests in another
2. **Check logs** if tests fail - they show which page/element failed
3. **Database resets**: Delete `.wrangler/state` and re-migrate if needed
4. **Test incrementally**: Run individual test files first:
   ```bash
   pnpm test:e2e tests/e2e/family-onboarding.spec.ts
   ```

---

## 🎉 Success Criteria

You'll know it's working when:
- ✅ `curl http://localhost:8787/health` returns `{"status":"ok"}`
- ✅ Signup returns a JWT token
- ✅ Login with same credentials succeeds
- ✅ E2E tests show green checkmarks (at least auth tests)

---

**Last Updated**: 2025-10-04
**Status**: Ready to test!
