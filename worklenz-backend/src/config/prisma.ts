import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton instance for Resource Capacity Management (RCM) tables.
 *
 * This client is used exclusively for RCM tables (rcm_*) while existing Worklenz
 * tables continue to use raw SQL queries via the pg pool.
 *
 * Configuration:
 * - Logs queries in development for debugging
 * - Uses connection pooling (default: 10 connections)
 * - Configured via DATABASE_URL environment variable
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],

  // Connection pool settings (can be overridden in DATABASE_URL)
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Graceful shutdown handlers
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
