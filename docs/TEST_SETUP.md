# Anchor - Test Setup Guide
**Comprehensive Testing Infrastructure**

---

## 📋 Test Coverage Overview

### Tests Created
- ✅ **Backend API Tests:** 3 suites, 100+ tests
- ✅ **Frontend Component Tests:** 2 suites, 30+ tests
- ✅ **E2E Tests:** 3 suites, 50+ scenarios
- 🎯 **Target Coverage:** >90%

---

## 🧪 Backend API Tests

### Test Suites Created

#### 1. Authentication Tests (`apps/api/src/routes/auth.test.ts`)
**Coverage:** 40+ tests

**Test Categories:**
- Family signup validation
- Family login flow
- Caregiver PIN authentication
- Email/password validation
- Security best practices
- Error handling

**Key Tests:**
```typescript
✓ should create new family account
✓ should validate email format
✓ should validate password length (min 8 chars)
✓ should reject duplicate email
✓ should login with valid credentials
✓ should reject invalid credentials
✓ should validate PIN format (6 digits)
✓ should not leak password in response
```

#### 2. Care Logs Tests (`apps/api/src/routes/care-logs.test.ts`)
**Coverage:** 60+ tests

**Test Categories:**
- Draft creation (caregiver only)
- Auto-save functionality
- Submit workflow (draft → submitted)
- Invalidation workflow (family_admin only)
- RBAC enforcement
- JSON field parsing
- Emergency flags

**Key Tests:**
```typescript
✓ should create care log as draft (caregiver only)
✓ should reject care log creation by family members
✓ should auto-save and preserve draft status
✓ should submit draft care log (caregiver only)
✓ should lock submitted log (immutable)
✓ should invalidate submitted log (family_admin only)
✓ should allow caregiver to edit after invalidation
✓ should hide draft logs from family members
✓ should parse medications/meals JSON correctly
```

#### 3. Caregivers Tests (`apps/api/src/routes/caregivers.test.ts`)
**Coverage:** 40+ tests

**Test Categories:**
- Caregiver creation (family_admin only)
- PIN generation (unique 6-digit)
- Deactivation workflow
- PIN reset
- Update caregiver details
- Audit trail tracking
- RBAC enforcement

**Key Tests:**
```typescript
✓ should create caregiver with PIN (family_admin only)
✓ should reject caregiver creation by family_member
✓ should generate unique PINs
✓ should deactivate caregiver with reason
✓ should reset PIN (family_admin only)
✓ should record deactivatedBy and deactivatedAt
✓ should not leak PINs in response
✓ should track all admin actions (audit trail)
```

### Running Backend Tests

```bash
# Run all backend tests
cd apps/api
pnpm test

# Run specific test file
pnpm test care-logs.test.ts

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test:watch

# Run integration tests
pnpm test:integration
```

---

## 🎨 Frontend Component Tests

### Test Suites Created

#### 1. Auto-Save Hook Tests (`apps/web/src/hooks/use-auto-save.test.ts`)
**Coverage:** 20+ tests

**Test Categories:**
- Debouncing logic
- Save status tracking
- Error handling
- Manual save function
- Concurrent saves
- Edge cases

**Key Tests:**
```typescript
✓ should initialize with idle status
✓ should trigger save after debounce delay
✓ should debounce multiple rapid changes
✓ should handle save errors
✓ should reset error on next successful save
✓ should not save if data is unchanged
✓ should cleanup on unmount
✓ should handle deep object changes
```

#### 2. Dashboard Component Tests (`apps/web/src/routes/family/dashboard.test.tsx`)
**Coverage:** 30+ tests

**Test Categories:**
- Status badges (draft/submitted/invalidated)
- Real-time data display
- Chart rendering
- Error handling
- Accessibility
- Invalidation workflow

**Key Tests:**
```typescript
✓ should display care recipient name
✓ should display draft badge for draft log
✓ should display submitted badge for submitted log
✓ should display invalidated badge for invalidated log
✓ should display morning routine data
✓ should display medication data
✓ should display vital signs
✓ should show emergency alert for emergency flag
✓ should render vital signs chart
✓ should refetch data every 30 seconds
```

### Running Frontend Tests

```bash
# Run all frontend tests
cd apps/web
pnpm test

# Run specific test file
pnpm test dashboard.test.tsx

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test:watch

# UI mode (Vitest)
pnpm test --ui
```

---

## 🎭 Playwright E2E Tests

### Test Suites Created

#### 1. Family Onboarding (`tests/e2e/family-onboarding.spec.ts`)
**Coverage:** 15+ scenarios

**Test Categories:**
- Complete onboarding flow
- Validation errors
- Navigation flow
- Mobile responsiveness

**Key Tests:**
```typescript
✓ should complete full onboarding flow
✓ should validate email format
✓ should validate password length
✓ should prevent duplicate email registration
✓ should allow navigation back in onboarding flow
✓ should save progress when navigating away
✓ should login with valid credentials
✓ should complete onboarding on mobile
```

