/**
 * Database Lazy Loader for Tests
 *
 * Provides lazy-loading utilities for database connections in tests.
 * This prevents database connections from being established during module import,
 * which can cause timeout issues in Jest.
 *
 * Usage:
 *
 * Instead of:
 *   import db from '../../config/db';
 *
 * Use:
 *   import { getDb } from '../utils/db-lazy-loader';
 *   const db = getDb();
 */

import type { QueryResult } from 'pg';
import type { PrismaClient } from '@prisma/client';

/**
 * Get database connection (lazy-loaded)
 * Only connects when first accessed, not during module import
 */
export function getDb(): {
  pool: any;
  query: (text: string, params?: unknown[]) => Promise<QueryResult<any>>;
} {
  return require('../../config/db').default;
}

/**
 * Get Prisma client (lazy-loaded)
 * Only connects when first accessed, not during module import
 */
export function getPrisma(): PrismaClient {
  return require('../../config/prisma').default;
}

/**
 * Close all database connections
 * Call this in afterAll() or test cleanup
 */
export async function closeAllConnections(): Promise<void> {
  const errors: Error[] = [];

  try {
    const prisma = getPrisma();
    await prisma.$disconnect();
    console.log('[LAZY LOADER] Prisma disconnected');
  } catch (error) {
    errors.push(error as Error);
  }

  try {
    const db = getDb();
    await db.pool.end();
    console.log('[LAZY LOADER] PostgreSQL pool closed');
  } catch (error) {
    errors.push(error as Error);
  }

  if (errors.length > 0) {
    console.warn('[LAZY LOADER] Some connections failed to close:', errors);
  }
}
