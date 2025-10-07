# Sprint 2: Enhanced Clinical Tracking - TDD Implementation Plan

**Date**: 2025-10-07
**Status**: 🚀 **PLANNING**
**Duration**: 2 weeks (Oct 7 - Oct 21, 2025)
**Sprint Goal**: Increase template coverage from 61% to 75% (63/84 fields)

---

## 📋 Sprint 2 Objectives

### Target Features (4 Major Sections)

1. **Fluid Intake Monitoring** (10 fields) - 3 days
2. **Enhanced Medication Tracking** (4 fields) - 2 days
3. **Sleep Tracking** (7 fields) - 2 days
4. **Mobility & Exercise** (9 fields) - 3 days

**Success Metrics**:
- ✅ 100% test coverage for new fields
- ✅ All API tests passing before UI implementation
- ✅ E2E tests for each feature
- ✅ Mobile-responsive UI
- ✅ Dashboard charts for all new metrics

---

## 🗄️ Database Schema Analysis

### Existing Schema (from `packages/database/src/schema.ts`)

#### ✅ Already in Schema (Partially Implemented)
```typescript
// Fluids - EXISTS but needs enhancement
fluids: text('fluids', { mode: 'json' }).$type<Array<{
  name: string;
  time: string;
  amountMl: number;
  swallowingIssues: string[];
}>>()
totalFluidIntake: integer('total_fluid_intake') // ml

// Mobility - EXISTS but incomplete
mobility: text('mobility', { mode: 'json' }).$type<{
  steps?: number;
  distance?: number;
  walkingAssistance?: string;
  exercises?: Array<{ type: string; duration: number; participation: number }>;
}>()

// Medications - EXISTS but needs purpose/notes
medications: text('medications', { mode: 'json' }).$type<Array<{
  name: string;
  given: boolean;
  time: string | null;
  timeSlot: 'before_breakfast' | 'after_breakfast' | 'afternoon' | 'after_dinner' | 'before_bedtime';
}>>()
```

#### ❌ Missing from Schema (Need to Add)
```sql
-- Sleep Tracking (NEW)
ALTER TABLE care_logs ADD COLUMN afternoon_rest TEXT; -- JSON object
ALTER TABLE care_logs ADD COLUMN night_sleep TEXT; -- JSON object

-- Sleep JSON Structure:
-- afternoon_rest: { startTime, endTime, quality: 'deep'|'light'|'restless'|'no_sleep', notes }
-- night_sleep: {
--   bedtime,
--   quality: 'deep'|'light'|'restless'|'no_sleep',
--   wakings: number,
--   wakingReasons: string[],
--   behaviors: string[],
--   notes
-- }
```

---

## 🧪 TDD Implementation Plan

### Phase 1: Fluid Intake Monitoring (Days 1-3)

#### Day 1: API Layer (Test-First)

**Goal**: Write tests first, then implement API validation

##### 1.1 API Tests (`apps/api/src/routes/care-logs.test.ts`)

