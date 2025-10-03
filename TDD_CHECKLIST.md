# Anchor - Test-Driven Development Checklist

> **Golden Rule**: Write test first (🔴 Red) → Implement code (🟢 Green) → Refactor (🔵 Blue) → Commit (📝)

---

## 📊 Progress Overview

**Target**: 12-week MVP delivery
**Current Phase**: Pre-Development
**Test Coverage Goal**: >90%

| Phase | Duration | Status | Test Coverage |
|-------|----------|--------|---------------|
| Phase 1: Foundation | Weeks 1-2 | ⬜ Not Started | Target: 95% |
| Phase 2: Core Features | Weeks 3-6 | ⬜ Not Started | Target: 92% |
| Phase 3: Dashboard & Analytics | Weeks 7-9 | ⬜ Not Started | Target: 90% |
| Phase 4: Polish & Testing | Weeks 10-12 | ⬜ Not Started | Target: 95% |

---

## Phase 1: Foundation (Weeks 1-2)

**Goal**: Set up infrastructure, database, and authentication

### Week 1: Project Setup & Database Schema

#### Day 1: Project Initialization
- [ ] **Setup**: Initialize monorepo with pnpm workspaces
  - [ ] 🔴 Test: Verify pnpm workspace structure
  - [ ] 🟢 Implement: Create `pnpm-workspace.yaml`
  - [ ] 📝 Commit: `chore: initialize monorepo with pnpm workspaces`

- [ ] **Setup**: Configure TypeScript (strict mode)
  - [ ] 🔴 Test: Verify TS config inheritance
  - [ ] 🟢 Implement: Create shared `tsconfig.json`
  - [ ] 📝 Commit: `chore: configure typescript with strict mode`

- [ ] **Setup**: Install and configure ESLint + Prettier
  - [ ] 🔴 Test: Verify linting rules work
  - [ ] 🟢 Implement: Add ESLint + Prettier configs
  - [ ] 📝 Commit: `chore: configure eslint and prettier`

- [ ] **Setup**: Configure Vitest for unit testing
  - [ ] 🔴 Test: Write sample test to verify setup
  - [ ] 🟢 Implement: Configure vitest.config.ts
  - [ ] 📝 Commit: `test: configure vitest for unit testing`

- [ ] **Setup**: Configure Playwright for E2E testing
  - [ ] 🔴 Test: Write sample E2E test
  - [ ] 🟢 Implement: Configure playwright.config.ts
  - [ ] 📝 Commit: `test: configure playwright for e2e testing`

#### Day 2: Database Schema - Users & Auth Tables
- [ ] **Database**: Create `users` table schema
  - [ ] 🔴 Test: Validate users table structure
  - [ ] 🟢 Implement: Define schema in Drizzle
  - [ ] 🔵 Refactor: Add indexes for email lookup
  - [ ] 📝 Commit: `feat(db): add users table schema`

- [ ] **Database**: Create `care_recipients` table schema
  - [ ] 🔴 Test: Validate foreign key to users
  - [ ] 🟢 Implement: Define schema with relationships
  - [ ] 🔵 Refactor: Add validation constraints
  - [ ] 📝 Commit: `feat(db): add care_recipients table schema`

- [ ] **Database**: Create `caregivers` table schema
  - [ ] 🔴 Test: Validate PIN field constraints
  - [ ] 🟢 Implement: Define schema with PIN auth
  - [ ] 🔵 Refactor: Add unique constraints
  - [ ] 📝 Commit: `feat(db): add caregivers table schema`

- [ ] **Database**: Generate and test migrations
  - [ ] 🔴 Test: Verify migrations run successfully
  - [ ] 🟢 Implement: Run `pnpm db:generate`
  - [ ] 📝 Commit: `chore(db): generate initial migrations`

#### Day 3: Database Schema - Care Logging Tables
- [ ] **Database**: Create `care_logs` table schema
  - [ ] 🔴 Test: Validate all required fields
  - [ ] 🟢 Implement: Define comprehensive schema
  - [ ] 🔵 Refactor: Add JSON field types
  - [ ] 📝 Commit: `feat(db): add care_logs table schema`

- [ ] **Database**: Create `medication_schedules` table
  - [ ] 🔴 Test: Validate time_slot enum
  - [ ] 🟢 Implement: Define medication schedule schema
  - [ ] 🔵 Refactor: Add frequency patterns
  - [ ] 📝 Commit: `feat(db): add medication_schedules schema`

- [ ] **Database**: Create `alerts` table schema
  - [ ] 🔴 Test: Validate severity levels
  - [ ] 🟢 Implement: Define alerts schema
  - [ ] 📝 Commit: `feat(db): add alerts table schema`

- [ ] **Database**: Create database client factory
  - [ ] 🔴 Test: Verify connection pooling
  - [ ] 🟢 Implement: Create reusable DB client
  - [ ] 📝 Commit: `feat(db): add database client factory`

#### Day 4: Shared Types & Validators
- [ ] **Shared**: Create TypeScript types for User
  - [ ] 🔴 Test: Validate type inference
  - [ ] 🟢 Implement: Define User type
  - [ ] 📝 Commit: `feat(shared): add user types`

- [ ] **Shared**: Create Zod schema for User validation
  - [ ] 🔴 Test: Test all validation rules
  - [ ] 🟢 Implement: Define Zod schema
  - [ ] 🔵 Refactor: Add custom error messages
  - [ ] 📝 Commit: `feat(shared): add user validation schema`

