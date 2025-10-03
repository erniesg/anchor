#!/usr/bin/env node

/**
 * Cloudflare Setup Script
 *
 * Automatically creates:
 * - D1 databases (dev + prod)
 * - R2 buckets (dev + prod)
 * - Updates wrangler.toml files
 *
 * Usage:
 *   pnpm setup:cloudflare
 *
 * Requirements:
 *   - .env file with CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
 *   - wrangler CLI installed
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  DB_NAME_DEV = 'anchor-dev-db',
  DB_NAME_PROD = 'anchor-prod-db',
  R2_BUCKET_DEV = 'anchor-dev-storage',
  R2_BUCKET_PROD = 'anchor-prod-storage',
  WORKER_NAME_DEV = 'anchor-dev-api',
  WORKER_NAME_PROD = 'anchor-prod-api',
} = process.env;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`);
const success = (msg) => log(`✓ ${msg}`, 'green');
const info = (msg) => log(`ℹ ${msg}`, 'blue');
const warn = (msg) => log(`⚠ ${msg}`, 'yellow');
const error = (msg) => log(`✗ ${msg}`, 'red');

// Validation
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  error('Missing required environment variables!');
  error('Please create a .env file with:');
  error('  CLOUDFLARE_ACCOUNT_ID="your-account-id"');
  error('  CLOUDFLARE_API_TOKEN="your-api-token"');
  process.exit(1);
}

// Helper to run wrangler commands
const runWrangler = (command, silent = false) => {
  try {
    const result = execSync(`wrangler ${command}`, {
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN,
      },
      encoding: 'utf-8',
    });
    if (!silent) info(result);
    return result;
  } catch (err) {
    if (!silent) error(err.message);
    throw err;
  }
};

// Create D1 database
const createD1Database = (name, env) => {
  info(`Creating D1 database: ${name}...`);

  try {
    const output = runWrangler(`d1 create ${name}`);

    // Extract database ID from output
    const idMatch = output.match(/database_id = "([^"]+)"/);
    if (!idMatch) {
      throw new Error('Could not extract database ID from wrangler output');
    }

    const databaseId = idMatch[1];
    success(`Created D1 database: ${name} (${databaseId})`);

    return databaseId;
  } catch (err) {
    if (err.message.includes('already exists')) {
      warn(`Database ${name} already exists, listing to get ID...`);
      const output = runWrangler('d1 list');
      const regex = new RegExp(`${name}.*([a-f0-9-]{36})`);
      const match = output.match(regex);
      if (match) {
        const databaseId = match[1];
        info(`Found existing database: ${name} (${databaseId})`);
        return databaseId;
      }
    }
    throw err;
  }
};

// Create R2 bucket
const createR2Bucket = (name, env) => {
  info(`Creating R2 bucket: ${name}...`);

  try {
    runWrangler(`r2 bucket create ${name}`);
    success(`Created R2 bucket: ${name}`);
  } catch (err) {
    if (err.message.includes('already exists')) {
      warn(`Bucket ${name} already exists, skipping...`);
    } else {
      throw err;
    }
  }
};

// Update wrangler.toml
const updateWranglerToml = (env, databaseId) => {
  const wranglerPath = join(process.cwd(), 'apps', 'api', 'wrangler.toml');

  if (!existsSync(wranglerPath)) {
    error(`wrangler.toml not found at ${wranglerPath}`);
    return;
  }

  let content = readFileSync(wranglerPath, 'utf-8');

  // Update database_id for the environment
  const envSection = env === 'dev' ? '[env.dev]' : '[env.production]';
  const dbRegex = new RegExp(`(${envSection}[\\s\\S]*?database_id = ")[^"]*(")`);

  if (dbRegex.test(content)) {
    content = content.replace(dbRegex, `$1${databaseId}$2`);
    writeFileSync(wranglerPath, content);
    success(`Updated wrangler.toml with ${env} database ID`);
  } else {
    warn(`Could not find ${env} environment in wrangler.toml`);
  }
};

// Main setup
const main = async () => {
  log('\n🚀 Starting Cloudflare Setup...\n', 'blue');

  try {
    // Verify wrangler is installed
    info('Checking wrangler installation...');
    runWrangler('--version', true);
    success('Wrangler CLI is installed');

    // Login check
    info('Checking Cloudflare authentication...');
    try {
      runWrangler('whoami', true);
      success('Authenticated with Cloudflare');
    } catch {
      warn('Not authenticated, attempting login...');
      runWrangler('login');
    }

    log('\n📦 Setting up Development Environment...\n', 'blue');

    // Create dev resources
    const devDbId = createD1Database(DB_NAME_DEV, 'dev');
    createR2Bucket(R2_BUCKET_DEV, 'dev');
    updateWranglerToml('dev', devDbId);

    log('\n📦 Setting up Production Environment...\n', 'blue');

    // Create prod resources
    const prodDbId = createD1Database(DB_NAME_PROD, 'prod');
    createR2Bucket(R2_BUCKET_PROD, 'prod');
    updateWranglerToml('production', prodDbId);

    // Save IDs to .env.local
    log('\n💾 Saving configuration...\n', 'blue');
    const envLocal = `
# Auto-generated by setup-cloudflare.js
# ${new Date().toISOString()}

# Development Database
DATABASE_ID_DEV="${devDbId}"
DATABASE_NAME_DEV="${DB_NAME_DEV}"

# Production Database
DATABASE_ID_PROD="${prodDbId}"
DATABASE_NAME_PROD="${DB_NAME_PROD}"

# R2 Buckets
R2_BUCKET_DEV="${R2_BUCKET_DEV}"
R2_BUCKET_PROD="${R2_BUCKET_PROD}"

# Worker Names
WORKER_NAME_DEV="${WORKER_NAME_DEV}"
WORKER_NAME_PROD="${WORKER_NAME_PROD}"
`;

    writeFileSync('.env.local', envLocal);
    success('Saved configuration to .env.local');

    log('\n✨ Cloudflare Setup Complete!\n', 'green');
    log('Next steps:', 'blue');
    log('  1. Review .env.local for generated resource IDs');
    log('  2. Run: pnpm db:generate    (generate database schema)');
    log('  3. Run: pnpm db:migrate:dev (apply migrations to dev DB)');
    log('  4. Run: pnpm dev            (start development servers)');
    log('');

  } catch (err) {
    error(`\nSetup failed: ${err.message}`);
    process.exit(1);
  }
};

main();