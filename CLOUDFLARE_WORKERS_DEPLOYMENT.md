# Cloudflare Workers Deployment Checklist

**Goal**: Deploy Anchor frontend (React + Vite + TanStack Router) and backend (Hono API) as separate Cloudflare Workers

**Architecture**:
- `anchor-api` / `anchor-dev-api` → Hono API Worker (already configured)
- `anchor` / `anchor-dev` → React SPA Worker (needs setup)

**Production URLs**:
- Frontend: `https://anchor.erniesg.workers.dev` → (later: custom domain)
- API: `https://anchor-api.erniesg.workers.dev`

**Development URLs**:
- Frontend: `https://anchor-dev.erniesg.workers.dev`
- API: `https://anchor-dev-api.erniesg.workers.dev`

---

## Prerequisites

### Cloudflare Account Setup
- [ ] Cloudflare account created/verified
- [ ] Wrangler CLI authenticated: `wrangler login`
- [ ] Verify auth: `wrangler whoami`

### Cloudflare Resources (one-time setup)
- [ ] D1 database created: `anchor-dev-db` (dev)
- [ ] D1 database created: `anchor-prod-db` (production)
- [ ] R2 bucket created: `anchor-dev-storage` (dev)
- [ ] R2 bucket created: `anchor-prod-storage` (production)
- [ ] Run migrations: `wrangler d1 migrations apply anchor-dev-db --env dev`
- [ ] Run migrations: `wrangler d1 migrations apply anchor-prod-db --env production`

### Secrets Configuration
API Worker secrets (need to be set manually):

```bash
# Development
cd apps/api
wrangler secret put JWT_SECRET --env dev
# Paste secret when prompted: [GENERATE_STRONG_SECRET]

wrangler secret put LOGTO_APP_SECRET --env dev
# Paste secret when prompted: [YOUR_LOGTO_SECRET]

# Production
wrangler secret put JWT_SECRET --env production
# Paste secret when prompted: [DIFFERENT_PRODUCTION_SECRET]

wrangler secret put LOGTO_APP_SECRET --env production
# Paste secret when prompted: [YOUR_LOGTO_PRODUCTION_SECRET]
```

**Note**: Secrets are encrypted and stored in Cloudflare. Cannot be read after setting.

---

## Phase 1: Frontend Worker Setup

### 1.1 Install Dependencies
```bash
cd apps/web
pnpm add -D @cloudflare/vite-plugin-cloudflare wrangler
```

- [ ] Dependencies installed
- [ ] Verify in `apps/web/package.json`

### 1.2 Update Vite Configuration

**File**: `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import cloudflare from '@cloudflare/vite-plugin-cloudflare';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    cloudflare(), // ← Add this
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] Cloudflare plugin added to `vite.config.ts`

### 1.3 Create Wrangler Configuration

**File**: `apps/web/wrangler.toml`

```toml
#:schema node_modules/wrangler/config-schema.json
name = "anchor"
compatibility_date = "2025-01-04"
compatibility_flags = ["nodejs_compat"]

# SPA Static Assets - Routes all 404s to index.html
[assets]
not_found_handling = "single-page-application"

# Development Environment
[env.dev]
name = "anchor-dev"
vars = {
  ENVIRONMENT = "dev",
  API_URL = "https://anchor-dev-api.erniesg.workers.dev"
}

# Production Environment
[env.production]
name = "anchor"
vars = {
  ENVIRONMENT = "production",
  API_URL = "https://anchor-api.erniesg.workers.dev"
}
```

- [ ] `apps/web/wrangler.toml` created
- [ ] SPA routing configured (`not_found_handling`)
- [ ] Environment variables set

### 1.4 Update Package.json Scripts

**File**: `apps/web/package.json`

Add/update scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "wrangler dev",
    "deploy:dev": "wrangler deploy --env dev",
    "deploy:prod": "wrangler deploy --env production",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext ts,tsx"
  }
}
```

- [ ] Scripts added to `apps/web/package.json`

### 1.5 Create API Client Helper

**File**: `apps/web/src/lib/api.ts`