- [ ] **Shared**: Create types for CareRecipient
  - [ ] 🔴 Test: Validate nested types
  - [ ] 🟢 Implement: Define CareRecipient type
  - [ ] 📝 Commit: `feat(shared): add care recipient types`

- [ ] **Shared**: Create Zod schema for CareLog
  - [ ] 🔴 Test: Test complex JSON validation
  - [ ] 🟢 Implement: Define CareLog schema
  - [ ] 🔵 Refactor: Add conditional validation
  - [ ] 📝 Commit: `feat(shared): add care log validation schema`

- [ ] **Shared**: Create constants file (time slots, scales, etc.)
  - [ ] 🔴 Test: Verify constant exports
  - [ ] 🟢 Implement: Define all constants
  - [ ] 📝 Commit: `feat(shared): add shared constants`

#### Day 5: API Foundation - Hono Setup
- [ ] **API**: Initialize Hono app with basic routing
  - [ ] 🔴 Test: Test root endpoint returns 200
  - [ ] 🟢 Implement: Create Hono app in `apps/api/src/index.ts`
  - [ ] 📝 Commit: `feat(api): initialize hono app`

- [ ] **API**: Add CORS middleware
  - [ ] 🔴 Test: Verify CORS headers
  - [ ] 🟢 Implement: Configure CORS middleware
  - [ ] 📝 Commit: `feat(api): add cors middleware`

- [ ] **API**: Add logging middleware
  - [ ] 🔴 Test: Verify logs are captured
  - [ ] 🟢 Implement: Add request/response logger
  - [ ] 📝 Commit: `feat(api): add logging middleware`

- [ ] **API**: Add error handling middleware
  - [ ] 🔴 Test: Test error responses (400, 401, 500)
  - [ ] 🟢 Implement: Global error handler
  - [ ] 🔵 Refactor: Add error types
  - [ ] 📝 Commit: `feat(api): add error handling middleware`

- [ ] **API**: Configure Wrangler for D1 binding
  - [ ] 🔴 Test: Verify D1 connection in dev mode
  - [ ] 🟢 Implement: Update wrangler.toml
  - [ ] 📝 Commit: `chore(api): configure d1 database binding`

### Week 2: Authentication & Authorization

#### Day 6: Logto Integration
- [ ] **Auth**: Set up Logto self-hosted on Workers
  - [ ] 🔴 Test: Verify Logto endpoints respond
  - [ ] 🟢 Implement: Deploy Logto to Workers
  - [ ] 📝 Commit: `feat(auth): deploy logto authentication`

- [ ] **Auth**: Create JWT verification middleware
  - [ ] 🔴 Test: Test valid/invalid tokens
  - [ ] 🟢 Implement: JWT verification function
  - [ ] 🔵 Refactor: Add token refresh logic
  - [ ] 📝 Commit: `feat(auth): add jwt verification middleware`

- [ ] **Auth**: Implement family signup endpoint
  - [ ] 🔴 Test: POST /auth/signup with valid data
  - [ ] 🔴 Test: Reject duplicate emails
  - [ ] 🟢 Implement: POST /auth/signup route
  - [ ] 🔵 Refactor: Hash passwords properly
  - [ ] 📝 Commit: `feat(auth): add family signup endpoint`

- [ ] **Auth**: Implement family login endpoint
  - [ ] 🔴 Test: POST /auth/login with valid credentials
  - [ ] 🔴 Test: Reject invalid credentials
  - [ ] 🟢 Implement: POST /auth/login route
  - [ ] 📝 Commit: `feat(auth): add family login endpoint`

#### Day 7: Caregiver PIN Authentication
- [ ] **Auth**: Create caregiver PIN generation utility
  - [ ] 🔴 Test: Generate unique 6-digit PIN
  - [ ] 🟢 Implement: PIN generator function
  - [ ] 📝 Commit: `feat(auth): add pin generation utility`

- [ ] **Auth**: Implement caregiver PIN login
  - [ ] 🔴 Test: POST /auth/caregiver-login with PIN
  - [ ] 🔴 Test: Rate limit failed attempts (5/hour)
  - [ ] 🟢 Implement: PIN authentication endpoint
  - [ ] 🔵 Refactor: Add rate limiting
  - [ ] 📝 Commit: `feat(auth): add caregiver pin authentication`

- [ ] **Auth**: Create session token system for caregivers
  - [ ] 🔴 Test: Verify session expiry (24 hours)
  - [ ] 🟢 Implement: Session token generation
  - [ ] 📝 Commit: `feat(auth): add caregiver session tokens`

#### Day 8: Authorization Middleware
- [ ] **Auth**: Create role-based auth middleware
  - [ ] 🔴 Test: Verify family role access
  - [ ] 🔴 Test: Verify caregiver role access
  - [ ] 🟢 Implement: Role checking middleware
  - [ ] 📝 Commit: `feat(auth): add role-based authorization`

- [ ] **Auth**: Implement row-level security checks
  - [ ] 🔴 Test: Family can only see their recipients
  - [ ] 🔴 Test: Caregiver can only see assigned recipient
  - [ ] 🟢 Implement: RLS helper functions
  - [ ] 📝 Commit: `feat(auth): add row-level security`

