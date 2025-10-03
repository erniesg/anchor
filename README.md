# Anchor - AI-Powered Caregiving Coordination Platform

> **"Structure for Sanity, Connection for the Heart"**

Transform eldercare chaos into clarity. Anchor helps families coordinate care with foreign domestic workers through simple mobile forms and intelligent dashboards.

---

## 🚀 Quick Start

### Prerequisites

```bash
node >= 20.x
pnpm >= 9.x
wrangler (installed globally or via npx)
```

### First-Time Setup

**1. Get Cloudflare Credentials:**
- Account ID: https://dash.cloudflare.com/ (right sidebar)
- API Token: https://dash.cloudflare.com/profile/api-tokens
  - Click "Create Token" → Use "Edit Cloudflare Workers" template
  - Needs: D1 Edit + R2 Edit + Workers Scripts Edit

**2. Configure & Deploy:**

```bash
# Install dependencies
pnpm install

# Create .env file
cp .env.example .env

# Edit .env - add your credentials:
# CLOUDFLARE_ACCOUNT_ID="your-account-id"
# CLOUDFLARE_API_TOKEN="your-api-token"

# Run automated setup (creates D1 DBs + R2 buckets)
pnpm setup:cloudflare

# Setup database
pnpm db:generate
pnpm db:migrate:dev

# Start development
pnpm dev
```

**Servers will start at:**
- Frontend: http://localhost:5173 (not scaffolded yet)
- API: http://localhost:8787
- Drizzle Studio: http://localhost:4983

### Troubleshooting

**"Authentication required"**: Run `wrangler login`

**"Resource already exists"**: Normal if re-running setup - script reuses existing resources

**Database ID not found**: Run `wrangler d1 list` and manually update `apps/api/wrangler.toml`

---

## 📁 Project Structure

```
anchor/
├── apps/
│   ├── web/              # React frontend (TanStack Router + Query)
│   └── api/              # Hono API on Cloudflare Workers
├── packages/
│   ├── database/         # Drizzle ORM + D1 schema
│   └── shared/           # Shared types + validators (Zod)
├── tests/
│   └── e2e/              # Playwright E2E tests
├── scripts/
│   └── setup-cloudflare.js  # Automated Cloudflare setup
└── docs/
    ├── INIT.md           # Comprehensive project guide
    ├── TDD_CHECKLIST.md  # 12-week phased development plan
    └── DEVELOPMENT.md    # Daily workflows & practices
```

---

## 🛠 Tech Stack

### Frontend
- **React 19** + TypeScript + Vite
- **TanStack Router** (type-safe routing)
- **TanStack Query** (data fetching + caching)
- **Tailwind CSS v4** (styling)
- **PWA** (offline-first)

### Backend
- **Hono** (edge-optimized API framework)
- **Cloudflare Workers** (serverless compute)
- **Cloudflare D1** (SQLite at edge)
- **Drizzle ORM** (type-safe database)
- **Cloudflare R2** (object storage)

### Testing
- **Vitest** (unit + integration)
- **Playwright** (E2E)
- **Target**: >90% coverage

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[INIT.md](./INIT.md)** | Full project overview, MVP definition, architecture |
| **[TDD_CHECKLIST.md](./TDD_CHECKLIST.md)** | 12-week phased development checklist (TDD) |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | Daily workflows, git practices, testing guide |

**Start here**: [INIT.md](./INIT.md) → [TDD_CHECKLIST.md](./TDD_CHECKLIST.md) → Begin coding!

---

## 🧪 Development Workflow

### Test-Driven Development (TDD)

```bash
# The Golden Rule: Write test BEFORE code

# 1. Write failing test
touch apps/api/src/routes/care-logs.test.ts

# 2. Run test (should fail)
pnpm test

# 3. Implement code
# (Write minimal code to pass test)

# 4. Run test (should pass)
pnpm test

# 5. Refactor (if needed)

# 6. Commit
git add .
git commit -m "feat(api): add care log creation endpoint"
```

### Daily Routine

**Morning:**
```bash
git pull origin main
pnpm install
pnpm test
pnpm dev
```

**During Work:**
- Write test → Implement → Refactor → Commit (every 30-60 min)
- Target: 8-12 commits per day

**End of Day:**
```bash
pnpm test && pnpm lint && git push origin main
```

---

## 🗂️ Common Commands

### Development

```bash
pnpm dev                  # Start all servers (web + api + db studio)
pnpm test                 # Run all unit tests
pnpm test:watch           # Watch mode
pnpm test:e2e             # Run E2E tests
pnpm lint                 # Lint code
pnpm typecheck            # Type check
pnpm validate             # Run all checks (typecheck + lint + test)
```

