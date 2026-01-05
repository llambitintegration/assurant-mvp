/**
 * Setup for Contract Tests
 * Unmocks database modules and provides test utilities
 */

// Unmock database and Prisma modules to allow real connections
jest.unmock('@prisma/client');
jest.unmock('pg');
jest.unmock('pg-pool');
jest.unmock('../../config/db');
jest.unmock('../../config/prisma');

// Unmock test utilities
jest.unmock('../utils/contract-test');
jest.unmock('../utils/shadow-compare');
jest.unmock('../utils/seed-test-database');

// Unmock services
jest.unmock('../../services/auth/auth-service');
jest.unmock('../../services/teams/teams-service');

import { PrismaClient } from '@prisma/client';
import db from '../../config/db';

// Singleton Prisma client for contract tests
let prisma: PrismaClient | null = null;

/**
 * Get or create the Prisma client for contract tests
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error']
    });
  }
  return prisma;
}

/**
 * Setup database connection for contract tests
 */
export async function setupContractTests(): Promise<PrismaClient> {
  const client = getPrismaClient();
  await client.$connect();
  console.log('[CONTRACT TEST SETUP] Database connection established');
  return client;
}

/**
 * Teardown database connection
 */
export async function teardownContractTests(): Promise<void> {
  if (prisma) {
    try {
      // Force disconnect all connections
      await prisma.$disconnect();
      prisma = null;
      console.log('[CONTRACT TEST TEARDOWN] Database connection closed');
    } catch (error) {
      console.error('[CONTRACT TEST TEARDOWN] Error during disconnect:', error);
      prisma = null;
    }
  }
}

/**
 * Global teardown - called at the end of the test suite
 */
export async function globalTeardown(): Promise<void> {
  // Disconnect Prisma
  await teardownContractTests();

  // Close PostgreSQL pool
  try {
    await db.pool.end();
    console.log('[CONTRACT TEST TEARDOWN] PostgreSQL pool closed');
  } catch (error) {
    console.error('[CONTRACT TEST TEARDOWN] Error closing pool:', error);
  }

  // Give time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Clean up test data for a team
 */
export async function cleanupContractTestData(teamId: string): Promise<void> {
  const client = getPrismaClient();

  try {
    // Clean up auth test data
    await client.users.deleteMany({
      where: {
        email: { startsWith: 'contract-test-' }
      }
    });

    // Clean up teams test data
    await client.team_members.deleteMany({
      where: { team_id: teamId }
    });

    console.log(`[CONTRACT TEST CLEANUP] Cleaned up test data for team: ${teamId}`);
  } catch (error) {
    console.error('[CONTRACT TEST CLEANUP] Error:', error);
    throw error;
  }
}

/**
 * Get or create a test team
 */
export async function getTestTeam(): Promise<{ id: string; name: string }> {
  const client = getPrismaClient();

  const adminTeamName = process.env.ADMIN_TEAM_NAME || 'LlambitIntegration';

  let team = await client.teams.findFirst({
    where: { name: adminTeamName }
  });

  if (!team) {
    team = await client.teams.findFirst();
  }

  if (!team) {
    throw new Error('No test team found. Please run database initialization.');
  }

  return {
    id: team.id,
    name: team.name
  };
}

/**
 * Get a test user from the team
 */
export async function getTestUser(teamId: string): Promise<{ id: string; email: string }> {
  const client = getPrismaClient();

  const teamMember = await client.team_members.findFirst({
    where: { team_id: teamId },
    include: { user: true }
  });

  if (!teamMember || !teamMember.user) {
    throw new Error('No test user found. Please run database initialization.');
  }

  return {
    id: teamMember.user.id,
    email: teamMember.user.email
  };
}
