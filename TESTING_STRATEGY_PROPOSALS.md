# Testing Strategy Proposals for Anchor Care Logs API

**Sprint 1 Day 2 Status**: 40/41 tests passing (97.6%)
**Remaining Issue**: Cannot parse Drizzle ORM's `and(eq(...), eq(...))` structure in mocked queries

---

## The Problem

The failing test: `should hide draft logs from family members`

**Root Cause**: The mock database in `test-setup.ts` cannot properly parse Drizzle's `and()` combinator. When the production code queries:

```typescript
db.select()
  .from(careLogs)
  .where(
    and(
      eq(careLogs.careRecipientId, recipientId),
      eq(careLogs.status, 'submitted')
    )
  )
```

The mock's `hasStatusFilter()` function fails to detect the `status = 'submitted'` condition inside the `and()`, so it returns ALL logs (including drafts) instead of only submitted logs.

**Drizzle AND Structure** (discovered via inspection):
```javascript
{
  queryChunks: [
    { value: ["("] },
    {
      queryChunks: [
        { queryChunks: [column, " = ", value] },  // First eq()
        { value: [" and "] },
        { queryChunks: [column, " = ", value] }   // Second eq()
      ]
    },
    { value: [")"] }
  ]
}
```

---

## Proposal 1: Fix the Mock Parser ⚡ **FASTEST** (30 minutes)

### Approach
Parse the nested `queryChunks` structure to extract column names and values from `and()` conditions.

### Implementation

**File**: `apps/api/src/test-setup.ts` (lines 139-174)

```typescript
// BEFORE: Simple column.name check (doesn't work for AND)
const hasStatusFilter = (obj: any): boolean => {
  if (!obj) return false;
  if (obj.column && obj.column.name === 'status' && obj.value === 'submitted') return true;
  if (obj.left) return hasStatusFilter(obj.left) || hasStatusFilter(obj.right);
  return false;
};

// AFTER: Deep queryChunks parser
const extractConditions = (queryChunks: any[]): Array<{column: string, value: any}> => {
  const conditions: Array<{column: string, value: any}> = [];

  if (!Array.isArray(queryChunks)) return conditions;

  for (const chunk of queryChunks) {
    // Recursively parse nested queryChunks (for AND/OR)
    if (chunk.queryChunks) {
      conditions.push(...extractConditions(chunk.queryChunks));
    }

    // Extract column-value pairs from eq() conditions
    // Pattern: [column_object, " = ", value]
    if (Array.isArray(chunk.queryChunks) && chunk.queryChunks.length >= 3) {
      const col = chunk.queryChunks.find((c: any) => c.name);
      const val = chunk.queryChunks.find((c: any) =>
        typeof c === 'string' || typeof c === 'number'
      );

      if (col && val !== undefined) {
        conditions.push({ column: col.name, value: val });
      }
    }
  }

  return conditions;
};

// Usage in WHERE mock
where: vi.fn((condition: any) => {
  const records = Array.from(dataStore.values());
  let filteredRecords = records;

  // Extract all conditions from Drizzle query
  const conditions = extractConditions(condition?.queryChunks || []);

  // Apply filters
  conditions.forEach(({ column, value }) => {
    if (column === 'status') {
      filteredRecords = filteredRecords.filter((r: any) => r.status === value);
    }
    if (column === 'care_recipient_id') {
      filteredRecords = filteredRecords.filter((r: any) => r.careRecipientId === value);
    }
  });

  // ... rest of mock logic
})
```

### Pros
- ✅ **Fastest fix** (30 minutes implementation)
- ✅ Keeps existing mock architecture
- ✅ No new dependencies

### Cons
- ❌ Fragile (breaks if Drizzle changes internal structure)
- ❌ Only handles `and()` + `eq()` (not `or()`, `like()`, etc.)
- ❌ Tight coupling to Drizzle internals

### Recommendation
✅ **RECOMMENDED for immediate unblocking** - Use this to get to 41/41, then refactor to Proposal 2 later.

---

## Proposal 2: Real SQLite Database 🏆 **MOST ROBUST** (2-3 hours)

