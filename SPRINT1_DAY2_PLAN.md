# Sprint 1 Day 2: Unaccompanied Time Tracking - TDD Implementation Plan

**Date**: 2025-10-06
**Sprint**: Phase 2 - Safety & Clinical Enhancements
**Priority**: 🚨 **SAFETY CRITICAL** - "Mum should NEVER be left alone"

---

## 📋 Template Requirements Analysis

### From Daily Care Report Template (Page 8)

```
🕐 UNACCOMPANIED TIME TRACKING

⚠️IMPORTANT: Mum should NEVER be left alone

| Time Period | Reason Caregiver Left | Replacement Person | Duration | Notes |
|-------------|----------------------|-------------------|----------|-------|
| to          |                      |                   |          |       |
| to          |                      |                   |          |       |
| to          |                      |                   |          |       |

Total time left unaccompanied: minutes
Any incidents during unaccompanied time:
```

### Key Features Required

1. **Dynamic Time Period Entries**
   - Add/remove time periods dynamically
   - Each period has: start time, end time, reason, replacement person, notes

2. **Duration Auto-Calculation**
   - Calculate duration in minutes from start/end time
   - Calculate total unaccompanied time (sum of all periods)

3. **Incident Reporting**
   - Free text field for incidents
   - Should trigger warnings if filled

4. **Dashboard Warnings**
   - Display total unaccompanied time
   - Alert if any incidents reported
   - Warning level based on duration (e.g., >60 minutes = urgent)

---

## 🗄️ Database Schema

### Migration: `0005_unaccompanied_time_tracking.sql`

```sql
-- Already added in 0004_fall_risk_assessment.sql:
-- ALTER TABLE care_logs ADD COLUMN unaccompanied_time TEXT; -- JSON array

-- Data structure will be JSON array:
-- [
--   {
--     "startTime": "14:00",
--     "endTime": "14:30",
--     "reason": "Emergency leave",
--     "replacementPerson": "Sister",
--     "durationMinutes": 30,
--     "notes": ""
--   }
-- ]

-- Incidents stored separately as TEXT field
ALTER TABLE care_logs ADD COLUMN unaccompanied_incidents TEXT;
```

---

## 🧪 TDD Implementation Steps

### Phase 1: API Layer (Test-First)

#### 1.1 Write API Validation Tests

**File**: `apps/api/src/routes/care-logs.test.ts`

```typescript
describe('Care Logs API > Sprint 1 Day 2: Unaccompanied Time Tracking', () => {

  it('should accept valid unaccompanied time data', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '14:00',
          endTime: '14:30',
          reason: 'Emergency break',
          replacementPerson: 'Family member',
          durationMinutes: 30,
          notes: '',
        },
      ],
      unaccompaniedIncidents: '',
    };

    // Should pass validation
    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.unaccompaniedTime).toHaveLength(1);
    expect(data.unaccompaniedTime[0].durationMinutes).toBe(30);
  });

  it('should validate time period start < end', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '14:30',  // Invalid: start after end
          endTime: '14:00',
          reason: 'Break',
          replacementPerson: 'Sister',
          durationMinutes: -30,
          notes: '',
        },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(400);
    const error = await res.json();
    expect(error.message).toContain('start time must be before end time');
  });

  it('should validate duration is positive', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '14:00',
          endTime: '14:30',
          reason: 'Break',
          replacementPerson: 'Sister',
          durationMinutes: -10,  // Invalid
          notes: '',
        },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(400);
    const error = await res.json();
    expect(error.message).toContain('duration must be positive');
  });

  it('should require reason when time period added', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '14:00',
          endTime: '14:30',
          reason: '',  // Invalid: empty
          replacementPerson: 'Sister',
          durationMinutes: 30,
          notes: '',
        },
      ],
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(400);
    const error = await res.json();
    expect(error.message).toContain('reason is required');
  });

  it('should accept empty unaccompanied time array', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [],  // Valid: never left alone
      unaccompaniedIncidents: '',
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
  });

  it('should calculate total unaccompanied time', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '10:00',
          endTime: '10:30',
          reason: 'Break 1',
          replacementPerson: 'Sister',
          durationMinutes: 30,
          notes: '',
        },
        {
          startTime: '15:00',
          endTime: '15:45',
          reason: 'Break 2',
          replacementPerson: 'Nephew',
          durationMinutes: 45,
          notes: '',
        },
      ],
      unaccompaniedIncidents: '',
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.totalUnaccompaniedMinutes).toBe(75);  // 30 + 45
  });

  it('should accept incidents report', async () => {
    const careLogData = {
      ...basicCareLog,
      unaccompaniedTime: [
        {
          startTime: '14:00',
          endTime: '14:30',
          reason: 'Emergency leave',
          replacementPerson: 'Neighbor',
          durationMinutes: 30,
          notes: 'Called replacement immediately',
        },
      ],
      unaccompaniedIncidents: 'Care recipient tried to get up alone but replacement person assisted',
    };

    const res = await app.request('/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caregiverToken}` },
      body: JSON.stringify(careLogData),
    }, mockEnv);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.unaccompaniedIncidents).toBe(careLogData.unaccompaniedIncidents);
  });
});
```

#### 1.2 Implement API Validation Schema

**File**: `apps/api/src/routes/care-logs.ts`

```typescript
import { z } from 'zod';

