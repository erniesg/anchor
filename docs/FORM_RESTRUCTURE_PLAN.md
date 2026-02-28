# Caregiver Form Restructure Plan

> **Goal**: Reorganize the daily care form from 13 flat sections into time-based forms with anytime quick actions.

**Created**: 2024-12-23
**Updated**: 2024-12-25 (All phases complete, deployed to production)
**Status**: ✅ Complete - 7/7 Phases Done

---

## Backwards Compatibility Strategy

### Approach: Parallel Routes
- **New time-based forms**: `/caregiver/form/morning`, `/afternoon`, `/evening`, `/summary`
- **Legacy full form**: `/caregiver/form-legacy` (remains fully functional)
- **Dashboard**: `/caregiver/form` links to both new forms AND legacy

### Why Keep Legacy?
1. Fallback if new forms have issues
2. Power users may prefer single-page form
3. Gradual migration - no big bang switch
4. Easy A/B testing between approaches

### Route Structure
```
/caregiver/form              → Dashboard (shows both options)
/caregiver/form/morning      → NEW: Morning-only form
/caregiver/form/afternoon    → NEW: Afternoon-only form
/caregiver/form/evening      → NEW: Evening-only form
/caregiver/form/summary      → NEW: Daily summary form
/caregiver/form-legacy       → EXISTING: Full 13-section form
```

### Dashboard Links
```
┌─────────────────────────────────────────┐
│  Time-Based Forms (Recommended)         │
│  [Morning] [Afternoon] [Evening] [Summary]
│                                         │
│  ─────────────────────────────────────  │
│  Or use: [Full Form (Legacy)] →         │
└─────────────────────────────────────────┘
```

---

