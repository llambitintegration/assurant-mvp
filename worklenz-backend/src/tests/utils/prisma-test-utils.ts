/**
 * Prisma Test Utilities
 * Helpers for mocking Prisma client methods
 */

/**
 * Create a mock for Prisma findMany that returns specified data
 */
export function mockPrismaFindMany<T>(data: T[]): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Create a mock for Prisma count that returns specified count
 */
export function mockPrismaCount(count: number): jest.Mock {
  return jest.fn().mockResolvedValue(count);
}

/**
 * Create a mock for Prisma $queryRaw that returns specified data
 */
export function mockPrismaQueryRaw<T>(data: T[]): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Create a mock for Prisma findUnique that returns specified data
 */
export function mockPrismaFindUnique<T>(data: T | null): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Create a mock for Prisma create that returns specified data
 */
export function mockPrismaCreate<T>(data: T): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Create a mock for Prisma update that returns specified data
 */
export function mockPrismaUpdate<T>(data: T): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Create a mock for Prisma delete that returns specified data
 */
export function mockPrismaDelete<T>(data: T): jest.Mock {
  return jest.fn().mockResolvedValue(data);
}

/**
 * Setup common mocks for rcm_resources queries
 */
export function setupPrismaResourceMocks(
  prismaMock: any,
  resources: any[],
  count: number
): void {
  prismaMock.rcm_resources.findMany.mockResolvedValue(resources);
  prismaMock.rcm_resources.count.mockResolvedValue(count);
}

/**
 * Setup common mocks for rcm_allocations queries
 */
export function setupPrismaAllocationMocks(
  prismaMock: any,
  allocations: any[]
): void {
  prismaMock.rcm_allocations.findMany.mockResolvedValue(allocations);
}

/**
 * Setup common mocks for rcm_availability queries
 */
export function setupPrismaAvailabilityMocks(
  prismaMock: any,
  availability: any[]
): void {
  prismaMock.rcm_availability.findMany.mockResolvedValue(availability);
}

/**
 * Setup common mocks for rcm_unavailability_periods queries
 */
export function setupPrismaUnavailabilityMocks(
  prismaMock: any,
  unavailability: any[]
): void {
  prismaMock.rcm_unavailability_periods.findMany.mockResolvedValue(unavailability);
}

/**
 * Setup mocks for project name queries ($queryRaw)
 */
export function setupPrismaProjectMocks(
  prismaMock: any,
  projects: Array<{ id: string; name: string }>
): void {
  prismaMock.$queryRaw.mockResolvedValue(projects);
}

/**
 * Reset all Prisma mocks
 */
export function resetPrismaMocks(prismaMock: any): void {
  if (prismaMock.rcm_resources) {
    prismaMock.rcm_resources.findMany.mockReset();
    prismaMock.rcm_resources.count.mockReset();
  }
  if (prismaMock.rcm_allocations) {
    prismaMock.rcm_allocations.findMany.mockReset();
  }
  if (prismaMock.rcm_availability) {
    prismaMock.rcm_availability.findMany.mockReset();
  }
  if (prismaMock.rcm_unavailability_periods) {
    prismaMock.rcm_unavailability_periods.findMany.mockReset();
  }
  if (prismaMock.$queryRaw) {
    prismaMock.$queryRaw.mockReset();
  }
}