// Unaccompanied Time Period Schema
const unaccompaniedTimePeriodSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  reason: z.string().min(1, 'Reason is required'),
  replacementPerson: z.string().optional(),
  durationMinutes: z.number().int().positive('Duration must be positive'),
  notes: z.string().optional(),
}).refine((data) => {
  // Validate start < end
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return startMinutes < endMinutes;
}, {
  message: 'Start time must be before end time',
});

// Update care log schema
const careLogCreateSchema = z.object({
  // ... existing fields ...

  // Unaccompanied Time Tracking
  unaccompaniedTime: z.array(unaccompaniedTimePeriodSchema).optional(),
  unaccompaniedIncidents: z.string().optional(),
});

// Helper function to calculate total unaccompanied time
function calculateTotalUnaccompaniedTime(periods: UnaccompaniedTimePeriod[]): number {
  return periods.reduce((total, period) => total + period.durationMinutes, 0);
}
```

---

### Phase 2: Frontend - Caregiver Form (Test-First)

#### 2.1 Write E2E Tests for Caregiver Form

**File**: `tests/e2e/caregiver-unaccompanied-time.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Caregiver Form - Unaccompanied Time Tracking', () => {

  test.beforeEach(async ({ page }) => {
    // Login as caregiver and navigate to form
    await page.goto('/caregiver/login');
    await page.fill('input[name="caregiverId"]', 'test-caregiver-id');
    await page.fill('input[name="pin"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/caregiver/form');
  });

  test('should display empty unaccompanied time section', async ({ page }) => {
    await expect(page.locator('h3:has-text("Unaccompanied Time Tracking")')).toBeVisible();
    await expect(page.locator('text=⚠️IMPORTANT: Should NEVER be left alone')).toBeVisible();
    await expect(page.locator('[data-testid="time-period-entry"]')).toHaveCount(0);
    await expect(page.locator('button:has-text("Add Time Period")')).toBeVisible();
  });

  test('should add new time period entry', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await expect(page.locator('[data-testid="time-period-entry"]')).toHaveCount(1);
    await expect(page.locator('input[name="unaccompaniedTime.0.startTime"]')).toBeVisible();
    await expect(page.locator('input[name="unaccompaniedTime.0.endTime"]')).toBeVisible();
    await expect(page.locator('input[name="unaccompaniedTime.0.reason"]')).toBeVisible();
    await expect(page.locator('input[name="unaccompaniedTime.0.replacementPerson"]')).toBeVisible();
  });

  test('should calculate duration automatically', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '14:00');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '14:30');
    await page.fill('input[name="unaccompaniedTime.0.reason"]', 'Emergency break');

    // Duration should auto-calculate
    await expect(page.locator('[data-testid="duration-display-0"]')).toHaveText('30 minutes');
  });

  test('should add multiple time periods', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');

    await expect(page.locator('[data-testid="time-period-entry"]')).toHaveCount(3);
  });

  test('should remove time period entry', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.click('button:has-text("Add Time Period")');

    await expect(page.locator('[data-testid="time-period-entry"]')).toHaveCount(2);

    await page.click('[data-testid="remove-period-0"]');

    await expect(page.locator('[data-testid="time-period-entry"]')).toHaveCount(1);
  });

  test('should calculate total unaccompanied time', async ({ page }) => {
    // Add first period
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '10:00');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '10:30');
    await page.fill('input[name="unaccompaniedTime.0.reason"]', 'Break 1');

    // Add second period
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="unaccompaniedTime.1.startTime"]', '15:00');
    await page.fill('input[name="unaccompaniedTime.1.endTime"]', '15:45');
    await page.fill('input[name="unaccompaniedTime.1.reason"]', 'Break 2');

    // Total should be displayed
    await expect(page.locator('[data-testid="total-unaccompanied-time"]')).toHaveText('Total time left unaccompanied: 75 minutes');
  });

  test('should validate start time before end time', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '14:30');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '14:00');
    await page.fill('input[name="unaccompaniedTime.0.reason"]', 'Break');

    await expect(page.locator('text=Start time must be before end time')).toBeVisible();
    await expect(page.locator('[data-testid="duration-display-0"]')).toHaveText('Invalid time range');
  });

  test('should require reason when time entered', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');

    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '14:00');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '14:30');
    // Leave reason empty

    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Reason is required')).toBeVisible();
  });

  test('should persist data on navigation', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '14:00');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '14:30');
    await page.fill('input[name="unaccompaniedTime.0.reason"]', 'Emergency');

    // Navigate to different section and back
    await page.click('text=Vital Signs');
    await page.click('text=Unaccompanied Time');

    // Data should persist
    await expect(page.locator('input[name="unaccompaniedTime.0.startTime"]')).toHaveValue('14:00');
    await expect(page.locator('input[name="unaccompaniedTime.0.endTime"]')).toHaveValue('14:30');
    await expect(page.locator('input[name="unaccompaniedTime.0.reason"]')).toHaveValue('Emergency');
  });

  test('should accept incidents report', async ({ page }) => {
    await page.click('button:has-text("Add Time Period")');
    await page.fill('input[name="unaccompaniedTime.0.startTime"]', '14:00');
    await page.fill('input[name="unaccompaniedTime.0.endTime"]', '14:30');
    await page.fill('input[name="unaccompaniedTime.0.reason"]', 'Emergency');

    await page.fill('textarea[name="unaccompaniedIncidents"]', 'Care recipient tried to stand but was assisted by replacement person');

    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Care log submitted successfully')).toBeVisible();
  });
});
```

#### 2.2 Implement Caregiver Form UI

**File**: `apps/web/src/routes/caregiver/form.tsx`

```typescript
// Add to existing form component