```typescript
/**
 * API Client for Cloudflare Workers deployment
 * Uses environment variable for API URL in production
 * Falls back to /api proxy in development
 */

// @ts-ignore - Vite injects this via Cloudflare plugin
const API_URL = typeof import.meta.env.API_URL !== 'undefined'
  ? import.meta.env.API_URL
  : '/api'; // Local dev uses Vite proxy

export async function apiCall<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.statusText}`);
  }

  return response.json();
}

// Helper for authenticated requests
export async function authenticatedApiCall<T = any>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

- [ ] `apps/web/src/lib/api.ts` created

### 1.6 Update API Calls in Components

**Files to update**:
- `apps/web/src/routes/caregiver/login.tsx`
- `apps/web/src/routes/caregiver/form.tsx`
- Any other files using `fetch('/api/...')`

**Before**:
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

**After**:
```typescript
import { apiCall } from '@/lib/api';

const data = await apiCall('/auth/login', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

- [ ] Update `apps/web/src/routes/caregiver/login.tsx`
- [ ] Update `apps/web/src/routes/caregiver/form.tsx`
- [ ] Search for other `fetch('/api` calls and update
- [ ] Test TypeScript compilation: `pnpm typecheck`

### 1.7 Update .gitignore

**File**: `apps/web/.gitignore` (create if doesn't exist)

```gitignore
# Cloudflare Workers
.wrangler/
.dev.vars
wrangler.toml.d.ts

# Vite
dist/
dist-ssr/
*.local
```

- [ ] `.gitignore` updated

---

## Phase 2: Backend Worker Configuration

### 2.1 Update API Wrangler Config

**File**: `apps/api/wrangler.toml`

Ensure names match production URLs:

```toml
name = "anchor-api"
main = "src/index.ts"
compatibility_date = "2025-01-04"
compatibility_flags = ["nodejs_compat"]

# Development Environment
[env.dev]
name = "anchor-dev-api"
vars = { ENVIRONMENT = "dev" }

[[env.dev.d1_databases]]
binding = "DB"
database_name = "anchor-dev-db"
database_id = "" # Fill from Cloudflare dashboard

[[env.dev.r2_buckets]]
binding = "STORAGE"
bucket_name = "anchor-dev-storage"

# Production Environment
[env.production]
name = "anchor-api"
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "anchor-prod-db"
database_id = "" # Fill from Cloudflare dashboard

[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "anchor-prod-storage"

# Secrets (set via wrangler secret put)
# - JWT_SECRET
# - LOGTO_APP_SECRET
```

- [ ] Verify `apps/api/wrangler.toml` names are correct
- [ ] D1 database IDs filled in
- [ ] R2 bucket names correct

### 2.2 Add CORS for Cross-Worker Communication

**File**: `apps/api/src/index.ts`

Add CORS middleware:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './types';

const app = new Hono<AppContext>();

// CORS for frontend Worker
app.use('/*', cors({
  origin: (origin) => {
    // Allow dev and prod frontend workers
    if (origin.includes('anchor-dev.') ||
        origin.includes('anchor.') ||
        origin === 'http://localhost:5173') {
      return origin;
    }
    return null;
  },
  credentials: true,
}));

// ... rest of routes
```

- [ ] CORS middleware added to `apps/api/src/index.ts`
- [ ] Test TypeScript compilation: `pnpm typecheck`

---

## Phase 3: Local Testing

### 3.1 Test API Worker Locally
```bash
cd apps/api
pnpm dev
# Should start on http://localhost:8787
```

- [ ] API Worker starts without errors
- [ ] Test endpoint: `curl http://localhost:8787/health`

### 3.2 Test Frontend Build
```bash
cd apps/web
pnpm build
# Check dist/ folder created
```

- [ ] Frontend builds successfully
- [ ] `dist/` folder contains `index.html` and assets

### 3.3 Test Frontend Preview
```bash
cd apps/web
pnpm preview
# Wrangler serves from dist/ on http://localhost:8787
```

- [ ] Frontend preview starts
- [ ] Can access at localhost URL
- [ ] Static assets load correctly

### 3.4 Test Full Integration (Dev Mode)
```bash
# Terminal 1: API Worker
cd apps/api && pnpm dev

# Terminal 2: Frontend dev server
cd apps/web && pnpm dev
```

- [ ] Both services running
- [ ] Frontend at `http://localhost:5173`
- [ ] API calls proxied to `http://localhost:8787`
- [ ] Login flow works
- [ ] Caregiver workflow works

---

## Phase 4: Development Deployment

### 4.1 Deploy API Worker (Dev)
```bash
cd apps/api
wrangler deploy --env dev
```

- [ ] API Worker deployed successfully
- [ ] URL: `https://anchor-dev-api.erniesg.workers.dev`
- [ ] Test endpoint: `curl https://anchor-dev-api.erniesg.workers.dev/health`

### 4.2 Set Secrets (Dev)
```bash
cd apps/api
wrangler secret put JWT_SECRET --env dev
# Paste: [GENERATE_32_CHAR_SECRET]

wrangler secret put LOGTO_APP_SECRET --env dev
# Paste: [YOUR_LOGTO_DEV_SECRET]
```

- [ ] `JWT_SECRET` set for dev
- [ ] `LOGTO_APP_SECRET` set for dev
- [ ] Verify: `wrangler secret list --env dev`

### 4.3 Run Database Migrations (Dev)
```bash
cd apps/api
wrangler d1 migrations apply anchor-dev-db --env dev
```

- [ ] Migrations applied successfully
- [ ] Verify tables: `wrangler d1 execute anchor-dev-db --env dev --command "SELECT name FROM sqlite_master WHERE type='table'"`

### 4.4 Seed Test Data (Dev)
```bash
# Seed E2E test caregiver
bash scripts/seed-e2e-caregiver.sh

# Or populate with sample data
bash scripts/populate-test-data.sh
```

- [ ] Test data seeded (optional)

### 4.5 Deploy Frontend Worker (Dev)
```bash
cd apps/web
pnpm build
wrangler deploy --env dev
```

- [ ] Frontend Worker deployed successfully
- [ ] URL: `https://anchor-dev.erniesg.workers.dev`
- [ ] Open in browser and test

### 4.6 Test Deployed Dev Environment
- [ ] Visit `https://anchor-dev.erniesg.workers.dev`
- [ ] Frontend loads correctly
- [ ] Static assets (CSS, JS, images) load
- [ ] Login page accessible
- [ ] Can login with test credentials
- [ ] Caregiver login works
- [ ] Dashboard loads
- [ ] API calls work (check Network tab)
- [ ] TanStack Router navigation works

---

## Phase 5: E2E Testing Against Dev Deployment

### 5.1 Update Playwright Config for Remote Testing

**File**: `playwright.config.ts`

Add project for remote testing:

```typescript
export default defineConfig({
  // ... existing config

  projects: [
    // Local testing (existing)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Remote dev environment testing
    {
      name: 'dev-remote',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://anchor-dev.erniesg.workers.dev',
      },
    },
  ],
});
```

- [ ] Playwright config updated

### 5.2 Run E2E Tests Against Dev
```bash
# First seed test data to remote D1
cd apps/api
wrangler d1 execute anchor-dev-db --env dev --file=../../scripts/seed-e2e-caregiver.sql

# Run tests
pnpm playwright test --project=dev-remote
```

- [ ] E2E tests pass against dev deployment
- [ ] Caregiver workflow tests pass
- [ ] Admin settings tests pass

---

## Phase 6: Production Deployment

### 6.1 Deploy API Worker (Production)
```bash
cd apps/api
wrangler deploy --env production
```

- [ ] API Worker deployed to production
- [ ] URL: `https://anchor-api.erniesg.workers.dev`

### 6.2 Set Secrets (Production)
```bash
cd apps/api
wrangler secret put JWT_SECRET --env production
# Paste: [DIFFERENT_STRONG_PRODUCTION_SECRET]

wrangler secret put LOGTO_APP_SECRET --env production
# Paste: [YOUR_LOGTO_PROD_SECRET]
```

- [ ] `JWT_SECRET` set for production
- [ ] `LOGTO_APP_SECRET` set for production
- [ ] Verify: `wrangler secret list --env production`

### 6.3 Run Database Migrations (Production)
```bash
cd apps/api
wrangler d1 migrations apply anchor-prod-db --env production
```

- [ ] Migrations applied to production database
- [ ] Verify tables created

### 6.4 Deploy Frontend Worker (Production)
```bash
cd apps/web
pnpm build
wrangler deploy --env production
```

- [ ] Frontend Worker deployed to production
- [ ] URL: `https://anchor.erniesg.workers.dev`

### 6.5 Test Production Deployment
- [ ] Visit `https://anchor.erniesg.workers.dev`
- [ ] All pages load correctly
- [ ] Authentication works
- [ ] No console errors
- [ ] API calls succeed
- [ ] Performance is good (check Cloudflare Analytics)

---

## Phase 7: Orchestration & CI/CD

### 7.1 Update Root Package.json

**File**: `package.json`

```json
{
  "scripts": {
    "deploy:dev": "pnpm build && cd apps/api && wrangler deploy --env dev && cd ../web && wrangler deploy --env dev",
    "deploy:prod": "pnpm validate && cd apps/api && wrangler deploy --env production && cd ../web && wrangler deploy --env production"
  }
}
```

- [ ] Deployment scripts added

### 7.2 Test Orchestrated Deployment
```bash
# From root
pnpm deploy:dev
```

- [ ] Both API and frontend deploy successfully

### 7.3 Setup Wrangler GitHub Action (Optional)

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Deploy API
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/api
          command: deploy --env production

      - name: Deploy Frontend
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/web
          command: deploy --env production
```

- [ ] GitHub Actions workflow created (optional)
- [ ] `CLOUDFLARE_API_TOKEN` secret added to GitHub repo

---

## Phase 8: Custom Domains (Optional)

### 8.1 Add Custom Domain for Frontend
```bash
# Via Cloudflare dashboard or CLI
wrangler domains add anchor.your-domain.com --env production
```

- [ ] Custom domain configured for frontend
- [ ] DNS records updated
- [ ] SSL certificate issued

### 8.2 Add Custom Domain for API
```bash
wrangler domains add api.anchor.your-domain.com --env production
```

- [ ] Custom domain configured for API
- [ ] Update `apps/web/wrangler.toml` with new API URL

---

## Monitoring & Observability

### Post-Deployment Checks
- [ ] Check Cloudflare Workers Analytics dashboard
- [ ] Monitor error rates
- [ ] Check D1 query performance
- [ ] Monitor R2 storage usage
- [ ] Set up alerts for errors (via Cloudflare dashboard)

### Logging
- [ ] Add `console.log` statements for debugging (visible in `wrangler tail`)
- [ ] Test live logging: `wrangler tail --env production`

---

## Rollback Plan

If production deployment fails:

```bash
# Rollback API
cd apps/api
wrangler rollback --env production

# Rollback Frontend
cd apps/web
wrangler rollback --env production
```

- [ ] Rollback procedure tested in dev

---

## Common Issues & Solutions

### Issue: "Module not found" after deployment
**Solution**: Check `package.json` dependencies are in `dependencies` not `devDependencies`

### Issue: API calls fail with CORS error
**Solution**: Verify CORS middleware in `apps/api/src/index.ts` includes frontend domain

### Issue: 404 on client-side routes
**Solution**: Verify `not_found_handling = "single-page-application"` in `wrangler.toml`

### Issue: Secrets not available
**Solution**: Re-set secrets with `wrangler secret put`

### Issue: Database queries fail
**Solution**: Check D1 binding name matches `wrangler.toml` and run migrations

---

## Completion Status

**Overall Progress**: ⬜️⬜️⬜️⬜️⬜️⬜️⬜️⬜️ 0/8 phases

- [ ] Phase 1: Frontend Worker Setup (0/7 tasks)
- [ ] Phase 2: Backend Worker Configuration (0/2 tasks)
- [ ] Phase 3: Local Testing (0/4 tasks)
- [ ] Phase 4: Development Deployment (0/6 tasks)
- [ ] Phase 5: E2E Testing (0/2 tasks)
- [ ] Phase 6: Production Deployment (0/5 tasks)
- [ ] Phase 7: Orchestration & CI/CD (0/3 tasks)
- [ ] Phase 8: Custom Domains (0/2 tasks - optional)

---

## Notes

- All secrets should be stored securely (use password manager)
- Never commit `.dev.vars` or secrets to git
- Test in dev environment before deploying to production
- Keep `compatibility_date` updated to latest stable version
- Monitor Cloudflare status page for platform issues

**Last Updated**: 2025-01-04
