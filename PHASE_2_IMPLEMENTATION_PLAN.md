# Phase 2 Implementation Plan: Safety & Clinical Enhancements

**Timeline**: October 7-21, 2025 (2 weeks / 10 working days)
**Goal**: Increase template coverage from 30% → 60% (25 → 50 fields)
**Focus**: Critical safety features and enhanced clinical tracking

---

## 📋 Sprint Overview

| Sprint | Days | Focus | Fields Added | Coverage Gain |
|---|---|---|---|---|
| **Sprint 1** | Day 1-3 | Fall Risk + Safety | 10 fields | +12% |
| **Sprint 2** | Day 4-6 | Fluids + Medications | 8 fields | +10% |
| **Sprint 3** | Day 7-9 | Sleep + Environment | 7 fields | +8% |
| **Day 10** | Testing & Polish | - | - | - |

**Total**: 25 new fields → **50/84 total (60% coverage)**

---

## 🚨 Sprint 1: Fall Risk & Safety (Days 1-3)

### **Priority Justification**
- Falls are the #1 cause of injury in elderly care
- Template emphasizes "MAJOR FALLS - REPORT IMMEDIATELY"
- Safety tracking prevents unaccompanied incidents

---

### **Feature 1.1: Fall Risk Assessment** (Day 1)

#### Database Schema Changes
```sql
-- Migration: 0004_fall_risk_assessment.sql
ALTER TABLE care_logs ADD COLUMN balance_issues INTEGER CHECK(balance_issues BETWEEN 1 AND 5);
ALTER TABLE care_logs ADD COLUMN near_falls TEXT CHECK(near_falls IN ('none', 'once_or_twice', 'multiple'));
ALTER TABLE care_logs ADD COLUMN actual_falls TEXT CHECK(actual_falls IN ('none', 'minor', 'major'));
ALTER TABLE care_logs ADD COLUMN walking_pattern TEXT; -- JSON array: ['shuffling', 'uneven', 'slow', etc.]
ALTER TABLE care_logs ADD COLUMN freezing_episodes TEXT CHECK(freezing_episodes IN ('none', 'mild', 'severe'));
```

#### Backend API Updates
**File**: `apps/api/src/routes/care-logs.ts`

1. **Update validation schema** (Lines 26-70):
```typescript
const createCareLogSchema = z.object({
  // ... existing fields

  // Fall Risk Assessment
  balanceIssues: z.number().min(1).max(5).optional(),
  nearFalls: z.enum(['none', 'once_or_twice', 'multiple']).optional(),
  actualFalls: z.enum(['none', 'minor', 'major']).optional(),
  walkingPattern: z.array(z.string()).optional(), // ['shuffling', 'uneven', 'slow', 'stumbling', 'cannot_lift_feet']
  freezingEpisodes: z.enum(['none', 'mild', 'severe']).optional(),
});
```

2. **Update insert/update logic** (Lines 92-116, 166-190):
```typescript
// Add to values object
balanceIssues: data.balanceIssues,
nearFalls: data.nearFalls,
actualFalls: data.actualFalls,
walkingPattern: data.walkingPattern as any,
freezingEpisodes: data.freezingEpisodes,
```

3. **Add fall alert logic**:
```typescript
// After insert/update
if (data.actualFalls === 'major') {
  await db.insert(alerts).values({
    careRecipientId: data.careRecipientId,
    severity: 'critical',
    type: 'fall_incident',
    message: `MAJOR FALL REPORTED - Immediate attention required`,
    metadata: { careLogId: newLog.id },
  });
}
```

#### Frontend: Caregiver Form
**File**: `apps/web/src/routes/caregiver/form.tsx`

**Add new section after Vital Signs** (~line 400):

```tsx
{/* Fall Risk & Movement Assessment */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-orange-500" />
      Fall Risk & Movement Assessment
    </h2>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Balance Issues Scale */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Balance Issues (1-5)
      </label>
      <div className="bg-gray-50 p-3 rounded-lg mb-2 text-xs">
        <p><strong>1</strong> = No balance problems</p>
        <p><strong>2</strong> = Slight unsteadiness occasionally</p>
        <p><strong>3</strong> = Moderate balance problems, careful walking</p>
        <p><strong>4</strong> = Severe balance problems, needs constant support</p>
        <p><strong>5</strong> = Cannot maintain balance, wheelchair/bed bound</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setBalanceIssues(value)}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              balanceIssues === value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>

    {/* Near Falls */}
    <div>
      <label className="block text-sm font-medium mb-2">Near Falls</label>
      <Select
        value={nearFalls}
        onValueChange={setNearFalls}
      >
        <option value="none">None</option>
        <option value="once_or_twice">1-2 times</option>
        <option value="multiple">Multiple times</option>
      </Select>
    </div>

    {/* Actual Falls */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Actual Falls 🚨
      </label>
      <Select
        value={actualFalls}
        onValueChange={setActualFalls}
        className={actualFalls === 'major' ? 'border-2 border-red-500' : ''}
      >
        <option value="none">None</option>
        <option value="minor">Minor</option>
        <option value="major">⚠️ MAJOR - REPORT IMMEDIATELY</option>
      </Select>
      {actualFalls === 'major' && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-semibold">
            ⚠️ MAJOR FALL ALERT: Family will be notified immediately
          </p>
        </div>
      )}
    </div>

    {/* Walking Pattern */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Walking Pattern (How she walks)
      </label>
      <div className="space-y-2">
        {['normal', 'shuffling', 'uneven', 'very_slow', 'stumbling', 'cannot_lift_feet'].map((pattern) => (
          <label key={pattern} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={walkingPattern.includes(pattern)}
              onChange={(e) => {
                if (e.target.checked) {
                  setWalkingPattern([...walkingPattern, pattern]);
                } else {
                  setWalkingPattern(walkingPattern.filter(p => p !== pattern));
                }
              }}
              className="rounded"
            />
            <span className="text-sm capitalize">
              {pattern.replace('_', ' ')}
            </span>
          </label>
        ))}
      </div>
    </div>

    {/* Freezing Episodes */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Freezing Episodes
      </label>
      <p className="text-xs text-gray-600 mb-2">
        (Suddenly stopping and being unable to move forward, like feet stuck to ground)
      </p>
      <Select
        value={freezingEpisodes}
        onValueChange={setFreezingEpisodes}
      >
        <option value="none">None</option>
        <option value="mild">Mild</option>
        <option value="severe">Severe</option>
      </Select>
    </div>
  </CardContent>
</Card>
```