interface UnaccompaniedTimePeriod {
  startTime: string;
  endTime: string;
  reason: string;
  replacementPerson?: string;
  durationMinutes: number;
  notes?: string;
}

function CaregiverForm() {
  // Existing state...

  const [unaccompaniedTime, setUnaccompaniedTime] = useState<UnaccompaniedTimePeriod[]>([]);
  const [unaccompaniedIncidents, setUnaccompaniedIncidents] = useState('');

  // Calculate duration when times change
  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) return -1; // Invalid

    return endMinutes - startMinutes;
  };

  // Calculate total unaccompanied time
  const totalUnaccompaniedMinutes = unaccompaniedTime.reduce(
    (total, period) => total + (period.durationMinutes > 0 ? period.durationMinutes : 0),
    0
  );

  const addTimePeriod = () => {
    setUnaccompaniedTime([
      ...unaccompaniedTime,
      {
        startTime: '',
        endTime: '',
        reason: '',
        replacementPerson: '',
        durationMinutes: 0,
        notes: '',
      },
    ]);
  };

  const removeTimePeriod = (index: number) => {
    setUnaccompaniedTime(unaccompaniedTime.filter((_, i) => i !== index));
  };

  const updateTimePeriod = (index: number, field: keyof UnaccompaniedTimePeriod, value: string) => {
    const updated = [...unaccompaniedTime];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate duration when times change
    if (field === 'startTime' || field === 'endTime') {
      const duration = calculateDuration(updated[index].startTime, updated[index].endTime);
      updated[index].durationMinutes = duration;
    }

    setUnaccompaniedTime(updated);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Existing sections... */}

      {/* Unaccompanied Time Tracking Section */}
      <section className="mb-8">
        <h3 className="text-xl font-bold mb-4">🕐 Unaccompanied Time Tracking</h3>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-sm font-semibold text-yellow-800">
            ⚠️ IMPORTANT: Care recipient should NEVER be left alone
          </p>
        </div>

        {unaccompaniedTime.map((period, index) => (
          <div
            key={index}
            data-testid="time-period-entry"
            className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-gray-700">Period {index + 1}</h4>
              <button
                type="button"
                data-testid={`remove-period-${index}`}
                onClick={() => removeTimePeriod(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  name={`unaccompaniedTime.${index}.startTime`}
                  value={period.startTime}
                  onChange={(e) => updateTimePeriod(index, 'startTime', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  name={`unaccompaniedTime.${index}.endTime`}
                  value={period.endTime}
                  onChange={(e) => updateTimePeriod(index, 'endTime', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration
              </label>
              <p
                data-testid={`duration-display-${index}`}
                className={`text-lg font-semibold ${
                  period.durationMinutes < 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {period.durationMinutes < 0
                  ? 'Invalid time range'
                  : `${period.durationMinutes} minutes`}
              </p>
              {period.durationMinutes < 0 && (
                <p className="text-sm text-red-600 mt-1">
                  Start time must be before end time
                </p>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason Caregiver Left *
              </label>
              <input
                type="text"
                name={`unaccompaniedTime.${index}.reason`}
                value={period.reason}
                onChange={(e) => updateTimePeriod(index, 'reason', e.target.value)}
                required
                placeholder="e.g., Emergency break, Personal matter"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Replacement Person
              </label>
              <input
                type="text"
                name={`unaccompaniedTime.${index}.replacementPerson`}
                value={period.replacementPerson}
                onChange={(e) => updateTimePeriod(index, 'replacementPerson', e.target.value)}
                placeholder="e.g., Family member, Neighbor"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name={`unaccompaniedTime.${index}.notes`}
                value={period.notes}
                onChange={(e) => updateTimePeriod(index, 'notes', e.target.value)}
                rows={2}
                placeholder="Additional details..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addTimePeriod}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Time Period
        </button>

        {unaccompaniedTime.length > 0 && (
          <div
            data-testid="total-unaccompanied-time"
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4"
          >
            <p className="text-lg font-semibold text-gray-900">
              Total time left unaccompanied: {totalUnaccompaniedMinutes} minutes
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Any incidents during unaccompanied time:
          </label>
          <textarea
            name="unaccompaniedIncidents"
            value={unaccompaniedIncidents}
            onChange={(e) => setUnaccompaniedIncidents(e.target.value)}
            rows={3}
            placeholder="Describe any incidents that occurred..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </section>
    </div>
  );
}
```

---

### Phase 3: Dashboard Warnings (Test-First)

#### 3.1 Write E2E Tests for Dashboard

**File**: `tests/e2e/dashboard-unaccompanied-warnings.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Family Dashboard - Unaccompanied Time Warnings', () => {

  test.beforeEach(async ({ page }) => {
    // Login as family admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/family/dashboard');
  });

  test('should not show warning when no unaccompanied time', async ({ page }) => {
    await expect(page.locator('[data-testid="unaccompanied-warning"]')).not.toBeVisible();
  });

  test('should show info banner for short unaccompanied time (<30 min)', async ({ page }) => {
    // Seed care log with 20 minutes unaccompanied time

    const warning = page.locator('[data-testid="unaccompanied-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/bg-blue/); // Info color
    await expect(warning).toContainText('20 minutes unaccompanied time');
  });

  test('should show yellow warning for moderate time (30-60 min)', async ({ page }) => {
    // Seed care log with 45 minutes unaccompanied time

    const warning = page.locator('[data-testid="unaccompanied-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/bg-yellow/); // Warning color
    await expect(warning).toContainText('45 minutes unaccompanied time');
  });

  test('should show red alert for excessive time (>60 min)', async ({ page }) => {
    // Seed care log with 90 minutes unaccompanied time

    const warning = page.locator('[data-testid="unaccompanied-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/bg-red/); // Alert color
    await expect(warning).toContainText('90 minutes unaccompanied time');
    await expect(warning).toContainText('⚠️ Exceeds recommended maximum');
  });

  test('should show incident alert when incidents reported', async ({ page }) => {
    // Seed care log with incidents

    const incidentAlert = page.locator('[data-testid="incident-alert"]');
    await expect(incidentAlert).toBeVisible();
    await expect(incidentAlert).toHaveClass(/bg-red/); // Alert color
    await expect(incidentAlert).toContainText('Incident reported during unaccompanied time');
  });

  test('should display time period details', async ({ page }) => {
    // Seed care log with 2 time periods

    await page.click('[data-testid="unaccompanied-details-toggle"]');

    await expect(page.locator('[data-testid="time-period-0"]')).toContainText('10:00 - 10:30 (30 min)');
    await expect(page.locator('[data-testid="time-period-0"]')).toContainText('Emergency break');
    await expect(page.locator('[data-testid="time-period-0"]')).toContainText('Replacement: Sister');

    await expect(page.locator('[data-testid="time-period-1"]')).toContainText('15:00 - 15:45 (45 min)');
  });

  test('should show trend across week view', async ({ page }) => {
    await page.click('text=Week View');

    // Should show unaccompanied time for each day
    await expect(page.locator('[data-testid="unaccompanied-day-0"]')).toContainText('30 min');
    await expect(page.locator('[data-testid="unaccompanied-day-1"]')).toContainText('0 min');
    await expect(page.locator('[data-testid="unaccompanied-day-2"]')).toContainText('45 min');
  });
});
```

#### 3.2 Implement Dashboard Warnings

**File**: `apps/web/src/routes/family/dashboard.tsx`

```typescript
function FamilyDashboard() {
  // Existing code...

  const getUnaccompaniedWarningLevel = (minutes: number): 'info' | 'warning' | 'danger' => {
    if (minutes === 0) return 'info';
    if (minutes <= 30) return 'info';
    if (minutes <= 60) return 'warning';
    return 'danger';
  };

  const totalUnaccompaniedMinutes = todayLog?.unaccompaniedTime?.reduce(
    (sum, period) => sum + period.durationMinutes,
    0
  ) || 0;

  const warningLevel = getUnaccompaniedWarningLevel(totalUnaccompaniedMinutes);
  const hasIncidents = todayLog?.unaccompaniedIncidents && todayLog.unaccompaniedIncidents.length > 0;

  return (
    <div>
      {/* Existing dashboard content... */}

      {/* Unaccompanied Time Warning */}
      {totalUnaccompaniedMinutes > 0 && (
        <div
          data-testid="unaccompanied-warning"
          className={`mb-4 p-4 rounded-lg border-l-4 ${
            warningLevel === 'danger'
              ? 'bg-red-50 border-red-400'
              : warningLevel === 'warning'
              ? 'bg-yellow-50 border-yellow-400'
              : 'bg-blue-50 border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">
                ⏱️ Unaccompanied Time: {totalUnaccompaniedMinutes} minutes
              </h4>
              {warningLevel === 'danger' && (
                <p className="text-sm text-red-800 mt-1">
                  ⚠️ Exceeds recommended maximum (60 minutes)
                </p>
              )}
            </div>
            <button
              data-testid="unaccompanied-details-toggle"
              onClick={() => setShowUnaccompaniedDetails(!showUnaccompaniedDetails)}
              className="text-blue-600 hover:underline text-sm"
            >
              {showUnaccompaniedDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {showUnaccompaniedDetails && (
            <div className="mt-4 space-y-2">
              {todayLog?.unaccompaniedTime?.map((period, index) => (
                <div
                  key={index}
                  data-testid={`time-period-${index}`}
                  className="bg-white p-3 rounded border border-gray-200"
                >
                  <p className="font-semibold">
                    {period.startTime} - {period.endTime} ({period.durationMinutes} min)
                  </p>
                  <p className="text-sm text-gray-600">Reason: {period.reason}</p>
                  {period.replacementPerson && (
                    <p className="text-sm text-gray-600">
                      Replacement: {period.replacementPerson}
                    </p>
                  )}
                  {period.notes && (
                    <p className="text-sm text-gray-600 italic">Notes: {period.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incident Alert */}
      {hasIncidents && (
        <div
          data-testid="incident-alert"
          className="mb-4 p-4 rounded-lg border-l-4 bg-red-50 border-red-400"
        >
          <h4 className="font-semibold text-red-900">
            🚨 Incident reported during unaccompanied time
          </h4>
          <p className="text-sm text-red-800 mt-2">{todayLog.unaccompaniedIncidents}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 📝 Implementation Checklist

### Day 2 Tasks (Estimated: 6-8 hours)

- [ ] **Database Migration** (30 min)
  - [ ] Create `0005_unaccompanied_time_tracking.sql`
  - [ ] Apply migration to dev database
  - [ ] Verify schema changes

- [ ] **API Layer** (2 hours)
  - [ ] Write 7 API validation tests
  - [ ] Implement Zod validation schema
  - [ ] Add duration calculation helper
  - [ ] Update care log endpoints
  - [ ] Run tests - all should pass ✅

- [ ] **Caregiver Form UI** (2.5 hours)
  - [ ] Write 9 E2E tests for time tracking form
  - [ ] Implement dynamic add/remove time periods
  - [ ] Implement auto-duration calculation
  - [ ] Implement total time calculation
  - [ ] Add validation messages
  - [ ] Run tests - all should pass ✅

- [ ] **Dashboard Warnings** (2 hours)
  - [ ] Write 7 E2E tests for dashboard warnings
  - [ ] Implement warning level logic
  - [ ] Implement warning banners
  - [ ] Implement time period details display
  - [ ] Implement incident alerts
  - [ ] Run tests - all should pass ✅

- [ ] **Integration Testing** (1 hour)
  - [ ] Test full flow: Form → Submit → Dashboard
  - [ ] Test edge cases (0 minutes, >120 minutes, invalid times)
  - [ ] Test mobile responsiveness

---

## 🎯 Success Criteria

1. ✅ All API tests passing (7/7)
2. ✅ All E2E form tests passing (9/9)
3. ✅ All E2E dashboard tests passing (7/7)
4. ✅ Duration auto-calculates correctly
5. ✅ Total time sums correctly for multiple periods
6. ✅ Dashboard shows appropriate warning levels
7. ✅ Incident alerts display prominently
8. ✅ Mobile-responsive on iPhone/Android

---

## 📊 Definition of Done

- [ ] Database migration applied to dev and test environments
- [ ] All unit tests passing (API validation)
- [ ] All E2E tests passing (form + dashboard)
- [ ] Code reviewed and approved
- [ ] Documentation updated (IMPLEMENTATION_STATUS.md)
- [ ] Deployed to dev environment
- [ ] Tested on mobile devices
- [ ] Sprint 1 Day 2 marked complete in project tracker

---

**Next**: Sprint 1 Day 3 - Safety Checks & Emergency Preparedness
