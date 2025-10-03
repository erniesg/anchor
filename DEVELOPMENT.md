# Development Guide

**Core Principle: Be succinct. Don't create new files unless absolutely necessary.**

---

## Code Philosophy

1. **Prefer editing existing files over creating new ones**
2. **Consolidate related functionality - avoid file proliferation**
3. **Remove duplicate/redundant files immediately**
4. **Every new file must have clear, unique purpose**

---

## 📋 Table of Contents

1. [Daily Development Workflow](#daily-development-workflow)
2. [Git Workflow & Commit Practices](#git-workflow--commit-practices)
3. [Testing Strategy](#testing-strategy)
4. [Code Style & Conventions](#code-style--conventions)
5. [Pull Request Process](#pull-request-process)
6. [Database Migrations](#database-migrations)
7. [Debugging Tips](#debugging-tips)
8. [Common Commands Reference](#common-commands-reference)

---

## 🌅 Daily Development Workflow

### Morning Routine (5 minutes)

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Check for database migrations
pnpm db:migrate:local

# 4. Run tests to ensure clean state
pnpm test

# 5. Start development server
pnpm dev
```

### During Development (Work Sessions)

**The TDD Cycle (30-60 minutes per feature):**

```
1. 📖 Read task from TDD_CHECKLIST.md
2. 🔴 Write failing test
3. ✅ Verify test fails (run: pnpm test)
4. 🟢 Write minimal code to pass
5. ✅ Verify test passes
6. 🔵 Refactor (if needed)
7. ✅ Verify tests still pass
8. 📝 Commit with semantic message
9. ↻  Repeat
```

**Example Session:**

```bash
# 1. Start working on medication card component
cd apps/web

# 2. Create test file
touch src/components/dashboard/medication-card.test.tsx

# 3. Write failing test
# (Open file, write test for rendering)

# 4. Run test (watch mode)
pnpm test:watch

# 5. Implement component
touch src/components/dashboard/medication-card.tsx

# 6. See test pass ✅

# 7. Refactor if needed

# 8. Commit
git add .
git commit -m "feat(web): add medication card component"

# 9. Continue with next test
```

### End of Day Routine (10 minutes)

```bash
# 1. Ensure all tests pass
pnpm test

# 2. Run linter
pnpm lint

# 3. Type check
pnpm typecheck

# 4. Review uncommitted changes
git status
git diff

# 5. Commit any work in progress
git add .
git commit -m "wip: medication card styling"

# 6. Push all commits to remote
git push origin main

# 7. Update progress in TDD_CHECKLIST.md
# (Check off completed items)

# 8. Note tomorrow's starting point
echo "Tomorrow: Continue with medication compliance chart" >> NOTES.md
```

---

## 🔀 Git Workflow & Commit Practices

### Commit Message Format

**Structure:**
```
<type>(<scope>): <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding or updating tests
- `refactor`: Code restructuring (no functionality change)
- `perf`: Performance improvement
- `docs`: Documentation changes
- `chore`: Tooling, dependencies, config changes
- `style`: Formatting, whitespace (no code change)
- `revert`: Revert a previous commit

**Scopes:**
- `web`: Frontend (React app)
- `api`: Backend (Cloudflare Workers)
- `db`: Database (schema, migrations)
- `shared`: Shared packages (types, validators)
- `infra`: Infrastructure (CI/CD, deployment)

**Examples:**

```bash
# Good commits ✅
git commit -m "feat(web): add caregiver pin login page"
git commit -m "test(api): add unit tests for auth middleware"
git commit -m "fix(db): correct foreign key constraint on care_logs"
git commit -m "refactor(shared): extract medication types to separate file"
git commit -m "perf(api): add caching to dashboard endpoint"

# Bad commits ❌
git commit -m "updates"
git commit -m "fix bug"
git commit -m "WIP"
git commit -m "final changes"
```

### Commit Frequency

**Golden Rules:**
- ✅ **Commit every 30-60 minutes** of meaningful work
- ✅ **Commit after each TDD cycle** (test → code → refactor)
- ✅ **Commit before switching tasks**
- ✅ **Commit before taking breaks**

**Too Frequent:**
- ❌ Committing every 5 minutes
- ❌ Committing incomplete thoughts
- ❌ Committing broken code

**Too Infrequent:**
- ❌ Committing once per day
- ❌ Committing 500+ lines at once
- ❌ Combining multiple features

**Perfect Frequency:**
- ✅ 8-12 commits per work day
- ✅ Each commit is atomic (one logical change)
- ✅ Each commit passes tests

### Branching Strategy (MVP: Trunk-Based)

For MVP, we use **trunk-based development** (no feature branches):

```bash
# Work directly on main
git checkout main
git pull origin main

# Make changes, commit frequently
git commit -m "feat(web): add medication card"

# Push daily
git push origin main
```

**Why trunk-based for MVP?**
- ✅ Faster iteration
- ✅ No merge conflicts
- ✅ Continuous integration
- ✅ Simpler workflow for solo/small team

**Post-MVP: Feature Branches (Optional)**

```bash
# Create feature branch
git checkout -b feat/dashboard-analytics

# Work on feature with regular commits
git commit -m "feat(api): add analytics endpoint"
git commit -m "test(api): add analytics tests"

# Push to remote
git push origin feat/dashboard-analytics

# Create PR when ready
# (GitHub UI or gh CLI)

# Merge after review
git checkout main
git merge feat/dashboard-analytics
git push origin main
```

### Commit Discipline Checklist

Before every commit:

```bash
# 1. Run tests
pnpm test

# 2. Lint code
pnpm lint

# 3. Type check
pnpm typecheck

# 4. Review changes
git diff

# 5. Stage files
git add <files>  # or git add . (if all changes are related)

# 6. Write descriptive commit message
git commit -m "feat(web): add medication card component"

# 7. Verify commit
git log --oneline -1
```

**Automated Pre-Commit Hooks:**

We use Husky + lint-staged to enforce quality:

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
pnpm test --run --reporter=verbose
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Pushing to Remote

**Daily Push:**
```bash
# End of day: Push all commits
git push origin main
```

**Mid-Day Push (If Collaborating):**
```bash
# After completing a feature or test suite
git push origin main
```

**Never Push:**
- ❌ Broken code (failing tests)
- ❌ Code with console.logs
- ❌ Uncommitted changes

---

## 🧪 Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /----\     - Critical user flows
     /      \    - Slow, expensive
    /--------\
   / Integration\ (20%)
  /    Tests    \ - API → DB
 /--------------\ - Multi-component
/   Unit Tests   \ (70%)
\________________/ - Fast, cheap
                    - Components, functions, hooks
```

### Unit Testing (Vitest)

**What to Test:**
- ✅ Pure functions
- ✅ React components (rendering, interactions)
- ✅ Custom hooks
- ✅ Utility functions
- ✅ Zod schemas (validation)
- ✅ Database schema constraints

**Example (Component Test):**

```typescript
// medication-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MedicationCard } from './medication-card';

describe('MedicationCard', () => {
  it('renders medication list', () => {
    const medications = [
      { name: 'Glucophage 500mg', given: true, time: '08:00' },
      { name: 'Forxiga 10mg', given: false, time: null }
    ];

    render(<MedicationCard medications={medications} />);

    expect(screen.getByText('Glucophage 500mg')).toBeInTheDocument();
    expect(screen.getByText('Forxiga 10mg')).toBeInTheDocument();
  });

  it('shows compliance percentage', () => {
    const medications = [
      { name: 'Med 1', given: true, time: '08:00' },
      { name: 'Med 2', given: true, time: '08:30' },
      { name: 'Med 3', given: false, time: null }
    ];

    render(<MedicationCard medications={medications} />);

    expect(screen.getByText('67%')).toBeInTheDocument(); // 2/3 = 67%
  });
});
```

**Running Unit Tests:**

```bash
# Run all tests
pnpm test

# Watch mode (during development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# Run specific test file
pnpm test medication-card

# Update snapshots
pnpm test -u
```

### Integration Testing

**What to Test:**
- ✅ API endpoint → Database flow
- ✅ Auth middleware → Protected routes
- ✅ Multi-table queries
- ✅ Data transformation pipelines

**Example (API Integration Test):**

```typescript
// care-logs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../index';
import { db } from '@anchor/database';

describe('POST /care-logs', () => {
  beforeEach(async () => {
    await db.clearTestData();
  });

  it('creates care log with valid data', async () => {
    const response = await app.request('/care-logs', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        careRecipientId: 'recipient-123',
        logDate: '2025-09-30',
        wakeTime: '07:00',
        mood: 'alert'
      })
    });

    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.id).toBeDefined();
    expect(json.wakeTime).toBe('07:00');
  });

  it('rejects unauthorized requests', async () => {
    const response = await app.request('/care-logs', {
      method: 'POST',
      body: JSON.stringify({ /* ... */ })
    });

    expect(response.status).toBe(401);
  });
});
```

**Running Integration Tests:**

```bash
pnpm test:integration
```

### E2E Testing (Playwright)

**What to Test:**
- ✅ Critical user flows (signup, login, form submission)
- ✅ Multi-page interactions
- ✅ Cross-component state management
- ✅ Real browser behavior

**Example (E2E Test):**

```typescript
// family-onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('family can complete onboarding flow', async ({ page }) => {
  // 1. Signup
  await page.goto('/auth/signup');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');

  // 2. Add care recipient
  await expect(page).toHaveURL('/family/onboarding');
  await page.fill('input[name="recipientName"]', 'Sulochana Rao');
  await page.selectOption('select[name="condition"]', 'PSP');
  await page.click('button:has-text("Next")');

  // 3. Create caregiver
  await page.fill('input[name="caregiverName"]', 'Maria Santos');
  await page.fill('input[name="phone"]', '+65 9123 4567');
  await page.click('button:has-text("Generate PIN")');

  // 4. Verify PIN displayed
  const pinElement = page.locator('[data-testid="caregiver-pin"]');
  await expect(pinElement).toBeVisible();

  const pinText = await pinElement.textContent();
  expect(pinText).toMatch(/\d{6}/); // 6-digit PIN

  // 5. Complete onboarding
  await page.click('button:has-text("Finish")');
  await expect(page).toHaveURL('/family/dashboard');
});
```

**Running E2E Tests:**

```bash
# Headless mode (CI)
pnpm test:e2e

# Headed mode (see browser)
pnpm test:e2e:headed

# Debug mode (step through)
pnpm test:e2e:debug

# Run specific test
pnpm test:e2e family-onboarding

# Generate test code (Codegen)
pnpm playwright codegen http://localhost:5173
```

### Test Coverage Requirements

**Targets:**
- **Unit Tests**: >90% coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: All critical user flows

**Coverage Report:**

```bash
pnpm test:coverage

# Output:
# ✓ src/components/medication-card.tsx (95.2%)
# ✓ src/services/api-client.ts (88.7%)
# ✗ src/utils/date-formatter.ts (82.1%) ← BELOW TARGET
```

**Viewing Coverage:**

```bash
# HTML report
open coverage/index.html
```

---

## 🎨 Code Style & Conventions

### TypeScript Style Guide

**Use Explicit Types:**

```typescript
// ✅ Good
interface CareLog {
  id: string;
  careRecipientId: string;
  logDate: Date;
  wakeTime: string | null;
}

const createCareLog = (data: CareLog): Promise<CareLog> => {
  // ...
};

// ❌ Bad
const createCareLog = (data: any): any => {
  // ...
};
```

**Avoid `any`, Use `unknown`:**

```typescript
// ✅ Good
const parseJSON = (data: unknown): CareLog => {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  // Type narrowing...
  return data as CareLog;
};

// ❌ Bad
const parseJSON = (data: any): CareLog => {
  return data;
};
```

**Use Zod for Runtime Validation:**

```typescript
import { z } from 'zod';

const CareLogSchema = z.object({
  careRecipientId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  mood: z.enum(['alert', 'confused', 'sleepy', 'agitated', 'calm'])
});

type CareLog = z.infer<typeof CareLogSchema>;

// Validate input
const validatedData = CareLogSchema.parse(input);
```

### React Conventions

**Functional Components with TypeScript:**

```typescript
// ✅ Good
interface MedicationCardProps {
  medications: Medication[];
  onUpdate: (id: string) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medications,
  onUpdate
}) => {
  return (
    <div className="card">
      {/* ... */}
    </div>
  );
};

// ❌ Bad (no types)
export const MedicationCard = ({ medications, onUpdate }) => {
  // ...
};
```

**Use Custom Hooks for Reusable Logic:**

```typescript
// ✅ Good
export const useCareLog = (recipientId: string) => {
  return useQuery({
    queryKey: ['care-logs', recipientId],
    queryFn: () => fetchCareLogs(recipientId)
  });
};

// Usage:
const { data, isLoading } = useCareLog(recipientId);
```

**Component File Structure:**

```typescript
// medication-card.tsx

// 1. Imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';

// 2. Types/Interfaces
interface MedicationCardProps {
  // ...
}

// 3. Helper functions (if needed)
const calculateCompliance = (medications: Medication[]) => {
  // ...
};

// 4. Component
export const MedicationCard: React.FC<MedicationCardProps> = (props) => {
  // a. Hooks
  const { data } = useQuery(/* ... */);

  // b. State
  const [expanded, setExpanded] = useState(false);

  // c. Derived values
  const compliance = calculateCompliance(data);

  // d. Event handlers
  const handleExpand = () => setExpanded(!expanded);

  // e. Render
  return (
    <Card>
      {/* ... */}
    </Card>
  );
};
```

### Naming Conventions

**Files:**
```
kebab-case.tsx           ✅ medication-card.tsx
PascalCase.tsx           ❌ MedicationCard.tsx (use kebab-case)
snake_case.tsx           ❌ medication_card.tsx
```

**Components:**
```typescript
PascalCase               ✅ MedicationCard
camelCase                ❌ medicationCard
```

**Functions/Variables:**
```typescript
camelCase                ✅ calculateCompliance
snake_case               ❌ calculate_compliance
PascalCase               ❌ CalculateCompliance
```

**Constants:**
```typescript
UPPER_SNAKE_CASE         ✅ MAX_RETRIES
camelCase                ❌ maxRetries (for constants)
```

**Types/Interfaces:**
```typescript
PascalCase               ✅ CareLog, MedicationSchedule
```

### Code Organization

**Folder Structure:**
```
src/
├── components/
│   ├── dashboard/         # Domain-specific components
│   │   ├── medication-card.tsx
│   │   ├── medication-card.test.tsx
│   │   └── vitals-card.tsx
│   ├── forms/
│   │   ├── medication-form.tsx
│   │   └── vitals-form.tsx
│   └── ui/                # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── hooks/                 # Custom hooks
│   ├── use-care-log.ts
│   └── use-dashboard.ts
├── lib/                   # Utilities, helpers
│   ├── api-client.ts
│   ├── date-utils.ts
│   └── validators.ts
├── routes/                # TanStack Router pages
│   ├── index.tsx
│   ├── auth/
│   └── family/
└── types/                 # Shared types
    ├── care-log.ts
    └── user.ts
```

**Import Order:**

```typescript
// 1. External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal packages
import { CareLog } from '@anchor/shared/types';

// 3. Relative imports (components)
import { Card } from '@/components/ui/card';

// 4. Relative imports (utilities)
import { formatDate } from '@/lib/date-utils';

// 5. Styles
import './medication-card.css';
```

---

## 🔄 Pull Request Process

(For post-MVP when using feature branches)

### Creating a PR

```bash
# 1. Ensure branch is up-to-date
git checkout main
git pull origin main
git checkout feat/your-feature
git rebase main

# 2. Run all checks
pnpm test
pnpm lint
pnpm typecheck

# 3. Push to remote
git push origin feat/your-feature

# 4. Create PR (GitHub CLI)
gh pr create --title "feat: add medication analytics" --body "Description..."

# Or use GitHub UI
```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No console.logs
- [ ] TypeScript strict mode passing

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Related Issues
Closes #123
```

### PR Review Checklist

**For Reviewer:**
- [ ] Code follows style guide
- [ ] Tests are comprehensive
- [ ] No unnecessary complexity
- [ ] Security considerations addressed
- [ ] Performance implications considered

**For Author:**
- [ ] Self-review completed
- [ ] All comments addressed
- [ ] CI/CD passing
- [ ] Conflicts resolved

---

## 🗃️ Database Migrations

### Creating Migrations

```bash
# 1. Modify schema
# Edit packages/database/src/schema.ts

# 2. Generate migration
pnpm db:generate

# Output:
# drizzle/migrations/0001_add_fall_risk_assessment.sql

# 3. Review generated SQL
cat drizzle/migrations/0001_add_fall_risk_assessment.sql

# 4. Apply to local database
pnpm db:migrate:local

# 5. Test locally
pnpm test

# 6. Commit migration
git add drizzle/migrations/
git commit -m "chore(db): add fall risk assessment table"
```

### Migration Best Practices

**✅ Do:**
- Review generated SQL before applying
- Test migrations locally first
- Keep migrations small and atomic
- Add rollback instructions in comments
- Version migrations sequentially

**❌ Don't:**
- Modify existing migrations (create new one)
- Delete migration files
- Mix schema changes with data changes
- Apply untested migrations to production

### Rollback Strategy

```sql
-- Migration: 0001_add_fall_risk_assessment.sql

-- UP
CREATE TABLE fall_risk_assessment (
  id TEXT PRIMARY KEY,
  care_log_id TEXT REFERENCES care_logs(id),
  balance_scale INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN (for rollback - document only, Drizzle doesn't auto-rollback)
-- DROP TABLE fall_risk_assessment;
```

---

## 🐛 Debugging Tips

### Frontend Debugging

**React DevTools:**
```bash
# Install browser extension
# Chrome: React Developer Tools
# Firefox: React DevTools
```

**TanStack Query DevTools:**
```typescript
// Add to main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

**Console Debugging:**
```typescript
// Temporary debugging (remove before commit)
console.log('Debug:', { data, isLoading });

// Better: Use debugger statement
debugger;

// Better: Use React DevTools
```

### API Debugging

**Wrangler Dev Console:**
```bash
# Start API in dev mode
pnpm --filter api dev

# View logs in terminal
# Logs appear automatically

# Test endpoints with curl
curl -X POST http://localhost:8787/care-logs \
  -H "Content-Type: application/json" \
  -d '{"careRecipientId": "123", ...}'
```

**Database Debugging:**

```bash
# Open Drizzle Studio (visual DB browser)
pnpm db:studio

# Access at http://localhost:4983
```

**Debugging Workers:**
```typescript
// Add console.log in Worker
export default {
  async fetch(request: Request, env: Env) {
    console.log('Request:', request.url);

    // Use c.text() in Hono for debugging
    return c.text('Debug response');
  }
};
```

### Test Debugging

**Vitest UI:**
```bash
# Run tests with UI
pnpm test --ui

# Opens browser with test results
```

**Debugging Specific Test:**
```typescript
// Use .only to run single test
it.only('should calculate compliance', () => {
  // ...
});

// Use debugger
it('should calculate compliance', () => {
  debugger; // Pauses execution
  // ...
});
```

**Playwright Debugging:**
```bash
# Debug mode (step through)
pnpm test:e2e:debug

# Show browser (headed mode)
pnpm test:e2e:headed

# Slow motion
pnpm test:e2e -- --slow-mo=1000
```

---

## 📚 Common Commands Reference

### Project Setup

```bash
# Install dependencies
pnpm install

# Start development servers (all)
pnpm dev

# Start specific app
pnpm --filter web dev
pnpm --filter api dev
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:debug
```

### Linting & Type Checking

```bash
# Lint all files
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm typecheck

# Format code
pnpm format

# Run all checks
pnpm validate
```

### Database

```bash
# Generate migration
pnpm db:generate

# Apply migrations (local)
pnpm db:migrate:local

# Apply migrations (production)
pnpm db:migrate:prod

# Open Drizzle Studio
pnpm db:studio

# Seed test data
pnpm db:seed
```

### Build & Deploy

```bash
# Build frontend
pnpm --filter web build

# Build API
pnpm --filter api build

# Deploy to Cloudflare
pnpm deploy

# Deploy specific app
pnpm --filter web deploy
pnpm --filter api deploy
```

### Utilities

```bash
# Clean node_modules
pnpm clean

# Update dependencies
pnpm update

# Check outdated dependencies
pnpm outdated

# Generate component
pnpm generate:component MedicationCard

# Generate API route
pnpm generate:route care-logs
```

---

## 🔐 Environment Variables

### Local Development

Create `.dev.vars` in project root:

```bash
# Database
DATABASE_ID="your-d1-database-id"

# Storage
R2_BUCKET="anchor-storage"

# Auth
LOGTO_ENDPOINT="https://your-logto-domain.com"
LOGTO_APP_ID="your-app-id"
LOGTO_APP_SECRET="your-app-secret"
JWT_SECRET="generate-random-string-here"

# Feature Flags
ENABLE_DEBUG_LOGS=true
ENABLE_ANALYTICS=false
```

### Production

Set via Wrangler:

```bash
# Set secret (prompt for value)
wrangler secret put JWT_SECRET

# Set environment variable
wrangler secret put LOGTO_APP_SECRET
```

---

## 🚀 Quick Start Reminder

```bash
# 1. Morning
git pull origin main && pnpm install && pnpm test

# 2. Start dev
pnpm dev

# 3. Work (TDD cycle)
# Write test → See fail → Implement → See pass → Refactor → Commit

# 4. End of day
pnpm test && pnpm lint && git push origin main
```

---

**Remember**: Test first, commit often, ship with confidence! 🎯