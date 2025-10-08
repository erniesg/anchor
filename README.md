# Anchor - Caregiving Coordination Platform

> **"Structure for Sanity, Connection for the Heart"**

Transform eldercare chaos into clarity. Anchor helps families coordinate care with domestic workers through simple mobile forms and intelligent dashboards.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup Cloudflare (one-time)
pnpm setup:cloudflare

# 3. Setup database
pnpm db:generate
pnpm db:migrate:dev

# 4. Start development
pnpm dev
```

**Servers start at:**
- Frontend: http://localhost:5173
- API: http://localhost:8787
- DB Studio: http://localhost:4983

---

## 📊 Current Status (2025-10-08)

### ✅ Sprint 2 Complete - Fluid Intake Monitoring
**Delivered:** Oct 7, 2025 (12.5 hours)
- **Caregiver Form:** Dynamic fluid entry tracking with 10 beverage types
- **Auto-calculation:** Total fluid intake with <1000ml dehydration warnings
- **Dashboard:** Fluid summary card, weekly trends, swallowing issues alerts
- **Testing:** 113/113 tests passing (100%), including 8 E2E + 1 manual visual test
- **Deployment:** Live in dev environment

### ✅ Sprint 1 Complete - Safety Foundation
**Delivered:** Oct 1-7, 2025
- **Fall Risk Assessment:** Balance issues, near falls, walking patterns
- **Unaccompanied Time:** Dynamic tracking with >60min warnings
- **Safety Checks:** 6 safety items + 7 emergency equipment checks
- **Dashboard:** Weekly trend charts for all safety metrics

### ✅ Phase 1 Complete - MVP Core
**Delivered:** Sept 30 - Oct 6, 2025
- **Auth:** JWT + bcrypt password hashing
- **RBAC:** family_admin, family_member, caregiver roles
- **Care Logging:** Morning routine, meds, meals, vitals, toileting
- **Dashboard:** Today/Week/Month views with trend charts
- **Age/Gender-Aware:** Personalized vital signs validation

**Template Coverage:** 65% (55/84 fields)
**Test Coverage:** 113/113 passing (100%)
**Live URLs:**
- API: https://anchor-dev-api.erniesg.workers.dev
- Web: https://anchor-dev.erniesg.workers.dev

### 🎯 Next: Phase 2 - Clinical Enhancements
**Timeline:** Oct 8-21, 2025 (2 weeks)
**Target:** 80% template coverage (29 more fields)
**Priorities:** Sleep tracking, enhanced medications, mobility & exercise

---

## 📁 Project Structure

```
anchor/
├── apps/
│   ├── web/              # React + TanStack Router + Query
│   └── api/              # Hono API on Cloudflare Workers
├── packages/
│   ├── database/         # Drizzle ORM + D1 schema
│   └── shared/           # Shared types + Zod validators
├── tests/e2e/            # Playwright E2E tests (50+ scenarios)
└── scripts/              # Setup & utility scripts
```

---

## 🛠 Tech Stack

**Frontend:** React 19, TypeScript, TanStack Router/Query, Tailwind CSS
**Backend:** Hono, Cloudflare Workers, D1 (SQLite), Drizzle ORM
**Testing:** Playwright E2E (skip unit tests - mocking too complex)

---

## 🧪 Testing

See [TESTING.md](./TESTING.md) for full guide.

**First-time setup:**
```bash
# Seed test users (required once)
./scripts/populate-test-data.sh    # Care log data
# Test users auto-created on first API signup
```

**Run tests:**
```bash
# E2E tests
pnpm dev                  # Terminal 1 (wait for servers)
pnpm test:e2e            # Terminal 2

# Test users:
# - admin@example.com / admin123 (family_admin)
# - member@example.com / member123 (family_member)

# API smoke test
./scripts/smoke-test.sh

# Manual smoke test (10 min checklist in TESTING.md)
```

---

## 🗂️ Common Commands

```bash
# Development
pnpm dev                  # Start all servers
pnpm test:e2e            # Run E2E tests
pnpm typecheck           # Type check
pnpm lint                # Lint code
pnpm validate            # All checks

# Database
pnpm db:generate         # Generate migrations
pnpm db:migrate:dev      # Apply migrations
pnpm db:studio           # Open DB GUI

# Deploy
pnpm deploy:dev          # Deploy to dev
pnpm deploy:prod         # Deploy to production
```

---

## 📚 Documentation

**Core Docs (Read These):**
| File | Purpose |
|------|---------|
| **[README.md](./README.md)** | This file - quick start & current status |
| **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** | Detailed feature status & roadmap (65% coverage) |
| **[TESTING.md](./TESTING.md)** | Testing strategy & execution |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | Daily workflows & git practices |

**Reference Docs:**
| File | Purpose |
|------|---------|
| **[INIT.md](./INIT.md)** | Original project specification |
| **[TDD_CHECKLIST.md](./TDD_CHECKLIST.md)** | 12-week development plan |
| **[RBAC_SCHEMA_DESIGN.md](./RBAC_SCHEMA_DESIGN.md)** | RBAC system design |

**Historical Docs:** Sprint summaries, session notes (see `SPRINT*.md`, `SESSION*.md` files)

---

## 🔐 Environment Variables

Required in `.env`:
```bash
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_API_TOKEN="your-api-token"
JWT_SECRET="your-generated-secret"
```

Get credentials: https://dash.cloudflare.com/profile/api-tokens

---

## 🎯 MVP Features

### ✅ Implemented
- Family signup/login
- Care recipient management
- Caregiver creation (with PIN)
- Caregiver mobile form (6 sections: morning, meds, meals, vitals, toileting, safety)
- Auto-save (30-second intervals)
- Draft/submit/invalidate workflow
- Family dashboard (real-time)
- 7-day trend charts
- Admin settings (deactivate, PIN reset)
- RBAC (family_admin, family_member, caregiver)

### 📝 Out of Scope (Phase 2)
- Photo uploads
- Voice notes
- Multi-language
- In-app messaging

---

## 🆘 Troubleshooting

**Wrangler auth fails:**
```bash
wrangler login
```

**Database not found:**
```bash
wrangler d1 list
# Update ID in apps/api/wrangler.toml
```

**Dev server won't start:**
```bash
lsof -ti:5173 -ti:8787 | xargs kill -9
pnpm dev
```

---

## 🚀 Next Steps

1. **Run tests:** `pnpm dev` → `pnpm test:e2e`
2. **Implement JWT:** Replace mock tokens
3. **Hash secrets:** bcrypt for passwords/PINs
4. **Set up CI/CD:** GitHub Actions for E2E tests
5. **Deploy:** Staging → Production

See [TESTING.md](./TESTING.md) for detailed testing guide.

---

**Built with ❤️ for caregivers and families everywhere.**
