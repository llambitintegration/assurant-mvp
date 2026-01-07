/**
 * Global Teardown for Contract Tests
 *
 * This file is called once after all tests have completed.
 * It ensures all database connections are properly closed to prevent worker process leaks.
 */

module.exports = async () => {
  try {
    console.log('[GLOBAL TEARDOWN] Starting cleanup...');

    // Import the singleton instances used by tests
    // Note: These are imported from the TypeScript source during ts-jest execution
    let prisma, db;

    try {
      // Try to import compiled version first (if exists)
      prisma = require('../../config/prisma').default;
    } catch (e) {
      console.log('[GLOBAL TEARDOWN] Prisma module not loaded or already disconnected');
    }

    try {
      // Try to import compiled version first (if exists)
      db = require('../../config/db').default;
    } catch (e) {
      console.log('[GLOBAL TEARDOWN] DB module not loaded or already closed');
    }

    // Close Prisma connection (singleton instance)
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
      console.log('[GLOBAL TEARDOWN] Prisma connection closed');
    }

    // Close PostgreSQL pool (singleton instance)
    if (db && db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
      console.log('[GLOBAL TEARDOWN] PostgreSQL pool closed');
    }

    // Give time for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[GLOBAL TEARDOWN] All database connections closed successfully');
  } catch (error) {
    console.error('[GLOBAL TEARDOWN] Error during cleanup:', error);
    // Don't throw - allow tests to complete even if teardown has issues
  }
};