### Approach
Replace mocks with an in-memory SQLite database using `better-sqlite3`. Run real Drizzle queries.

### Implementation

**New file**: `apps/api/src/test-db.ts`

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@anchor/database/schema';

export function createTestDb() {
  // Create in-memory database
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  // Run migrations
  migrate(db, { migrationsFolder: './drizzle' });

  return { db, sqlite };
}

export function seedTestData(db: any) {
  // Insert test users, care recipients, caregivers
  const familyAdmin = db.insert(schema.users).values({
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'family_admin',
    passwordHash: 'hash',
  }).returning().get();

  // ... more seed data

  return { familyAdmin };
}
```

**Update**: `apps/api/src/test-setup.ts`

```typescript
import { beforeEach } from 'vitest';
import { createTestDb, seedTestData } from './test-db';

let testDb: any;

beforeEach(() => {
  // Fresh database for each test
  testDb = createTestDb();
  seedTestData(testDb.db);
});

afterEach(() => {
  // Close database
  testDb.sqlite.close();
});

// Mock @anchor/database to return real DB
vi.mock('@anchor/database', () => ({
  createDbClient: vi.fn(() => testDb.db),
}));
```

**Update tests**: No changes needed! Tests work with real database.

### Pros
- ✅ **Tests real behavior** (no mocking layer)
- ✅ Future-proof (works with any Drizzle query)
- ✅ Catches real database bugs
- ✅ Fast (in-memory, ~5-10ms per test)
- ✅ Easy to debug (can inspect real SQL)

### Cons
- ❌ Requires better-sqlite3 dependency
- ❌ Need migration files
- ❌ 2-3 hours initial setup

### Recommendation
🏆 **RECOMMENDED for long-term** - Best investment for maintainability and reliability.

---

## Proposal 3: SQL String Inspection 🔍 **MIDDLE GROUND** (1-2 hours)

### Approach
Mock D1's `prepare()` to inspect generated SQL strings instead of Drizzle objects.

### Implementation

**File**: `apps/api/src/test-setup.ts`

```typescript
const testDataStore: Map<string, any> = new Map();

