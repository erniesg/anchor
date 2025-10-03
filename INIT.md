# Project Anchor - Initialization Guide

> **Mission**: "Structure for Sanity, Connection for the Heart"
> A caregiving coordination platform that transforms chaos into clarity for families managing eldercare with foreign domestic workers (FDW).

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [The Problem We're Solving](#the-problem-were-solving)
3. [MVP Definition](#mvp-definition)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Getting Started](#getting-started)
7. [Development Workflow](#development-workflow)
8. [Project Structure](#project-structure)
9. [Key Principles](#key-principles)
10. [Success Metrics](#success-metrics)

---

## 🎯 Project Overview

**What**: A Progressive Web App (PWA) that enables caregivers (FDW) to log daily care activities via simple mobile forms, while families access real-time dashboards with trend analysis and alerts.

**Who**:
- **Primary Users**: Adult children (35-55) in Singapore managing elderly parents remotely
- **Secondary Users**: Foreign domestic workers providing hands-on care
- **Care Recipients**: Elderly individuals with progressive conditions (starting with PSP - Progressive Supranuclear Palsy)

**When**: MVP launch target Q2 2025 (12 weeks from start)

**Where**: Singapore/Malaysia initially, Southeast Asia expansion

---

## 🔥 The Problem We're Solving

### The "Remote Manager" Burden

By 2026, 1 in 5 Singaporeans will be over 65. Families are scattered globally, and the default eldercare solution is a Foreign Domestic Worker managed remotely by an adult child who is:

- **Overwhelmed**: Random WhatsApp messages, panicked calls, no structured information
- **Anxious**: Constant low-grade fear of crisis calls during work meetings
- **Disconnected**: Operating as "remote administrator" instead of loving family member
- **Blind**: No visibility into weekday care ("weekday black hole")
- **Burnt Out**: Cognitive load at 200%, juggling career + kids + eldercare

### What We're Building

A **calm, structured system** that:
1. ✅ Reduces cognitive load (offloads mental tracking work)
2. ✅ Provides single source of truth (no more WhatsApp chaos)
3. ✅ Enables proactive care (spot trends before crises)
4. ✅ Extends home care duration (delays nursing home placement)
5. ✅ Preserves human connection (less admin, more emotional presence)

---

## 🎯 MVP Definition

### Core User Flows (Must-Have)

#### 1. Family Onboarding (5 minutes)
```
Sign up → Add care recipient → Create caregiver account (with PIN) → Done
```

#### 2. Caregiver Daily Logging (<10 minutes)
```
PIN login → Fill smart form → Submit → Family sees update
```
**Sections (MVP):**
- Morning routine (wake time, mood, shower)
- Medications (all time slots: before/after meals)
- Meals & nutrition (appetite, amount eaten, swallowing issues)
- Vital signs (BP, pulse, O2, blood sugar)
- Toileting (frequency, accidents, pain)
- Safety & incidents (falls, emergency button)

#### 3. Family Dashboard (At-a-glance peace of mind)
```
View today's summary → Check trends (7 days) → Receive alerts → Export report
```
**Cards:**
- Medications (compliance tracking)
- Meals & Nutrition (appetite trends)
- Vital Signs (with sparkline graphs)
- Safety & Incidents (fall alerts)
- Last updated timestamp

### Out of Scope (Phase 2+)
- ❌ Full 16-section form (start with 6 core sections)
- ❌ Photo uploads
- ❌ Voice notes
- ❌ Multi-language (English only for MVP)
- ❌ In-app messaging
- ❌ WhatsApp integration
- ❌ Multiple caregivers per recipient
- ❌ Advanced AI pattern detection

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Routing**: TanStack Router (type-safe, file-based)
- **State/Data**: TanStack Query (caching, optimistic updates)
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **PWA**: Vite PWA plugin

### Backend (Cloudflare Workers)
- **API Framework**: Hono (fastest edge framework)
- **Database**: Cloudflare D1 (SQLite at edge)
- **ORM**: Drizzle ORM (edge-compatible, type-safe)
- **Auth**: Logto (self-hosted on Cloudflare Workers)
- **Storage**: Cloudflare R2 (for PDF reports)
- **Real-time**: Polling (30s) for MVP, Durable Objects Phase 2

### Infrastructure
- **Hosting**: Cloudflare Pages (frontend) + Workers (API)
- **CI/CD**: GitHub Actions → Cloudflare
- **Monitoring**: Cloudflare Analytics + Sentry
- **Cost**: ~$5-10/month (Workers Paid plan)

### Development Tools
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Git Hooks**: Husky + lint-staged

---

## 🏗 Architecture

### High-Level Flow
```
┌─────────────────────────────────────────────────────────┐
│               Cloudflare Global Network                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐ │
│  │ Pages (PWA)  │───▶│ Workers API  │──▶│ D1 (SQL)  │ │
│  │  React App   │    │ Hono Router  │   │ Drizzle   │ │
│  └──────────────┘    └──────────────┘   └───────────┘ │
│         │                    │                          │
│         │                    ▼                          │
│         │            ┌──────────────┐                   │
│         └───────────▶│  R2 Storage  │                   │
│                      │ (PDF reports)│                   │
│                      └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  Users (Singapore/Malaysia Edge) │
        │  - Family (web/mobile browser)   │
        │  - Caregiver (PWA on phone)      │
        └──────────────────────────────────┘
```

### Data Flow
```
Caregiver fills form → Validation (Zod) → POST /api/care-logs
                                                ↓
                                    Hono middleware (auth check)
                                                ↓
                                    Drizzle ORM → D1 insert
                                                ↓
                                    Return success + log ID
                                                ↓
Family dashboard polls every 30s → GET /api/dashboard/:recipientId
                                                ↓
                                    Aggregate data from D1
                                                ↓
                                    Return JSON (cached 30s)
```

### Security Architecture
```
Family Login:  Email/Password (Logto) → JWT token → Bearer auth
Caregiver:     PIN (6-digit) → Custom auth → Session token
API:           All routes require auth middleware
Database:      Row-level security via caregiver_id/family_id checks
```

---

## 🚀 Getting Started

### Prerequisites
```bash
node >= 20.x
pnpm >= 9.x
wrangler >= 3.x
git
```

### Initial Setup

#### 1. Clone & Install
```bash
cd /Users/erniesg/code/erniesg/anchor
pnpm install
```

#### 2. Cloudflare Setup
```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create anchor-db

# Create R2 bucket
wrangler r2 bucket create anchor-storage

# Copy wrangler output to .dev.vars
cp .dev.vars.example .dev.vars
# Add your D1 database ID and R2 bucket name
```

#### 3. Database Setup
```bash
# Generate migration files
pnpm db:generate

# Apply migrations (local)
pnpm db:migrate:local

# Apply migrations (production)
pnpm db:migrate:prod
```

#### 4. Environment Variables
Create `.dev.vars` in project root:
```bash
DATABASE_ID="your-d1-database-id"
R2_BUCKET="anchor-storage"
LOGTO_ENDPOINT="https://your-logto-domain.com"
LOGTO_APP_ID="your-app-id"
LOGTO_APP_SECRET="your-app-secret"
JWT_SECRET="generate-random-string-here"
```

#### 5. Start Development
```bash
# Start everything (parallel)
pnpm dev

# Opens:
# - Frontend: http://localhost:5173
# - API: http://localhost:8787
# - Drizzle Studio: http://localhost:4983
```

---

## 💻 Development Workflow

### Test-Driven Development (TDD)

**Golden Rule**: **Write tests before code, commit regularly, push daily.**

#### TDD Cycle (Red-Green-Refactor)
```
1. 🔴 RED:    Write failing test
2. 🟢 GREEN:  Write minimal code to pass
3. 🔵 REFACTOR: Improve code while keeping tests green
4. 📝 COMMIT:  Commit after each completed cycle
```

#### Example Flow
```bash
# 1. Create test file
touch packages/database/src/schema.test.ts

# 2. Write failing test
# Test that care_logs table has correct columns

# 3. Run test (should fail)
pnpm test

# 4. Implement schema
# Add care_logs table definition

# 5. Run test (should pass)
pnpm test

# 6. Refactor if needed

# 7. Commit
git add .
git commit -m "test: add care_logs schema with validation"
```

### Commit Conventions

**Format**: `<type>(<scope>): <subject>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding/updating tests
- `refactor`: Code restructuring
- `docs`: Documentation changes
- `chore`: Tooling/config changes

**Examples**:
```bash
git commit -m "feat(api): add care log creation endpoint"
git commit -m "test(database): add schema validation tests"
git commit -m "fix(dashboard): resolve medication card state bug"
git commit -m "refactor(forms): extract medication form component"
```

### Git Workflow

#### Daily Practice
```bash
# Morning: Pull latest
git pull origin main

# During work: Commit frequently (every 30-60 min)
git add .
git commit -m "feat: add medication time picker"

# End of day: Push all commits
git push origin main

# Clean commit history (squash if >10 commits/day)
git rebase -i HEAD~10  # Optional, for cleanup
```

#### Feature Branches (Optional for MVP)
```bash
# Create feature branch
git checkout -b feat/family-dashboard

# Work on feature with regular commits
git commit -m "feat(dashboard): add medication card"
git commit -m "test(dashboard): add medication card tests"

# Merge back to main
git checkout main
git merge feat/family-dashboard
git push origin main
```

### Testing Strategy

#### Unit Tests (Vitest)
```bash
# Run all tests
pnpm test

# Watch mode (during development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# Target: >90% coverage
```

**What to test:**
- Database schema validation
- API endpoint logic
- Form validation (Zod schemas)
- Utility functions
- React hooks

#### Integration Tests (Vitest)
```bash
pnpm test:integration
```

**What to test:**
- API → Database flow
- Auth middleware
- Multi-table queries
- PDF generation

#### E2E Tests (Playwright)
```bash
pnpm test:e2e

# Headed mode (see browser)
pnpm test:e2e:headed

# Debug mode
pnpm test:e2e:debug
```

**What to test:**
- Family signup → add recipient → create caregiver
- Caregiver login → fill form → submit
- Family dashboard → view summary → export PDF
- Emergency button → alert notification

### Code Quality Checks

Run before every commit:
```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format

# All checks
pnpm validate  # Runs all of the above + tests
```

### Database Migrations

```bash
# 1. Modify schema in packages/database/src/schema.ts

# 2. Generate migration
pnpm db:generate

# 3. Review generated SQL in drizzle/migrations/

# 4. Apply to local D1
pnpm db:migrate:local

# 5. Test locally

# 6. Apply to production D1
pnpm db:migrate:prod

# 7. Commit migration files
git add drizzle/migrations/
git commit -m "chore(db): add fall_risk_assessment table"
```

---

## 📁 Project Structure

```
anchor/
├── apps/
│   ├── web/                          # Frontend PWA
│   │   ├── public/
│   │   │   └── manifest.json         # PWA manifest
│   │   ├── src/
│   │   │   ├── routes/               # TanStack Router
│   │   │   │   ├── index.tsx         # Landing page
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.tsx
│   │   │   │   │   └── signup.tsx
│   │   │   │   ├── family/
│   │   │   │   │   ├── dashboard.tsx
│   │   │   │   │   └── recipient/
│   │   │   │   │       └── $id.tsx
│   │   │   │   └── caregiver/
│   │   │   │       ├── login.tsx
│   │   │   │       └── form.tsx
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── medication-card.tsx
│   │   │   │   │   ├── vitals-card.tsx
│   │   │   │   │   └── chart.tsx
│   │   │   │   ├── forms/
│   │   │   │   │   ├── medication-form.tsx
│   │   │   │   │   ├── vitals-form.tsx
│   │   │   │   │   └── scale-selector.tsx
│   │   │   │   └── ui/               # Reusable UI
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       └── input.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts     # TanStack Query setup
│   │   │   │   └── utils.ts
│   │   │   ├── hooks/
│   │   │   │   ├── use-care-log.ts
│   │   │   │   └── use-dashboard.ts
│   │   │   └── main.tsx
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                          # Cloudflare Workers API
│       ├── src/
│       │   ├── index.ts              # Hono app entry
│       │   ├── routes/
│       │   │   ├── auth.ts           # POST /auth/login, /auth/signup
│       │   │   ├── care-logs.ts      # CRUD /care-logs
│       │   │   ├── dashboard.ts      # GET /dashboard/:recipientId
│       │   │   ├── family.ts         # CRUD /family
│       │   │   └── caregiver.ts      # CRUD /caregiver
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT verification
│       │   │   ├── cors.ts
│       │   │   └── logger.ts
│       │   ├── services/
│       │   │   ├── dashboard.service.ts
│       │   │   ├── care-log.service.ts
│       │   │   └── analytics.service.ts
│       │   └── lib/
│       │       ├── db.ts             # Drizzle client
│       │       └── utils.ts
│       ├── wrangler.toml
│       └── package.json
│
├── packages/
│   ├── database/                     # Shared database schema
│   │   ├── drizzle/
│   │   │   └── migrations/           # Auto-generated SQL
│   │   ├── src/
│   │   │   ├── schema.ts             # Drizzle tables
│   │   │   ├── client.ts             # DB client factory
│   │   │   └── schema.test.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── shared/                       # Shared types & validators
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── care-log.ts
│   │   │   │   ├── user.ts
│   │   │   │   └── dashboard.ts
│   │   │   ├── validators/           # Zod schemas
│   │   │   │   ├── care-log.schema.ts
│   │   │   │   └── auth.schema.ts
│   │   │   └── constants.ts
│   │   └── package.json
│   │
│   └── config/                       # Shared configs
│       ├── eslint.config.js
│       ├── tsconfig.json
│       └── tailwind.config.js
│
├── tests/
│   ├── e2e/                          # Playwright tests
│   │   ├── family-onboarding.spec.ts
│   │   ├── caregiver-logging.spec.ts
│   │   └── dashboard.spec.ts
│   └── fixtures/                     # Test data
│       └── seed-data.ts
│
├── docs/
│   ├── INIT.md                       # This file
│   ├── TDD_CHECKLIST.md              # Phased development checklist
│   ├── API.md                        # API documentation
│   └── DEPLOYMENT.md                 # Deployment guide
│
├── scripts/
│   ├── seed-db.ts                    # Seed test data
│   └── generate-migration.ts
│
├── .github/
│   └── workflows/
│       ├── test.yml                  # Run tests on PR
│       └── deploy.yml                # Deploy to Cloudflare
│
├── .dev.vars.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

---

## 🎯 Key Principles

### 1. Test-Driven Development (TDD)
- ✅ Write tests BEFORE implementation
- ✅ Maintain >90% test coverage
- ✅ Run tests before every commit
- ✅ Never skip tests for "speed"

### 2. Commit Frequently, Push Daily
- ✅ Commit every 30-60 minutes of meaningful work
- ✅ Push all commits at end of day
- ✅ Use semantic commit messages
- ✅ Keep commits atomic (one logical change per commit)

### 3. Type Safety Everywhere
- ✅ Use TypeScript strict mode
- ✅ No `any` types (use `unknown` if needed)
- ✅ Validate all inputs with Zod
- ✅ Share types across frontend/backend

### 4. Mobile-First, Offline-First
- ✅ Design for mobile screens first
- ✅ PWA with service worker caching
- ✅ Optimistic UI updates
- ✅ Handle offline gracefully

### 5. Calm & Clarity Design
- ✅ Clean, uncluttered interfaces
- ✅ Large touch targets (48px minimum)
- ✅ High contrast for readability
- ✅ Consistent spacing/typography

### 6. Security by Default
- ✅ All routes require authentication
- ✅ Row-level security checks
- ✅ Input validation on client + server
- ✅ Rate limiting on sensitive endpoints

### 7. Performance Budget
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3s
- ✅ Lighthouse score > 90
- ✅ Bundle size < 200KB (gzipped)

---

## 📊 Success Metrics

### MVP Success Criteria (Week 12)

#### Technical Metrics
- [ ] Test coverage > 90%
- [ ] Zero critical bugs in production
- [ ] API response time < 500ms (p95)
- [ ] Dashboard load time < 2s
- [ ] PWA score > 90 (Lighthouse)
- [ ] Uptime > 99.5%

#### User Metrics (3 Pilot Families)
- [ ] Family signup → first log < 24 hours
- [ ] Caregiver form completion time < 10 minutes
- [ ] Family checks dashboard > 2x/day
- [ ] Medication compliance tracking > 90%
- [ ] Emergency button response time < 30 seconds
- [ ] User satisfaction (NPS) > 50

#### Product Metrics
- [ ] All 6 core form sections working
- [ ] 7-day trend analysis for meds + vitals
- [ ] PDF report generation functional
- [ ] Alert system operational (falls, missed meds)
- [ ] Mobile responsive on iOS + Android
- [ ] Offline mode working (form auto-save)

---

## 📚 Additional Resources

### Documentation
- **API Docs**: See `docs/API.md`
- **Deployment Guide**: See `docs/DEPLOYMENT.md`
- **TDD Checklist**: See `docs/TDD_CHECKLIST.md`

### External Docs
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)

### Design References
- **Figma**: (Add link when created)
- **Existing HTML mockups**: `/assets/ui/*.html`
- **Care template PDF**: `/assets/Daily Care Report Template.pdf`

---

## 🚦 Next Steps

1. ✅ Read this document completely
2. ✅ Review `TDD_CHECKLIST.md` for phased development plan
3. ⬜ Set up development environment (follow "Getting Started")
4. ⬜ Run initial project scaffold script
5. ⬜ Complete Phase 1, Week 1 checklist
6. ⬜ Daily: Commit regularly, push at EOD
7. ⬜ Weekly: Review progress against checklist

---

## 📞 Support

**Questions?**
- Check existing documentation first
- Review code comments and tests
- Ask in project Slack/Discord (if applicable)

**Found a bug?**
- Check if test exists for the bug
- Write failing test first
- Fix bug
- Commit with `fix:` prefix

**Want to add a feature?**
- Check if it's in MVP scope
- If yes: Add to TDD checklist, write test
- If no: Add to Phase 2+ backlog

---

## 📝 Version History

- **v0.1.0** (2025-09-30): Initial project setup and documentation
- **v1.0.0** (Target: Q2 2025): MVP launch

---

**Remember**: "Structure for Sanity, Connection for the Heart"

Every line of code you write is helping a family stay connected and a caregiver provide better care. Build with empathy, test with rigor, commit with discipline.

Let's build something that matters. 🚀