- [ ] **Integration**: Write auth flow E2E test
  - [ ] 🔴 Test: Full signup → login → protected route flow
  - [ ] 🟢 Implement: Playwright E2E test
  - [ ] 📝 Commit: `test(e2e): add authentication flow test`

#### Day 9-10: Frontend Foundation
- [ ] **Frontend**: Initialize Vite + React app
  - [ ] 🔴 Test: Verify app renders
  - [ ] 🟢 Implement: Create React app in `apps/web/`
  - [ ] 📝 Commit: `feat(web): initialize react app`

- [ ] **Frontend**: Configure Tailwind CSS v4
  - [ ] 🔴 Test: Verify Tailwind classes work
  - [ ] 🟢 Implement: Install and configure Tailwind
  - [ ] 📝 Commit: `feat(web): configure tailwind css`

- [ ] **Frontend**: Set up TanStack Router
  - [ ] 🔴 Test: Test route navigation
  - [ ] 🟢 Implement: Configure file-based routing
  - [ ] 📝 Commit: `feat(web): configure tanstack router`

- [ ] **Frontend**: Set up TanStack Query
  - [ ] 🔴 Test: Test query caching
  - [ ] 🟢 Implement: Configure Query client
  - [ ] 📝 Commit: `feat(web): configure tanstack query`

- [ ] **Frontend**: Create API client service
  - [ ] 🔴 Test: Test fetch wrapper with auth
  - [ ] 🟢 Implement: API client with JWT handling
  - [ ] 🔵 Refactor: Add retry logic
  - [ ] 📝 Commit: `feat(web): add api client service`

- [ ] **Frontend**: Create reusable UI components
  - [ ] 🔴 Test: Test Button component variants
  - [ ] 🟢 Implement: Button, Input, Card components
  - [ ] 📝 Commit: `feat(web): add ui component library`

- [ ] **Frontend**: Configure PWA plugin
  - [ ] 🔴 Test: Verify service worker registration
  - [ ] 🟢 Implement: Vite PWA plugin setup
  - [ ] 📝 Commit: `feat(web): configure pwa support`

---

## Phase 2: Core Features (Weeks 3-6)

**Goal**: Implement family onboarding and caregiver form system

### Week 3: Family Onboarding Flow

#### Day 11: Family Signup UI
- [ ] **Frontend**: Create signup page UI
  - [ ] 🔴 Test: Test form validation
  - [ ] 🟢 Implement: Signup form with React Hook Form
  - [ ] 📝 Commit: `feat(web): add family signup page`

- [ ] **Frontend**: Integrate signup with API
  - [ ] 🔴 Test: Test successful signup flow
  - [ ] 🔴 Test: Test error handling
  - [ ] 🟢 Implement: Connect form to POST /auth/signup
  - [ ] 📝 Commit: `feat(web): integrate signup with api`

- [ ] **Frontend**: Create login page UI
  - [ ] 🔴 Test: Test login form
  - [ ] 🟢 Implement: Login form
  - [ ] 📝 Commit: `feat(web): add family login page`

#### Day 12: Add Care Recipient Flow
- [ ] **API**: Create POST /care-recipients endpoint
  - [ ] 🔴 Test: Test recipient creation
  - [ ] 🔴 Test: Verify auth required
  - [ ] 🟢 Implement: Care recipient creation
  - [ ] 📝 Commit: `feat(api): add care recipient creation endpoint`