#### Frontend: Dashboard Alerts
**File**: `apps/web/src/routes/family/dashboard.tsx`

**Add fall risk indicator** (After vital signs, ~line 250):

```tsx
{/* Fall Risk Alert */}
{todayLog?.actualFalls === 'major' && (
  <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-bold text-red-800">MAJOR FALL REPORTED</h3>
        <p className="text-sm text-red-700 mt-1">
          {todayLog.walkingPattern?.length > 0 && (
            <>Walking pattern: {todayLog.walkingPattern.join(', ')}</>
          )}
        </p>
        <p className="text-xs text-red-600 mt-2">
          Reported: {format(new Date(todayLog.createdAt), 'h:mm a')}
        </p>
      </div>
    </div>
  </div>
)}

{/* Balance Issues Warning */}
{todayLog?.balanceIssues >= 4 && (
  <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
    <p className="text-sm text-orange-800">
      ⚠️ Severe balance problems reported (Level {todayLog.balanceIssues}/5)
    </p>
  </div>
)}
```

**Time Estimate**: 6 hours
- Database migration: 30 min
- API updates: 1.5 hours
- Caregiver form UI: 3 hours
- Dashboard alerts: 1 hour

**Fields Added**: 5 (balance_issues, near_falls, actual_falls, walking_pattern, freezing_episodes)

---

### **Feature 1.2: Unaccompanied Time Tracking** (Day 2)

#### Database Schema
```sql
-- Migration: 0004_fall_risk_assessment.sql (continued)
ALTER TABLE care_logs ADD COLUMN unaccompanied_time TEXT; -- JSON array
```

#### JSON Structure
```typescript
interface UnaccompaniedTime {
  startTime: string;
  endTime: string;
  reason: string;
  replacementPerson: string;
  duration: number; // minutes
  incidents: string;
}
```

#### Backend API
**File**: `apps/api/src/routes/care-logs.ts`

```typescript
const unaccompaniedTimeSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string(),
  replacementPerson: z.string(),
  duration: z.number(),
  incidents: z.string().optional(),
});

const createCareLogSchema = z.object({
  // ... existing
  unaccompaniedTime: z.array(unaccompaniedTimeSchema).optional(),
});
```

#### Frontend: Caregiver Form
```tsx
{/* Unaccompanied Time Tracking */}
<Card className="border-2 border-yellow-400">
  <CardHeader className="bg-yellow-50">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Clock className="h-5 w-5 text-yellow-600" />
      ⚠️ Unaccompanied Time Tracking
    </h2>
    <p className="text-sm text-yellow-800 mt-1">
      <strong>IMPORTANT: Mum should NEVER be left alone</strong>
    </p>
  </CardHeader>
  <CardContent className="space-y-3">
    {unaccompaniedTime.map((session, index) => (
      <div key={index} className="border rounded-lg p-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            type="time"
            value={session.startTime}
            onChange={(e) => updateUnaccompanied(index, 'startTime', e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={session.endTime}
            onChange={(e) => updateUnaccompanied(index, 'endTime', e.target.value)}
          />
          <Input
            label="Reason Caregiver Left"
            value={session.reason}
            onChange={(e) => updateUnaccompanied(index, 'reason', e.target.value)}
          />
          <Input
            label="Replacement Person"
            value={session.replacementPerson}
            onChange={(e) => updateUnaccompanied(index, 'replacementPerson', e.target.value)}
          />
        </div>
        <Input
          label="Any Incidents During This Time?"
          value={session.incidents}
          onChange={(e) => updateUnaccompanied(index, 'incidents', e.target.value)}
          className="mt-3"
        />
        <button
          type="button"
          onClick={() => removeUnaccompanied(index)}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
    ))}

    <Button
      type="button"
      variant="secondary"
      onClick={addUnaccompanied}
      className="w-full"
    >
      + Add Unaccompanied Period
    </Button>

    {/* Total Duration Warning */}
    {totalUnaccompaniedMinutes > 0 && (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
        <p className="text-sm font-semibold text-yellow-800">
          Total time left unaccompanied: {totalUnaccompaniedMinutes} minutes
        </p>
      </div>
    )}
  </CardContent>
</Card>
```

**Time Estimate**: 4 hours
- Database migration: 30 min
- API updates: 1 hour
- Caregiver form UI: 2 hours
- Dashboard display: 30 min

**Fields Added**: 1 (unaccompanied_time with 6 sub-fields)

---

### **Feature 1.3: Safety Checks & Emergency Prep** (Day 3)

#### Database Schema
```sql
-- Migration: 0004_fall_risk_assessment.sql (continued)
ALTER TABLE care_logs ADD COLUMN safety_checks TEXT; -- JSON object
ALTER TABLE care_logs ADD COLUMN emergency_prep TEXT; -- JSON object
```