### Database

```bash
pnpm db:generate          # Generate migrations from schema
pnpm db:migrate:dev       # Apply migrations to dev database
pnpm db:migrate:prod      # Apply migrations to prod database
pnpm db:studio            # Open Drizzle Studio (visual DB browser)
```

### Deployment

```bash
pnpm deploy:dev           # Deploy to dev environment
pnpm deploy:prod          # Deploy to production
```

---

## 🌍 Environments

### Development (`anchor-dev-*`)
- **Database**: `anchor-dev-db`
- **Storage**: `anchor-dev-storage`
- **Worker**: `anchor-dev-api`
- **URL**: `anchor-dev-api.your-account.workers.dev`

### Production (`anchor-prod-*`)
- **Database**: `anchor-prod-db`
- **Storage**: `anchor-prod-storage`
- **Worker**: `anchor-prod-api`
- **URL**: `anchor-prod-api.your-account.workers.dev` (or custom domain)

---

## 🔐 Environment Variables

### Required (`.env`)

```bash
# Cloudflare Account
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_API_TOKEN="your-api-token"

# Database/Storage Names (auto-created by setup script)
DB_NAME_DEV="anchor-dev-db"
DB_NAME_PROD="anchor-prod-db"
R2_BUCKET_DEV="anchor-dev-storage"
R2_BUCKET_PROD="anchor-prod-storage"

# Auth (configure later)
LOGTO_ENDPOINT="https://your-logto-domain.com"
LOGTO_APP_ID="your-app-id"
LOGTO_APP_SECRET="your-app-secret"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-generated-secret"
```

### Auto-Generated (`.env.local`)

Created by `pnpm setup:cloudflare`:
- Database IDs
- Resource names
- Connection strings

---

## 🎯 MVP Scope (Phase 1)

### Core Features
- ✅ Family signup/login
- ✅ Add care recipient
- ✅ Create caregiver account (with PIN)
- ✅ Caregiver mobile form (6 core sections):
  - Morning routine
  - Medications (all time slots)
  - Meals & nutrition
  - Vital signs
  - Toileting
  - Safety & incidents
- ✅ Family dashboard (real-time)
- ✅ 7-day trend analysis
- ✅ Emergency alert system
- ✅ PDF report generation

### Out of Scope (Phase 2+)
- ❌ Photo uploads
- ❌ Voice notes
- ❌ Multi-language
- ❌ In-app messaging
- ❌ WhatsApp integration

---

## 🧑‍💻 Contributing

### Commit Message Format

```
<type>(<scope>): <subject>

Types: feat, fix, test, refactor, docs, chore
Scopes: web, api, db, shared

Examples:
feat(web): add medication card component
test(api): add care log endpoint tests
fix(db): correct foreign key constraint
```

### Pull Request Process (Post-MVP)

1. Create feature branch: `git checkout -b feat/your-feature`
2. Write tests first (TDD)
3. Implement feature
4. Run all checks: `pnpm validate`
5. Push and create PR
6. Review and merge

---

## 📊 Success Metrics (MVP)

### Technical
- [ ] Test coverage >90%
- [ ] API response time <500ms (p95)
- [ ] Dashboard load time <2s
- [ ] Lighthouse score >90
- [ ] Zero critical bugs

### User (3 Pilot Families)
- [ ] Onboarding <5 minutes
- [ ] Form completion <10 minutes
- [ ] Family checks dashboard >2x/day
- [ ] Medication compliance >90%
- [ ] User satisfaction (NPS) >50

---

## 🆘 Troubleshooting

### Wrangler login fails
```bash
wrangler login
# Follow browser prompt to authorize
```

### Database migrations fail
```bash
# Check database ID in wrangler.toml
wrangler d1 list

# Verify migrations directory
ls packages/database/drizzle/migrations/
```

### Tests failing
```bash
# Clear cache and reinstall
pnpm clean
pnpm install
pnpm test
```

### Dev server not starting
```bash
# Check ports are free
lsof -ti:5173 -ti:8787 | xargs kill -9

# Restart
pnpm dev
```

---

## 📞 Support

- **Documentation**: Read [INIT.md](./INIT.md) first
- **Development**: See [DEVELOPMENT.md](./DEVELOPMENT.md)
- **TDD Checklist**: Follow [TDD_CHECKLIST.md](./TDD_CHECKLIST.md)

---

## 📝 License

Private - All Rights Reserved

---

**Built with ❤️ for caregivers and families everywhere.**

*"Every line of code helps a family stay connected."* 🚀