```typescript
describe('Care Logs API > Sprint 2 Day 1: Fluid Intake Monitoring', () => {

  it('should accept valid fluid entries', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        {
          name: 'Glucerna Milk',
          time: '08:30',
          amountMl: 250,
          swallowingIssues: [],
        },
        {
          name: 'Plain Water',
          time: '10:00',
          amountMl: 150,
          swallowingIssues: [],
        },
      ],
      totalFluidIntake: 400,
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.fluids).toHaveLength(2);
    expect(data.totalFluidIntake).toBe(400);
  });

  it('should auto-calculate total fluid intake', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        { name: 'Moringa Water', time: '08:00', amountMl: 200, swallowingIssues: [] },
        { name: 'Orange Juice', time: '10:00', amountMl: 150, swallowingIssues: [] },
        { name: 'Plain Water', time: '14:00', amountMl: 100, swallowingIssues: [] },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.totalFluidIntake).toBe(450); // Auto-calculated
  });

  it('should validate fluid amount is positive', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        { name: 'Water', time: '10:00', amountMl: -100, swallowingIssues: [] },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(400);
    const error = await res.json();
    expect(error.message).toContain('amount must be positive');
  });

  it('should require fluid name when entry added', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        { name: '', time: '10:00', amountMl: 100, swallowingIssues: [] },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(400);
    const error = await res.json();
    expect(error.message).toContain('name is required');
  });

  it('should accept empty fluids array', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [],
      totalFluidIntake: 0,
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.totalFluidIntake).toBe(0);
  });

  it('should track swallowing issues per fluid', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        {
          name: 'Glucerna Milk',
          time: '08:30',
          amountMl: 250,
          swallowingIssues: ['coughing', 'slow'],
        },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.fluids[0].swallowingIssues).toEqual(['coughing', 'slow']);
  });

  it('should warn when total fluid intake is low (<1000ml)', async () => {
    const careLogData = {
      ...basicCareLog,
      fluids: [
        { name: 'Water', time: '08:00', amountMl: 300, swallowingIssues: [] },
        { name: 'Juice', time: '12:00', amountMl: 200, swallowingIssues: [] },
      ],
      totalFluidIntake: 500,
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.lowFluidWarning).toBe(true); // Dehydration risk
  });
});
```

##### 1.2 API Validation Schema (`apps/api/src/routes/care-logs.ts`)

```typescript
import { z } from 'zod';

// Fluid Entry Schema
const fluidEntrySchema = z.object({
  name: z.string().min(1, 'Fluid name is required'),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  amountMl: z.number().int().positive('Amount must be positive'),
  swallowingIssues: z.array(z.string()).optional().default([]),
});

// Update care log schema
const careLogCreateSchema = z.object({
  // ... existing fields ...

  // Fluid Intake
  fluids: z.array(fluidEntrySchema).optional().default([]),
  totalFluidIntake: z.number().int().nonnegative().optional(),
});

// Helper function to calculate total fluid intake
function calculateTotalFluidIntake(fluids: FluidEntry[]): number {
  return fluids.reduce((total, fluid) => total + fluid.amountMl, 0);
}

// POST /care-logs endpoint
app.post('/care-logs', async (c) => {
  // ... validation ...

  // Auto-calculate total fluid intake if not provided
  if (data.fluids && !data.totalFluidIntake) {
    data.totalFluidIntake = calculateTotalFluidIntake(data.fluids);
  }

  // Add low fluid warning if needed
  const lowFluidWarning = data.totalFluidIntake && data.totalFluidIntake < 1000;

  // ... insert into database ...

  return c.json({ ...result, lowFluidWarning }, 201);
});
```

#### Day 2: Caregiver Form UI (Test-First)