## Table of Contents
- [Current State](#current-state)
- [Target Architecture](#target-architecture)
- [Implementation Phases](#implementation-phases)
- [Progress Tracking](#progress-tracking)

---

## Current State

### What's Working ✅
- API: 162 tests passing
- Frontend: No type errors
- Production: Deployed and functional
- Progressive submission: Backend supports `completedSections` (morning/afternoon/evening/dailySummary)
- Audit history: Implemented and working

### Current Form Structure (13 sections)
```
1. Morning Routine
2. Medications
3. Meals & Nutrition
4. Vital Signs
5. Toileting
6. Rest & Sleep
7. Fall Risk
8. Unaccompanied Time
9. Safety Checks
10. Spiritual & Emotional
11. Physical Activity
12. Special Concerns
13. Notes & Submit
```

### Problems with Current Structure
- Overwhelming (50+ fields in one form)
- Not time-appropriate (shows dinner at 8am)
- Hard to track progress
- Doesn't match caregiver workflow (shift-based)
- Poor mobile UX

---

## Target Architecture

### New Route Structure
```
/caregiver/form              → Dashboard (4 time-period cards + quick actions)
/caregiver/form/morning      → Morning form (4-5 fields)
/caregiver/form/afternoon    → Afternoon form (4-5 fields)
/caregiver/form/evening      → Evening form (4-5 fields)
/caregiver/form/summary      → Daily wrap-up + final submit
```

### Dashboard View
```
┌─────────────────────────────────────────┐
│  📅 Today's Care Log                    │
│  Care Recipient: [Name]                 │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ 🌅       │  │ 🌤️       │            │
│  │ Morning  │  │ Afternoon│            │
│  │ ✅ Done  │  │ 3/5 ⏳   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ 🌙       │  │ 📝       │            │
│  │ Evening  │  │ Summary  │            │
│  │ Pending  │  │ Locked 🔒│            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ⚡ Quick Actions                       │
│  [🚽 Toilet] [💧 Fluid] [🏃 Exercise]  │
└─────────────────────────────────────────┘
```

### Time-Based Forms

#### Morning Form (6am-12pm)
| Field | Type | Required |
|-------|------|----------|
| Wake Time | time | ✅ |
| Mood | select (alert/confused/sleepy/agitated/calm) | ✅ |
| Shower Time | time | ❌ |
| Hair Wash | boolean | ❌ |
| Morning Medications | checklist | ✅ |
| Breakfast | meal object | ✅ |
| Morning Vitals | vitals object | ❌ |

→ [Submit Morning Section]

#### Afternoon Form (12pm-6pm)
| Field | Type | Required |
|-------|------|----------|
| Lunch | meal object | ✅ |
| Afternoon Medications | checklist | ✅ |
| Tea Break | simple meal | ❌ |
| Afternoon Rest | rest object | ❌ |

→ [Submit Afternoon Section]

#### Evening Form (6pm-bedtime)
| Field | Type | Required |
|-------|------|----------|
| Dinner | meal object | ✅ |
| Evening Medications | checklist | ✅ |
| Bedtime Medications | checklist | ❌ |
| Night Sleep Setup | sleep object | ❌ |

→ [Submit Evening Section]

#### Summary Form (End of Day)
| Field | Type | Required |
|-------|------|----------|
| Total Fluids Review | number (auto-calc) | display |
| Fall Risk Assessment | object | ✅ |
| Unaccompanied Time | object | ✅ |
| Safety Checks | checklist | ✅ |
| Caregiver Notes | structured text | ✅ |

→ [Submit Complete Day]

### Anytime Quick Actions (FAB)

These can be logged at any time, from any screen:

#### Toileting Entry
```typescript
{
  time: string;
  type: 'bowel' | 'urination' | 'both';
  assistance: 'none' | 'some' | 'full';
  notes?: string;
}
```

#### Fluid Entry
```typescript
{
  time: string;
  type: 'water' | 'tea' | 'juice' | 'glucerna' | 'other';
  amount: number; // ml
  notes?: string;
}
```

#### Exercise Entry
```typescript
{
  time: string;
  type: string[]; // ['arm_exercises', 'walking', 'stretching', ...]
  duration: number; // minutes
  assistance: 'none' | 'some' | 'full';
  notes?: string;
}
```

#### Incident Entry
```typescript
{
  time: string;
  type: 'near_fall' | 'fall' | 'other';
  description: string;
  actionsTaken: string;
}
```

---

## Implementation Phases

### Phase 1: Dashboard + Routing ✅ DONE
**Goal**: Create the dashboard landing page and route structure

**Tasks**:
- [x] 1.1 Create `/caregiver/form` dashboard component
- [x] 1.2 Add route for dashboard (layout + index)
- [x] 1.3 Create time-period card components with status
- [x] 1.4 Link cards to legacy form (to be updated to sub-routes)
- [x] 1.5 Show progress based on `completedSections` from API

**Files Created/Modified**:
- `apps/web/src/routes/caregiver/form.tsx` → layout with auth check
- `apps/web/src/routes/caregiver/form/index.tsx` → dashboard component
- `apps/web/src/routes/caregiver/form-legacy.tsx` → full form (moved)

### Phase 2: Morning Form ✅ DONE
**Goal**: Extract morning-specific fields into standalone form

**Tasks**:
- [x] 2.1 Create morning form component at `/caregiver/form/morning`
- [x] 2.2 Add wake/mood/shower fields
- [x] 2.3 Add morning vitals (BP, pulse, oxygen, blood sugar)
- [x] 2.4 Add breakfast section
- [x] 2.5 Add morning medications
- [x] 2.6 Add "Submit Morning" button (calls submit-section API)
- [x] 2.7 Navigation between forms

### Phase 3: Afternoon Form ✅ DONE
**Goal**: Extract afternoon-specific fields

**Tasks**:
- [x] 3.1 Create afternoon form component at `/caregiver/form/afternoon`
- [x] 3.2 Add lunch section
- [x] 3.3 Add afternoon medications
- [x] 3.4 Add tea break section
- [x] 3.5 Add afternoon rest section
- [x] 3.6 Add "Submit Afternoon" button

### Phase 4: Evening Form ✅ DONE
**Goal**: Extract evening-specific fields

**Tasks**:
- [x] 4.1 Create evening form component at `/caregiver/form/evening`
- [x] 4.2 Add dinner section
- [x] 4.3 Add evening/bedtime medications
- [x] 4.4 Add night sleep/bedtime section
- [x] 4.5 Add "Submit Evening" button

### Phase 5: Summary Form ✅ DONE
**Goal**: Create end-of-day summary and final submission

**Tasks**:
- [x] 5.1 Create summary form component at `/caregiver/form/summary`
- [x] 5.2 Show auto-calculated totals (fluids)
- [x] 5.3 Add fall risk assessment
- [x] 5.4 Add unaccompanied time tracking
- [x] 5.5 Add safety checks
- [x] 5.6 Add caregiver notes (structured)
- [x] 5.7 Add "Submit Daily Summary" button
- [x] 5.8 Show section completion progress

### Phase 6: Anytime Quick Actions (FAB) ✅ DONE
**Goal**: Add floating action button for anytime entries

**Tasks**:
- [x] 6.1 Create FAB component
- [x] 6.2 Create quick toileting modal/drawer
- [x] 6.3 Create quick fluid modal/drawer
- [x] 6.4 Create quick exercise modal/drawer
- [x] 6.5 Create quick incident modal/drawer
- [x] 6.6 Add FAB to all caregiver form pages
- [x] 6.7 Ensure entries save immediately to care log

### Phase 7: Cleanup & Polish ✅ DONE
**Goal**: Polish new forms, keep legacy accessible

**Tasks**:
- [x] 7.1 Add "Full Form (Legacy)" link to dashboard
- [x] 7.2 Update E2E tests for new structure (15/15 tests passing)
- [x] 7.3 Test on mobile viewports (375px) (touch-friendly, no overflow)
- [x] 7.4 Test progressive submission flow
- [x] 7.5 Test family dashboard still displays all data
- [x] 7.6 Deploy to dev and test
- [x] 7.7 Deploy to production

**Note**: Legacy form at `/caregiver/form-legacy` remains fully functional as fallback.

---

## Progress Tracking

### Overall Progress: 100% (7/7 phases complete) 🎉

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Dashboard + Routing | ✅ Done | 5/5 |
| Phase 2: Morning Form | ✅ Done | 7/7 |
| Phase 3: Afternoon Form | ✅ Done | 6/6 |
| Phase 4: Evening Form | ✅ Done | 5/5 |
| Phase 5: Summary Form | ✅ Done | 8/8 |
| Phase 6: Quick Actions FAB | ✅ Done | 7/7 |
| Phase 7: Cleanup & Polish | ✅ Done | 7/7 |

### Completed Items ✅
- [x] API tests passing (162/162)
- [x] Frontend type checks passing
- [x] Production deployment working
- [x] Progressive submission backend (completedSections)
- [x] Audit history implemented
- [x] E2E tests updated to use BASE_URL
- [x] Family auth working on production
- [x] **Phase 1: Dashboard with time-period cards** (2024-12-24)
- [x] **Full deployed flow tested** - Caregiver → Section submit → Family visibility → Audit trail (2024-12-24)
- [x] **Phase 6: Quick Actions FAB complete** - Toileting, Fluid, Exercise, Incident modals (2024-12-24)
- [x] **Fixed PATCH handler for fluids/sleep** - Added missing fields to care-logs PATCH endpoint (2024-12-24)
- [x] **Phases 2-5: Time-based forms complete** (2024-12-25)
  - Morning form: wake, hygiene, vitals, breakfast, AM meds
  - Afternoon form: lunch, tea break, rest, PM meds
  - Evening form: dinner, bedtime, evening meds
  - Summary form: fluids review, fall risk, safety, notes
- [x] **Legacy form preserved** at `/caregiver/form-legacy` for backwards compatibility
- [x] **Meals API format fixed** (2024-12-25)
  - Forms now use `meals.breakfast`, `meals.lunch`, `meals.dinner` structure
  - Verified: All meals save and display correctly
- [x] **Full integration test passed** (2024-12-25)
  - ✅ All routes return 200
  - ✅ Section submissions working (morning, afternoon, evening)
  - ✅ Audit logs: 14+ entries recorded
  - ✅ Family can see: wake, mood, meals, fluids, completed sections
- [x] **E2E Tests Complete** (2024-12-25)
  - ✅ 15/15 Playwright tests passing
  - ✅ Dashboard, Morning, Afternoon, Evening, Summary forms tested
  - ✅ Mobile viewport (375px) - no overflow, touch-friendly buttons
  - ✅ Family login and data viewing verified
  - ✅ API integration tests (meals, sections, audit history)

---

## Design Decisions

### Confirmed ✅
1. **Time-based forms** - Split into Morning/Afternoon/Evening/Summary
2. **Anytime quick actions** - Toileting, Fluids, Exercise, Incidents via FAB
3. **Exercise is anytime** - Not tied to morning/afternoon slots
4. **Single vitals reading** - No need for afternoon vitals (can add later if needed)
5. **Dashboard landing** - Shows 4 cards with progress status
6. **Auto-save** - Changes save automatically as caregiver fills fields (debounced)
7. **Editable until final submit** - Caregiver can edit any section until day is finalized
8. **Review before final submit** - Summary page shows all data for review before final submission
9. **All changes audited** - Every field change tracked with timestamp and who made it
10. **Family sees live progress** - Family dashboard shows real-time caregiver progress

### Data Model
The existing `completedSections` field already supports this:
```typescript
completedSections: {
  morning?: { submittedAt: string; submittedBy: string };
  afternoon?: { submittedAt: string; submittedBy: string };
  evening?: { submittedAt: string; submittedBy: string };
  dailySummary?: { submittedAt: string; submittedBy: string };
}
```

No backend changes needed for the restructure!

---

## Gap Analysis & Improvements (2024-12-26)

### Critical Issues Found

#### 1. **Shower/Hair Wash in Morning Form - WRONG**
**Problem**: Elderly don't shower every morning. Having this in the daily Morning form implies it's expected daily.

**Solution**: Move to Daily Summary as "Personal Hygiene" section:
```typescript
personalHygiene: {
  bathOrShower: boolean; // "Did they bathe/shower today?"
  hairWashed: boolean;
  oralCare: 'am' | 'pm' | 'both' | 'none';
  skinCare: boolean;
  notes?: string;
}
```

#### 2. **Medications Hardcoded - CRITICAL GAP**
**Problem**: Medications in forms are either hardcoded or empty. Family should configure medication schedules (like pack list pattern).

**Solution**: Create medication schedule system:
```typescript
// Family configures once (like pack list):
interface MedicationSchedule {
  id: string;
  careRecipientId: string;
  medicationName: string;        // "Glucophage 500mg"
  dosage: string;                // "1 tablet"
  frequency: string;             // "daily", "twice_daily", "MWF", "PRN"
  timeSlots: string[];           // ["before_breakfast", "after_dinner"]
  purpose?: string;              // "Diabetes"
  instructions?: string;         // "Take with food"
  active: boolean;
}

// Caregiver sees in appropriate time-based form:
interface MedicationLog {
  medicationScheduleId: string;
  given: boolean;
  time: string | null;
  notes?: string;                // "Refused", "Vomited after"
}
```

**Time Slots**:
- `before_breakfast` → Morning form
- `after_breakfast` → Morning form
- `afternoon` → Afternoon form
- `before_dinner` → Evening form
- `after_dinner` → Evening form
- `bedtime` → Evening form

#### 3. **Appetite AND Amount Eaten - REDUNDANT**
**Problem**: Forms track both "Appetite (1-5)" and "Amount Eaten (1-5)" for every meal. This is confusing and redundant.

**Solution**: Keep only Amount Eaten:
```typescript
// BEFORE (current - redundant):
{
  time: string;
  appetite: number;      // Remove this
  amountEaten: number;
  assistance: string;
}

// AFTER (simplified):
{
  time: string;
  amountEaten: number;   // 1-5 scale
  assistance: 'none' | 'some' | 'full';
  swallowingIssues: string[];
}
```

#### 4. **Swallowing Issues - MISSING**
**Problem**: Forms track meals but don't capture swallowing difficulties (critical for elderly care).

**Solution**: Add swallowing issues checkboxes to all meal sections:
```typescript
swallowingIssues: string[]; // Multi-select:
// - 'choking'
// - 'coughing'
// - 'drooling'
// - 'spitting_out'
// - 'difficulty_swallowing'
// - 'refusing_food'
// - 'pocketing_food' (holding food in cheek)
```

#### 5. **Previous Night Wakings in Evening Form - WRONG PLACEMENT**
**Problem**: Evening form asks about "Night Wakings (if known from previous night)" - this doesn't make sense chronologically.

**Solution**: Move to Morning form as "Last Night's Sleep Report":
```typescript
// Morning form should have:
lastNightSleep?: {
  quality: 'deep' | 'light' | 'restless' | 'no_sleep';
  wakings: number;
  wakingReasons: string[];
  notes?: string;
}

// Evening form should only have:
bedtimeSetup: {
  bedtime: string;
  behaviors: string[];  // How they went to bed
  notes?: string;
}
```

---

### Form-by-Form Recommendations

#### Morning Form (6am-12pm) - REVISED
| Field | Status | Notes |
|-------|--------|-------|
| Wake Time | ✅ Keep | Required |
| Mood on Waking | ✅ Keep | Required |
| Last Night's Sleep | ➕ ADD | Move from Evening (quality, wakings, reasons) |
| ~~Shower Time~~ | ❌ REMOVE | Move to Summary as Personal Hygiene |
| ~~Hair Wash~~ | ❌ REMOVE | Move to Summary as Personal Hygiene |
| Morning Vitals | ✅ Keep | BP, Pulse, O2, Blood Sugar |
| Breakfast | ✅ Keep | But remove Appetite, add Swallowing Issues |
| Morning Medications | 🔧 FIX | Load from family-configured schedule |

#### Afternoon Form (12pm-6pm) - REVISED
| Field | Status | Notes |
|-------|--------|-------|
| Lunch | ✅ Keep | Remove Appetite, add Swallowing Issues |
| Tea Break | ✅ Keep | Simplified (time, amount only) |
| Afternoon Rest | ✅ Keep | Good as-is |
| Afternoon Medications | 🔧 FIX | Load from family-configured schedule |

#### Evening Form (6pm-bedtime) - REVISED
| Field | Status | Notes |
|-------|--------|-------|
| Dinner | ✅ Keep | Remove Appetite, add Swallowing Issues |
| Bedtime Setup | 🔧 FIX | Remove "previous night wakings", keep bedtime/behaviors |
| Evening/Bedtime Medications | 🔧 FIX | Load from family-configured schedule |

#### Summary Form (End of Day) - REVISED
| Field | Status | Notes |
|-------|--------|-------|
| Section Progress | ✅ Keep | Shows morning/afternoon/evening completion |
| Fluid Intake Summary | ✅ Keep | Auto-calculated from quick actions |
| Fall Risk Assessment | ✅ Keep | Balance, near falls, actual falls, walking |
| Safety Checks | ✅ Keep | 6 safety items |
| Unaccompanied Time | ✅ Keep | Time periods, reasons, replacement |
| Personal Hygiene | ➕ ADD | Bath/shower, oral care AM/PM, hair wash |
| Toileting Summary | ➕ ADD | Auto-calc from quick actions (bowel/urination count) |
| Exercise Summary | ➕ ADD | Auto-calc from quick actions (types, duration) |
| Spiritual/Emotional | ➕ ADD | Mood throughout day, religious activities, social |
| Caregiver Notes | ✅ Keep | What went well, challenges, recommendations |

---

### Quick Actions (FAB) - ADDITIONS

| Action | Status | Notes |
|--------|--------|-------|
| Toileting | ✅ Keep | Bowel/urination tracking |
| Fluid Intake | ✅ Keep | Drink logging |
| Exercise | ✅ Keep | Activity logging |
| Incident | ✅ Keep | Near falls, incidents |
| Oral Care | ➕ ADD | Quick log for teeth brushing, denture care |
| PRN Medication | ➕ ADD | For "as needed" medications |

---

### Database Changes Required

#### 1. New Table: `medication_schedules`
```sql
CREATE TABLE medication_schedules (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL REFERENCES care_recipients(id),
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT DEFAULT 'daily',  -- daily, twice_daily, MWF, PRN
  time_slots TEXT,  -- JSON array: ["before_breakfast", "bedtime"]
  purpose TEXT,
  instructions TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Update: `care_logs` Schema
```sql
-- Add new fields
ALTER TABLE care_logs ADD COLUMN last_night_sleep TEXT;      -- JSON
ALTER TABLE care_logs ADD COLUMN personal_hygiene TEXT;      -- JSON
ALTER TABLE care_logs ADD COLUMN oral_care_logs TEXT;        -- JSON array
ALTER TABLE care_logs ADD COLUMN spiritual_emotional TEXT;   -- JSON
ALTER TABLE care_logs ADD COLUMN medication_logs TEXT;       -- JSON array (references schedules)
```

---

### Implementation Priority

**Phase 1 (High Priority)**:
1. [ ] Remove Shower/Hair Wash from Morning form
2. [ ] Add Personal Hygiene section to Summary form
3. [ ] Remove redundant "Appetite" field from all meals
4. [ ] Add Swallowing Issues to all meal sections

**Phase 2 (Medium Priority)**:
5. [ ] Create medication_schedules table and API
6. [ ] Build Family medication schedule UI (like pack list)
7. [ ] Update time-based forms to load medications from schedule
8. [ ] Move "Previous Night Wakings" to Morning form

**Phase 3 (Lower Priority)**:
9. [ ] Add Oral Care quick action
10. [ ] Add PRN Medication quick action
11. [ ] Add auto-calculated summaries to Summary form
12. [ ] Add Spiritual/Emotional section to Summary

---

### Family Dashboard Improvements

**Current Issues**:
- Shows redundant "waiting for caregiver" cards
- No historical view (only today)
- Missing activity/audit log tab

**Improvements Needed**:
1. **Unified Progress Card**: Single card showing today's status
2. **View Tabs**: Today | This Week | This Month | Activity
3. **Activity Tab**: Audit log showing all changes with timestamps
4. **Medication Dashboard**: Show today's medication schedule and compliance
5. **Trends Integration**: Link to trends page for historical data

---

## Notes

- Keep backward compatibility with existing care logs
- Mobile-first design (test on 375px width)
- Each time form should be completable in <2 minutes
- FAB should be accessible but not intrusive
- Consider offline support in future iteration
- Follow pack list pattern for medication schedules (family configures → caregiver uses)
