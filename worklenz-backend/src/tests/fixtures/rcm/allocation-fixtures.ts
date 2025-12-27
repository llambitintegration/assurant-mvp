/**
 * Allocation Test Fixtures
 * Provides mock allocation data for testing
 */

import { Prisma } from '@prisma/client';

/**
 * Base allocation properties
 */
const baseAllocationProps = {
  is_active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
  notes: null,
};

/**
 * Create a mock allocation
 */
export function createMockAllocation(overrides: any = {}): any {
  return {
    id: 'allocation-1-uuid',
    resource_id: 'resource-1-uuid',
    project_id: 'project-1-uuid',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-01-31'),
    allocation_percent: new Prisma.Decimal(50),
    project_name: 'Test Project',
    ...baseAllocationProps,
    ...overrides,
  };
}

/**
 * Create an allocation for a specific percentage
 */
export function createAllocationWithPercent(percent: number, overrides: any = {}): any {
  return createMockAllocation({
    allocation_percent: new Prisma.Decimal(percent),
    ...overrides,
  });
}

/**
 * Create overlapping allocations (for testing utilization > 100%)
 */
export function createOverlappingAllocations(resourceId = 'resource-1-uuid'): any[] {
  return [
    createMockAllocation({
      id: 'alloc-1-uuid',
      resource_id: resourceId,
      project_id: 'project-1-uuid',
      project_name: 'Project Alpha',
      allocation_percent: new Prisma.Decimal(40),
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-15'),
    }),
    createMockAllocation({
      id: 'alloc-2-uuid',
      resource_id: resourceId,
      project_id: 'project-2-uuid',
      project_name: 'Project Beta',
      allocation_percent: new Prisma.Decimal(60),
      start_date: new Date('2024-01-10'),
      end_date: new Date('2024-01-31'),
    }),
  ];
}

/**
 * Create overutilized scenario (total > 100%)
 */
export function createOverutilizedScenario(resourceId = 'resource-1-uuid'): any[] {
  return [
    createAllocationWithPercent(80, {
      id: 'alloc-1-uuid',
      resource_id: resourceId,
      project_id: 'project-1-uuid',
      project_name: 'Project A',
    }),
    createAllocationWithPercent(40, {
      id: 'alloc-2-uuid',
      resource_id: resourceId,
      project_id: 'project-2-uuid',
      project_name: 'Project B',
    }),
  ];
}

/**
 * Create optimal utilization scenario (80-100%)
 */
export function createOptimalScenario(resourceId = 'resource-1-uuid'): any[] {
  return [
    createAllocationWithPercent(50, {
      id: 'alloc-1-uuid',
      resource_id: resourceId,
      project_id: 'project-1-uuid',
      project_name: 'Project A',
    }),
    createAllocationWithPercent(40, {
      id: 'alloc-2-uuid',
      resource_id: resourceId,
      project_id: 'project-2-uuid',
      project_name: 'Project B',
    }),
  ];
}

/**
 * Create allocations for a specific date range
 */
export function createAllocationsInRange(startDate: Date, endDate: Date, resourceId = 'resource-1-uuid'): any[] {
  return [
    createMockAllocation({
      resource_id: resourceId,
      start_date: startDate,
      end_date: endDate,
      allocation_percent: new Prisma.Decimal(50),
    }),
  ];
}

/**
 * Create allocation that partially overlaps with a period
 */
export function createPartiallyOverlappingAllocation(periodStart: Date, periodEnd: Date, resourceId = 'resource-1-uuid'): any {
  const midPoint = new Date((periodStart.getTime() + periodEnd.getTime()) / 2);

  return createMockAllocation({
    resource_id: resourceId,
    start_date: new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before period
    end_date: midPoint, // Ends halfway through period
    allocation_percent: new Prisma.Decimal(50),
  });
}

/**
 * Create multiple allocations for different projects
 */
export function createMultiProjectAllocations(resourceId = 'resource-1-uuid', count = 3): any[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockAllocation({
      id: `alloc-${i + 1}-uuid`,
      resource_id: resourceId,
      project_id: `project-${i + 1}-uuid`,
      project_name: `Project ${String.fromCharCode(65 + i)}`, // Project A, B, C, etc.
      allocation_percent: new Prisma.Decimal(30 + i * 10), // 30%, 40%, 50%
    });
  });
}

/**
 * Create allocation with no active flag (inactive)
 */
export function createInactiveAllocation(overrides: any = {}): any {
  return createMockAllocation({
    is_active: false,
    ...overrides,
  });
}
