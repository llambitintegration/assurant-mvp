/**
 * Test Database Seeding Utility
 *
 * Provides deterministic test data generation for Prisma migration testing.
 * Supports different scenarios: minimal, full, and stress testing.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

/**
 * Seed scenarios
 */
export type SeedScenario = 'minimal' | 'full' | 'stress';

/**
 * Seed configuration
 */
export interface SeedConfig {
  scenario: SeedScenario;
  teamCount?: number;
  usersPerTeam?: number;
  projectsPerTeam?: number;
  tasksPerProject?: number;
  deterministicIds?: boolean; // Use predictable UUIDs for testing
  seedInventory?: boolean;
  seedTimeTracking?: boolean;
}

/**
 * Seed result statistics
 */
export interface SeedResult {
  teams: number;
  users: number;
  projects: number;
  tasks: number;
  inventory?: {
    suppliers: number;
    locations: number;
    components: number;
  };
  duration: number;
}

/**
 * Deterministic UUID generator for testing
 */
function generateTestUUID(prefix: string, index: number): string {
  const paddedIndex = index.toString().padStart(8, '0');
  return `${prefix}-0000-0000-0000-${paddedIndex}`.substring(0, 36);
}

/**
 * Main seed database function
 */
export async function seedDatabase(
  prisma: PrismaClient,
  config: SeedConfig
): Promise<SeedResult> {
  const startTime = Date.now();

  // Determine counts based on scenario
  const counts = getScenarioCounts(config);

  const result: SeedResult = {
    teams: 0,
    users: 0,
    projects: 0,
    tasks: 0,
    duration: 0
  };

  // Seed teams and users
  const teams = await seedTeamsAndUsers(prisma, counts.teams, counts.usersPerTeam, config);
  result.teams = teams.length;
  result.users = teams.reduce((sum, t) => sum + t.users.length, 0);

  // Seed projects and tasks
  for (const team of teams) {
    const projects = await seedProjects(
      prisma,
      team.id,
      team.users[0].id,
      counts.projectsPerTeam,
      config
    );
    result.projects += projects.length;

    for (const project of projects) {
      const tasks = await seedTasks(
        prisma,
        team.id,
        project.id,
        team.users,
        counts.tasksPerProject,
        config
      );
      result.tasks += tasks.length;
    }
  }

  // Seed inventory if requested
  if (config.seedInventory) {
    const inventoryResult = await seedInventory(prisma, teams, config);
    result.inventory = inventoryResult;
  }

  result.duration = Date.now() - startTime;

  return result;
}

/**
 * Get counts based on scenario
 */
function getScenarioCounts(config: SeedConfig): {
  teams: number;
  usersPerTeam: number;
  projectsPerTeam: number;
  tasksPerProject: number;
} {
  const { scenario } = config;

  switch (scenario) {
    case 'minimal':
      return {
        teams: config.teamCount || 1,
        usersPerTeam: config.usersPerTeam || 2,
        projectsPerTeam: config.projectsPerTeam || 1,
        tasksPerProject: config.tasksPerProject || 3
      };

    case 'full':
      return {
        teams: config.teamCount || 3,
        usersPerTeam: config.usersPerTeam || 5,
        projectsPerTeam: config.projectsPerTeam || 5,
        tasksPerProject: config.tasksPerProject || 10
      };

    case 'stress':
      return {
        teams: config.teamCount || 10,
        usersPerTeam: config.usersPerTeam || 20,
        projectsPerTeam: config.projectsPerTeam || 20,
        tasksPerProject: config.tasksPerProject || 50
      };

    default:
      return {
        teams: 1,
        usersPerTeam: 2,
        projectsPerTeam: 1,
        tasksPerProject: 3
      };
  }
}

/**
 * Seed teams and users
 */