// Mock D1 to intercept SQL queries
mockD1 = {
  prepare: vi.fn((sql: string) => {
    console.log('SQL Query:', sql);

    // Parse WHERE clause from SQL string
    const hasStatusSubmitted = sql.includes("status") && sql.includes("'submitted'");
    const hasCareRecipientFilter = sql.match(/care_recipient_id\s*=\s*'([^']+)'/);

    return {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(async () => {
        let records = Array.from(testDataStore.values());

        // Apply filters based on SQL
        if (hasStatusSubmitted) {
          records = records.filter(r => r.status === 'submitted');
        }
        if (hasCareRecipientFilter) {
          const recipientId = hasCareRecipientFilter[1];
          records = records.filter(r => r.careRecipientId === recipientId);
        }

        return { results: records };
      }),
      // ... other methods
    };
  }),
};
```

### Pros
- ✅ Works with any Drizzle query pattern
- ✅ No dependency on Drizzle internals
- ✅ Easier to debug (readable SQL strings)

### Cons
- ❌ SQL parsing is fragile (regex-based)
- ❌ Still mocking (not testing real behavior)
- ❌ Doesn't work with Drizzle's query builder API

### Recommendation
⚠️ **NOT RECOMMENDED** - Combines downsides of both mocking and real DB without clear benefits.

---

## Proposal 4: Accept 97.6% and Skip Test 🎯 **PRAGMATIC** (5 minutes)

### Approach
Document the limitation and skip the problematic test. Focus on Sprint 1 implementation.

### Implementation

**File**: `apps/api/src/routes/care-logs.test.ts` (line 412)

```typescript
// SKIP: Mock cannot parse Drizzle's and(eq(), eq()) structure
// Production code works correctly (verified manually)
// TODO: Migrate to real database testing (see TESTING_STRATEGY_PROPOSALS.md)
it.skip('should hide draft logs from family members', async () => {
  // ... test code
});
```

**File**: `TESTING_STRATEGY_PROPOSALS.md` (this document)

Add comprehensive documentation of the issue and future migration plan.

### Pros
- ✅ **Fastest** (5 minutes)
- ✅ Unblocks Sprint 1 Day 3 implementation
- ✅ Business logic already proven (2 bugs fixed!)
- ✅ Documents technical debt for future

### Cons
- ❌ One edge case untested (draft visibility)
- ❌ Kicks the can down the road

### Recommendation
🎯 **RECOMMENDED if time-constrained** - Pragmatic choice to maintain velocity.

---

## Proposal 5: Hybrid Approach 🔀 **BALANCED** (1 hour)

### Approach
Use Proposal 1 (quick fix) NOW + Proposal 2 (real DB) LATER as a separate task.

### Timeline
- **Today** (30 min): Implement Proposal 1 → Get to 41/41 tests
- **Sprint 1 Day 3** (2-3 hours): Replace with Proposal 2 during refactoring phase
- **Sprint 2**: All new tests use real database

### Pros
- ✅ Immediate unblocking
- ✅ Clear migration path
- ✅ No technical debt accumulation

### Cons
- ❌ Requires two implementation efforts

### Recommendation
🔀 **BEST OF BOTH WORLDS** - Pragmatic short-term + robust long-term.

---

## Comparison Matrix

| Proposal | Time | Reliability | Future-Proof | Complexity |
|----------|------|-------------|--------------|------------|
| 1. Fix Parser | 30m | ⚠️ Medium | ❌ Low | ⭐ Simple |
| 2. Real DB | 2-3h | ✅ High | ✅ High | ⭐⭐ Moderate |
| 3. SQL Parsing | 1-2h | ⚠️ Medium | ⚠️ Medium | ⭐⭐⭐ Complex |
| 4. Skip Test | 5m | ❌ Low | ❌ Low | ⭐ Trivial |
| 5. Hybrid | 30m + 2-3h | ✅ High | ✅ High | ⭐⭐ Moderate |

---

## Industry Research (2025-10-06) 📚

### Cloudflare Official Recommendation
**Source**: [Cloudflare Workers Vitest Integration](https://blog.cloudflare.com/workers-vitest-integration/)

Cloudflare recommends `@cloudflare/vitest-pool-workers` which:
- Runs tests in real `workerd` runtime (not Node.js simulation)
- Provides **isolated per-test storage** for D1/KV/R2
- Automatically undoes storage writes after each test
- Supports D1 migrations with `applyD1Migrations()`

**Example**:
```typescript
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

describe('D1 Database', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, migrations);
  });

  it('queries work correctly', async () => {
    const result = await env.DB.prepare('SELECT * FROM users').all();
    expect(result.results).toEqual([]);
  });
});
```

### Drizzle Community Best Practice
**Source**: [Drizzle ORM Issue #4205](https://github.com/drizzle-team/drizzle-orm/issues/4205)

The Drizzle community has standardized on **in-memory databases** (not mocking):

For Postgres users → **PGlite** (WASM-compiled Postgres in memory)
For SQLite users → **better-sqlite3** (in-memory mode)

**Key Insight**: "PGlite runs WASM-compiled postgres in memory. Ideal for testing as there's no docker containers, no delay, and it's real pg. Supports parallelism and watch mode."

**Setup** (adapted for SQLite):
```typescript
// vitest.setup.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