#### JSON Structures
```typescript
interface SafetyChecks {
  tripHazards: { checked: boolean; action: string };
  cables: { checked: boolean; action: string };
  sandals: { checked: boolean; action: string };
  slipHazards: { checked: boolean; action: string };
  mobilityAids: { checked: boolean; action: string };
  emergencyEquipment: { checked: boolean; action: string };
}

interface EmergencyPrep {
  icePack: boolean;
  wheelchair: boolean;
  commode: boolean;
  walkingStick: boolean;
  walker: boolean;
  bruiseOintment: boolean;
  antiseptic: boolean;
}
```

#### Frontend: Caregiver Form
```tsx
{/* Safety Checks */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Shield className="h-5 w-5 text-blue-500" />
      Daily Safety Checks
    </h2>
    <p className="text-sm text-gray-600 mt-1">
      Check daily and remove hazards
    </p>
  </CardHeader>
  <CardContent className="space-y-3">
    {Object.entries(safetyChecks).map(([key, value]) => (
      <div key={key} className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={value.checked}
          onChange={(e) => updateSafetyCheck(key, 'checked', e.target.checked)}
          className="mt-1"
        />
        <div className="flex-1">
          <label className="font-medium text-sm capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </label>
          <Select
            value={value.action}
            onValueChange={(action) => updateSafetyCheck(key, 'action', action)}
            className="mt-1 text-sm"
          >
            <option value="">Select action</option>
            <option value="none_found">None found</option>
            <option value="removed">Removed</option>
            <option value="secured">Secured</option>
            <option value="cleaned">Cleaned</option>
            <option value="ready">Ready</option>
          </Select>
        </div>
      </div>
    ))}
  </CardContent>
</Card>

{/* Emergency Preparedness */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Ambulance className="h-5 w-5 text-red-500" />
      Emergency Preparedness Checklist
    </h2>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(emergencyPrep).map(([key, ready]) => (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ready}
            onChange={(e) => updateEmergencyPrep(key, e.target.checked)}
            className="rounded"
          />
          <span className="text-sm capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        </label>
      ))}
    </div>
  </CardContent>
</Card>
```

**Time Estimate**: 4 hours
- Database migration: 30 min
- API updates: 1 hour
- Caregiver form UI: 2 hours
- Dashboard summary: 30 min

**Fields Added**: 2 (safety_checks with 6 items, emergency_prep with 7 items)

---

### **Sprint 1 Summary**

**Total Time**: 3 days (14 hours)
**Fields Added**: 8 core fields (fall risk 5, unaccompanied 1, safety 2)
**Coverage Increase**: +12% (30% → 42%)

**Deliverables**:
- ✅ Fall risk assessment with real-time alerts
- ✅ Unaccompanied time tracking (safety critical)
- ✅ Daily safety checklist
- ✅ Emergency preparedness monitoring
- ✅ Dashboard fall alerts

---

## 💧 Sprint 2: Fluids & Medications (Days 4-6)

### **Feature 2.1: Fluid Intake Monitoring** (Days 4-5)

#### Database Schema
```sql
-- Migration: 0005_fluids_and_meds.sql
ALTER TABLE care_logs ADD COLUMN beverages TEXT; -- JSON array
ALTER TABLE care_logs ADD COLUMN total_fluid_intake INTEGER; -- ml
```

#### JSON Structure
```typescript
interface Beverage {
  name: string; // "Glucerna Milk (Morning)", "Moringa Water", etc.
  time: string;
  amount: number; // ml
  mugAmount: 'full' | 'half' | 'quarter'; // Alternative to ml
  swallowingIssues: string[]; // ['coughing', 'choking']
}

const PRESET_BEVERAGES = [
  'Glucerna Milk (Morning)',
  'Moringa Water',
  'Fenugreek Water',
  'Orange Juice',
  'Cucumber Juice',
  'Glucerna Milk (Evening)',
  'Plain Water',
];
```

#### Backend API
```typescript
const beverageSchema = z.object({
  name: z.string(),
  time: z.string(),
  amount: z.number().optional(),
  mugAmount: z.enum(['full', 'half', 'quarter']).optional(),
  swallowingIssues: z.array(z.string()).optional(),
});

const createCareLogSchema = z.object({
  // ... existing
  beverages: z.array(beverageSchema).optional(),
  totalFluidIntake: z.number().optional(), // Auto-calculated
});

// Add calculation helper
function calculateTotalFluid(beverages: Beverage[]): number {
  const MUG_SIZE_ML = 250; // Assume standard mug
  return beverages.reduce((total, bev) => {
    if (bev.amount) return total + bev.amount;
    if (bev.mugAmount === 'full') return total + MUG_SIZE_ML;
    if (bev.mugAmount === 'half') return total + MUG_SIZE_ML / 2;
    if (bev.mugAmount === 'quarter') return total + MUG_SIZE_ML / 4;
    return total;
  }, 0);
}

// Before insert/update
if (data.beverages) {
  data.totalFluidIntake = calculateTotalFluid(data.beverages);
}
```