async function seedTeamsAndUsers(
  prisma: PrismaClient,
  teamCount: number,
  usersPerTeam: number,
  config: SeedConfig
): Promise<Array<{ id: string; users: Array<{ id: string; email: string }> }>> {
  const teams: Array<{ id: string; users: Array<{ id: string; email: string }> }> = [];

  for (let t = 1; t <= teamCount; t++) {
    const teamId = config.deterministicIds
      ? generateTestUUID('team', t)
      : undefined;

    // Create team
    const team = await prisma.teams.create({
      data: {
        id: teamId,
        name: `Test Team ${t}`,
        user_id: teamId || undefined // Will be updated after first user creation
      }
    });

    const users: Array<{ id: string; email: string }> = [];

    // Create users for this team
    for (let u = 1; u <= usersPerTeam; u++) {
      const userId = config.deterministicIds
        ? generateTestUUID(`user-t${t}`, u)
        : undefined;

      const email = `test-t${t}-u${u}@example.com`;
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

      const user = await prisma.users.create({
        data: {
          id: userId,
          email,
          name: `Test User ${t}-${u}`,
          password: hashedPassword,
          email_verified: true
        }
      });

      // Add user to team
      await prisma.team_members.create({
        data: {
          team_id: team.id,
          user_id: user.id,
          role_id: null, // Default role
          created_at: new Date()
        }
      });

      users.push({ id: user.id, email: user.email });
    }

    // Update team owner to first user
    if (users.length > 0) {
      await prisma.teams.update({
        where: { id: team.id },
        data: { user_id: users[0].id }
      });
    }

    teams.push({ id: team.id, users });
  }

  return teams;
}

/**
 * Seed projects
 */