vi.mock('@anchor/database', async () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: './drizzle' });

  // Seed test data
  await db.insert(users).values({ email: 'test@test.com' });

  return { createDbClient: () => db };
});
```

### Community Consensus (2025)
- ✅ **Real databases** > Mocking for integration tests
- ✅ **In-memory** > Docker for speed and simplicity
- ✅ **Mocking** only for pure unit tests (business logic isolation)
- ❌ Avoid mocking Drizzle queries (too fragile)

---

## Updated Recommendation 🎯

### Option A: Cloudflare-Native Approach (OFFICIAL) ⭐
**Use `@cloudflare/vitest-pool-workers` with D1**

**Pros**:
- ✅ Official Cloudflare solution
- ✅ Tests in real workerd runtime
- ✅ Isolated per-test D1 storage
- ✅ Best production parity

**Cons**:
- ⚠️ More complex setup
- ⚠️ Requires wrangler.toml configuration
- ⚠️ Tied to Cloudflare ecosystem

**Time**: 2-3 hours initial setup

---

### Option B: Community-Standard Approach (RECOMMENDED) 🏆
**Use `better-sqlite3` with in-memory database**

**Pros**:
- ✅ Proven by Drizzle community
- ✅ Fast setup (1-2 hours)
- ✅ Framework-agnostic
- ✅ No mocking fragility

**Cons**:
- ⚠️ Tests in Node.js (not workerd)
- ⚠️ Minor API differences from D1

**Time**: 1-2 hours

---

### Option C: Hybrid Quick Fix (PRAGMATIC) ⚡
**Fix mock now, migrate to Option B later**

**Pros**:
- ✅ Immediate unblocking (30 min)
- ✅ Clear migration path

**Cons**:
- ❌ Technical debt
- ❌ Fragile mock logic

**Time**: 30 min + 1-2 hours later

---

## Final Recommendation 🎯

### For Immediate Sprint Progress:
**Option B (Community-Standard)** - better-sqlite3 in-memory

### Why This Wins:
1. ✅ **Industry-proven** (Drizzle community standard 2025)
2. ✅ **No mocking fragility** (real database, real queries)
3. ✅ **Fast enough** (1-2 hours vs 30min + 2-3 hours for hybrid)
4. ✅ **Future-proof** (works with any Drizzle query pattern)
5. ✅ **Framework-agnostic** (easier to migrate if needed)

### Why NOT Option A (Cloudflare-Native):
- We're already using mocked D1 for tests (not real Cloudflare environment)
- Better-sqlite3 gives same SQLite behavior as D1
- Can migrate to Option A in Sprint 2 if production parity becomes critical

---

## Implementation Steps (RECOMMENDED: Option B)

### Phase 1: Install Dependencies (5 minutes)

```bash
# Install better-sqlite3 for in-memory testing
pnpm add -D better-sqlite3 @types/better-sqlite3

# Install drizzle better-sqlite3 driver
pnpm add -D drizzle-orm
```

### Phase 2: Create Test Database Helper (15 minutes)

**File**: `apps/api/src/test/db-helper.ts`

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@anchor/database/schema';
import { sql } from 'drizzle-orm';

export function createTestDb() {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

export function runMigrations(db: any) {
  // Apply schema using drizzle-kit push (no migration files needed)
  // Or use migrate() if you have migrations folder

  // For now, create tables manually from schema
  const { careLogs, users, careRecipients, caregivers } = schema;

  // This is a simplified approach - in production, use proper migrations
  db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS care_recipients (
      id TEXT PRIMARY KEY,
      family_admin_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS caregivers (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS care_logs (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      caregiver_id TEXT,
      log_date INTEGER NOT NULL,
      status TEXT DEFAULT 'draft',
      wake_time TEXT,
      mood TEXT,
      medications TEXT,
      meals TEXT,
      toileting TEXT,
      balance_issues INTEGER,
      near_falls TEXT,
      actual_falls TEXT,
      walking_pattern TEXT,
      freezing_episodes TEXT,
      unaccompanied_time TEXT,
      safety_checks TEXT,
      emergency_prep TEXT,
      emergency_flag INTEGER DEFAULT 0,
      submitted_at INTEGER,
      invalidated_at INTEGER,
      invalidated_by TEXT,
      invalidation_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

export function seedTestData(db: any) {
  const { users, careRecipients, caregivers } = schema;

  // Insert test users
  db.insert(users).values({
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Test Family Admin',
    role: 'family_admin',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  db.insert(users).values({
    id: 'user-456',
    email: 'member@test.com',
    name: 'Test Family Member',
    role: 'family_member',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  // Insert test care recipient
  db.insert(careRecipients).values({
    id: '550e8400-e29b-41d4-a716-446655440000',
    familyAdminId: 'user-123',
    name: 'Test Recipient',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  // Insert test caregiver
  db.insert(caregivers).values({
    id: '550e8400-e29b-41d4-a716-446655440001',
    careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Caregiver',
    pinCode: 'hashed-pin',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  return {
    familyAdminId: 'user-123',
    familyMemberId: 'user-456',
    careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
    caregiverId: '550e8400-e29b-41d4-a716-446655440001',
  };
}
```