#### Frontend: Caregiver Form
```tsx
{/* Beverages & Fluid Intake */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Droplet className="h-5 w-5 text-blue-500" />
      Beverages & Fluid Intake
    </h2>
  </CardHeader>
  <CardContent className="space-y-4">
    {beverages.map((bev, index) => (
      <div key={index} className="border rounded-lg p-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Drink Type"
            value={bev.name}
            onValueChange={(value) => updateBeverage(index, 'name', value)}
          >
            {PRESET_BEVERAGES.map(drink => (
              <option key={drink} value={drink}>{drink}</option>
            ))}
            <option value="other">Other (specify)</option>
          </Select>

          <Input
            label="Time"
            type="time"
            value={bev.time}
            onChange={(e) => updateBeverage(index, 'time', e.target.value)}
          />

          {/* Amount Options */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="ml"
                value={bev.amount || ''}
                onChange={(e) => updateBeverage(index, 'amount', Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-gray-500 self-center">OR</span>
              <Select
                value={bev.mugAmount || ''}
                onValueChange={(value) => updateBeverage(index, 'mugAmount', value)}
                className="flex-1"
              >
                <option value="">Select</option>
                <option value="full">Full</option>
                <option value="half">Half</option>
                <option value="quarter">Quarter</option>
              </Select>
            </div>
          </div>

          {/* Swallowing Issues */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Swallowing Issues
            </label>
            <div className="space-y-1">
              {['none', 'coughing', 'choking'].map((issue) => (
                <label key={issue} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bev.swallowingIssues?.includes(issue) || false}
                    onChange={(e) => {
                      const issues = bev.swallowingIssues || [];
                      if (e.target.checked) {
                        updateBeverage(index, 'swallowingIssues', [...issues, issue]);
                      } else {
                        updateBeverage(index, 'swallowingIssues', issues.filter(i => i !== issue));
                      }
                    }}
                  />
                  <span className="capitalize">{issue}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeBeverage(index)}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
    ))}

    <Button
      type="button"
      variant="secondary"
      onClick={addBeverage}
      className="w-full"
    >
      + Add Beverage
    </Button>

    {/* Total Fluid Intake Display */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="font-semibold text-blue-900">
        TOTAL FLUID INTAKE: {totalFluidIntake} ml
      </p>
      {totalFluidIntake < 1500 && (
        <p className="text-sm text-orange-600 mt-1">
          ⚠️ Low fluid intake (Target: 1500-2000ml/day)
        </p>
      )}
    </div>
  </CardContent>
</Card>
```

