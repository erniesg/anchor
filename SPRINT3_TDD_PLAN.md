# Sprint 3: Quality of Life Metrics - TDD Implementation Plan

**Date**: 2025-10-08
**Status**: 🚀 **PLANNING**
**Duration**: 6-7 days (Oct 8-15, 2025)
**Sprint Goal**: Reach 75%+ template coverage (118+/157 fields)

---

## 📋 Sprint 3 Objectives

### Target Features (5 Sections - Balanced Approach)

1. **Spiritual & Emotional Well-Being** (6 fields) - 1 day
2. **Therapy & Comfort** (6 fields) - 1 day
3. **Caregiver Notes** (5 fields) - 1 day
4. **Activities & Social Interaction** (8 fields) - 2 days
5. **Personal Items & Hospital Bag** (14 fields) - 1 day

**Total Fields**: 39 fields
**Coverage After Sprint 3**: 85 + 39 = 124 fields (78.9%) ✅ **EXCEEDS 75% TARGET!**

**Success Metrics**:
- ✅ 100% test coverage for new sections
- ✅ All E2E tests passing (local + deployed)
- ✅ Database migrations applied
- ✅ Dashboard display for new metrics
- ✅ Mobile-responsive UI
- ✅ Submit test continues passing

---

## 🧪 Sprint 3 Day-by-Day Plan

### Day 1: Spiritual & Emotional Well-Being (6 fields)

**Coverage Impact**: 54.1% → 57.9% (+3.8%)

#### Database Migration
```sql
-- Migration: 0006_add_spiritual_emotional.sql
ALTER TABLE care_logs ADD COLUMN spiritual_emotional TEXT; -- JSON object

-- Structure:
{
  "prayerTime": "string", // HH:MM format
  "prayerExpression": "string[]", // verbal/silent/hands_clasped/eyes_closed
  "overallMood": number, // 1-5 scale
  "communicationScale": number, // 1-5 scale
  "socialInteraction": "string[]", // family_visit/phone_call/video_call/none
  "emotionalState": "string" // calm/happy/anxious/sad/neutral
}
```

#### API Tests (8 tests)
**File**: `apps/api/src/routes/care-logs.test.ts`

```typescript
describe('Care Logs API > Sprint 3 Day 1: Spiritual & Emotional', () => {

  it('should accept valid spiritual & emotional data', async () => {
    // Test with all fields
  });

  it('should validate prayer time format (HH:MM)', async () => {
    // Test invalid format
  });

  it('should accept multiple prayer expression types', async () => {
    // Test array values
  });

  it('should validate mood scale (1-5)', async () => {
    // Test out of range
  });

  it('should validate communication scale (1-5)', async () => {
    // Test out of range
  });

  it('should accept multiple social interaction types', async () => {
    // Test array values
  });

  it('should accept valid emotional states', async () => {
    // Test enum values
  });

  it('should allow all spiritual & emotional fields to be optional', async () => {
    // Test with empty object
  });
});
```

#### UI Implementation
**File**: `apps/web/src/routes/caregiver/form.tsx`

**Section Location**: Section 11 (after Notes & Submit)

**Fields**:
1. Prayer Time (time picker)
2. Prayer Expression (multi-select checkboxes)
3. Overall Mood (1-5 emoji scale slider)
4. Communication Scale (1-5 scale slider)
5. Social Interaction (multi-select checkboxes)
6. Emotional State (button group)

#### E2E Tests (6 tests)
**File**: `tests/e2e/spiritual-emotional.spec.ts`

```typescript
describe('Spiritual & Emotional Well-Being', () => {

  test('should display spiritual & emotional section', async ({ page }) => {
    // Verify section renders
  });

  test('should select prayer time', async ({ page }) => {
    // Test time picker
  });

  test('should select multiple prayer expressions', async ({ page }) => {
    // Test checkbox group
  });

  test('should select mood on 1-5 scale', async ({ page }) => {
    // Test slider/emoji buttons
  });

  test('should select communication scale', async ({ page }) => {
    // Test slider
  });

  test('should select social interactions', async ({ page }) => {
    // Test multi-select
  });
});
```

#### Dashboard Display
**File**: `apps/web/src/routes/family/dashboard.tsx`

**Card**: "Spiritual & Emotional Well-Being"
- Prayer time & expressions
- Mood indicator (emoji + number)
- Communication quality
- Social interactions summary
- Emotional state badge

---

### Day 2: Therapy & Comfort (6 fields)

**Coverage Impact**: 57.9% → 61.7% (+3.8%)

#### Database Migration
```sql
-- Migration: 0007_add_therapy_comfort.sql
ALTER TABLE care_logs ADD COLUMN therapy_comfort TEXT; -- JSON object

-- Structure:
{
  "sessions": [
    {
      "time": "string", // HH:MM
      "duration": number, // minutes
      "type": "string", // massage/physical_therapy/other
      "oilLotion": "string", // optional
      "areas": "string[]", // head/neck/shoulders/back/arms/hands/legs/feet
      "response": "string" // relaxed/enjoyed/uncomfortable/neutral
    }
  ]
}
```

#### API Tests (7 tests)
```typescript
describe('Care Logs API > Sprint 3 Day 2: Therapy & Comfort', () => {
  it('should accept valid therapy sessions', async () => {});
  it('should validate session time format', async () => {});
  it('should validate duration > 0', async () => {});
  it('should accept multiple body areas', async () => {});
  it('should validate response enum', async () => {});
  it('should allow multiple therapy sessions', async () => {});
  it('should allow empty sessions array', async () => {});
});
```