- [ ] **API**: Create GET /care-recipients endpoint
  - [ ] 🔴 Test: Test listing recipients
  - [ ] 🔴 Test: Test RLS (only family's recipients)
  - [ ] 🟢 Implement: List recipients endpoint
  - [ ] 📝 Commit: `feat(api): add care recipients list endpoint`

- [ ] **Frontend**: Create "Add Recipient" form
  - [ ] 🔴 Test: Test form validation (name, DOB, condition)
  - [ ] 🟢 Implement: Multi-step form with React Hook Form
  - [ ] 🔵 Refactor: Add PSP-specific fields
  - [ ] 📝 Commit: `feat(web): add care recipient form`

#### Day 13: Create Caregiver Account Flow
- [ ] **API**: Create POST /caregivers endpoint
  - [ ] 🔴 Test: Test caregiver creation
  - [ ] 🔴 Test: Verify PIN generation
  - [ ] 🟢 Implement: Caregiver account creation
  - [ ] 📝 Commit: `feat(api): add caregiver creation endpoint`

- [ ] **API**: Create GET /caregivers/:id/qr endpoint
  - [ ] 🔴 Test: Test QR code generation
  - [ ] 🟢 Implement: QR code with caregiver ID + PIN
  - [ ] 📝 Commit: `feat(api): add caregiver qr code generation`

- [ ] **Frontend**: Create "Add Caregiver" form
  - [ ] 🔴 Test: Test caregiver creation flow
  - [ ] 🟢 Implement: Caregiver form with PIN display
  - [ ] 📝 Commit: `feat(web): add caregiver creation form`

- [ ] **Frontend**: Display QR code + PIN
  - [ ] 🔴 Test: Test QR code rendering
  - [ ] 🟢 Implement: QR code display component
  - [ ] 📝 Commit: `feat(web): add qr code display for caregiver`

#### Day 14: Medication Schedule Setup
- [ ] **API**: Create POST /medication-schedules endpoint
  - [ ] 🔴 Test: Test schedule creation
  - [ ] 🔴 Test: Validate time slots
  - [ ] 🟢 Implement: Medication schedule CRUD
  - [ ] 📝 Commit: `feat(api): add medication schedule endpoints`

- [ ] **Frontend**: Create medication schedule wizard
  - [ ] 🔴 Test: Test adding multiple medications
  - [ ] 🟢 Implement: Multi-medication form
  - [ ] 🔵 Refactor: Add pre-filled templates (PSP)
  - [ ] 📝 Commit: `feat(web): add medication schedule wizard`

#### Day 15: Onboarding E2E Test
- [ ] **E2E**: Write complete onboarding flow test
  - [ ] 🔴 Test: Signup → Add recipient → Add caregiver → Schedule meds
  - [ ] 🟢 Implement: Playwright test
  - [ ] 📝 Commit: `test(e2e): add family onboarding flow test`

### Week 4: Caregiver Form System (Part 1)

#### Day 16: Caregiver Login UI
- [ ] **Frontend**: Create caregiver PIN login page
  - [ ] 🔴 Test: Test 6-digit PIN input
  - [ ] 🟢 Implement: PIN pad UI (mobile-optimized)
  - [ ] 📝 Commit: `feat(web): add caregiver pin login page`

- [ ] **Frontend**: Integrate with PIN auth API
  - [ ] 🔴 Test: Test login success/failure
  - [ ] 🟢 Implement: Connect to POST /auth/caregiver-login
  - [ ] 📝 Commit: `feat(web): integrate caregiver pin authentication`

#### Day 17: Form Builder Components
- [ ] **Frontend**: Create ScaleSelector component (1-5)
  - [ ] 🔴 Test: Test scale selection + tooltips
  - [ ] 🟢 Implement: Interactive scale buttons
  - [ ] 📝 Commit: `feat(web): add scale selector component`

- [ ] **Frontend**: Create TimeInput component
  - [ ] 🔴 Test: Test time validation
  - [ ] 🟢 Implement: Mobile-friendly time picker
  - [ ] 📝 Commit: `feat(web): add time input component`

- [ ] **Frontend**: Create CheckboxGroup component
  - [ ] 🔴 Test: Test multi-select
  - [ ] 🟢 Implement: Styled checkbox group
  - [ ] 📝 Commit: `feat(web): add checkbox group component`

- [ ] **Frontend**: Create ConditionalField wrapper
  - [ ] 🔴 Test: Test show/hide based on condition
  - [ ] 🟢 Implement: Conditional rendering logic
  - [ ] 📝 Commit: `feat(web): add conditional field wrapper`

#### Day 18-19: Morning Routine Section
- [ ] **API**: Create POST /care-logs/morning endpoint
  - [ ] 🔴 Test: Test morning data submission
  - [ ] 🔴 Test: Validate required fields
  - [ ] 🟢 Implement: Morning routine logging
  - [ ] 📝 Commit: `feat(api): add morning routine logging endpoint`

- [ ] **Frontend**: Create morning routine form
  - [ ] 🔴 Test: Test wake time, mood, shower fields
  - [ ] 🟢 Implement: Morning routine form section
  - [ ] 🔵 Refactor: Add auto-save (every 30s)
  - [ ] 📝 Commit: `feat(web): add morning routine form`

- [ ] **Frontend**: Add form progress indicator
  - [ ] 🔴 Test: Test progress calculation
  - [ ] 🟢 Implement: Progress bar component
  - [ ] 📝 Commit: `feat(web): add form progress indicator`

#### Day 20: Medication Logging Section
- [ ] **Frontend**: Create medication checklist component
  - [ ] 🔴 Test: Test medication selection + time
  - [ ] 🟢 Implement: Medication logging table
  - [ ] 🔵 Refactor: Load from schedule
  - [ ] 📝 Commit: `feat(web): add medication logging component`

- [ ] **Frontend**: Add conditional "missed medication" field
  - [ ] 🔴 Test: Test conditional display
  - [ ] 🟢 Implement: Show reasons when unchecked
  - [ ] 📝 Commit: `feat(web): add missed medication tracking`

### Week 5: Caregiver Form System (Part 2)

#### Day 21-22: Meals & Nutrition Section
- [ ] **API**: Extend care-logs with meals data
  - [ ] 🔴 Test: Test meal data validation
  - [ ] 🟢 Implement: Update schema + endpoint
  - [ ] 📝 Commit: `feat(api): add meals nutrition logging`

- [ ] **Frontend**: Create meal logging form
  - [ ] 🔴 Test: Test appetite scale, amount eaten
  - [ ] 🟢 Implement: Meals form with scales
  - [ ] 📝 Commit: `feat(web): add meal logging form`

- [ ] **Frontend**: Add beverage/fluid tracking table
  - [ ] 🔴 Test: Test fluid total calculation
  - [ ] 🟢 Implement: Fluid intake table
  - [ ] 🔵 Refactor: Auto-calculate total
  - [ ] 📝 Commit: `feat(web): add fluid tracking table`

- [ ] **Frontend**: Add swallowing issues checkboxes
  - [ ] 🔴 Test: Test choking alert trigger
  - [ ] 🟢 Implement: Swallowing issues tracking
  - [ ] 📝 Commit: `feat(web): add swallowing issues tracking`

#### Day 23: Vital Signs Section
- [ ] **API**: Add vitals data to care-logs
  - [ ] 🔴 Test: Test BP, pulse, O2, blood sugar validation
  - [ ] 🟢 Implement: Vitals logging
  - [ ] 📝 Commit: `feat(api): add vitals logging`

- [ ] **Frontend**: Create vitals form
  - [ ] 🔴 Test: Test BP format (120/80)
  - [ ] 🟢 Implement: Vitals input form
  - [ ] 🔵 Refactor: Add range validation warnings
  - [ ] 📝 Commit: `feat(web): add vitals logging form`

#### Day 24-25: Toileting & Safety Sections
- [ ] **API**: Add toileting data to care-logs
  - [ ] 🔴 Test: Test toileting data structure
  - [ ] 🟢 Implement: Toileting logging
  - [ ] 📝 Commit: `feat(api): add toileting logging`

- [ ] **Frontend**: Create toileting form
  - [ ] 🔴 Test: Test frequency, consistency, pain fields
  - [ ] 🟢 Implement: Comprehensive toileting form
  - [ ] 📝 Commit: `feat(web): add toileting form`

- [ ] **API**: Add fall/safety data to care-logs
  - [ ] 🔴 Test: Test fall incident validation
  - [ ] 🟢 Implement: Safety incident logging
  - [ ] 📝 Commit: `feat(api): add safety incident logging`

- [ ] **Frontend**: Create fall risk assessment form
  - [ ] 🔴 Test: Test balance scale (1-5)
  - [ ] 🔴 Test: Test walking pattern checkboxes
  - [ ] 🟢 Implement: Fall risk form
  - [ ] 📝 Commit: `feat(web): add fall risk assessment form`

### Week 6: Emergency System & Form Completion

#### Day 26: Emergency Button
- [ ] **API**: Create POST /alerts/emergency endpoint
  - [ ] 🔴 Test: Test emergency alert creation
  - [ ] 🔴 Test: Verify family notification trigger
  - [ ] 🟢 Implement: Emergency alert system
  - [ ] 📝 Commit: `feat(api): add emergency alert endpoint`

- [ ] **Frontend**: Create emergency button component
  - [ ] 🔴 Test: Test confirmation dialog
  - [ ] 🟢 Implement: Large red emergency button
  - [ ] 📝 Commit: `feat(web): add emergency button`

- [ ] **Frontend**: Add emergency notification (family)
  - [ ] 🔴 Test: Test real-time notification display
  - [ ] 🟢 Implement: Alert banner on family dashboard
  - [ ] 📝 Commit: `feat(web): add emergency notification banner`

#### Day 27-28: Form Auto-Save & Offline Mode
- [ ] **Frontend**: Implement form auto-save
  - [ ] 🔴 Test: Test auto-save every 30s
  - [ ] 🟢 Implement: useAutoSave hook
  - [ ] 📝 Commit: `feat(web): add form auto-save`

- [ ] **Frontend**: Add offline mode with local storage
  - [ ] 🔴 Test: Test offline form submission
  - [ ] 🟢 Implement: Service worker + IndexedDB
  - [ ] 🔵 Refactor: Sync when online
  - [ ] 📝 Commit: `feat(web): add offline mode support`

- [ ] **Frontend**: Add submission success/error handling
  - [ ] 🔴 Test: Test success toast
  - [ ] 🔴 Test: Test error retry
  - [ ] 🟢 Implement: Toast notifications
  - [ ] 📝 Commit: `feat(web): add form submission feedback`

#### Day 29-30: Form Integration E2E Tests
- [ ] **E2E**: Caregiver complete form test
  - [ ] 🔴 Test: Login → Fill all sections → Submit
  - [ ] 🟢 Implement: Playwright test
  - [ ] 📝 Commit: `test(e2e): add caregiver form completion test`

- [ ] **E2E**: Emergency button test
  - [ ] 🔴 Test: Click emergency → Family sees alert
  - [ ] 🟢 Implement: Playwright test
  - [ ] 📝 Commit: `test(e2e): add emergency alert test`

---

## Phase 3: Dashboard & Analytics (Weeks 7-9)

**Goal**: Build family dashboard with trend analysis

### Week 7: Dashboard Foundation

#### Day 31-32: Dashboard Layout & API
- [x] **Frontend**: Create dashboard layout
  - [x] 🔴 Test: Test responsive grid
  - [x] 🟢 Implement: Card-based dashboard layout
  - [x] 📝 Commit: `feat(web): add dashboard 3-mode view toggle`

- [x] **Frontend**: Create header with view modes
  - [x] 🟢 Implement: 3-mode toggle (Today/Week/Month)
  - [x] 🟢 Implement: Mon-Sun week navigation
  - [x] 📝 Commit: `feat(web): add dashboard header with view modes`

- [x] **Frontend**: Implement Mon-Sun week logic
  - [x] 🟢 Implement: Week calculation using date-fns
  - [x] 🟢 Implement: Week navigation controls (← →)
  - [x] 📝 Commit: `feat(web): add week navigation with mon-sun logic`

- [ ] **API**: Create GET /dashboard/:recipientId endpoint
  - [ ] 🔴 Test: Test dashboard data aggregation
  - [ ] 🔴 Test: Verify RLS (only family access)
  - [ ] 🟢 Implement: Dashboard data service
  - [ ] 🔵 Refactor: Add caching (30s)
  - [ ] 📝 Commit: `feat(api): add dashboard endpoint`

#### Day 33-34: Medication Card
- [ ] **API**: Create GET /analytics/medications endpoint
  - [ ] 🔴 Test: Test 7-day compliance calculation
  - [ ] 🟢 Implement: Medication analytics
  - [ ] 📝 Commit: `feat(api): add medication analytics endpoint`

- [ ] **Frontend**: Create medication card component
  - [ ] 🔴 Test: Test medication checklist display
  - [ ] 🟢 Implement: Medication card UI
  - [ ] 📝 Commit: `feat(web): add medication card`

- [ ] **Frontend**: Add 7-day compliance chart
  - [ ] 🔴 Test: Test chart data rendering
  - [ ] 🟢 Implement: Recharts bar chart
  - [ ] 📝 Commit: `feat(web): add medication compliance chart`

#### Day 35: Meals & Nutrition Card
- [ ] **API**: Create GET /analytics/nutrition endpoint
  - [ ] 🔴 Test: Test appetite trend calculation
  - [ ] 🟢 Implement: Nutrition analytics
  - [ ] 📝 Commit: `feat(api): add nutrition analytics endpoint`

- [ ] **Frontend**: Create meals card component
  - [ ] 🔴 Test: Test appetite score display
  - [ ] 🟢 Implement: Meals card with stats
  - [ ] 📝 Commit: `feat(web): add meals nutrition card`

### Week 8: Trend Analysis & Charts

#### Day 36-37: Vital Signs Trend Charts (✅ COMPLETED 2025-10-03)
- [x] **Frontend**: Add Blood Pressure trend chart
  - [x] 🟢 Implement: Dual-line chart (systolic/diastolic)
  - [x] 🟢 Implement: Recharts with proper axes (60-180 mmHg)
  - [x] 📝 Commit: `feat(web): add blood pressure trend chart`

- [x] **Frontend**: Add Pulse & Oxygen trend chart
  - [x] 🟢 Implement: Dual-axis line chart
  - [x] 🟢 Implement: Left axis (pulse 50-120), Right axis (O2 90-100)
  - [x] 📝 Commit: `feat(web): add pulse and oxygen trend chart`

- [x] **Frontend**: Add Blood Sugar trend chart
  - [x] 🟢 Implement: Single-line chart (4-10 mmol/L)
  - [x] 📝 Commit: `feat(web): add blood sugar trend chart`

- [x] **Frontend**: Add Appetite & Consumption chart
  - [x] 🟢 Implement: Dual-axis bar chart (appetite 1-5, consumption 0-100%)
  - [x] 📝 Commit: `feat(web): add appetite and consumption chart`

- [x] **Frontend**: Implement week data fetching
  - [x] 🟢 Implement: Fetch all 7 days (Mon-Sun) with TanStack Query
  - [x] 🟢 Implement: Data transformation for charts
  - [x] 🟢 Implement: Empty states for missing data
  - [x] 📝 Commit: `feat(web): add week data fetching and transformation`

- [ ] **API**: Create GET /analytics/vitals endpoint
  - [ ] 🔴 Test: Test 7-day vitals data aggregation
  - [ ] 🟢 Implement: Vitals analytics service
  - [ ] 📝 Commit: `feat(api): add vitals analytics endpoint`

#### Day 38: Safety & Incidents Card
- [ ] **API**: Create GET /analytics/safety endpoint
  - [ ] 🔴 Test: Test fall incidents aggregation
  - [ ] 🟢 Implement: Safety analytics
  - [ ] 📝 Commit: `feat(api): add safety analytics endpoint`

- [ ] **Frontend**: Create safety card component
  - [ ] 🔴 Test: Test fall count display
  - [ ] 🟢 Implement: Safety card UI
  - [ ] 📝 Commit: `feat(web): add safety incidents card`

#### Day 39-40: Alert System
- [ ] **API**: Create alert detection service
  - [ ] 🔴 Test: Test missed medication detection
  - [ ] 🔴 Test: Test vital signs anomaly detection
  - [ ] 🔴 Test: Test fall risk increase detection
  - [ ] 🟢 Implement: Alert generation logic
  - [ ] 📝 Commit: `feat(api): add alert detection service`

- [ ] **API**: Create GET /alerts endpoint
  - [ ] 🔴 Test: Test alert listing
  - [ ] 🟢 Implement: Alerts endpoint with filters
  - [ ] 📝 Commit: `feat(api): add alerts list endpoint`

- [ ] **Frontend**: Create alerts banner component
  - [ ] 🔴 Test: Test alert severity colors
  - [ ] 🟢 Implement: Alert banner UI
  - [ ] 📝 Commit: `feat(web): add alerts banner`

- [ ] **Frontend**: Add alert acknowledgment
  - [ ] 🔴 Test: Test dismiss alert
  - [ ] 🟢 Implement: PATCH /alerts/:id/acknowledge
  - [ ] 📝 Commit: `feat(web): add alert acknowledgment`

### Week 9: Reports & Dashboard Polish

#### Day 41-42: PDF Report Generation
- [ ] **API**: Create PDF generation service
  - [ ] 🔴 Test: Test PDF generation with mock data
  - [ ] 🟢 Implement: Daily report PDF generator
  - [ ] 📝 Commit: `feat(api): add pdf generation service`

- [ ] **API**: Create POST /reports/daily endpoint
  - [ ] 🔴 Test: Test report generation
  - [ ] 🟢 Implement: Generate and store in R2
  - [ ] 📝 Commit: `feat(api): add daily report generation endpoint`

- [ ] **Frontend**: Add "Generate Report" button
  - [ ] 🔴 Test: Test report download
  - [ ] 🟢 Implement: Report generation UI
  - [ ] 📝 Commit: `feat(web): add report generation button`

#### Day 43-44: Real-time Updates
- [ ] **Frontend**: Implement polling for dashboard
  - [ ] 🔴 Test: Test 30s polling interval
  - [ ] 🟢 Implement: TanStack Query refetchInterval
  - [ ] 📝 Commit: `feat(web): add dashboard auto-refresh`

- [ ] **Frontend**: Add "Last updated" timestamp
  - [ ] 🔴 Test: Test timestamp display
  - [ ] 🟢 Implement: Timestamp component
  - [ ] 📝 Commit: `feat(web): add last updated timestamp`

#### Day 45: Dashboard E2E Tests
- [ ] **E2E**: Complete dashboard flow test
  - [ ] 🔴 Test: Login → View dashboard → Check trends → Export report
  - [ ] 🟢 Implement: Playwright test
  - [ ] 📝 Commit: `test(e2e): add dashboard flow test`

---

## Phase 4: Polish & Testing (Weeks 10-12)

**Goal**: Refine UX, performance optimization, comprehensive testing

### Week 10: UX Polish & Mobile Optimization

#### Day 46-47: Mobile Responsiveness
- [ ] **Frontend**: Audit mobile layouts (all pages)
  - [ ] 🔴 Test: Test on iPhone SE, iPhone 14, Android
  - [ ] 🟢 Implement: Fix responsive issues
  - [ ] 📝 Commit: `fix(web): improve mobile responsiveness`

- [ ] **Frontend**: Optimize touch targets (48px min)
  - [ ] 🔴 Test: Test button tap accuracy
  - [ ] 🟢 Implement: Increase button sizes on mobile
  - [ ] 📝 Commit: `feat(web): optimize touch targets for mobile`

- [ ] **Frontend**: Add haptic feedback (mobile)
  - [ ] 🔴 Test: Test vibration on actions
  - [ ] 🟢 Implement: Vibration API integration
  - [ ] 📝 Commit: `feat(web): add haptic feedback`

#### Day 48-49: Performance Optimization
- [ ] **Frontend**: Run Lighthouse audit
  - [ ] 🔴 Test: Target score >90
  - [ ] 🟢 Implement: Fix performance issues
  - [ ] 📝 Commit: `perf(web): optimize lighthouse score`

- [ ] **Frontend**: Optimize bundle size
  - [ ] 🔴 Test: Target <200KB gzipped
  - [ ] 🟢 Implement: Code splitting, tree shaking
  - [ ] 📝 Commit: `perf(web): reduce bundle size`

- [ ] **API**: Add response caching
  - [ ] 🔴 Test: Test cache headers
  - [ ] 🟢 Implement: Cache-Control headers
  - [ ] 📝 Commit: `perf(api): add response caching`

#### Day 50: Accessibility Audit
- [ ] **Frontend**: Run accessibility audit (axe/WAVE)
  - [ ] 🔴 Test: WCAG 2.1 AA compliance
  - [ ] 🟢 Implement: Fix a11y issues
  - [ ] 📝 Commit: `a11y(web): fix accessibility issues`

### Week 11: Comprehensive Testing

#### Day 51-52: Unit Test Coverage
- [ ] **All**: Audit test coverage
  - [ ] 🔴 Test: Verify >90% coverage
  - [ ] 🟢 Implement: Add missing unit tests
  - [ ] 📝 Commit: `test: increase unit test coverage to 90%`

- [ ] **Database**: Test all schema constraints
  - [ ] 🔴 Test: Foreign keys, unique constraints, indexes
  - [ ] 🟢 Implement: Comprehensive schema tests
  - [ ] 📝 Commit: `test(db): add schema constraint tests`

#### Day 53-54: Integration Testing
- [ ] **API**: Test all endpoints with auth
  - [ ] 🔴 Test: All CRUD operations
  - [ ] 🔴 Test: Error cases (401, 403, 404, 500)
  - [ ] 🟢 Implement: Integration tests
  - [ ] 📝 Commit: `test(api): add comprehensive integration tests`

#### Day 55-56: E2E Testing Suite
- [ ] **E2E**: Write missing E2E tests
  - [ ] 🔴 Test: All critical user flows
  - [ ] 🟢 Implement: Complete E2E test suite
  - [ ] 📝 Commit: `test(e2e): complete e2e test suite`

- [ ] **E2E**: Add visual regression tests
  - [ ] 🔴 Test: Screenshot comparison
  - [ ] 🟢 Implement: Playwright screenshot tests
  - [ ] 📝 Commit: `test(e2e): add visual regression tests`

### Week 12: Production Readiness

#### Day 57-58: Security Audit
- [ ] **Security**: Run security scan (npm audit)
  - [ ] 🔴 Test: Zero high/critical vulnerabilities
  - [ ] 🟢 Implement: Update dependencies
  - [ ] 📝 Commit: `chore: update dependencies for security`

- [ ] **Security**: Test rate limiting
  - [ ] 🔴 Test: Verify all endpoints have rate limits
  - [ ] 🟢 Implement: Add missing rate limits
  - [ ] 📝 Commit: `feat(api): add rate limiting to all endpoints`

- [ ] **Security**: Test input validation
  - [ ] 🔴 Test: SQL injection, XSS attempts
  - [ ] 🟢 Implement: Fix validation gaps
  - [ ] 📝 Commit: `fix(api): strengthen input validation`

#### Day 59: Monitoring & Error Tracking
- [ ] **Infra**: Set up Sentry error tracking
  - [ ] 🔴 Test: Verify errors are captured
  - [ ] 🟢 Implement: Sentry integration
  - [ ] 📝 Commit: `feat: add sentry error tracking`

- [ ] **Infra**: Set up Cloudflare Analytics
  - [ ] 🔴 Test: Verify metrics collection
  - [ ] 🟢 Implement: Enable analytics
  - [ ] 📝 Commit: `feat: enable cloudflare analytics`

#### Day 60: Deployment & Launch Prep
- [ ] **Infra**: Configure production environment
  - [ ] 🔴 Test: Deploy to staging
  - [ ] 🟢 Implement: Production Wrangler config
  - [ ] 📝 Commit: `chore: configure production environment`

- [ ] **Infra**: Set up CI/CD pipeline
  - [ ] 🔴 Test: Verify auto-deploy on push
  - [ ] 🟢 Implement: GitHub Actions workflow
  - [ ] 📝 Commit: `chore: add ci/cd pipeline`

- [ ] **Docs**: Write deployment documentation
  - [ ] 🟢 Implement: Update DEPLOYMENT.md
  - [ ] 📝 Commit: `docs: add deployment guide`

- [ ] **Final**: Run full regression test suite
  - [ ] 🔴 Test: All tests pass (unit + integration + e2e)
  - [ ] 🟢 Implement: Fix any failures
  - [ ] 📝 Commit: `test: verify all tests pass for launch`

---

## 🎯 MVP Completion Checklist

### Technical Requirements
- [ ] Test coverage >90% (measured by Vitest)
- [ ] All E2E tests passing (Playwright)
- [ ] Zero high/critical security vulnerabilities
- [ ] Lighthouse score >90 (Performance, Accessibility, Best Practices, SEO)
- [ ] PWA installable on iOS + Android
- [ ] API response time <500ms (p95)
- [ ] Dashboard load time <2s

### Feature Completeness
- [ ] Family signup/login working
- [ ] Add care recipient working
- [ ] Create caregiver account working (with PIN)
- [ ] Caregiver PIN login working
- [ ] All 6 core form sections working:
  - [ ] Morning routine
  - [ ] Medications (all time slots)
  - [ ] Meals & nutrition
  - [ ] Vital signs
  - [ ] Toileting
  - [ ] Safety & incidents
- [ ] Emergency button working (instant notification)
- [ ] Form auto-save working (30s interval)
- [ ] Offline mode working (IndexedDB sync)
- [ ] Family dashboard displaying all cards
- [ ] 7-day trend analysis working (meds + vitals)
- [ ] Alert system working (missed meds, falls, vitals)
- [ ] PDF report generation working
- [ ] Mobile responsive on iOS + Android

### User Validation (3 Pilot Families)
- [ ] Family can complete onboarding in <5 minutes
- [ ] Caregiver can complete form in <10 minutes
- [ ] Family checks dashboard >2x/day
- [ ] Medication compliance tracking >90%
- [ ] Emergency button response <30 seconds
- [ ] User satisfaction (NPS) >50

### Documentation
- [ ] README.md complete
- [ ] API.md documented (all endpoints)
- [ ] DEPLOYMENT.md complete
- [ ] User guide written (for families)
- [ ] Caregiver guide written (simple instructions)

---

## 📝 Daily Commit Checklist

Use this for every commit:

- [ ] ✅ Tests written and passing
- [ ] ✅ Code linted (pnpm lint)
- [ ] ✅ Types checked (pnpm typecheck)
- [ ] ✅ Commit message follows convention
- [ ] ✅ No console.logs left in code
- [ ] ✅ No commented-out code
- [ ] ✅ Changes are atomic (one logical change)

---

## 🎓 TDD Reminders

**Before coding anything:**
1. Write the test first (🔴 Red)
2. Run the test - it should fail
3. Write minimal code to pass (🟢 Green)
4. Run the test - it should pass
5. Refactor if needed (🔵 Blue)
6. Run tests again - all should pass
7. Commit with descriptive message (📝)

**Never:**
- ❌ Write code before writing test
- ❌ Skip tests because "it's simple"
- ❌ Commit without running tests
- ❌ Push code with failing tests

**Always:**
- ✅ Write test first
- ✅ Commit after each TDD cycle
- ✅ Push daily (end of day)
- ✅ Keep tests fast (<1s per test)

---

## 🏆 Success Metrics Tracking

Track these weekly:

| Metric | Target | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 | Week 7 | Week 8 | Week 9 | Week 10 | Week 11 | Week 12 |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|---------|---------|---------|
| Test Coverage | >90% | | | | | | | | | | | | |
| Tests Passing | 100% | | | | | | | | | | | | |
| Commits/Day | 8-12 | | | | | | | | | | | | |
| Open Bugs | <5 | | | | | | | | | | | | |
| Lighthouse Score | >90 | | | | | | | | | | | | |

---

**Remember**: Write test → See it fail → Make it pass → Refactor → Commit → Repeat 🔄

Let's build this right! 🚀