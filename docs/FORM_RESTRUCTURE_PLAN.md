# Caregiver Form Restructure Plan

> **Goal**: Reorganize the daily care form from 13 flat sections into time-based forms with anytime quick actions.

**Created**: 2024-12-23
**Updated**: 2024-12-24 (Phase 1 + 6 complete, deployed to production)
**Status**: In Progress - 2/7 Phases Done

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

### Phase 2: Morning Form ⏳ SIMPLIFIED
**Goal**: Extract morning-specific fields into standalone form

**Current Approach**: Section navigation via query params to legacy form.
Dashboard cards navigate directly to relevant sections, providing time-based workflow
without requiring full form extraction.

**Tasks**:
- [x] 2.7 Handle navigation to morning sections via dashboard
- [ ] 2.1 Create morning form component (future - full extraction)
- [ ] 2.2 Move wake/mood/shower fields from current form
- [ ] 2.3 Move morning medications section
- [ ] 2.4 Move breakfast section
- [ ] 2.5 Move morning vitals (optional)
- [ ] 2.6 Add "Submit Morning" button (calls submit-section API)

### Phase 3: Afternoon Form
**Goal**: Extract afternoon-specific fields

**Tasks**:
- [ ] 3.1 Create afternoon form component
- [ ] 3.2 Move lunch section
- [ ] 3.3 Move afternoon medications
- [ ] 3.4 Move tea break section
- [ ] 3.5 Move afternoon rest section
- [ ] 3.6 Add "Submit Afternoon" button

### Phase 4: Evening Form
**Goal**: Extract evening-specific fields

**Tasks**:
- [ ] 4.1 Create evening form component
- [ ] 4.2 Move dinner section
- [ ] 4.3 Move evening/bedtime medications
- [ ] 4.4 Move night sleep section
- [ ] 4.5 Add "Submit Evening" button

### Phase 5: Summary Form
**Goal**: Create end-of-day summary and final submission

**Tasks**:
- [ ] 5.1 Create summary form component
- [ ] 5.2 Show auto-calculated totals (fluids, etc.)
- [ ] 5.3 Move fall risk assessment
- [ ] 5.4 Move unaccompanied time summary
- [ ] 5.5 Move safety checks
- [ ] 5.6 Move caregiver notes (structured)
- [ ] 5.7 Add "Submit Complete Day" button
- [ ] 5.8 Lock summary until other sections done (or allow override)

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

### Phase 7: Cleanup & Polish
**Goal**: Remove old form, test everything

**Tasks**:
- [ ] 7.1 Remove old 13-section form code
- [ ] 7.2 Update E2E tests for new structure
- [ ] 7.3 Test on mobile viewports
- [ ] 7.4 Test progressive submission flow
- [ ] 7.5 Test family dashboard still displays all data
- [ ] 7.6 Deploy to dev and test
- [ ] 7.7 Deploy to production

---

## Progress Tracking

### Overall Progress: 29% (2/7 phases complete)

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Dashboard + Routing | ✅ Done | 5/5 |
| Phase 2: Morning Form | ⏳ Next | 1/7 |
| Phase 3: Afternoon Form | Pending | 0/6 |
| Phase 4: Evening Form | Pending | 0/5 |
| Phase 5: Summary Form | Pending | 0/8 |
| Phase 6: Quick Actions FAB | ✅ Done | 7/7 |
| Phase 7: Cleanup & Polish | Pending | 0/7 |

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

## Notes

- Keep backward compatibility with existing care logs
- Mobile-first design (test on 375px width)
- Each time form should be completable in <2 minutes
- FAB should be accessible but not intrusive
- Consider offline support in future iteration
