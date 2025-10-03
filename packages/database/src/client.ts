import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

/**
 * Create a Drizzle database client
 * @param d1 - Cloudflare D1 database binding
 * @returns Drizzle ORM instance
 */
export const createDbClient = (d1: D1Database) => {
  return drizzle(d1, { schema });
};

export type DbClient = ReturnType<typeof createDbClient>;