##### 2.1 E2E Tests (`tests/e2e/fluid-intake.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Caregiver Form - Fluid Intake Monitoring', () => {

  test.beforeEach(async ({ page }) => {
    // Login as caregiver
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'test-caregiver-id');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/caregiver/form');
  });

  test('should display fluid intake section with empty state', async ({ page }) => {
    await expect(page.locator('h3:has-text("Fluid Intake Monitoring")')).toBeVisible();
    await expect(page.locator('[data-testid="fluid-entry"]')).toHaveCount(0);
    await expect(page.locator('button:has-text("Add Fluid Entry")')).toBeVisible();
  });

  test('should add fluid entry with beverage selection', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');

    await expect(page.locator('[data-testid="fluid-entry"]')).toHaveCount(1);

    // Select from predefined beverages
    await page.click('select[name="fluids.0.name"]');
    await expect(page.locator('option:has-text("Glucerna Milk")')).toBeVisible();
    await expect(page.locator('option:has-text("Moringa Water")')).toBeVisible();
    await expect(page.locator('option:has-text("Plain Water")')).toBeVisible();
  });

  test('should calculate total fluid intake automatically', async ({ page }) => {
    // Add first entry
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');

    // Add second entry
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.1.name"]', 'Plain Water');
    await page.fill('input[name="fluids.1.time"]', '10:00');
    await page.fill('input[name="fluids.1.amountMl"]', '150');

    // Total should auto-calculate
    await expect(page.locator('[data-testid="total-fluid-intake"]')).toHaveText('Total daily fluid intake: 400 ml');
  });

  test('should show warning for low fluid intake', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Plain Water');
    await page.fill('input[name="fluids.0.time"]', '08:00');
    await page.fill('input[name="fluids.0.amountMl"]', '300');

    await expect(page.locator('[data-testid="low-fluid-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-fluid-warning"]')).toContainText('Low fluid intake (<1000ml)');
    await expect(page.locator('[data-testid="low-fluid-warning"]')).toHaveClass(/bg-yellow/); // Warning color
  });

  test('should remove fluid entry', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');
    await page.click('button:has-text("Add Fluid Entry")');

    await expect(page.locator('[data-testid="fluid-entry"]')).toHaveCount(2);

    await page.click('[data-testid="remove-fluid-0"]');

    await expect(page.locator('[data-testid="fluid-entry"]')).toHaveCount(1);
  });

  test('should track swallowing issues per fluid', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Glucerna Milk');
    await page.fill('input[name="fluids.0.time"]', '08:30');
    await page.fill('input[name="fluids.0.amountMl"]', '250');

    await page.check('input[name="fluids.0.swallowingIssues.coughing"]');
    await page.check('input[name="fluids.0.swallowingIssues.slow"]');

    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Care log submitted successfully')).toBeVisible();
  });

  test('should support custom fluid name', async ({ page }) => {
    await page.click('button:has-text("Add Fluid Entry")');
    await page.selectOption('select[name="fluids.0.name"]', 'Other');

    await expect(page.locator('input[name="fluids.0.customName"]')).toBeVisible();
    await page.fill('input[name="fluids.0.customName"]', 'Green Tea');

    await page.fill('input[name="fluids.0.time"]', '10:00');
    await page.fill('input[name="fluids.0.amountMl"]', '200');

    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Care log submitted successfully')).toBeVisible();
  });
});
```

##### 2.2 Caregiver Form UI Implementation (`apps/web/src/routes/caregiver/form.tsx`)

```typescript
// Predefined beverage list (from template)
const BEVERAGE_OPTIONS = [
  'Glucerna Milk',
  'Moringa Water',
  'Fenugreek Water',
  'Orange Juice',
  'Cucumber Juice',
  'Plain Water',
  'Tea',
  'Coffee',
  'Soup',
  'Other',
];

interface FluidEntry {
  name: string;
  time: string;
  amountMl: number;
  swallowingIssues: string[];
}