#### Frontend: Dashboard Fluid Tracking
```tsx
{/* Fluid Intake Card */}
<Card>
  <CardHeader>
    <h3 className="font-semibold flex items-center gap-2">
      <Droplet className="h-5 w-5 text-blue-500" />
      Fluid Intake Today
    </h3>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-blue-600">
      {todayLog?.totalFluidIntake || 0} ml
    </div>
    <div className="mt-2 bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${Math.min((todayLog?.totalFluidIntake / 2000) * 100, 100)}%` }}
      />
    </div>
    <p className="text-sm text-gray-600 mt-1">
      Target: 1500-2000ml/day
    </p>

    {/* Beverage Breakdown */}
    {todayLog?.beverages?.length > 0 && (
      <div className="mt-3 space-y-1">
        {todayLog.beverages.map((bev, i) => (
          <div key={i} className="text-sm flex justify-between">
            <span>{bev.name}</span>
            <span className="text-gray-600">
              {bev.amount ? `${bev.amount}ml` : bev.mugAmount}
            </span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

**Time Estimate**: 8 hours (2 days)
- Database migration: 30 min
- API updates + calculation: 2 hours
- Caregiver form UI: 4 hours
- Dashboard visualization: 1.5 hours

**Fields Added**: 2 (beverages array with 5 sub-fields, total_fluid_intake)

---

### **Feature 2.2: Enhanced Medications** (Day 6)

#### Database Schema
```sql
-- Migration: 0005_fluids_and_meds.sql (continued)
-- No schema change needed, just update JSON structure for medications field
```

#### Updated Medication JSON Structure
```typescript
interface Medication {
  name: string;
  purpose: string; // NEW: "Diabetes control", "Cholesterol control", etc.
  given: boolean;
  time: string | null;
  timeSlot: 'before_breakfast' | 'after_breakfast' | 'afternoon' | 'after_dinner' | 'before_bedtime';
  notes: string; // NEW: Per-medication notes
  weeklySchedule?: string; // NEW: e.g., "MWF Only" for Crestor
}

// Add to care log
interface CareLog {
  // ... existing
  missedMedications: string; // NEW: Summary of missed meds
  medicationIssues: string; // NEW: General medication problems
}
```

#### Backend API
```typescript
const medicationLogSchema = z.object({
  name: z.string(),
  purpose: z.string().optional(), // NEW
  given: z.boolean(),
  time: z.string().nullable(),
  timeSlot: z.enum(['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime']),
  notes: z.string().optional(), // NEW
  weeklySchedule: z.string().optional(), // NEW
});

const createCareLogSchema = z.object({
  // ... existing medications field (already array of medicationLogSchema)
  missedMedications: z.string().optional(), // NEW
  medicationIssues: z.string().optional(), // NEW
});
```

#### Frontend: Caregiver Form - Enhance Medications Section
```tsx
{/* Enhanced Medications */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Pill className="h-5 w-5 text-purple-500" />
      Medications & Supplements
    </h2>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Time Slot Sections */}
    {Object.entries(medicationsBySlot).map(([slot, meds]) => (
      <div key={slot} className="border-l-4 border-purple-300 pl-4">
        <h3 className="font-semibold capitalize mb-3">
          {slot.replace('_', ' ')}
        </h3>

        {meds.map((med, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Medication Name"
                value={med.name}
                onChange={(e) => updateMed(slot, index, 'name', e.target.value)}
              />

              {/* NEW: Purpose */}
              <Input
                label="Purpose (Why taking it?)"
                value={med.purpose}
                onChange={(e) => updateMed(slot, index, 'purpose', e.target.value)}
                placeholder="e.g., Diabetes control"
              />

              {/* Given checkbox + Time */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={med.given}
                    onChange={(e) => updateMed(slot, index, 'given', e.target.checked)}
                  />
                  <span className="text-sm font-medium">Given</span>
                </label>
                {med.given && (
                  <Input
                    type="time"
                    value={med.time || ''}
                    onChange={(e) => updateMed(slot, index, 'time', e.target.value)}
                    className="flex-1"
                  />
                )}
              </div>

              {/* NEW: Weekly Schedule */}
              <Input
                label="Schedule (if not daily)"
                value={med.weeklySchedule}
                onChange={(e) => updateMed(slot, index, 'weeklySchedule', e.target.value)}
                placeholder="e.g., MWF Only"
              />
            </div>

            {/* NEW: Notes */}
            <Input
              label="Notes"
              value={med.notes}
              onChange={(e) => updateMed(slot, index, 'notes', e.target.value)}
              placeholder="Any issues or observations"
              className="mt-3"
            />

            <button
              type="button"
              onClick={() => removeMed(slot, index)}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          onClick={() => addMed(slot)}
          className="text-sm"
        >
          + Add {slot.replace('_', ' ')} medication
        </Button>
      </div>
    ))}

    {/* NEW: Missed Medications Summary */}
    <div className="border-t pt-4">
      <Input
        label="Missed Medications (if any)"
        value={missedMedications}
        onChange={(e) => setMissedMedications(e.target.value)}
        placeholder="List any medications that were not given"
      />
    </div>

    {/* NEW: Medication Issues */}
    <Input
      label="Medication Issues"
      value={medicationIssues}
      onChange={(e) => setMedicationIssues(e.target.value)}
      placeholder="Any problems with medications today?"
    />
  </CardContent>
</Card>
```

#### Frontend: Dashboard Medication Tracking
```tsx
{/* Medication Adherence - Enhanced */}
<Card>
  <CardHeader>
    <h3 className="font-semibold flex items-center gap-2">
      <Pill className="h-5 w-5 text-purple-500" />
      Medication Adherence
    </h3>
  </CardHeader>
  <CardContent>
    {todayLog?.medications && todayLog.medications.length > 0 ? (
      <div className="space-y-2">
        {todayLog.medications.map((med: any, i: number) => (
          <div key={i} className="flex items-start justify-between py-2 border-b last:border-0">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {med.given ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{med.name}</p>
                  {/* NEW: Purpose display */}
                  {med.purpose && (
                    <p className="text-xs text-gray-600 italic">{med.purpose}</p>
                  )}
                  {/* NEW: Weekly schedule */}
                  {med.weeklySchedule && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {med.weeklySchedule}
                    </span>
                  )}
                </div>
              </div>
              {/* NEW: Notes display */}
              {med.notes && (
                <p className="text-xs text-gray-600 mt-1 pl-6">Note: {med.notes}</p>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {med.timeSlot.replace('_', ' ')}
              {med.time && ` at ${med.time}`}
            </span>
          </div>
        ))}

        {/* NEW: Missed Medications Alert */}
        {todayLog.missedMedications && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-3">
            <p className="text-sm font-semibold text-orange-800">
              Missed Medications:
            </p>
            <p className="text-sm text-orange-700 mt-1">{todayLog.missedMedications}</p>
          </div>
        )}

        {/* NEW: Medication Issues */}
        {todayLog.medicationIssues && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
            <p className="text-sm font-semibold text-red-800">Issues:</p>
            <p className="text-sm text-red-700 mt-1">{todayLog.medicationIssues}</p>
          </div>
        )}
      </div>
    ) : (
      <p className="text-sm text-gray-500">No medication data</p>
    )}
  </CardContent>
</Card>
```

**Time Estimate**: 4 hours
- Update medication JSON structure: 30 min
- Caregiver form enhancements: 2 hours
- Dashboard display updates: 1 hour
- Testing medication flow: 30 min

**Fields Added**: 3 new fields per medication (purpose, notes, weeklySchedule) + 2 summary fields (missedMedications, medicationIssues)

---

### **Sprint 2 Summary**

**Total Time**: 3 days (12 hours)
**Fields Added**: 7 fields (beverages/fluids 2, enhanced medications 5)
**Coverage Increase**: +10% (42% → 52%)

**Deliverables**:
- ✅ Comprehensive fluid intake tracking (10+ beverage types)
- ✅ Total daily fluid calculation with alerts
- ✅ Enhanced medication tracking (purpose, notes, schedule)
- ✅ Missed medications summary
- ✅ Dashboard fluid and medication visualizations

---

## 😴 Sprint 3: Sleep & Environment (Days 7-9)

### **Feature 3.1: Sleep Tracking** (Days 7-8)

#### Database Schema
```sql
-- Migration: 0006_sleep_and_environment.sql
ALTER TABLE care_logs ADD COLUMN afternoon_rest TEXT; -- JSON
ALTER TABLE care_logs ADD COLUMN night_sleep TEXT; -- JSON
```

#### JSON Structures
```typescript
interface AfternoonRest {
  startTime: string;
  endTime: string;
  quality: 'deep_sleep' | 'light_sleep' | 'restless' | 'no_sleep';
  behaviors: string[]; // ['quiet', 'snoring', 'talking', 'mumbling', 'restless_movements', 'dreaming', 'nightmares']
}

interface NightSleep {
  bedtime: string;
  quality: 'deep_sleep' | 'light_sleep' | 'restless' | 'no_sleep';
  wakings: number;
  wakingReasons: string[]; // ['toilet', 'pain', 'confusion', 'dreams_nightmares', 'unknown']
  behaviors: string[];
  issues: string; // Free text for concerns
}
```

#### Frontend: Caregiver Form
```tsx
{/* Afternoon Rest */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Moon className="h-5 w-5 text-indigo-500" />
      Afternoon Rest
    </h2>
  </CardHeader>
  <CardContent className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Rest Time (Start)"
        type="time"
        value={afternoonRest.startTime}
        onChange={(e) => setAfternoonRest({...afternoonRest, startTime: e.target.value})}
      />
      <Input
        label="Rest Time (End)"
        type="time"
        value={afternoonRest.endTime}
        onChange={(e) => setAfternoonRest({...afternoonRest, endTime: e.target.value})}
      />
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">Sleep Quality</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: 'deep_sleep', label: 'Deep Sleep', icon: '😴' },
          { value: 'light_sleep', label: 'Light Sleep', icon: '😌' },
          { value: 'restless', label: 'Restless', icon: '😫' },
          { value: 'no_sleep', label: 'No Sleep', icon: '😳' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setAfternoonRest({...afternoonRest, quality: option.value})}
            className={`p-3 rounded-lg border-2 transition-colors ${
              afternoonRest.quality === option.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">{option.icon}</div>
            <div className="text-sm font-medium">{option.label}</div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">
        Sleep Sounds/Behaviours
      </label>
      <div className="grid grid-cols-3 gap-2">
        {['quiet', 'snoring', 'talking', 'mumbling', 'restless_movements', 'dreaming', 'nightmares'].map((behavior) => (
          <label key={behavior} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={afternoonRest.behaviors.includes(behavior)}
              onChange={(e) => {
                if (e.target.checked) {
                  setAfternoonRest({
                    ...afternoonRest,
                    behaviors: [...afternoonRest.behaviors, behavior]
                  });
                } else {
                  setAfternoonRest({
                    ...afternoonRest,
                    behaviors: afternoonRest.behaviors.filter(b => b !== behavior)
                  });
                }
              }}
            />
            <span className="capitalize">{behavior.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  </CardContent>
</Card>

{/* Night Sleep */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Moon className="h-5 w-5 text-purple-500" />
      Night Sleep
    </h2>
  </CardHeader>
  <CardContent className="space-y-3">
    <Input
      label="Bedtime"
      type="time"
      value={nightSleep.bedtime}
      onChange={(e) => setNightSleep({...nightSleep, bedtime: e.target.value})}
    />

    <div>
      <label className="block text-sm font-medium mb-2">Sleep Quality</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: 'deep_sleep', label: 'Deep Sleep', icon: '😴' },
          { value: 'light_sleep', label: 'Light Sleep', icon: '😌' },
          { value: 'restless', label: 'Restless', icon: '😫' },
          { value: 'no_sleep', label: 'No Sleep', icon: '😳' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setNightSleep({...nightSleep, quality: option.value})}
            className={`p-3 rounded-lg border-2 ${
              nightSleep.quality === option.value
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200'
            }`}
          >
            <div className="text-2xl mb-1">{option.icon}</div>
            <div className="text-sm font-medium">{option.label}</div>
          </button>
        ))}
      </div>
    </div>

    <Input
      label="Night Wakings (count)"
      type="number"
      min="0"
      value={nightSleep.wakings}
      onChange={(e) => setNightSleep({...nightSleep, wakings: Number(e.target.value)})}
    />

    {nightSleep.wakings > 0 && (
      <div>
        <label className="block text-sm font-medium mb-2">
          Reasons for Waking
        </label>
        <div className="space-y-2">
          {['toilet', 'pain', 'confusion', 'dreams_nightmares', 'unknown'].map((reason) => (
            <label key={reason} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={nightSleep.wakingReasons.includes(reason)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setNightSleep({
                      ...nightSleep,
                      wakingReasons: [...nightSleep.wakingReasons, reason]
                    });
                  } else {
                    setNightSleep({
                      ...nightSleep,
                      wakingReasons: nightSleep.wakingReasons.filter(r => r !== reason)
                    });
                  }
                }}
              />
              <span className="capitalize">{reason.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>
    )}

    <div>
      <label className="block text-sm font-medium mb-2">
        Sleep Behaviours
      </label>
      <div className="grid grid-cols-3 gap-2">
        {['quiet', 'snoring', 'talking', 'mumbling', 'restless_movements', 'dreaming', 'nightmares'].map((behavior) => (
          <label key={behavior} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={nightSleep.behaviors.includes(behavior)}
              onChange={(e) => {
                if (e.target.checked) {
                  setNightSleep({
                    ...nightSleep,
                    behaviors: [...nightSleep.behaviors, behavior]
                  });
                } else {
                  setNightSleep({
                    ...nightSleep,
                    behaviors: nightSleep.behaviors.filter(b => b !== behavior)
                  });
                }
              }}
            />
            <span className="capitalize">{behavior.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
    </div>

    <Input
      label="Sleep Issues/Concerns"
      value={nightSleep.issues}
      onChange={(e) => setNightSleep({...nightSleep, issues: e.target.value})}
      placeholder="Any sleep concerns to report?"
    />
  </CardContent>
</Card>
```

**Time Estimate**: 8 hours (2 days)
- Database migration: 30 min
- API updates: 1 hour
- Caregiver form UI: 5 hours
- Dashboard sleep summary: 1.5 hours

**Fields Added**: 2 (afternoon_rest with 4 sub-fields, night_sleep with 6 sub-fields)

---

### **Feature 3.2: Environment & Room Safety** (Day 9)

#### Database Schema
```sql
-- Migration: 0006_sleep_and_environment.sql (continued)
ALTER TABLE care_logs ADD COLUMN room_maintenance TEXT; -- JSON
ALTER TABLE care_logs ADD COLUMN personal_items_check TEXT; -- JSON
ALTER TABLE care_logs ADD COLUMN hospital_bag_ready BOOLEAN DEFAULT 0;
```

#### JSON Structures
```typescript
interface RoomMaintenance {
  cleaningStatus: 'completed_by_maid' | 'caregiver_assisted' | 'not_done';
  roomComfort: 'good_temperature' | 'too_hot' | 'too_cold';
}

interface PersonalItemsCheck {
  spectacles: { checked: boolean; status: 'clean' | 'need_cleaning' };
  jewellery: { checked: boolean; status: 'all_present' | 'missing_item' };
  handbag: { checked: boolean; status: 'organized' | 'need_organizing' };
}
```

#### Frontend: Caregiver Form (Simplified)
```tsx
{/* Environment & Room Maintenance */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Home className="h-5 w-5 text-green-500" />
      Room Maintenance & Comfort
    </h2>
  </CardHeader>
  <CardContent className="space-y-3">
    <Select
      label="Cleaning Status"
      value={roomMaintenance.cleaningStatus}
      onValueChange={(value) => setRoomMaintenance({...roomMaintenance, cleaningStatus: value})}
    >
      <option value="completed_by_maid">Completed by maid</option>
      <option value="caregiver_assisted">Caregiver assisted</option>
      <option value="not_done">Not done</option>
    </Select>

    <Select
      label="Room Comfort"
      value={roomMaintenance.roomComfort}
      onValueChange={(value) => setRoomMaintenance({...roomMaintenance, roomComfort: value})}
    >
      <option value="good_temperature">Good temperature</option>
      <option value="too_hot">Too hot</option>
      <option value="too_cold">Too cold</option>
    </Select>
  </CardContent>
</Card>

{/* Personal Items Daily Check */}
<Card>
  <CardHeader>
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Eye className="h-5 w-5 text-blue-500" />
      Personal Items Check
    </h2>
  </CardHeader>
  <CardContent className="space-y-3">
    {Object.entries(personalItemsCheck).map(([item, check]) => (
      <div key={item} className="flex items-center gap-4">
        <input
          type="checkbox"
          checked={check.checked}
          onChange={(e) => updatePersonalItem(item, 'checked', e.target.checked)}
        />
        <label className="flex-1 font-medium capitalize">
          {item.replace('_', ' ')}
        </label>
        <Select
          value={check.status}
          onValueChange={(value) => updatePersonalItem(item, 'status', value)}
          className="w-48"
        >
          {item === 'spectacles' && (
            <>
              <option value="clean">Clean</option>
              <option value="need_cleaning">Need cleaning</option>
            </>
          )}
          {item === 'jewellery' && (
            <>
              <option value="all_present">All present</option>
              <option value="missing_item">Missing item</option>
            </>
          )}
          {item === 'handbag' && (
            <>
              <option value="organized">Organized</option>
              <option value="need_organizing">Need organizing</option>
            </>
          )}
        </Select>
      </div>
    ))}
  </CardContent>
</Card>

{/* Hospital Bag Readiness */}
<Card className="border-2 border-red-300">
  <CardHeader className="bg-red-50">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Ambulance className="h-5 w-5 text-red-500" />
      Hospital Bag Readiness
    </h2>
    <p className="text-sm text-red-700 mt-1">
      Keep ready at all times for emergencies
    </p>
  </CardHeader>
  <CardContent>
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={hospitalBagReady}
        onChange={(e) => setHospitalBagReady(e.target.checked)}
        className="w-5 h-5"
      />
      <span className="font-medium">
        Hospital bag is packed and ready (2 kaftans, 2 panties, 2 diapers, footwear, towels, toiletries)
      </span>
    </label>
  </CardContent>
</Card>
```

**Time Estimate**: 4 hours
- Database migration: 30 min
- API updates: 1 hour
- Caregiver form UI: 2 hours
- Dashboard summary: 30 min

**Fields Added**: 3 (room_maintenance, personal_items_check, hospital_bag_ready)

---

### **Sprint 3 Summary**

**Total Time**: 3 days (12 hours)
**Fields Added**: 5 fields (sleep 2, environment 3)
**Coverage Increase**: +8% (52% → 60%)

**Deliverables**:
- ✅ Afternoon rest tracking (time, quality, behaviors)
- ✅ Night sleep tracking (bedtime, quality, wakings, reasons)
- ✅ Room maintenance & comfort monitoring
- ✅ Personal items daily checklist
- ✅ Hospital bag emergency readiness

---

## 🧪 Day 10: Testing & Polish

### **Testing Checklist**

#### Database Integrity
- [ ] All migrations applied successfully
- [ ] JSON fields validate correctly
- [ ] Foreign keys intact
- [ ] Test data seed successful

#### API Testing
- [ ] All new endpoints return correct data
- [ ] Validation schemas catch errors
- [ ] Alert creation triggers properly
- [ ] Calculation helpers work (total fluid intake)

#### Frontend Testing
- [ ] All new form sections render
- [ ] State management works correctly
- [ ] Auto-save includes new fields
- [ ] Submit workflow works end-to-end

#### Dashboard Testing
- [ ] Fall risk alerts display
- [ ] Fluid intake visualization correct
- [ ] Medication adherence shows enhancements
- [ ] Sleep summary displays

#### E2E User Flow
- [ ] Caregiver can log all new fields
- [ ] Family sees enhanced data on dashboard
- [ ] Alerts trigger appropriately
- [ ] Week view includes new data points

### **Polish Tasks**

1. **Mobile Responsiveness**
   - Test all new forms on mobile
   - Adjust layouts for small screens
   - Ensure tap targets are adequate

2. **Error Handling**
   - Add try/catch to all new API calls
   - Display user-friendly error messages
   - Handle edge cases (e.g., division by zero in fluid calc)

3. **Loading States**
   - Add skeletons for new dashboard cards
   - Show spinners during saves
   - Disable submit during processing

4. **Documentation**
   - Update API documentation
   - Add inline code comments
   - Update user guide

5. **Performance**
   - Optimize JSON parsing
   - Minimize re-renders
   - Lazy load dashboard cards

**Time Estimate**: 8 hours

---

## 📊 Phase 2 Summary

### **Overall Progress**

| Metric | Before Phase 2 | After Phase 2 | Change |
|---|---|---|---|
| **Total Fields** | 25 | 50 | +25 |
| **Template Coverage** | 30% | 60% | +30% |
| **Core Sections Complete** | 6 | 8 | +2 |
| **Safety Features** | 1 | 4 | +3 |
| **Clinical Tracking** | Basic | Enhanced | ✅ |

### **New Capabilities**

**Safety & Risk Management**:
- ✅ Fall risk assessment with real-time alerts
- ✅ Unaccompanied time tracking (safety critical)
- ✅ Daily safety checks (trip hazards, equipment)
- ✅ Emergency preparedness monitoring

**Clinical Enhancements**:
- ✅ Comprehensive fluid intake (10+ beverage types)
- ✅ Enhanced medications (purpose, notes, schedule)
- ✅ Sleep quality tracking (afternoon + night)
- ✅ Environmental comfort monitoring

**Dashboard Intelligence**:
- ✅ Fall risk indicators
- ✅ Dehydration alerts (fluid intake < 1500ml)
- ✅ Missed medication tracking
- ✅ Sleep quality trends

### **Code Statistics**

**Database**:
- 3 new migrations
- 15 new fields/columns
- JSON schema updates

**Backend API**:
- 50+ lines of validation schemas
- 5 new calculation helpers
- Alert triggers for critical events

**Frontend**:
- 8 new form sections
- 1000+ lines of TypeScript/JSX
- 6 new dashboard cards

**Testing**:
- 25 new test scenarios
- E2E flow coverage: 90%

---

## 🚀 Deployment Checklist

### **Pre-Deployment**

- [ ] All tests passing (E2E + unit)
- [ ] No TypeScript errors
- [ ] Database migrations tested locally
- [ ] Seed data updated
- [ ] API documentation updated

### **Deployment Steps**

```bash
# 1. Apply migrations
cd apps/api
wrangler d1 execute anchor-dev-db --env dev --remote --file migrations/0004_fall_risk_assessment.sql
wrangler d1 execute anchor-dev-db --env dev --remote --file migrations/0005_fluids_and_meds.sql
wrangler d1 execute anchor-dev-db --env dev --remote --file migrations/0006_sleep_and_environment.sql

# 2. Deploy API
pnpm build
wrangler deploy --env dev

# 3. Deploy Web
cd ../web
pnpm build:dev
pnpm deploy:dev

# 4. Verify deployment
curl https://anchor-dev-api.erniesg.workers.dev/health
open https://anchor-dev.erniesg.workers.dev

# 5. Seed updated test data
./scripts/seed-care-logs-phase2.sh
```

### **Post-Deployment Verification**

- [ ] API health check passes
- [ ] Web app loads without errors
- [ ] New fields appear in forms
- [ ] Dashboard displays new data
- [ ] Alerts trigger correctly
- [ ] Mobile responsiveness works

---

## 📅 Timeline Summary

| Week | Days | Deliverables | Coverage |
|---|---|---|---|
| **Week 1** | Oct 7-11 | Sprints 1-2: Fall Risk, Safety, Fluids, Meds | 30% → 52% |
| **Week 2** | Oct 14-18 | Sprint 3 + Testing: Sleep, Environment, Polish | 52% → 60% |
| **Oct 21** | Launch | Phase 2 complete, deployed | **60%** |

**Total Duration**: 10 working days
**Total Effort**: ~40 hours (1 developer full-time)

---

## 🎯 Success Criteria

**Phase 2 Complete When**:
- ✅ 60% template coverage achieved (50/84 fields)
- ✅ All critical safety features implemented
- ✅ No P0/P1 bugs
- ✅ E2E tests passing (>90%)
- ✅ Deployed to production
- ✅ User acceptance testing completed

**Key Metrics to Track**:
- Fall incidents reported
- Fluid intake compliance (target: >1500ml/day)
- Medication adherence rate
- Sleep quality trends
- Safety checklist completion rate

---

## 📝 Notes for Implementation

### **Development Best Practices**

1. **Database First**
   - Apply migration
   - Test locally with seed data
   - Verify schema changes

2. **API Second**
   - Update validation schemas
   - Add calculation helpers
   - Implement alert triggers
   - Test with Postman/curl

3. **Frontend Last**
   - Build form UI
   - Connect to API
   - Add dashboard displays
   - Test user flow

4. **Iterate & Polish**
   - Mobile responsiveness
   - Error handling
   - Loading states
   - User feedback

### **Common Gotchas**

- **JSON Fields**: Always parse as `any` and handle errors
- **Date Calculations**: Use Unix timestamps for consistency
- **Validation**: Client-side + server-side validation
- **Auto-save**: Debounce saves to prevent API spam
- **Alerts**: Don't spam - only critical events

### **Resources**

- Template: `/Users/erniesg/code/erniesg/anchor/assets/Daily Care Report Template.pdf`
- Coverage Analysis: `/Users/erniesg/code/erniesg/anchor/FIELD_COVERAGE_ANALYSIS.md`
- Current Status: `/Users/erniesg/code/erniesg/anchor/IMPLEMENTATION_STATUS.md`
- Database Schema: `/Users/erniesg/code/erniesg/anchor/packages/database/src/schema.ts`

---

**Document Version**: 1.0
**Created**: 2025-10-06
**Next Review**: After Sprint 1 completion (Oct 9, 2025)
