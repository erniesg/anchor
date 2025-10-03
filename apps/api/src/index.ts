import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDbClient } from '@anchor/database';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/**
 * Cloudflare Workers Environment Bindings
 */
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ENVIRONMENT: 'dev' | 'production';
  JWT_SECRET: string;
  LOGTO_APP_SECRET: string;
}

/**
 * Hono Context with Database Client
 */
export type AppContext = {
  Bindings: Env;
  Variables: {
    db: ReturnType<typeof createDbClient>;
    userId?: string;
    role?: string;
  };
};

/**
 * Initialize Hono App
 */
const app = new Hono<AppContext>();

/**
 * Middleware: CORS
 */
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://*.pages.dev', 'https://anchor.app'],
  credentials: true,
}));

/**
 * Middleware: Request Logger
 */
app.use('*', logger());

/**
 * Middleware: Database Client Injection
 */
app.use('*', async (c, next) => {
  const db = createDbClient(c.env.DB);
  c.set('db', db);
  await next();
});

/**
 * Health Check Endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root Endpoint
 */
app.get('/', (c) => {
  return c.json({
    name: 'Anchor API',
    version: '0.1.0',
    environment: c.env.ENVIRONMENT,
    message: 'Structure for Sanity, Connection for the Heart',
  });
});

/**
 * API Routes
 */
import auth from './routes/auth';
import careRecipientsRoute from './routes/care-recipients';
import caregiversRoute from './routes/caregivers';
import careLogsRoute from './routes/care-logs';

app.route('/auth', auth);
app.route('/care-recipients', careRecipientsRoute);
app.route('/caregivers', caregiversRoute);
app.route('/care-logs', careLogsRoute);
// app.route('/dashboard', dashboardRoutes);
// app.route('/alerts', alertsRoutes);

/**
 * 404 Handler
 */
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

/**
 * Error Handler
 */
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: c.env.ENVIRONMENT === 'dev' ? err.message : 'Something went wrong',
  }, 500);
});

/**
 * Export Hono App
 */
export default app;