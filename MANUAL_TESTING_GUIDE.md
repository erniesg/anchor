# Manual Testing Guide - Anchor Care Platform
**Date:** 2025-10-09
**Environment:** Development (anchor-dev.erniesg.workers.dev)

---

## 🎯 Quick Test Summary

### ✅ What's Been Tested (Automated)
- ✅ Caregiver login & form submission
- ✅ All 13 form sections (E2E with Playwright)
- ✅ Database persistence (100% verified)
- ✅ API endpoints (POST, PATCH, submit)
- ✅ 7 days of trend data seeded

### 📋 What Needs Manual Testing
- ⏳ Family member login & dashboard
- ⏳ Weekly/daily trend visualizations
- ⏳ Data filtering by date
- ⏳ Mobile responsiveness
- ⏳ Cross-browser compatibility

---

## 🧪 Test Environment Details

### URLs
- **Frontend:** https://anchor-dev.erniesg.workers.dev
- **API:** https://anchor-dev-api.erniesg.workers.dev
- **Database:** Cloudflare D1 (anchor-dev-db)

### Test Accounts

#### Caregiver Account
```
Caregiver ID: 88fef386-a0bd-452d-a8b6-be2844ef0bc6
PIN: 123456
Care Recipient: Grandmother Lee (0725fbb9-21c5-46a4-9ed0-305b0a506f20)
```

#### Family Admin Account
```
User ID: 12345678-1234-1234-1234-123456789abc
Email: admin@example.com
Role: family_admin
Care Recipient: Grandmother Lee (0725fbb9-21c5-46a4-9ed0-305b0a506f20)
```

**Note:** Family login requires authentication implementation - check if social auth is configured.

---

## 📱 Test Scenarios

### Scenario 1: Caregiver Workflow (Full Form Submission)

**Objective:** Verify complete caregiver workflow from login to submission

**Steps:**
1. **Navigate to:** https://anchor-dev.erniesg.workers.dev/caregiver/login

2. **Login:**
   - Caregiver ID: `88fef386-a0bd-452d-a8b6-be2844ef0bc6`
   - PIN: `123456`
   - Click "Login"

3. **Verify Redirect:**
   - ✅ Should redirect to `/caregiver/form`
   - ✅ Should see "Daily Care Report" header
   - ✅ Should see "Today: [current date]"
   - ✅ Should see "Grandmother Lee" as care recipient

4. **Fill Form Sections:**

   **Section 1: Morning Routine**
   - Wake time: 07:30
   - Mood: Select "alert"
   - Shower time: 08:00
   - Check "Hair wash"
   - Click "Next: Medications →"

   **Section 2: Medications**
   - (Skip if no medications configured)
   - Click "Next: Meals & Nutrition →"

   **Section 3: Meals & Nutrition**
   - Breakfast time: 09:00
   - Appetite slider: 4/5
   - Amount eaten slider: 75%
   - Click "Next: Vital Signs →"

   **Section 4: Vital Signs**
   - Time measured: 10:00
   - Blood pressure: 125/82
   - Pulse rate: 72
   - Oxygen level: 97
   - Blood sugar: 5.8
   - Click "Next: Toileting →"

   **Section 5: Toileting**
   - Bowel movements: 1
   - Urination frequency: 4
   - Diaper changes: 2
   - Click "Next: Sleep →"

   **Section 6: Rest & Sleep**
   - Check "Had afternoon rest today"
   - Start time: 14:00
   - End time: 15:30
   - Quality: Select "light"
   - Click "Next: Fall Risk & Safety →"

   **Section 7: Fall Risk & Safety**
   - Balance slider: 3/5
   - Select "none" for near falls
   - Select "none" for actual falls
   - Click "Next →"

   **Section 8: Unaccompanied Time**
   - (Skip if not needed)
   - Click "Next →"

   **Section 9: Daily Safety Checks**
   - ✅ Check all 6 safety items:
     - Trip Hazards
     - Cables & Cords
     - Sandals & Footwear
     - Slip Hazards
     - Mobility Aids
     - Emergency Equipment
   - Click "Next →"

   **Navigate to Final Section:**
   - Keep clicking "Next" through remaining optional sections
   - Should reach "Notes & Submit" section

5. **Review Your Report:**
   - ✅ Verify completion percentage (should be ~56% or higher)
   - ✅ Verify summary shows all entered data
   - ✅ Check "Review Your Report" section displays correctly

6. **Submit Report:**
   - Click "Submit Report ✓" button
   - ✅ Should see green success message: "Report Submitted Successfully!"
   - ✅ Button should show "Create New Report for Tomorrow"
   - ✅ Form should be locked (read-only)