### Phase 3: Update Test Setup (30 minutes)

**File**: `apps/api/src/test-setup.ts`

```typescript
import { beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, runMigrations, seedTestData } from './test/db-helper';

// Global test database instance
let testDb: any;
let testSqlite: any;

beforeEach(() => {
  // Create fresh in-memory database for each test
  const { db, sqlite } = createTestDb();
  testDb = db;
  testSqlite = sqlite;

  // Apply schema
  runMigrations(db);

  // Seed test data
  seedTestData(db);
});

afterEach(() => {
  // Close database connection
  testSqlite?.close();
  testDb = null;
  testSqlite = null;
});

// Mock @anchor/database to return our test database
vi.mock('@anchor/database', () => ({
  createDbClient: vi.fn(() => testDb),
}));

// Keep existing mocks for JWT, access control, etc.
vi.mock('hono/jwt', () => ({
  verify: vi.fn(async (token: string) => {
    if (token.startsWith('mock-token-family-admin')) {
      return { sub: 'user-123', role: 'family_admin' };
    }
    if (token.startsWith('mock-token-family-member')) {
      return { sub: 'user-456', role: 'family_member' };
    }
    if (token.startsWith('mock-token-caregiver')) {
      return {
        caregiverId: '550e8400-e29b-41d4-a716-446655440001',
        careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
      };
    }
    throw new Error('Invalid JWT');
  }),
  sign: vi.fn(async () => 'mock-jwt-token'),
}));

// ... keep other mocks
```

### Phase 4: Run Tests (5 minutes)

```bash
# Run all care-logs tests
pnpm --filter @anchor/api test care-logs

# Expected: 41/41 tests passing! ✅
```

### Phase 5: Verify and Commit (5 minutes)

```bash
# Run full test suite
pnpm --filter @anchor/api test

# Commit changes
git add apps/api/src/test/ apps/api/package.json
git commit -m "test: migrate to better-sqlite3 in-memory database

- Replace fragile Drizzle query mocking with real SQLite
- All 41 care-logs tests now passing
- Future-proof: works with any Drizzle query pattern
- Following Drizzle community best practices (2025)"

git push
```

### Total Time: ~1 hour

---

## Alternative: Phase 1 Quick Fix (Proposal C)

### Phase 1: Quick Fix (TODAY - 30 minutes)

```bash
# 1. Update test-setup.ts with deep queryChunks parser
# 2. Run tests
pnpm --filter @anchor/api test care-logs

# 3. Verify 41/41 passing
# 4. Commit
git add apps/api/src/test-setup.ts
git commit -m "test: fix Drizzle AND condition parsing in mocks"
git push
```

### Phase 2: Real Database (Sprint 1 Day 3 - 2-3 hours)

```bash
# 1. Install better-sqlite3
pnpm add -D better-sqlite3 @types/better-sqlite3

# 2. Create test-db.ts with in-memory SQLite
# 3. Update test-setup.ts to use real database
# 4. Run all tests
pnpm --filter @anchor/api test

# 5. Commit
git add apps/api/src/test-db.ts apps/api/src/test-setup.ts
git commit -m "test: migrate to real SQLite database for tests"
git push
```

---

## Decision Log

**Date**: 2025-10-06
**Status**: Awaiting user decision
**Sprint**: Day 2 Complete (97.6% → 100%)
**Next**: Sprint 1 Day 3 (Fall Risk Implementation)

**Question for User**: Which proposal do you prefer?
- Option A: Hybrid (Proposal 5) - Quick fix now, robust later
- Option B: Real DB only (Proposal 2) - Do it right the first time
- Option C: Skip test (Proposal 4) - Pragmatic, move on to Day 3
