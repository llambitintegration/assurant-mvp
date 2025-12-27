/**
 * Allocation Test Fixtures
 *
 * Allocation period generators for testing allocation calculator functionality.
 * Includes test cases for merging, aggregating, and splitting allocations.
 */

import { AllocationPeriod } from '../../../utils/data-migration/extractors/allocation-calculator';
import { generateResourceId, generateProjectId } from '../../../utils/data-migration/uuid-generation/deterministic-uuid';

// ============================================================================
// BASIC ALLOCATION GENERATORS
// ============================================================================

/**
 * Create a simple allocation period.
 *
 * @param overrides - Optional overrides for allocation fields
 * @returns AllocationPeriod object
 */
export function createAllocation(overrides?: Partial<AllocationPeriod>): AllocationPeriod {
  const defaults: AllocationPeriod = {
    resourceId: generateResourceId('test.user@example.com'),
    projectId: generateProjectId('Test Project'),
    startDate: '2025-01-01',
    endDate: '2025-01-07',
    percentAllocation: 50,
    hoursPerWeek: 20,
    notes: '20 hours/week',
  };

  return { ...defaults, ...overrides };
}

/**
 * Create multiple allocations with sequential dates.
 *
 * @param count - Number of allocations to create
 * @param params - Parameters for allocation generation
 * @returns Array of AllocationPeriod objects
 */
export interface AllocationSequenceParams {
  resourceEmail?: string;
  projectName?: string;
  percentAllocation?: number;
  startDate?: string;
  weekLength?: number;
}

export function createAllocationSequence(
  count: number,
  params: AllocationSequenceParams = {}
): AllocationPeriod[] {
  const {
    resourceEmail = 'test.user@example.com',
    projectName = 'Test Project',
    percentAllocation = 50,
    startDate = '2025-01-01',
    weekLength = 7,
  } = params;

  const resourceId = generateResourceId(resourceEmail);
  const projectId = generateProjectId(projectName);

  const allocations: AllocationPeriod[] = [];

  for (let i = 0; i < count; i++) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + i * weekLength);

    const end = new Date(start);
    end.setDate(start.getDate() + weekLength - 1);

    allocations.push({
      resourceId,
      projectId,
      startDate: formatDate(start),
      endDate: formatDate(end),
      percentAllocation,
      hoursPerWeek: (percentAllocation / 100) * 40,
      notes: `${(percentAllocation / 100) * 40} hours/week`,
    });
  }

  return allocations;
}

// ============================================================================
// MERGE CONSECUTIVE PERIODS TEST CASES
// ============================================================================

/**
 * Consecutive allocations (should be merged).
 */
export function createConsecutiveAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('john.doe@example.com');
  const projectId = generateProjectId('P0003C');

  return [
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-08',
      endDate: '2025-01-14',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-15',
      endDate: '2025-01-21',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
  ];
}

/**
 * Non-consecutive allocations (should NOT be merged).
 */
export function createNonConsecutiveAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('john.doe@example.com');
  const projectId = generateProjectId('P0003C');

  return [
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    // Gap of 1 week
    {
      resourceId,
      projectId,
      startDate: '2025-01-15',
      endDate: '2025-01-21',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    // Gap of 1 week
    {
      resourceId,
      projectId,
      startDate: '2025-01-29',
      endDate: '2025-02-04',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
  ];
}

/**
 * Consecutive allocations with different percentages (should NOT be merged).
 */
export function createConsecutiveDifferentPercentAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('john.doe@example.com');
  const projectId = generateProjectId('P0003C');

  return [
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-08',
      endDate: '2025-01-14',
      percentAllocation: 75,
      hoursPerWeek: 30,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-15',
      endDate: '2025-01-21',
      percentAllocation: 100,
      hoursPerWeek: 40,
    },
  ];
}

/**
 * Consecutive allocations for different resources (should NOT be merged).
 */