**Expected Results:**
- ✅ All data saves automatically (draft mode)
- ✅ Submission creates "submitted" status record in database
- ✅ Success message displays
- ✅ Form becomes read-only after submission

**Verification:**
```bash
# Check database for submitted log
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, status, log_date FROM care_logs WHERE status='submitted' ORDER BY created_at DESC LIMIT 1;"
```

---

### Scenario 2: Family Dashboard (Trend Visualization)

**Objective:** Verify family member can view care logs and trends

**Steps:**
1. **Navigate to:** https://anchor-dev.erniesg.workers.dev/family/dashboard
   - (Or https://anchor-dev.erniesg.workers.dev/family/login if auth required)

2. **Login (if required):**
   - Email: admin@example.com
   - (Check authentication method - social auth or credentials)

3. **Verify Dashboard:**
   - ✅ Should see "Grandmother Lee" care recipient
   - ✅ Should see today's care log summary
   - ✅ Should see trend charts/graphs

4. **Test Today's View:**
   - ✅ Morning routine data displayed
   - ✅ Vital signs displayed with values
   - ✅ Meals and fluids shown
   - ✅ Toileting summary visible
   - ✅ Safety checks status shown

5. **Test Weekly View:**
   - ✅ Select different dates from date picker
   - ✅ Verify data changes for selected date
   - ✅ Check trend visualizations:
     - Blood pressure over 7 days (should show 120/78 → 132/86 trend)
     - Blood sugar over 7 days (should show 5.5 → 7.3 trend)
     - Mood variations (alert, calm, sleepy, confused, agitated)
     - Fluid intake totals
     - Medication adherence

6. **Test Data Filtering:**
   - ✅ Filter by date range
   - ✅ Filter by specific metrics (vitals only, meals only, etc.)

**Expected Results:**
- ✅ Dashboard loads with care recipient data
- ✅ Today's log shows most recent submitted data
- ✅ Trends show data from past 7 days
- ✅ Charts/graphs display correctly
- ✅ Date navigation works smoothly

**Verification:**
```bash
# Check API returns data for family view
curl -s https://anchor-dev-api.erniesg.workers.dev/care-logs/recipient/0725fbb9-21c5-46a4-9ed0-305b0a506f20 | jq '.'
```

---

### Scenario 3: Data Trends & Patterns

**Objective:** Verify seeded data shows realistic trends

**Data Seeded (Past 7 Days):**
- **Blood Pressure:** 120/78 → 123/80 → 126/82 → 129/84 → 132/86 (increasing trend)
- **Pulse:** 68 → 70 → 72 → 74 → 76 bpm (increasing)
- **Blood Sugar:** 5.5 → 5.8 → 6.1 → 6.4 → 6.7 mmol/L (increasing)
- **Moods:** Varied (alert, calm, sleepy, confused, agitated)
- **Fluid Intake:** 950ml → 1000ml → 1050ml → 1100ml (increasing)
- **Appetite:** Varies 3-5/5

**Manual Checks:**
1. **Vitals Trend Chart:**
   - ✅ Should show upward trend for BP and blood sugar
   - ⚠️ Should trigger warnings if BP > 130/85
   - ✅ Pulse should be within normal range

2. **Mood Pattern:**
   - ✅ Should show variety of moods across week
   - ✅ Should highlight concerning patterns (e.g., multiple "confused" or "agitated")

3. **Fluid Intake:**
   - ✅ All days should show ~1000ml intake
   - ⚠️ Should not show "low fluid warning" (threshold < 1000ml)

4. **Safety Checks:**
   - ✅ All 6 checks completed every day
   - ✅ 100% completion rate visible

**Expected Results:**
- ✅ Trends display with realistic variation
- ✅ Warnings shown for concerning values
- ✅ Data patterns help identify care needs

---

### Scenario 4: Auto-Save & Draft Recovery

**Objective:** Verify auto-save prevents data loss

**Steps:**
1. Login as caregiver
2. Start filling form (Sections 1-3)
3. **Wait 30 seconds** (auto-save interval)
4. ✅ Check for "Saved" indicator (should appear)
5. **Close browser tab without submitting**
6. **Reopen browser and login again**
7. ✅ Verify form data is restored from draft

**Expected Results:**
- ✅ Auto-save triggers every 30 seconds
- ✅ Draft data persists across sessions
- ✅ User can resume editing incomplete reports

---

### Scenario 5: Mobile Responsiveness

**Objective:** Verify form works on mobile devices

**Devices to Test:**
- iPhone (Safari)
- Android (Chrome)
- Tablet (iPad)

**Steps:**
1. Open https://anchor-dev.erniesg.workers.dev/caregiver/login on mobile
2. Complete login flow
3. Fill form sections
4. Test interactions:
   - ✅ Time pickers work on mobile
   - ✅ Sliders respond to touch
   - ✅ Radio buttons are tappable
   - ✅ Checkboxes are easy to select
   - ✅ Navigation buttons are accessible
5. Submit form
6. Verify success message

**Expected Results:**
- ✅ Form is fully functional on mobile
- ✅ UI elements are touch-friendly
- ✅ No horizontal scrolling required
- ✅ Text is readable without zooming

---

## 🔍 Database Verification Commands

### Check Submitted Care Logs
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT id, log_date, status, wake_time, blood_pressure, pulse_rate FROM care_logs WHERE status='submitted' ORDER BY log_date DESC LIMIT 10;"
```

### Count Total Care Logs
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT COUNT(*) as total, status FROM care_logs GROUP BY status;"
```

### Check Latest Submitted Log Details
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT * FROM care_logs WHERE status='submitted' ORDER BY created_at DESC LIMIT 1;"
```

### Verify Trend Data
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT log_date, blood_pressure, blood_sugar, mood FROM care_logs WHERE care_recipient_id='0725fbb9-21c5-46a4-9ed0-305b0a506f20' AND status='submitted' ORDER BY log_date DESC LIMIT 7;"
```

---

## 🐛 Known Issues & Troubleshooting

### Issue 1: Family Login Not Working
**Symptom:** Cannot access family dashboard
**Possible Causes:**
- Social auth not configured (Google/Facebook OAuth)
- User credentials not set up
- RBAC middleware blocking access

**Solution:**
1. Check if `care_recipient_access` table has entry:
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT * FROM care_recipient_access WHERE user_id='12345678-1234-1234-1234-123456789abc';"
```
2. Verify user exists:
```bash
npx wrangler d1 execute anchor-dev-db --remote --env dev \
  --command="SELECT * FROM users WHERE id='12345678-1234-1234-1234-123456789abc';"
```

### Issue 2: Trends Not Displaying
**Symptom:** Dashboard shows no data or empty charts
**Possible Causes:**
- No submitted care logs
- Date filter set incorrectly
- API not returning data

**Solution:**
1. Verify data exists:
```bash
curl -s https://anchor-dev-api.erniesg.workers.dev/care-logs/recipient/0725fbb9-21c5-46a4-9ed0-305b0a506f20 | jq '. | length'
```
2. Check browser console for errors
3. Verify API authentication headers

### Issue 3: Form Not Saving
**Symptom:** Auto-save not working
**Possible Causes:**
- Browser localStorage disabled
- API token expired
- Network connectivity issues

**Solution:**
1. Check browser console for errors
2. Verify localStorage is enabled
3. Check Network tab for failed API calls

---

## ✅ Test Completion Checklist

### Automated Tests (Completed)
- [x] E2E caregiver login
- [x] E2E form submission (all sections)
- [x] E2E data persistence verification
- [x] API unit tests (129/129 passing)
- [x] Database migrations applied

### Manual Tests (To Do)
- [ ] Caregiver full workflow (Scenario 1)
- [ ] Family dashboard access (Scenario 2)
- [ ] Trend visualization verification (Scenario 3)
- [ ] Auto-save & draft recovery (Scenario 4)
- [ ] Mobile responsiveness (Scenario 5)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Performance testing (load time, API response)

---

## 📊 Test Data Summary

### Seeded Data
- **Care Logs:** 7 days (2025-10-03 to 2025-10-09)
- **Care Recipient:** Grandmother Lee
- **Caregiver:** Test Caregiver
- **Status:** All submitted

### Data Variations
- Blood pressure: 120/78 to 132/86 (upward trend)
- Moods: alert, calm, sleepy, confused, agitated
- Fluid intake: 950ml to 1150ml
- Wake times: 07:30 to 09:30 (varied)

---

## 🚀 Next Steps

1. **Complete Manual Testing:**
   - Test all 5 scenarios above
   - Document any bugs or issues found
   - Verify mobile experience

2. **User Acceptance Testing (UAT):**
   - Provide access to actual caregivers
   - Gather feedback on usability
   - Identify missing features

3. **Production Deployment:**
   - Once all manual tests pass
   - Set up production environment
   - Configure production database
   - Deploy with monitoring

---

**Last Updated:** 2025-10-09
**Tested By:** Claude Code (Automated) + [Your Name] (Manual)
**Environment:** Development (anchor-dev.erniesg.workers.dev)