#### 2. Caregiver Workflow (`tests/e2e/caregiver-workflow.spec.ts`)
**Coverage:** 20+ scenarios

**Test Categories:**
- Care log form completion
- Auto-save functionality
- Draft/submit workflow
- Form locking
- Emergency flags
- Mobile workflow

**Key Tests:**
```typescript
✓ should complete full care log form
✓ should auto-save draft every 30 seconds
✓ should preserve data on page refresh
✓ should lock form after submission
✓ should show emergency alert for emergency flag
✓ should validate required fields
✓ should navigate between sections
✓ should allow editing after invalidation
✓ should complete form on mobile
```

#### 3. Admin Settings (`tests/e2e/admin-settings.spec.ts`)
**Coverage:** 20+ scenarios

**Test Categories:**
- Caregiver management
- Deactivation workflow
- PIN reset
- RBAC enforcement
- Search & filter
- Error handling

**Key Tests:**
```typescript
✓ should display caregiver management section
✓ should deactivate caregiver with reason
✓ should reset caregiver PIN
✓ should create new caregiver
✓ should edit caregiver details
✓ should view caregiver audit trail
✓ should restrict family_member from admin actions
✓ should search caregivers by name
✓ should handle API errors gracefully
```

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e family-onboarding.spec.ts

# Run in headed mode (watch browser)
pnpm test:e2e:headed

# Run in debug mode
pnpm test:e2e:debug

# Run on specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project="Mobile Chrome"

# Generate HTML report
pnpm test:e2e --reporter=html
```

---

## 🛠 Test Configuration

### Vitest Config (Backend & Frontend)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for frontend
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### Playwright Config

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
```

---

## 📊 Coverage Targets

### Backend API
- **Target:** >95% coverage
- **Critical paths:**
  - Authentication flows
  - RBAC middleware
  - Draft/submit workflow
  - Invalidation flow

### Frontend
- **Target:** >90% coverage
- **Critical components:**
  - Auto-save hook
  - Dashboard rendering
  - Care log form
  - Admin settings

### E2E
- **Target:** All critical user journeys
- **Key flows:**
  - Family onboarding
  - Caregiver daily workflow
  - Admin operations

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Root
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### 2. Run All Tests

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Unit tests (backend + frontend)
pnpm test

# E2E tests
pnpm test:e2e

# Everything
pnpm validate
```

### 3. View Coverage Reports

```bash
# Generate coverage
pnpm test:coverage

# Open HTML report
open coverage/index.html
```

---

## 🐛 Debugging Tests

### Backend Tests

```bash
# Run specific test with debug output
pnpm test care-logs.test.ts --reporter=verbose

# Run in watch mode
pnpm test:watch

# Debug in VS Code
# Add breakpoint, press F5
```

### Frontend Tests

```bash
# Run in UI mode (interactive)
pnpm test --ui

# Debug specific component
pnpm test dashboard.test.tsx --reporter=verbose
```

### E2E Tests

```bash
# Run in debug mode (step through)
pnpm test:e2e:debug

# Run in headed mode (watch browser)
pnpm test:e2e:headed

# Generate trace for failed tests
pnpm test:e2e --trace on
```

---

## 📝 Writing New Tests

### Backend API Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';

describe('New Feature API', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', async () => {
    const res = await app.request('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'value' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('expectedField');
  });
});
```

### Frontend Component Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should complete workflow', async ({ page }) => {
    await page.goto('/route');
    await page.fill('input[name="field"]', 'value');
    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Tests failing due to missing dependencies
```bash
pnpm install
pnpm exec playwright install
```

#### 2. Database not found in tests
```bash
# Ensure test database is set up
pnpm db:generate
pnpm db:migrate:dev
```

#### 3. E2E tests timing out
```bash
# Increase timeout in playwright.config.ts
export default defineConfig({
  timeout: 60000, // 60 seconds
});
```

#### 4. Mock data not loading
```bash
# Check if test data is seeded
pnpm db:seed
```

---

## 📈 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test --coverage
      - run: pnpm test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json
```

---

## 🎯 Test Checklist

### Before Commit
- [ ] All tests passing locally
- [ ] Coverage >90% for new code
- [ ] No linting errors
- [ ] Type check passes

### Before PR
- [ ] All CI tests passing
- [ ] E2E tests passing
- [ ] Coverage report reviewed
- [ ] No regression in coverage

### Before Deploy
- [ ] All tests passing in production-like environment
- [ ] Performance tests passing
- [ ] Security tests passing
- [ ] Smoke tests passing

---

## 📚 Additional Resources

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

### Test Files Location
```
anchor/
├── apps/
│   ├── api/src/routes/*.test.ts         # Backend unit tests
│   └── web/src/**/*.test.tsx            # Frontend component tests
├── tests/
│   └── e2e/*.spec.ts                    # E2E tests
└── playwright.config.ts                 # Playwright config
```

---

**Status:** Test infrastructure complete. Ready to run and debug! 🧪

**Next Action:** Run `pnpm test && pnpm test:e2e` to execute all tests.