function CaregiverForm() {
  // ... existing state ...

  const [fluids, setFluids] = useState<FluidEntry[]>([]);

  // Calculate total fluid intake
  const totalFluidIntake = fluids.reduce((total, fluid) => total + fluid.amountMl, 0);
  const isLowFluidIntake = totalFluidIntake < 1000;

  const addFluidEntry = () => {
    setFluids([
      ...fluids,
      {
        name: '',
        time: '',
        amountMl: 0,
        swallowingIssues: [],
      },
    ]);
  };

  const removeFluidEntry = (index: number) => {
    setFluids(fluids.filter((_, i) => i !== index));
  };

  const updateFluidEntry = (index: number, field: keyof FluidEntry, value: any) => {
    const updated = [...fluids];
    updated[index] = { ...updated[index], [field]: value };
    setFluids(updated);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Existing sections... */}

      {/* Fluid Intake Monitoring Section */}
      <section className="mb-8">
        <h3 className="text-xl font-bold mb-4">💧 Fluid Intake Monitoring</h3>

        {fluids.map((fluid, index) => (
          <div
            key={index}
            data-testid="fluid-entry"
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-gray-700">Fluid Entry {index + 1}</h4>
              <button
                type="button"
                data-testid={`remove-fluid-${index}`}
                onClick={() => removeFluidEntry(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beverage *
                </label>
                <select
                  name={`fluids.${index}.name`}
                  value={fluid.name}
                  onChange={(e) => updateFluidEntry(index, 'name', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select beverage</option>
                  {BEVERAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time *
                </label>
                <input
                  type="time"
                  name={`fluids.${index}.time`}
                  value={fluid.time}
                  onChange={(e) => updateFluidEntry(index, 'time', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (ml) *
                </label>
                <input
                  type="number"
                  name={`fluids.${index}.amountMl`}
                  value={fluid.amountMl || ''}
                  onChange={(e) => updateFluidEntry(index, 'amountMl', parseInt(e.target.value) || 0)}
                  min="0"
                  required
                  placeholder="e.g., 250"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Swallowing Issues (optional)
              </label>
              <div className="flex gap-4">
                {['Coughing', 'Choking', 'Slow', 'None'].map((issue) => (
                  <label key={issue} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={`fluids.${index}.swallowingIssues.${issue.toLowerCase()}`}
                      checked={fluid.swallowingIssues.includes(issue.toLowerCase())}
                      onChange={(e) => {
                        const issues = e.target.checked
                          ? [...fluid.swallowingIssues, issue.toLowerCase()]
                          : fluid.swallowingIssues.filter((i) => i !== issue.toLowerCase());
                        updateFluidEntry(index, 'swallowingIssues', issues);
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{issue}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addFluidEntry}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Fluid Entry
        </button>

        {fluids.length > 0 && (
          <div
            data-testid="total-fluid-intake"
            className={`rounded-lg p-4 mb-4 ${
              isLowFluidIntake ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <p className="text-lg font-semibold text-gray-900">
              Total daily fluid intake: {totalFluidIntake} ml
            </p>
            {isLowFluidIntake && (
              <div data-testid="low-fluid-warning" className="mt-2">
                <p className="text-sm text-yellow-800">
                  ⚠️ Low fluid intake (<1000ml) - Dehydration risk
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Recommended: 1500-2000ml per day
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
```

#### Day 3: Dashboard Display

##### 3.1 E2E Tests (`tests/e2e/dashboard-fluid-intake.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Family Dashboard - Fluid Intake Display', () => {

  test.beforeEach(async ({ page }) => {
    // Login as family admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/family/dashboard');
  });

  test('should display total fluid intake in summary card', async ({ page }) => {
    await expect(page.locator('[data-testid="fluid-intake-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="fluid-intake-card"]')).toContainText('Total Fluid Intake');
    await expect(page.locator('[data-testid="fluid-intake-total"]')).toContainText('ml');
  });

  test('should show low fluid warning if intake <1000ml', async ({ page }) => {
    // Seed log with 500ml total
    const warning = page.locator('[data-testid="low-fluid-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/bg-yellow/); // Warning color
    await expect(warning).toContainText('Low fluid intake');
  });

  test('should show normal status if intake >=1000ml', async ({ page }) => {
    // Seed log with 1500ml total
    const status = page.locator('[data-testid="fluid-intake-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/bg-green/); // Success color
    await expect(status).toContainText('Adequate hydration');
  });

  test('should display fluid breakdown details', async ({ page }) => {
    await page.click('[data-testid="fluid-details-toggle"]');

    await expect(page.locator('[data-testid="fluid-entry-0"]')).toContainText('Glucerna Milk');
    await expect(page.locator('[data-testid="fluid-entry-0"]')).toContainText('250 ml');
    await expect(page.locator('[data-testid="fluid-entry-0"]')).toContainText('08:30');
  });

  test('should show swallowing issues alert if present', async ({ page }) => {
    const alert = page.locator('[data-testid="swallowing-issues-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/bg-red/); // Alert color
    await expect(alert).toContainText('Swallowing issues reported');
  });

  test('should display fluid intake trend in week view', async ({ page }) => {
    await page.click('text=Week View');

    // Chart should show daily fluid intake
    await expect(page.locator('[data-testid="fluid-intake-chart"]')).toBeVisible();

    // Should show 7 days of data
    const bars = page.locator('[data-testid^="fluid-bar-"]');
    await expect(bars).toHaveCount(7);
  });

  test('should highlight days with low fluid intake in chart', async ({ page }) => {
    await page.click('text=Week View');

    // Days with <1000ml should be highlighted
    const lowDays = page.locator('[data-testid^="fluid-bar-"][class*="bg-yellow"]');
    await expect(lowDays.first()).toBeVisible();
  });
});
```

##### 3.2 Dashboard Implementation (`apps/web/src/routes/family/dashboard.tsx`)

```typescript
function FamilyDashboard() {
  // ... existing code ...

  const getFluidIntakeStatus = (ml: number): 'low' | 'adequate' | 'good' => {
    if (ml < 1000) return 'low';
    if (ml < 1500) return 'adequate';
    return 'good';
  };

  const totalFluidIntake = todayLog?.totalFluidIntake || 0;
  const fluidStatus = getFluidIntakeStatus(totalFluidIntake);
  const hasSwallowingIssues = todayLog?.fluids?.some((f) => f.swallowingIssues.length > 0);

  return (
    <div>
      {/* Existing dashboard content... */}

      {/* Fluid Intake Summary Card */}
      <div data-testid="fluid-intake-card" className="bg-white rounded-lg shadow p-6 mb-4">
        <h3 className="text-lg font-semibold mb-4">💧 Fluid Intake</h3>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-3xl font-bold text-gray-900" data-testid="fluid-intake-total">
              {totalFluidIntake} ml
            </p>
            <p className="text-sm text-gray-600">Total today</p>
          </div>

          <div
            data-testid="fluid-intake-status"
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              fluidStatus === 'low'
                ? 'bg-yellow-100 text-yellow-800'
                : fluidStatus === 'adequate'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {fluidStatus === 'low' && '⚠️ Low'}
            {fluidStatus === 'adequate' && 'Adequate'}
            {fluidStatus === 'good' && '✅ Good'}
          </div>
        </div>

        {/* Low Fluid Warning */}
        {fluidStatus === 'low' && (
          <div
            data-testid="low-fluid-warning"
            className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4"
          >
            <p className="text-sm text-yellow-800 font-semibold">
              ⚠️ Low fluid intake (<1000ml)
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Recommended: 1500-2000ml per day to prevent dehydration
            </p>
          </div>
        )}

        {/* Swallowing Issues Alert */}
        {hasSwallowingIssues && (
          <div
            data-testid="swallowing-issues-alert"
            className="bg-red-50 border-l-4 border-red-400 p-3 mb-4"
          >
            <p className="text-sm text-red-800 font-semibold">
              🚨 Swallowing issues reported during fluid intake
            </p>
          </div>
        )}

        {/* Fluid Breakdown */}
        <button
          data-testid="fluid-details-toggle"
          onClick={() => setShowFluidDetails(!showFluidDetails)}
          className="text-blue-600 hover:underline text-sm"
        >
          {showFluidDetails ? 'Hide' : 'Show'} Fluid Breakdown
        </button>

        {showFluidDetails && (
          <div className="mt-4 space-y-2">
            {todayLog?.fluids?.map((fluid, index) => (
              <div
                key={index}
                data-testid={`fluid-entry-${index}`}
                className="bg-gray-50 p-3 rounded border border-gray-200"
              >
                <div className="flex justify-between items-center">
                  <p className="font-semibold">{fluid.name}</p>
                  <p className="text-gray-600">{fluid.amountMl} ml</p>
                </div>
                <p className="text-sm text-gray-600">Time: {fluid.time}</p>
                {fluid.swallowingIssues.length > 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    Issues: {fluid.swallowingIssues.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week View: Fluid Intake Chart */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h3 className="text-lg font-semibold mb-4">Weekly Fluid Intake Trend</h3>
          <div data-testid="fluid-intake-chart" className="h-64">
            {/* Bar chart showing daily fluid intake */}
            {weekLogs.map((log, index) => {
              const intake = log.totalFluidIntake || 0;
              const isLow = intake < 1000;
              const barHeight = (intake / 2000) * 100; // Max 2000ml

              return (
                <div
                  key={index}
                  data-testid={`fluid-bar-${index}`}
                  className={`inline-block w-1/7 mx-1 ${
                    isLow ? 'bg-yellow-400' : 'bg-blue-500'
                  }`}
                  style={{ height: `${barHeight}%` }}
                  title={`${format(log.logDate, 'EEE')}: ${intake}ml`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            {weekLogs.map((log) => (
              <span key={log.id}>{format(log.logDate, 'EEE')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 2: Enhanced Medication Tracking (Days 4-5)

#### Database Schema (No Changes Needed - Update JSON Structure)

Existing schema already supports medications as JSON. We'll enhance the TypeScript type:

```typescript
// packages/database/src/schema.ts
medications: text('medications', { mode: 'json' })
  .$type<Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: 'before_breakfast' | 'after_breakfast' | 'afternoon' | 'after_dinner' | 'before_bedtime';
    purpose?: string; // NEW: e.g., "Diabetes control", "Cholesterol"
    notes?: string;   // NEW: Per-medication notes
  }>>()
```

#### API Tests (Similar pattern to fluids)
- Validate purpose field
- Validate notes field
- Track missed medications summary
- Generate medication adherence percentage

#### UI Implementation
- Add purpose dropdown per medication
- Add notes textarea per medication
- Display medication adherence chart on dashboard
- Highlight missed medications

---

### Phase 3: Sleep Tracking (Days 6-7)

#### Database Migration (`0005_sleep_tracking.sql`)

```sql
-- Sleep Tracking
ALTER TABLE care_logs ADD COLUMN afternoon_rest TEXT; -- JSON object
ALTER TABLE care_logs ADD COLUMN night_sleep TEXT; -- JSON object

-- JSON Structures:
-- afternoon_rest: {
--   startTime: "14:00",
--   endTime: "15:30",
--   quality: "deep" | "light" | "restless" | "no_sleep",
--   notes: ""
-- }
-- night_sleep: {
--   bedtime: "21:00",
--   quality: "deep" | "light" | "restless" | "no_sleep",
--   wakings: 2,
--   wakingReasons: ["toilet", "pain"],
--   behaviors: ["snoring", "restless"],
--   notes: ""
-- }
```

#### API Tests
- Validate afternoon rest times
- Validate night sleep quality
- Validate wakings count (>=0)
- Accept empty sleep data

#### UI Implementation
- Afternoon rest: start/end time, quality selector
- Night sleep: bedtime, quality, wakings count, reasons checkboxes, behaviors checkboxes
- Dashboard: Sleep quality chart, wakings trend

---

### Phase 4: Mobility & Exercise (Days 8-10)

#### Database Schema (Enhance Existing JSON)

```typescript
// packages/database/src/schema.ts
mobility: text('mobility', { mode: 'json' })
  .$type<{
    steps?: number;
    distance?: number;
    walkingAssistance?: 'independent' | 'one_person' | 'two_people' | 'walker' | 'wheelchair';
    movementDifficulties?: {
      bedInOut: boolean;
      chairSitStand: boolean;
      carInOut: boolean;
    };
    exercises?: Array<{
      type: 'eye' | 'arm_shoulder' | 'leg' | 'balance' | 'stretching' | 'arm_pedalling' | 'leg_pedalling' | 'physio';
      session: 'morning' | 'afternoon';
      duration: number; // minutes
      participation: number; // 1-5 scale
    }>;
  }>()
```

#### API Tests
- Validate steps/distance
- Validate participation scale (1-5)
- Track exercise completion rate

#### UI Implementation
- Steps/distance input
- Walking assistance selector
- Movement difficulties checkboxes
- Exercise sessions (morning/afternoon) with type, duration, participation
- Dashboard: Exercise adherence chart, mobility trends

---

## 📝 Implementation Checklist

### Week 1: Fluids & Medications (Days 1-5)

- [ ] Day 1: Fluid intake API tests (7 tests) + validation schema
- [ ] Day 2: Fluid intake caregiver form UI (8 E2E tests)
- [ ] Day 3: Fluid intake dashboard display (7 E2E tests)
- [ ] Day 4: Enhanced medication API tests (6 tests) + schema update
- [ ] Day 5: Medication UI enhancements + dashboard

### Week 2: Sleep & Mobility (Days 6-10)

- [ ] Day 6: Sleep tracking database migration + API tests (8 tests)
- [ ] Day 7: Sleep tracking UI + dashboard (6 E2E tests)
- [ ] Day 8: Mobility & exercise API tests (7 tests)
- [ ] Day 9: Mobility & exercise UI (9 E2E tests)
- [ ] Day 10: Dashboard charts for all Sprint 2 metrics + final testing

---

## 🎯 Success Criteria

1. ✅ **100% API Test Coverage**: All new fields have passing API tests
2. ✅ **100% E2E Test Coverage**: All new UI sections have E2E tests
3. ✅ **Mobile Responsive**: All forms work on mobile (iPhone/Android)
4. ✅ **Dashboard Charts**: Weekly trends for all Sprint 2 metrics
5. ✅ **Template Coverage**: Increase from 61% to 75% (14 new fields)
6. ✅ **Zero Regressions**: All Sprint 1 tests still passing

---

## 🔧 Development Workflow

### Daily TDD Cycle

1. **Morning (9am - 12pm)**: Write API tests first
   - Define test cases
   - Write failing tests
   - Run tests (should fail)

2. **Afternoon (1pm - 4pm)**: Implement API validation
   - Write Zod schemas
   - Implement business logic
   - Run tests until all pass

3. **Evening (7pm - 10pm)**: Write E2E tests & implement UI
   - Write E2E test cases
   - Implement UI components
   - Run E2E tests until all pass

### Testing Commands

```bash
# API Tests
cd apps/api
pnpm test                                    # All tests
pnpm test -- care-logs                       # Care logs only
pnpm test -- "Sprint 2"                      # Sprint 2 tests only

# E2E Tests
cd apps/web
pnpm exec playwright test                    # All E2E tests
pnpm exec playwright test fluid-intake.spec.ts  # Specific test
pnpm exec playwright test --ui               # Interactive mode

# Run all tests
pnpm test:all                                # API + E2E
```

---

## 📊 Sprint 2 Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Template Coverage | 75% (63/84) | 61% (51/84) | 🎯 Target |
| API Tests | 120+ tests | 89 tests | 📈 +31 tests |
| E2E Tests | 60+ tests | 14 tests | 📈 +46 tests |
| New Database Fields | 12 fields | 0 fields | 🆕 Add 12 |
| Dashboard Charts | 10 charts | 7 charts | 📈 +3 charts |

---

## 🚧 Known Challenges

1. **localStorage vs Database**: Need to consolidate data fetching (HIGH PRIORITY)
2. **JSON Field Parsing**: Ensure parseJsonFields() helper works for all new fields
3. **Mobile UX**: Fluid/exercise entry forms may be complex on small screens
4. **Chart Performance**: Week view with 10+ metrics may be slow

---

## 📚 Reference Files

**Schema**:
- `packages/database/src/schema.ts` (lines 181-189: fluids, lines 198-204: mobility)

**Existing Tests**:
- `apps/api/src/routes/care-logs.test.ts` (Sprint 1 patterns)
- `apps/web/tests/e2e/unaccompanied-time.spec.ts` (E2E patterns)

**Existing UI**:
- `apps/web/src/routes/caregiver/form.tsx` (form patterns)
- `apps/web/src/routes/family/dashboard.tsx` (dashboard patterns)

**Migrations**:
- `apps/api/migrations/0004_fall_risk_assessment.sql` (Sprint 1 migration pattern)

---

**Status**: ✅ **PLAN COMPLETE - READY TO START DAY 1**
**Next Step**: Write API tests for fluid intake tracking
**Review Date**: After Day 5 completion (medications done)
