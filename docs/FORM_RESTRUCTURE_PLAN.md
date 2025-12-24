# Caregiver Form Restructure Plan

> **Goal**: Reorganize the daily care form from section-based to time-based structure, add missing fields, and move one-time setup items out of the daily form.

**Created**: 2024-12-23
**Status**: Planning

---

## Table of Contents
- [Current State Analysis](#current-state-analysis)
- [Phase 1: Critical Missing Features](#phase-1-critical-missing-features)
- [Phase 2: Time-Based Restructure](#phase-2-time-based-restructure)
- [Phase 3: Enhanced Tracking](#phase-3-enhanced-tracking)
- [Phase 4: Cleanup & Optimization](#phase-4-cleanup--optimization)
- [Integration Checklist](#integration-checklist)
- [TDD Test Cases](#tdd-test-cases)

---

## Current State Analysis

### Current Form Sections (13 sections)
1. Morning Routine
2. Medications
3. Meals & Nutrition (Breakfast only)
4. Vital Signs (single reading)
5. Toileting & Hygiene (consolidated)
6. Rest & Sleep
7. Fall Risk & Safety
8. Unaccompanied Time
9. Safety Checks
10. Spiritual & Emotional
11. Physical Activity
12. Special Concerns
13. Notes & Submit

### Missing from PDF Template
| Category | Missing | Priority |
|----------|---------|----------|
| Meals | Lunch, Tea Break, Dinner | P1 |
| Fluids | Specific beverages, TOTAL calculation | P1 |
| Vitals | Afternoon reading, Heart Rate | P1 |
| Caregiver Notes | Structured fields (What Went Well, Challenges, etc.) | P1 |
| Activities | Massage therapy (2 sessions) | P2 |
| Activities | Phone activities (YouTube, texting) | P2 |
| Activities | Sofa/relaxation sessions | P2 |
| Sleep | Sleep sounds/behaviors | P2 |
| Mobility | Total steps, Distance | P2 |
| Fluids | Per-beverage tracking | P2 |

### Items to Move OUT of Daily Form
- [x] Hospital Bag Preparedness (moved to `/caregiver/pack-list`)
- [ ] Emergency Preparedness Checklist (weekly, not daily)
- [ ] Medication list management (move to care recipient profile)

---

## Phase 1: Critical Missing Features

### 1.1 Complete Meal Tracking ✅ COMPLETED (2024-12-23)

**Frontend Tasks:**
- [x] Add Lunch section with same fields as Breakfast
- [x] Add Tea Break section (simplified - time, appetite, amount)
- [x] Add Dinner section with same fields as Breakfast
- [x] Add Food Preferences Today field
- [x] Add Food Refusals Today field
- [x] Add Eating Assistance field for Breakfast, Lunch, Dinner

**Backend Tasks:**
- [x] Update care_logs schema to support multiple meals
- [x] Schema includes: breakfast, lunch, teaBreak, dinner, foodPreferences, foodRefusals
- [x] Family dashboard updated to display all meals with averages in trends

**State Variables to Add:**
```typescript
// Lunch
const [lunchTime, setLunchTime] = useState('');
const [lunchAppetite, setLunchAppetite] = useState(0);
const [lunchAmount, setLunchAmount] = useState(0);
const [lunchAssistance, setLunchAssistance] = useState<'none' | 'some' | 'full'>('none');
const [lunchSwallowing, setLunchSwallowing] = useState<'none' | 'coughing' | 'choking' | 'slow'>('none');

// Tea Break
const [teaBreakTime, setTeaBreakTime] = useState('');
const [teaBreakAppetite, setTeaBreakAppetite] = useState(0);
const [teaBreakAmount, setTeaBreakAmount] = useState(0);

// Dinner
const [dinnerTime, setDinnerTime] = useState('');
const [dinnerAppetite, setDinnerAppetite] = useState(0);
const [dinnerAmount, setDinnerAmount] = useState(0);
const [dinnerAssistance, setDinnerAssistance] = useState<'none' | 'some' | 'full'>('none');
const [dinnerSwallowing, setDinnerSwallowing] = useState<'none' | 'coughing' | 'choking' | 'slow'>('none');

// Food notes
const [foodPreferences, setFoodPreferences] = useState('');
const [foodRefusals, setFoodRefusals] = useState('');
```

**TDD Tests:**
- [ ] `meals.test.ts`: POST care log with lunch data returns 201
- [ ] `meals.test.ts`: POST care log with all 4 meals returns correct structure
- [ ] `meals.test.ts`: GET care log returns all meal data
- [ ] `meals.test.ts`: Meal appetite validation (1-5 range)
- [ ] `meals.test.ts`: Meal amount validation (0-100 range)

---

### 1.2 Full Fluid Tracking

**Frontend Tasks:**
- [ ] Create FluidIntakeTracker component
- [ ] Add specific beverage tracking (Glucerna Morning/Evening, Moringa Water, etc.)
- [ ] Add running total calculation with visual indicator
- [ ] Add quick-add buttons for common drinks
- [ ] Add low fluid intake warning (<1000ml)

**Backend Tasks:**
- [ ] Add `fluid_intake` JSONB field to care_logs
- [ ] Create fluid intake calculation endpoint
- [ ] Add validation for fluid amounts

**Data Structure:**
```typescript
interface FluidEntry {
  id: string;
  drinkType: 'glucerna_morning' | 'glucerna_evening' | 'moringa_water' |
             'fenugreek_water' | 'orange_juice' | 'cucumber_juice' |
             'plain_water' | 'other';
  time: string;
  amountMl: number;
  mugAmount: 'full' | 'half' | 'quarter' | 'none';
  swallowingIssues: 'none' | 'coughing' | 'choking';
  notes?: string;
}

interface FluidIntake {
  entries: FluidEntry[];
  totalMl: number;
}
```

**TDD Tests:**
- [ ] `fluids.test.ts`: POST fluid entry returns 201
- [ ] `fluids.test.ts`: Total calculation is accurate
- [ ] `fluids.test.ts`: GET care log returns fluid entries with total
- [ ] `fluids.test.ts`: Fluid amount validation (0-1000ml per entry)
- [ ] `fluids.test.ts`: Low intake flag when total < 1000ml

---

### 1.3 Afternoon Vitals Reading

**Frontend Tasks:**
- [ ] Split Vital Signs section into Morning/Afternoon tabs or subsections
- [ ] Add Heart Rate field (separate from Pulse Rate)
- [ ] Add Vital Signs Concerns text field
- [ ] Add Weekly Weight field (show only once per week or on specific days)

**Backend Tasks:**
- [ ] Update vitals structure to support morning/afternoon readings
- [ ] Add heart_rate field
- [ ] Add vitals_concerns field
- [ ] Add weekly_weight field with date tracking

**Data Structure:**
```typescript
interface VitalsReading {
  time: string;
  bloodPressure: string; // "120/80"
  pulseRate: number;
  heartRate: number;
  oxygenLevel: number;
  bloodSugar?: number;
}

interface Vitals {
  morning: VitalsReading;
  afternoon: VitalsReading;
  concerns?: string;
  weeklyWeight?: {
    value: number;
    date: string;
  };
}
```

**TDD Tests:**
- [ ] `vitals.test.ts`: POST care log with morning vitals returns 201
- [ ] `vitals.test.ts`: POST care log with afternoon vitals returns 201
- [ ] `vitals.test.ts`: Heart rate validation (30-200 bpm)
- [ ] `vitals.test.ts`: Vitals alerts trigger for critical values
- [ ] `vitals.test.ts`: Weekly weight only updates if date changed

---

### 1.4 Structured Caregiver Notes

**Frontend Tasks:**
- [ ] Replace single notes field with structured fields
- [ ] Add "What Went Well Today" textarea
- [ ] Add "Challenges Faced" textarea
- [ ] Add "Recommendations for Tomorrow" textarea
- [ ] Add "Important Information for Family" textarea
- [ ] Keep general notes field for additional comments

**Backend Tasks:**
- [ ] Update care_logs schema for structured notes
- [ ] Add validation for minimum content on submission

**Data Structure:**
```typescript
interface CaregiverNotes {
  whatWentWell?: string;
  challengesFaced?: string;
  recommendationsForTomorrow?: string;
  importantInfoForFamily?: string;
  generalNotes?: string;
}
```

**TDD Tests:**
- [ ] `notes.test.ts`: POST care log with structured notes returns 201
- [ ] `notes.test.ts`: GET care log returns all note fields
- [ ] `notes.test.ts`: Notes fields accept up to 2000 characters each

---

## Phase 2: Time-Based Restructure

### 2.1 New Section Organization

**Proposed Structure:**
```
1. Morning Section (6am-12pm)
   - Wake Up & Shower
   - Morning Medications
   - Breakfast
   - Morning Vitals
   - Morning Exercise
   - Morning Fluids

2. Afternoon Section (12pm-6pm)
   - Lunch
   - Afternoon Medications
   - Tea Break
   - Afternoon Vitals
   - Afternoon Rest
   - Afternoon Exercise
   - Afternoon Fluids

3. Evening Section (6pm-bedtime)
   - Dinner
   - Evening Medications
   - Evening Activities
   - Bedtime Medications
   - Night Sleep

4. Anytime Section (floating quick-access)
   - Toileting
   - Mobility observations
   - Quick fluid add

5. Daily Safety & Incidents
   - Fall Risk
   - Unaccompanied Time
   - Safety Checks
   - Personal Items
   - Special Concerns

6. End-of-Day Summary
   - Structured Caregiver Notes
   - Submit
```

**Frontend Tasks:**
- [ ] Refactor section navigation to time-based groups
- [ ] Add time-aware section highlighting (auto-open current time section)
- [ ] Create collapsible section groups
- [ ] Add progress indicators per time section
- [ ] Add floating quick-action button for Toileting/Fluids

**TDD Tests:**
- [ ] `form-navigation.test.ts`: Section navigation works correctly
- [ ] `form-navigation.test.ts`: Auto-open current time section
- [ ] `form-navigation.test.ts`: Progress calculation accurate per section

---

### 2.2 Medication Time Slots

**Frontend Tasks:**
- [ ] Reorganize medications into 5 time slots:
  - Before Breakfast
  - After Breakfast (Morning)
  - Afternoon (Before/After Lunch)
  - After Dinner
  - Before Bedtime
- [ ] Show medications grouped by time slot
- [ ] Add "Missed Medications" summary field
- [ ] Add "Medication Issues" summary field

**Backend Tasks:**
- [ ] Update medication time_slot enum
- [ ] Add missed_medications and medication_issues fields

**TDD Tests:**
- [ ] `medications.test.ts`: All 5 time slots accepted
- [ ] `medications.test.ts`: Missed medications tracked correctly
- [ ] `medications.test.ts`: Medication issues saved

---

## Phase 3: Enhanced Tracking

### 3.1 Massage Therapy

**Frontend Tasks:**
- [ ] Add Massage Therapy section with 2 sessions (Afternoon, Evening)
- [ ] Fields per session: Time range, Duration, Oil/Lotion, Areas massaged, Response

**Data Structure:**
```typescript
interface MassageSession {
  session: 'afternoon' | 'evening';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  oilLotionUsed?: string;
  areasMassaged: ('head' | 'face' | 'forehead' | 'neck' | 'arms' |
                  'legs' | 'shoulders' | 'back' | 'other')[];
  otherAreas?: string;
  response: 'relaxed' | 'enjoyed' | 'uncomfortable';
}
```

**TDD Tests:**
- [ ] `massage.test.ts`: POST massage session returns 201
- [ ] `massage.test.ts`: Both afternoon and evening sessions saved
- [ ] `massage.test.ts`: Areas massaged array validated

---

### 3.2 Phone & Activities Tracking

**Frontend Tasks:**
- [ ] Add Phone Activities section (YouTube, Texting/Messaging)
- [ ] Add Sofa/Relaxation Time tracking (up to 4 sessions)
- [ ] Add engagement level tracking

**Data Structure:**
```typescript
interface PhoneActivity {
  type: 'youtube' | 'texting' | 'other';
  timePeriods: string;
  durationMinutes: number;
  engagementLevel: 'very_engaged' | 'somewhat' | 'not_interested' |
                   'very_active' | 'some_activity' | 'no_activity';
}

interface RelaxationSession {
  startTime: string;
  endTime: string;
  activity: string;
  mood: 'engaged' | 'content' | 'calm' | 'relaxed' | 'withdrawn' | 'agitated';
}
```

**TDD Tests:**
- [ ] `activities.test.ts`: Phone activities saved correctly
- [ ] `activities.test.ts`: Up to 4 relaxation sessions allowed
- [ ] `activities.test.ts`: Mood tracking validated

---

### 3.3 Complete Sleep Tracking

**Frontend Tasks:**
- [ ] Add Sleep Sounds/Behaviours for afternoon rest
- [ ] Add Sleep Behaviours for night sleep (separate from waking reasons)
- [ ] Behaviours: Quiet, Snoring, Talking, Mumbling, Restless movements, Dreaming, Nightmares

**TDD Tests:**
- [ ] `sleep.test.ts`: Sleep behaviors array saved
- [ ] `sleep.test.ts`: Both afternoon and night behaviors tracked

---

### 3.4 Steps & Distance Tracking

**Frontend Tasks:**
- [ ] Add Total Steps field
- [ ] Add Distance (km) field
- [ ] Add Walking Assistance level dropdown

**TDD Tests:**
- [ ] `mobility.test.ts`: Steps count saved (0-50000 range)
- [ ] `mobility.test.ts`: Distance saved with 2 decimal places
- [ ] `mobility.test.ts`: Walking assistance enum validated

---

## Phase 4: Cleanup & Optimization

### 4.1 Move to Settings/Profile

- [ ] Move Emergency Preparedness Checklist to weekly task
- [ ] Create Medication Profile for care recipient (medications list with schedule)
- [ ] Form only tracks "given or not" against profile

### 4.2 Performance Optimization

- [ ] Implement lazy loading for sections
- [ ] Add form state persistence to localStorage
- [ ] Optimize re-renders with memo/useMemo

---

## Phase 5: Audit History & Change Tracking

> **Goal**: Track all changes to care logs and show families what has changed since they last viewed.

### 5.1 Audit History Table

**Database Tasks:**
- [ ] Create `care_log_audit` migration
- [ ] Fields: id, care_log_id, changed_at, changed_by, change_type, section, field_path, old_value, new_value

**Schema:**
```sql
CREATE TABLE care_log_audit (
  id TEXT PRIMARY KEY,
  care_log_id TEXT NOT NULL,
  changed_at INTEGER NOT NULL,        -- timestamp
  changed_by TEXT NOT NULL,           -- user ID
  change_type TEXT NOT NULL,          -- 'create' | 'update' | 'section_submit' | 'final_submit'
  section TEXT,                       -- 'morning' | 'afternoon' | 'meals' | 'vitals' | etc.
  field_path TEXT,                    -- 'meals.lunch.time' | 'vitals.bloodPressure'
  old_value TEXT,                     -- JSON stringified
  new_value TEXT,                     -- JSON stringified
  FOREIGN KEY (care_log_id) REFERENCES care_logs(id)
);
```

**TDD Tests:**
- [ ] `audit.test.ts`: Creating a care log creates audit entry with change_type='create'
- [ ] `audit.test.ts`: Updating a field creates audit entry with old/new values
- [ ] `audit.test.ts`: Section submit creates audit entry with change_type='section_submit'
- [ ] `audit.test.ts`: GET /care-logs/:id/history returns chronological audit entries

---

### 5.2 API Audit Logging

**Backend Tasks:**
- [ ] Add audit logging on POST /care-logs (create)
- [ ] Add audit logging on PATCH /care-logs/:id (update) - diff old vs new
- [ ] Add audit logging on POST /care-logs/:id/submit-section
- [ ] Add audit logging on POST /care-logs/:id/submit (final)
- [ ] Create GET /care-logs/:id/history endpoint

**Diff Logic:**
```typescript
function createAuditEntries(oldLog: CareLog | null, newLog: CareLog, userId: string): AuditEntry[] {
  // Compare fields recursively
  // For each changed field, create an audit entry with field_path, old_value, new_value
}
```

---

### 5.3 Family Last Viewed Tracking

**Database Tasks:**
- [ ] Add `family_last_viewed_at` field to care_logs or create separate tracking table
- [ ] Track per-family-member (different family members may view at different times)

**Schema Option A (simple):**
```sql
ALTER TABLE care_logs ADD COLUMN family_last_viewed_at INTEGER;
```

**Schema Option B (per-user tracking):**
```sql
CREATE TABLE care_log_views (
  id TEXT PRIMARY KEY,
  care_log_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  UNIQUE(care_log_id, user_id)
);
```

**API Tasks:**
- [ ] Create POST /care-logs/:id/mark-viewed endpoint
- [ ] Update GET endpoints to return changes_since_last_view count

---

### 5.4 Change Highlighting UI

**Frontend Tasks:**
- [ ] Add "X updates" badge on cards with changes
- [ ] Highlight changed fields with visual indicator (background color, icon)
- [ ] Show "was X, now Y" for changed values
- [ ] Add "View change history" button/link
- [ ] Create ChangeHistoryTimeline component

**UI Components:**
```typescript
// Badge component
<ChangeBadge count={3} /> // Shows "3 updates"

// Field highlight
<HighlightedField
  label="Lunch Time"
  value="12:45"
  previousValue="12:30"
  changed={true}
/>

// Timeline component
<ChangeHistoryTimeline
  careLogId={id}
  entries={auditEntries}
/>
```

**TDD Tests:**
- [ ] `ChangeBadge.test.tsx`: Shows correct count
- [ ] `HighlightedField.test.tsx`: Shows previous value when changed
- [ ] `ChangeHistoryTimeline.test.tsx`: Renders entries chronologically

---

## Integration Checklist

### Frontend-Backend Integration Points

| Feature | FE Component | BE Endpoint | Schema | Status |
|---------|--------------|-------------|--------|--------|
| Multiple Meals | MealsSection | POST /care-logs | meals JSONB | [x] ✅ |
| Fluid Tracking | FluidIntakeTracker | POST /care-logs | fluid_intake JSONB | [x] ✅ |
| Afternoon Vitals | VitalsSection | POST /care-logs | vitals JSONB | [ ] |
| Structured Notes | NotesSection | POST /care-logs | notes JSONB | [ ] |
| Massage Therapy | MassageSection | POST /care-logs | massage_therapy JSONB | [ ] |
| Phone Activities | ActivitiesSection | POST /care-logs | activities JSONB | [ ] |
| Sleep Behaviors | SleepSection | POST /care-logs | sleep JSONB update | [ ] |
| Steps/Distance | MobilitySection | POST /care-logs | mobility JSONB | [ ] |
| Audit History | ChangeHistoryTimeline | GET /care-logs/:id/history | care_log_audit | [ ] |
| Change Badges | ChangeBadge | GET /care-logs | care_log_views | [ ] |
| Last Viewed | Dashboard | POST /care-logs/:id/mark-viewed | care_log_views | [ ] |

### API Contract Verification

For each new field, verify:
- [ ] POST request accepts the field
- [ ] GET request returns the field
- [ ] PATCH request updates the field
- [ ] Validation errors return 400 with clear message
- [ ] Null/undefined handling is consistent

### Database Migration Checklist

- [ ] Create migration for new JSONB fields
- [ ] Test migration on dev database
- [ ] Verify backward compatibility (old logs still readable)
- [ ] Update D1 schema in wrangler.toml if needed

---

## TDD Test Cases

### Unit Tests (Frontend)

```typescript
// tests/unit/components/MealsSection.test.tsx
describe('MealsSection', () => {
  it('renders all 4 meal inputs', () => {});
  it('calculates total calories when all meals entered', () => {});
  it('shows swallowing issues warning', () => {});
  it('validates appetite range 1-5', () => {});
});

// tests/unit/components/FluidIntakeTracker.test.tsx
describe('FluidIntakeTracker', () => {
  it('renders quick-add buttons for common drinks', () => {});
  it('calculates running total correctly', () => {});
  it('shows low intake warning below 1000ml', () => {});
  it('allows custom drink entry', () => {});
});

// tests/unit/components/VitalsSection.test.tsx
describe('VitalsSection', () => {
  it('renders morning and afternoon tabs', () => {});
  it('shows critical alert for dangerous values', () => {});
  it('validates blood pressure format', () => {});
  it('shows age-adjusted thresholds', () => {});
});
```

### Integration Tests (API)

```typescript
// apps/api/tests/care-logs.test.ts

describe('POST /care-logs - Meals', () => {
  it('accepts complete meal data for all 4 meals', async () => {});
  it('validates meal appetite is 1-5', async () => {});
  it('validates meal amount is 0-100', async () => {});
  it('returns 400 for invalid swallowing value', async () => {});
});

describe('POST /care-logs - Fluids', () => {
  it('accepts fluid entries array', async () => {});
  it('calculates total fluid intake', async () => {});
  it('flags low intake in response', async () => {});
  it('validates drink type enum', async () => {});
});

describe('POST /care-logs - Vitals', () => {
  it('accepts morning vitals', async () => {});
  it('accepts afternoon vitals', async () => {});
  it('validates heart rate range', async () => {});
  it('triggers alert for critical BP', async () => {});
});

describe('GET /care-logs/:id', () => {
  it('returns all meal data', async () => {});
  it('returns fluid entries with total', async () => {});
  it('returns both vitals readings', async () => {});
  it('returns structured notes', async () => {});
});
```

### E2E Tests

```typescript
// apps/web/tests/e2e/caregiver-form-meals.spec.ts
describe('Caregiver Form - Meals', () => {
  it('can enter breakfast and see it in summary', async () => {});
  it('can enter all 4 meals and submit', async () => {});
  it('shows validation error for invalid appetite', async () => {});
});

// apps/web/tests/e2e/caregiver-form-fluids.spec.ts
describe('Caregiver Form - Fluids', () => {
  it('can quick-add common drinks', async () => {});
  it('shows running total updating in real-time', async () => {});
  it('shows low intake warning', async () => {});
});

// apps/web/tests/e2e/caregiver-form-complete.spec.ts
describe('Caregiver Form - Complete Flow', () => {
  it('can fill morning section and navigate to afternoon', async () => {});
  it('auto-saves draft when navigating sections', async () => {});
  it('can submit complete form with all sections', async () => {});
  it('shows form locked after submission', async () => {});
});
```

---

## Progress Tracking

### Phase 1 Progress: 0%
- [ ] 1.1 Complete Meal Tracking (0/5 FE, 0/3 BE, 0/5 Tests)
- [ ] 1.2 Full Fluid Tracking (0/5 FE, 0/3 BE, 0/5 Tests)
- [ ] 1.3 Afternoon Vitals (0/4 FE, 0/4 BE, 0/5 Tests)
- [ ] 1.4 Structured Notes (0/5 FE, 0/2 BE, 0/3 Tests)

### Phase 2 Progress: 0%
- [ ] 2.1 Time-Based Sections (0/5 FE, 0/3 Tests)
- [ ] 2.2 Medication Time Slots (0/4 FE, 0/2 BE, 0/3 Tests)

### Phase 3 Progress: 0%
- [ ] 3.1 Massage Therapy (0/2 FE, 0/3 Tests)
- [ ] 3.2 Phone & Activities (0/3 FE, 0/3 Tests)
- [ ] 3.3 Complete Sleep (0/3 FE, 0/2 Tests)
- [ ] 3.4 Steps & Distance (0/3 FE, 0/3 Tests)

### Phase 4 Progress: 0%
- [ ] 4.1 Move to Settings (0/3 tasks)
- [ ] 4.2 Performance Optimization (0/3 tasks)

---

## Family View Integration

### Current Family Dashboard (`/family/dashboard`)

The family dashboard currently displays:

| Category | Current Display | Data Source |
|----------|-----------------|-------------|
| Vitals | Blood pressure, Pulse, Oxygen, Blood Sugar | Single morning reading |
| Meals | Breakfast appetite (1-5), Amount eaten (%) | `meals.breakfast` |
| Fluids | Total fluid intake (ml), Optional breakdown | `totalFluidIntake`, `fluids[]` |
| Sleep | Afternoon rest, Night sleep quality/wakings | `afternoonRest`, `nightSleep` |
| Medications | Adherence %, Given/Missed counts | `medicationAdherence` |
| Safety | Balance issues, Near falls, Actual falls | `balanceIssues`, `nearFalls`, `actualFalls` |
| Activity | Morning/Afternoon exercise sessions | `morningExerciseSession`, `afternoonExerciseSession` |
| Unaccompanied | Total unaccompanied minutes | `totalUnaccompaniedMinutes` |

### Required Family View Updates

#### Phase 1 Impact (Critical)

| New Feature | Dashboard Display | Trends Display | Priority |
|-------------|-------------------|----------------|----------|
| **Multiple Meals** | Show all 4 meals (B/L/T/D) with mini-charts | Daily calorie/appetite trends | P1 |
| **Fluid Tracking** | Running total + breakdown by beverage | 7-day fluid intake trend line | P1 |
| **Afternoon Vitals** | Morning vs Afternoon comparison cards | Both readings on BP/pulse charts | P1 |
| **Structured Notes** | "Important Info for Family" highlighted section | N/A | P1 |

**Frontend Tasks for Family View:**
- [ ] Update `dashboard.tsx` MealsData interface to include lunch, teaBreak, dinner
- [ ] Add lunch/dinner to appetite chart (currently only breakfast)
- [ ] Create meal summary cards showing all 4 meals
- [ ] Update fluid breakdown to show per-beverage totals
- [ ] Add morning vs afternoon vitals comparison view
- [ ] Add "Important for Family" alert card at top of dashboard
- [ ] Update `trends.tsx` to chart multiple meals over 7 days

**Data Structure Changes in Dashboard:**
```typescript
// Current
interface MealsData {
  breakfast?: { appetite?: number; amountEaten?: number; };
}

// Required
interface MealsData {
  breakfast?: MealEntry;
  lunch?: MealEntry;
  teaBreak?: MealEntry;
  dinner?: MealEntry;
}

interface MealEntry {
  time?: string;
  appetite?: number;
  amountEaten?: number;
  assistance?: 'none' | 'some' | 'full';
  swallowing?: string;
}
```

#### Phase 2 Impact (Time-Based)

- [ ] Add time-based filtering (show morning/afternoon/evening data separately)
- [ ] Add visual timeline view of the day
- [ ] Update week view to show time-of-day patterns

#### Phase 3 Impact (Enhanced Tracking)

| New Feature | Dashboard Display | Priority |
|-------------|-------------------|----------|
| Massage Therapy | Sessions completed indicator | P2 |
| Phone Activities | Engagement summary | P3 |
| Sleep Behaviors | Detailed sleep quality breakdown | P2 |
| Steps/Distance | Daily mobility summary | P2 |

### Trends Page (`/family/trends`) Updates

Current charts:
- Blood Pressure (7-day line chart)
- Pulse Rate (7-day line chart)
- Oxygen Level (7-day line chart)
- Blood Sugar (7-day line chart)
- Appetite & Meal Consumption (7-day bar chart - **breakfast only**)

Required updates:
- [ ] Add afternoon vitals to existing charts (dual line)
- [ ] Expand appetite chart to show all 4 meals
- [ ] Add fluid intake trend chart
- [ ] Add sleep quality trend chart
- [ ] Add medication adherence trend chart

---

## Test Impact Analysis

### Existing Test Files

#### API Tests (3 files)
| Test File | Current Focus | Impact Level | Updates Needed |
|-----------|---------------|--------------|----------------|
| `auth.test.ts` | Authentication | None | No changes |
| `care-logs.test.ts` | Care log CRUD | **HIGH** | Add tests for new meal/fluid/vitals fields |
| `caregivers.test.ts` | Caregiver management | Low | No changes |

#### E2E Tests (17 files)
| Test File | Current Focus | Impact Level | Updates Needed |
|-----------|---------------|--------------|----------------|
| `core-sections.spec.ts` | Form core sections | **HIGH** | Update for time-based sections |
| `caregiver-submit.spec.ts` | Form submission | **HIGH** | Update payload expectations |
| `sleep-tracking.spec.ts` | Sleep fields | **MEDIUM** | Add sleep behaviors tests |
| `medication-tracking.spec.ts` | Medication fields | **MEDIUM** | Add time-slot tests |
| `unaccompanied-time.spec.ts` | Unaccompanied tracking | Low | No changes expected |
| `physical-activity.spec.ts` | Exercise tracking | Low | No changes expected |
| `exercise-sessions.spec.ts` | Exercise sessions | Low | No changes expected |
| `exercise-sessions-deployed.spec.ts` | Deployed exercise | Low | No changes expected |
| `spiritual-emotional.spec.ts` | Spiritual section | None | No changes |
| `oral-care.spec.ts` | Oral care section | None | No changes |
| `environment-safety.spec.ts` | Safety section | None | No changes |
| `mobile-caregiver.spec.ts` | Mobile form view | **MEDIUM** | Verify new sections render |
| `family-dashboard.spec.ts` | Family dashboard | **HIGH** | Add tests for new data display |
| `family-weekly-view.spec.ts` | Week view | **HIGH** | Add multi-meal/fluid trend tests |
| `full-onboarding-production.spec.ts` | Onboarding flow | Low | No changes |
| `onboarding-flow.spec.ts` | Onboarding flow | Low | No changes |
| `debug-submit.spec.ts` | Debug submission | Low | Update if payload changes |

### New Tests Required

#### API Tests to Add
```typescript
// care-logs.test.ts additions
describe('POST /care-logs - Multiple Meals', () => {
  it('accepts all 4 meals in single submission');
  it('validates meal appetite range 1-5');
  it('validates meal amount range 0-100');
});

describe('POST /care-logs - Fluid Tracking', () => {
  it('accepts fluid entries array');
  it('calculates total fluid intake');
  it('flags low intake when total < 1000ml');
});

describe('POST /care-logs - Afternoon Vitals', () => {
  it('accepts morning and afternoon vitals separately');
  it('stores heart rate distinct from pulse');
});

describe('GET /care-logs - Family View', () => {
  it('returns all meal data for dashboard');
  it('returns fluid breakdown with total');
  it('returns both vitals readings');
  it('returns structured caregiver notes');
});
```

#### E2E Tests to Add
```typescript
// New file: meals-complete.spec.ts
describe('Caregiver Form - All Meals', () => {
  it('can enter breakfast, lunch, tea break, dinner');
  it('shows meal progress indicator');
  it('validates swallowing issues warning');
});

// New file: fluids-tracking.spec.ts
describe('Caregiver Form - Fluids', () => {
  it('can add quick drinks from presets');
  it('shows running total in real-time');
  it('shows low intake warning');
});

// New file: family-meals-display.spec.ts
describe('Family Dashboard - Meals Display', () => {
  it('shows all 4 meals with appetite ratings');
  it('calculates daily nutrition summary');
});

// New file: family-fluids-display.spec.ts
describe('Family Dashboard - Fluids Display', () => {
  it('shows fluid total prominently');
  it('shows beverage breakdown when expanded');
  it('shows low intake alert when applicable');
});
```

### Test Migration Strategy

1. **Before Phase 1 Implementation:**
   - [ ] Write failing tests for new meal fields
   - [ ] Write failing tests for fluid tracking
   - [ ] Write failing tests for afternoon vitals
   - [ ] Write failing tests for structured notes

2. **During Phase 1 Implementation:**
   - [ ] Run tests after each feature (should progressively pass)
   - [ ] Update existing tests that break due to schema changes

3. **After Phase 1 Implementation:**
   - [ ] All new tests pass
   - [ ] All existing tests pass (may need payload updates)
   - [ ] E2E tests verify Family View displays new data

4. **Regression Testing:**
   - [ ] Run full test suite before each deployment
   - [ ] Verify backward compatibility with existing care logs
   - [ ] Test mobile viewport for all new sections

---

## Notes

- All new fields should use JSONB for flexibility
- Maintain backward compatibility with existing care logs
- Test on mobile viewport (375px width minimum)
- Consider offline support for field workers
- **Family View must be updated alongside caregiver form changes**
- **Update API tests BEFORE implementing backend changes (TDD)**
- **Update E2E tests AFTER both FE and BE are integrated**
