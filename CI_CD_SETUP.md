# CI/CD Setup Guide for Anchor

## Overview

Your CI/CD pipeline is now configured with GitHub Actions for automatic deployments:

- **`dev` branch** → Deploys to Dev/Staging environment
- **`master` branch** → Deploys to Production environment

## Environments

### Development (Staging)
- **API**: https://anchor-dev-api.erniesg.workers.dev
- **Web**: https://anchor-dev.erniesg.workers.dev
- **Database**: `anchor-dev-db`
- **Storage**: `anchor-dev-storage`

### Production
- **API**: https://anchor-api.erniesg.workers.dev
- **Web**: https://anchor.erniesg.workers.dev
- **Database**: `anchor-prod-db`
- **Storage**: `anchor-prod-storage`

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### 1. Get Cloudflare API Token

```bash
# Option 1: Use wrangler to generate a token
wrangler login

# Option 2: Create manually at:
# https://dash.cloudflare.com/profile/api-tokens
# Template: "Edit Cloudflare Workers"
# Permissions needed:
#   - Account.Cloudflare Workers Scripts (Edit)
#   - Account.Cloudflare Workers KV Storage (Edit)
#   - Account.D1 (Edit)
#   - Account.R2 (Edit)
```

### 2. Get Cloudflare Account ID

```bash
# View your account ID
wrangler whoami

# Or find it at:
# https://dash.cloudflare.com/ (in the URL or sidebar)
```

### 3. Add Secrets to GitHub

Go to: `https://github.com/YOUR_USERNAME/anchor/settings/secrets/actions`

Add these secrets:
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

## Workflow Files Created

1. **`.github/workflows/deploy-dev.yml`**
   - Triggers on: Push to `dev` branch
   - Runs: Tests + Deploy to dev environment
   - Posts deployment URLs as commit comment

2. **`.github/workflows/deploy-prod.yml`**
   - Triggers on: Push to `master` or `main` branch
   - Runs: Tests + Integration tests + Deploy to production
   - Uses GitHub environment protection for production
   - Posts deployment URLs as commit comment

3. **`.github/workflows/pr-check.yml`**
   - Triggers on: Pull requests to `dev`, `master`, or `main`
   - Runs: All quality checks without deployment
   - Posts results as PR comment

## Initial Setup Steps

### 1. Create Dev Branch

```bash
# Create and push dev branch
git checkout -b dev
git push -u origin dev
```

### 2. Configure GitHub Secrets

```bash
# Get your Cloudflare credentials
wrangler whoami

# Then add them to:
# https://github.com/YOUR_USERNAME/anchor/settings/secrets/actions
```

### 3. (Optional) Set up Branch Protection

Protect your `master` branch:
1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `master`
3. Enable:
   - ✅ Require pull request before merging
   - ✅ Require status checks to pass
   - ✅ Require conversation resolution before merging

### 4. (Optional) Configure Production Environment Protection

Add manual approval for production deployments:
1. Go to: Settings → Environments → New environment
2. Name: `production`
3. Enable:
   - ✅ Required reviewers (add yourself or team members)
   - ⏱️ Wait timer: 0-30 minutes (optional delay)

## Development Workflow

### Feature Development

```bash
# Work on a feature
git checkout dev
git pull origin dev
git checkout -b feature/my-feature

# Make changes, commit
git add .
git commit -m "feat: add new feature"

# Push and create PR to dev
git push origin feature/my-feature
# Create PR: feature/my-feature → dev
```

### Deploying to Staging

```bash
# Merge PR to dev, or push directly
git checkout dev
git merge feature/my-feature
git push origin dev

# 🚀 Automatic deployment to dev environment triggered!
```

### Deploying to Production

```bash
# Create PR from dev to master
git checkout master
git merge dev
git push origin master

# 🚀 Automatic deployment to production triggered!
# (with manual approval if environment protection is configured)
```

## Monitoring Deployments

### View Deployment Status

```bash
# Check GitHub Actions
# https://github.com/YOUR_USERNAME/anchor/actions

# Check Cloudflare Workers
wrangler deployments list

# Tail production logs
wrangler tail --env production

# Tail dev logs
wrangler tail --env dev
```

### Rollback

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version (if needed)
wrangler rollback --message "Rolling back due to issue"
```

## Database Migrations

Migrations need to be run separately (they're not automated in CI/CD yet):

```bash
# Dev database
pnpm db:migrate:dev
# Or: wrangler d1 migrations apply anchor-dev-db --env dev

# Production database (be careful!)
pnpm db:migrate:prod
# Or: wrangler d1 migrations apply anchor-prod-db --env production
```

## Secrets Management

Some secrets need to be set per environment:

```bash
# Set dev secrets
wrangler secret put JWT_SECRET --env dev
wrangler secret put LOGTO_APP_SECRET --env dev

# Set production secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put LOGTO_APP_SECRET --env production
```

## Testing Locally Before Deployment

```bash
# Run all checks that CI will run
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration

# Test dev deployment locally
pnpm deploy:dev

# Test prod deployment locally (careful!)
pnpm deploy:prod
```

## Troubleshooting

### Deployment Fails with "Unauthorized"

- Check that `CLOUDFLARE_API_TOKEN` is set correctly in GitHub secrets
- Verify token has correct permissions (Workers, KV, D1, R2)

### Deployment Succeeds but Site is Broken

- Check environment variables in wrangler.toml
- Verify secrets are set for the environment
- Check Cloudflare Workers logs: `wrangler tail --env dev`

### Tests Pass Locally but Fail in CI

- Ensure all dependencies are in package.json (not globally installed)
- Check Node.js version matches (20.x)
- Verify test database/fixtures are properly set up

## Next Steps

- [ ] Create `dev` branch
- [ ] Add GitHub secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
- [ ] Test deployment to dev environment
- [ ] Set up branch protection rules
- [ ] Configure production environment protection
- [ ] Consider adding database migrations to CI/CD
- [ ] Set up Slack/Discord notifications for deployments