export function createMultiResourceAllocations(): AllocationPeriod[] {
  const projectId = generateProjectId('P0003C');

  return [
    {
      resourceId: generateResourceId('john.doe@example.com'),
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId: generateResourceId('jane.smith@example.com'),
      projectId,
      startDate: '2025-01-08',
      endDate: '2025-01-14',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId: generateResourceId('bob.jones@example.com'),
      projectId,
      startDate: '2025-01-15',
      endDate: '2025-01-21',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
  ];
}

/**
 * Consecutive allocations for different projects (should NOT be merged).
 */
export function createMultiProjectAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('john.doe@example.com');

  return [
    {
      resourceId,
      projectId: generateProjectId('Project A'),
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId: generateProjectId('Project B'),
      startDate: '2025-01-08',
      endDate: '2025-01-14',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId: generateProjectId('Project C'),
      startDate: '2025-01-15',
      endDate: '2025-01-21',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
  ];
}

/**
 * Complex scenario: Mix of consecutive and non-consecutive allocations.
 */
export function createMixedAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('john.doe@example.com');
  const projectId = generateProjectId('P0003C');

  return [
    // Group 1: Consecutive (should merge)
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-08',
      endDate: '2025-01-14',
      percentAllocation: 50,
      hoursPerWeek: 20,
    },

    // Gap

    // Group 2: Single allocation
    {
      resourceId,
      projectId,
      startDate: '2025-01-22',
      endDate: '2025-01-28',
      percentAllocation: 75,
      hoursPerWeek: 30,
    },

    // Group 3: Consecutive (should merge)
    {
      resourceId,
      projectId,
      startDate: '2025-01-29',
      endDate: '2025-02-04',
      percentAllocation: 100,
      hoursPerWeek: 40,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-02-05',
      endDate: '2025-02-11',
      percentAllocation: 100,
      hoursPerWeek: 40,
    },
    {
      resourceId,
      projectId,
      startDate: '2025-02-12',
      endDate: '2025-02-18',
      percentAllocation: 100,
      hoursPerWeek: 40,
    },
  ];
}

// ============================================================================
// MULTI-ROLE ALLOCATION TEST CASES
// ============================================================================

/**
 * Multi-role allocations (same resource, same project, different roles).
 */
export function createMultiRoleAllocations(): AllocationPeriod[] {
  const resourceId = generateResourceId('tabitha.brown@example.com');
  const projectId = generateProjectId('P0003C');

  return [
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 30,
      hoursPerWeek: 12,
      role: 'Purchasing',
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 20,
      hoursPerWeek: 8,
      role: 'Quoting',
    },
    {
      resourceId,
      projectId,
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      percentAllocation: 10,
      hoursPerWeek: 4,
      role: 'Buying',
    },
  ];
}

// ============================================================================
// HOURS/PERCENTAGE CONVERSION TEST CASES
// ============================================================================

export interface HoursPercentTestCase {
  hours: number;
  percent: number;
  description: string;
}

/**
 * Hours to percentage conversion test cases (40-hour work week).
 */
export const HOURS_TO_PERCENT_CASES: HoursPercentTestCase[] = [
  { hours: 0, percent: 0, description: 'No hours' },
  { hours: 10, percent: 25, description: 'Quarter time' },
  { hours: 20, percent: 50, description: 'Half time' },
  { hours: 30, percent: 75, description: 'Three-quarter time' },
  { hours: 40, percent: 100, description: 'Full time' },
  { hours: 50, percent: 125, description: 'Overtime (125%)' },
  { hours: 60, percent: 150, description: 'Overtime (150%)' },
  { hours: 80, percent: 200, description: 'Double time' },
  { hours: 1, percent: 2.5, description: '1 hour' },
  { hours: 5, percent: 12.5, description: '5 hours' },
  { hours: 15, percent: 37.5, description: '15 hours' },
  { hours: 35, percent: 87.5, description: '35 hours' },
];

// ============================================================================
// ALLOCATION SPLITTING TEST CASES
// ============================================================================

/**
 * Long allocation period (should be split into weekly periods).
 */
export function createLongAllocation(): AllocationPeriod {
  return {
    resourceId: generateResourceId('john.doe@example.com'),
    projectId: generateProjectId('P0003C'),
    startDate: '2025-01-01',
    endDate: '2025-03-31', // 13 weeks
    percentAllocation: 50,
    hoursPerWeek: 20,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format Date to YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate expected merged result count.
 *
 * Helper for determining how many allocations should remain after merging.
 */
export function getExpectedMergedCount(allocations: AllocationPeriod[]): number {
  if (allocations.length === 0) return 0;

  const sorted = [...allocations].sort((a, b) => {
    if (a.resourceId !== b.resourceId) return a.resourceId.localeCompare(b.resourceId);
    if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId);
    return a.startDate.localeCompare(b.startDate);
  });

  let mergedCount = 1;
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    const canMerge =
      current.resourceId === next.resourceId &&
      current.projectId === next.projectId &&
      current.percentAllocation === next.percentAllocation &&
      areConsecutive(current.endDate, next.startDate);

    if (canMerge) {
      current = { ...current, endDate: next.endDate };
    } else {
      mergedCount++;
      current = next;
    }
  }

  return mergedCount;
}

/**
 * Check if two periods are consecutive.
 */
function areConsecutive(endDate: string, nextStartDate: string): boolean {
  const end = new Date(endDate);
  const nextStart = new Date(nextStartDate);

  const dayAfterEnd = new Date(end);
  dayAfterEnd.setDate(end.getDate() + 1);

  return dayAfterEnd.getTime() === nextStart.getTime();
}
