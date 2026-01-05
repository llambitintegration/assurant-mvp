/**
 * Global Teardown for Contract Tests
 *
 * This file is called once after all tests have completed.
 * It ensures all database connections are properly closed to prevent worker process leaks.
 */

module.exports = async () => {
  try {
    // Import the singleton instances used by tests
    const prisma = require('../../config/prisma').default;
    const db = require('../../config/db').default;

    // Close Prisma connection (singleton instance)
    if (prisma) {
      await prisma.$disconnect();
      console.log('[GLOBAL TEARDOWN] Prisma connection closed');
    }

    // Close PostgreSQL pool (singleton instance)
    if (db && db.pool) {
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
