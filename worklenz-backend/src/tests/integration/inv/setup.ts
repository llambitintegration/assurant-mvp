/**
 * Integration Test Setup for Inventory Management
 * Provides database connection utilities, test database setup/teardown,
 * and transaction management for test isolation
 */

import { PrismaClient } from '@prisma/client';

// Singleton Prisma client for integration tests
let prisma: PrismaClient | null = null;

/**
 * Get or create the Prisma client for integration tests
 * Uses the DATABASE_URL from environment variables
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
 * Connect to the database
 * Should be called in beforeAll hook
 */
export async function setupDatabase(): Promise<void> {
  const client = getPrismaClient();
  await client.$connect();
  console.log('[TEST SETUP] Database connection established');
}

/**
 * Disconnect from the database
 * Should be called in afterAll hook
 */
export async function teardownDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('[TEST TEARDOWN] Database connection closed');
  }
}

/**
 * Clean up inventory test data for a specific team
 * This ensures test isolation by removing all data created during tests
 */
export async function cleanupInventoryData(teamId: string): Promise<void> {
  const client = getPrismaClient();

  try {
    // Delete in correct order to respect foreign key constraints
    // Transactions reference components
    await client.inv_transactions.deleteMany({
      where: { team_id: teamId }
    });

    // Barcode mappings reference components
    await client.inv_barcode_mappings.deleteMany({
      where: { team_id: teamId }
    });

    // Components reference suppliers and storage locations
    await client.inv_components.deleteMany({
      where: { team_id: teamId }
    });

    // Storage locations (handle hierarchy - delete children first)
    // Get all locations for the team
    const locations = await client.inv_storage_locations.findMany({
      where: { team_id: teamId },
      orderBy: { created_at: 'desc' } // Delete newest first (likely to be children)
    });

    // Delete all locations
    for (const location of locations) {
      await client.inv_storage_locations.delete({
        where: { id: location.id }
      });
    }

    // Suppliers
    await client.inv_suppliers.deleteMany({
      where: { team_id: teamId }
    });

    console.log(`[TEST CLEANUP] Cleaned up inventory data for team: ${teamId}`);
  } catch (error) {
    console.error('[TEST CLEANUP] Error cleaning up inventory data:', error);
    throw error;
  }
}

/**
 * Clean up all test data (use with caution)
 * This removes ALL inventory data - only use in dedicated test environments
 */
export async function cleanupAllInventoryData(): Promise<void> {
  const client = getPrismaClient();

  try {
    // Use raw SQL for faster cleanup in test environments
    await client.$executeRaw`TRUNCATE TABLE inv_transactions CASCADE`;
    await client.$executeRaw`TRUNCATE TABLE inv_barcode_mappings CASCADE`;
    await client.$executeRaw`TRUNCATE TABLE inv_components CASCADE`;
    await client.$executeRaw`TRUNCATE TABLE inv_storage_locations CASCADE`;
    await client.$executeRaw`TRUNCATE TABLE inv_suppliers CASCADE`;

    console.log('[TEST CLEANUP] Truncated all inventory tables');
  } catch (error) {
    console.error('[TEST CLEANUP] Error truncating inventory tables:', error);
    throw error;
  }
}

/**
 * Execute a callback within a transaction that will be rolled back
 * This provides perfect test isolation without affecting the database
 *
 * Note: This approach has limitations with some Prisma operations
 * For full integration tests, use cleanup functions instead
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  const client = getPrismaClient();

  try {
    return await client.$transaction(async (tx) => {
      await callback(tx as PrismaClient);
      // Force rollback by throwing an error
      throw new Error('ROLLBACK_TRANSACTION');
    });
  } catch (error: any) {
    if (error.message === 'ROLLBACK_TRANSACTION') {
      // Transaction was rolled back successfully
      return {} as T;
    }
    throw error;
  }
}

/**
 * Get a test team from the database
 * Returns the first available team or creates one if needed
 */
export async function getTestTeam(): Promise<{ id: string; name: string }> {
  const client = getPrismaClient();

  // Try to get the admin team from environment
  const adminTeamName = process.env.ADMIN_TEAM_NAME || 'LlambitIntegration';

  let team = await client.teams.findFirst({
    where: { name: adminTeamName }
  });

  if (!team) {
    // Get any team
    team = await client.teams.findFirst();
  }

  if (!team) {
    throw new Error('No test team found in database. Please run database initialization.');
  }

  return {
    id: team.id,
    name: team.name
  };
}

/**
 * Get a test user from the database
 * Returns the first user in the test team
 */
export async function getTestUser(teamId: string): Promise<{ id: string; email: string }> {
  const client = getPrismaClient();

  const teamMember = await client.team_members.findFirst({
    where: { team_id: teamId },
    include: { user: true }
  });

  if (!teamMember || !teamMember.user) {
    throw new Error('No test user found in database. Please run database initialization.');
  }

  return {
    id: teamMember.user.id,
    email: teamMember.user.email
  };
}

/**
 * Wait for a specified amount of time
 * Useful for waiting for async operations to complete
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Setup function to be called in beforeAll hooks
 */
export async function setupIntegrationTest(): Promise<{
  teamId: string;
  userId: string;
  prisma: PrismaClient;
}> {
  await setupDatabase();
  const team = await getTestTeam();
  const user = await getTestUser(team.id);

  return {
    teamId: team.id,
    userId: user.id,
    prisma: getPrismaClient()
  };
}

/**
 * Teardown function to be called in afterAll hooks
 */
export async function teardownIntegrationTest(teamId: string): Promise<void> {
  await cleanupInventoryData(teamId);
  await teardownDatabase();
}

/**
 * Clean function to be called in afterEach hooks
 * This cleans up data created during each test
 */
export async function cleanAfterEach(teamId: string): Promise<void> {
  await cleanupInventoryData(teamId);
}