async function seedProjects(
  prisma: PrismaClient,
  teamId: string,
  ownerId: string,
  projectCount: number,
  config: SeedConfig
): Promise<Array<{ id: string; name: string }>> {
  const projects: Array<{ id: string; name: string }> = [];

  for (let p = 1; p <= projectCount; p++) {
    const projectId = config.deterministicIds
      ? generateTestUUID(`proj-${teamId.substring(0, 8)}`, p)
      : undefined;

    // Create project status if needed
    const status = await prisma.project_statuses.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Active',
        color_code: '#0d9488'
      }
    });

    const project = await prisma.projects.create({
      data: {
        id: projectId,
        name: `Test Project ${p}`,
        team_id: teamId,
        user_id: ownerId,
        status_id: status.id,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    projects.push({ id: project.id, name: project.name });
  }

  return projects;
}

/**
 * Seed tasks
 */
async function seedTasks(
  prisma: PrismaClient,
  teamId: string,
  projectId: string,
  users: Array<{ id: string }>,
  taskCount: number,
  config: SeedConfig
): Promise<Array<{ id: string }>> {
  const tasks: Array<{ id: string }> = [];

  // Create task status if needed
  const status = await prisma.task_statuses.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'To Do',
      color_code: '#64748b',
      category_id: null
    }
  });

  for (let t = 1; t <= taskCount; t++) {
    const taskId = config.deterministicIds
      ? generateTestUUID(`task-${projectId.substring(0, 8)}`, t)
      : undefined;

    const task = await prisma.tasks.create({
      data: {
        id: taskId,
        name: `Test Task ${t}`,
        project_id: projectId,
        team_id: teamId,
        status_id: status.id,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Assign task to random user
    const assigneeIndex = t % users.length;
    await prisma.task_members.create({
      data: {
        task_id: task.id,
        team_member_id: users[assigneeIndex].id
      }
    });

    tasks.push({ id: task.id });
  }

  return tasks;
}

/**
 * Seed inventory data
 */
async function seedInventory(
  prisma: PrismaClient,
  teams: Array<{ id: string; users: Array<{ id: string }> }>,
  config: SeedConfig
): Promise<{ suppliers: number; locations: number; components: number }> {
  let supplierCount = 0;
  let locationCount = 0;
  let componentCount = 0;

  for (const team of teams) {
    const userId = team.users[0].id;

    // Create suppliers
    for (let s = 1; s <= 3; s++) {
      const supplier = await prisma.inv_suppliers.create({
        data: {
          name: `Test Supplier ${s}`,
          contact_person: `Contact Person ${s}`,
          email: `supplier${s}@test.com`,
          team_id: team.id,
          created_by: userId
        }
      });
      supplierCount++;

      // Create components for this supplier
      for (let c = 1; c <= 5; c++) {
        await prisma.inv_components.create({
          data: {
            name: `Component ${s}-${c}`,
            sku: `SKU-${s}-${c.toString().padStart(3, '0')}`,
            description: `Test component ${c} from supplier ${s}`,
            category: 'Electronics',
            owner_type: 'supplier',
            supplier_id: supplier.id,
            quantity: c * 10,
            unit: 'pcs',
            unit_cost: 9.99 + c,
            reorder_level: 5,
            reorder_quantity: 20,
            team_id: team.id,
            created_by: userId
          }
        });
        componentCount++;
      }
    }

    // Create storage locations
    for (let l = 1; l <= 2; l++) {
      const location = await prisma.inv_storage_locations.create({
        data: {
          location_code: `LOC-${l.toString().padStart(3, '0')}`,
          name: `Test Location ${l}`,
          description: `Storage location ${l}`,
          team_id: team.id,
          created_by: userId
        }
      });
      locationCount++;

      // Create components for this location
      for (let c = 1; c <= 3; c++) {
        await prisma.inv_components.create({
          data: {
            name: `Location Component ${l}-${c}`,
            sku: `LOC-SKU-${l}-${c.toString().padStart(3, '0')}`,
            owner_type: 'storage_location',
            storage_location_id: location.id,
            quantity: c * 5,
            unit: 'pcs',
            team_id: team.id,
            created_by: userId
          }
        });
        componentCount++;
      }
    }
  }

  return { suppliers: supplierCount, locations: locationCount, components: componentCount };
}

/**
 * Clean database - removes all test data while preserving schema
 */
export async function cleanDatabase(
  prisma: PrismaClient,
  options: { preserveAdmin?: boolean } = {}
): Promise<void> {
  // Delete in correct order to respect foreign key constraints

  // Tasks and related
  await prisma.task_members.deleteMany({});
  await prisma.tasks.deleteMany({});

  // Projects
  await prisma.projects.deleteMany({});

  // Inventory
  await prisma.inv_transactions.deleteMany({});
  await prisma.inv_barcode_mappings.deleteMany({});
  await prisma.inv_components.deleteMany({});
  await prisma.inv_storage_locations.deleteMany({});
  await prisma.inv_suppliers.deleteMany({});

  // Teams and users
  await prisma.team_members.deleteMany({});

  if (!options.preserveAdmin) {
    await prisma.teams.deleteMany({});
    await prisma.users.deleteMany({});
  } else {
    // Delete only test teams and users
    const testEmails = await prisma.users.findMany({
      where: {
        email: {
          contains: '@example.com'
        }
      },
      select: { id: true }
    });

    const testUserIds = testEmails.map(u => u.id);

    await prisma.teams.deleteMany({
      where: {
        name: {
          startsWith: 'Test Team'
        }
      }
    });

    await prisma.users.deleteMany({
      where: {
        id: {
          in: testUserIds
        }
      }
    });
  }
}

/**
 * Quick seed for testing - creates minimal data
 */
export async function quickSeed(prisma: PrismaClient): Promise<{
  teamId: string;
  userId: string;
  projectId: string;
  taskId: string;
}> {
  const result = await seedDatabase(prisma, {
    scenario: 'minimal',
    deterministicIds: false,
    seedInventory: false
  });

  // Get the created IDs
  const team = await prisma.teams.findFirst({
    where: { name: { startsWith: 'Test Team' } }
  });

  const user = await prisma.users.findFirst({
    where: { email: { contains: '@example.com' } }
  });

  const project = await prisma.projects.findFirst({
    where: { team_id: team?.id }
  });

  const task = await prisma.tasks.findFirst({
    where: { project_id: project?.id }
  });

  if (!team || !user || !project || !task) {
    throw new Error('Failed to create test data');
  }

  return {
    teamId: team.id,
    userId: user.id,
    projectId: project.id,
    taskId: task.id
  };
}

/**
 * Seed a specific module only
 */
export async function seedModule(
  prisma: PrismaClient,
  module: 'inventory' | 'tasks' | 'projects',
  teamId: string,
  userId: string,
  count: number = 5
): Promise<void> {
  switch (module) {
    case 'inventory':
      await seedInventory(prisma, [{ id: teamId, users: [{ id: userId }] }], {
        scenario: 'minimal'
      });
      break;

    case 'projects':
      await seedProjects(prisma, teamId, userId, count, { scenario: 'minimal' });
      break;

    case 'tasks': {
      const project = await prisma.projects.findFirst({
        where: { team_id: teamId }
      });
      if (project) {
        await seedTasks(
          prisma,
          teamId,
          project.id,
          [{ id: userId }],
          count,
          { scenario: 'minimal' }
        );
      }
      break;
    }
  }
}
