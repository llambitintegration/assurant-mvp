/**
 * Prisma Client Mock
 * Provides a mock of the Prisma client for testing
 * Compatible with Jest's automocking feature
 */

import { PrismaClient } from '@prisma/client';

/**
 * Create mock functions for Prisma operations
 */
const createMockPrismaModel = () => ({
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

/**
 * Mock Prisma client with all RCM models
 */
const prismaMock = {
  rcm_resources: createMockPrismaModel(),
  rcm_allocations: createMockPrismaModel(),
  rcm_availability: createMockPrismaModel(),
  rcm_unavailability_periods: createMockPrismaModel(),
  rcm_skills: createMockPrismaModel(),
  rcm_resource_skills: createMockPrismaModel(),
  rcm_departments: createMockPrismaModel(),
  rcm_resource_department_assignments: createMockPrismaModel(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

/**
 * Reset all mocks on the Prisma client
 * Call this in beforeEach() to ensure test isolation
 */
export function resetPrismaMock(): void {
  // Reset all model mocks
  Object.keys(prismaMock).forEach((key) => {
    const model = (prismaMock as any)[key];
    if (model && typeof model === 'object') {
      Object.keys(model).forEach((method) => {
        if (typeof model[method]?.mockReset === 'function') {
          model[method].mockReset();
        }
      });
    }
    if (typeof model?.mockReset === 'function') {
      model.mockReset();
    }
  });
}

/**
 * Export the mock Prisma client as the default export
 */
export default prismaMock;