#### UI: Dynamic session list (add/remove)
#### E2E: 5 tests
#### Dashboard: Therapy summary card with session history

---

### Day 3: Caregiver Notes (5 fields)

**Coverage Impact**: 61.7% → 64.9% (+3.2%)

#### Database Migration
```sql
-- Migration: 0008_add_caregiver_notes.sql
ALTER TABLE care_logs ADD COLUMN caregiver_notes TEXT; -- JSON object

-- Structure:
{
  "whatWentWell": "string",
  "challengesFaced": "string",
  "recommendationsForTomorrow": "string",
  "importantInfoForFamily": "string",
  "caregiverSignature": "string" // caregiver name
}
```

#### API Tests (6 tests)
#### UI: Text areas with character limits (500 chars each)
#### E2E: 4 tests
#### Dashboard: Notes display card (family can see all notes)

---

### Day 4-5: Activities & Social Interaction (8 fields)

**Coverage Impact**: 64.9% → 70.0% (+5.1%)

#### Database Migration
```sql
-- Migration: 0009_add_activities_social.sql
ALTER TABLE care_logs ADD COLUMN activities TEXT; -- JSON object

-- Structure:
{
  "phoneActivities": "string[]", // youtube/texting/calls/none
  "engagementLevel": number, // 1-5 scale
  "otherActivities": "string[]", // phone/conversation/prayer/reading
  "relaxationPeriods": [
    {
      "startTime": "string",
      "endTime": "string",
      "activity": "string", // resting/sleeping/watching_tv/listening_music
      "mood": "string" // happy/calm/restless/bored
    }
  ]
}
```

#### API Tests (9 tests)
#### UI: Multi-section form with time tracking
#### E2E: 7 tests
#### Dashboard: Activity summary + daily engagement chart

---

### Day 6: Personal Items & Hospital Bag (14 fields)

**Coverage Impact**: 70.0% → 78.9% (+8.9%)

#### Database Migration
```sql
-- Migration: 0010_add_personal_items.sql
ALTER TABLE care_logs ADD COLUMN personal_items TEXT; -- JSON object

-- Structure:
{
  "spectaclesCleaned": boolean,
  "jewelryAccountedFor": boolean,
  "handbagOrganized": boolean,
  "hospitalBag": {
    "icPack": boolean,
    "medications": boolean,
    "glasses": boolean,
    "dentures": boolean,
    "hearingAid": boolean,
    "mobileCharger": boolean,
    "comfortItems": boolean,
    "clothingSet": boolean,
    "toiletries": boolean,
    "documents": boolean,
    "snacks": boolean
  }
}
```

#### API Tests (8 tests)
#### UI: Checkbox grid with categories
#### E2E: 5 tests
#### Dashboard: Checklist status display

---

### Day 7: Integration Testing & Polish

- Run all E2E tests (local + deployed)
- Verify submit test still passes
- Dashboard polish for new sections
- Performance testing
- Documentation updates

---

## 📊 Expected Outcomes

### Coverage Progress

| Milestone | Fields | Coverage | Status |
|-----------|--------|----------|--------|
| Sprint 2 Complete | 85/157 | 54.1% | ✅ |
| After Day 1 | 91/157 | 57.9% | Planned |
| After Day 2 | 97/157 | 61.7% | Planned |
| After Day 3 | 102/157 | 64.9% | Planned |
| After Day 4-5 | 110/157 | 70.0% | Planned |
| After Day 6 | 124/157 | 78.9% | ✅ TARGET! |

### Test Coverage

- **API Tests**: ~45 new tests
- **E2E Tests**: ~27 new tests
- **Total New Tests**: ~72 tests
- **All tests passing**: 100% target

### Technical Deliverables

- ✅ 5 database migrations
- ✅ 5 new API schemas with validation
- ✅ 5 new form sections with UI
- ✅ 5 new dashboard cards
- ✅ Mobile-responsive throughout
- ✅ Auto-save for all sections

---

## 🎯 Why This Approach?

### Pros:
1. **Quick wins first** (Days 1-3) - Simple forms, build momentum
2. **Exceeds target** - 78.9% is well above 75% goal
3. **Good user value** - Quality of life metrics matter
4. **Defers complexity** - Mobility & Special Concerns saved for Sprint 4
5. **Realistic velocity** - 6-7 days at 5-6 fields/day average

### Deferred to Sprint 4:
- 🚶‍♀ Mobility & Exercise (18 fields) - Complex tracking
- ⚠️ Special Concerns (15 fields) - Incident management
- 📝 Communications (6 fields) - Low priority

---

## 🚀 Success Criteria

### Functional:
- ✅ All 5 sections functional in caregiver form
- ✅ All data saves and persists correctly
- ✅ Dashboard displays all new metrics
- ✅ Submit workflow still works
- ✅ Mobile responsive on all devices

### Technical:
- ✅ Zero TypeScript errors
- ✅ All migrations applied (local + remote)
- ✅ 100% test pass rate
- ✅ No regressions in existing features
- ✅ Performance acceptable (<2s load time)

### Quality:
- ✅ Clean, maintainable code
- ✅ Comprehensive test coverage
- ✅ Documentation updated
- ✅ TDD methodology followed
- ✅ Code reviewed and polished

---

**Status**: ✅ **PLAN COMPLETE - READY TO START DAY 1**
**Next Step**: Database migration + API tests for Spiritual & Emotional
**Review Date**: After Day 3 (checkpoint), Final review after Day 7
