/**
 * Allocation Calculation and Merging Utilities
 *
 * Utilities for calculating resource allocations, converting hours to percentages,
 * and merging consecutive allocation periods.
 *
 * @module allocation-calculator
 */

import { addDays, daysBetween } from './date-utils';

/**
 * Represents a resource allocation period
 */
export interface AllocationPeriod {
  /** Resource ID */
  resourceId: string;

  /** Project ID */
  projectId: string;

  /** Start date (YYYY-MM-DD) */
  startDate: string;

  /** End date (YYYY-MM-DD) */
  endDate: string;

  /** Hours allocated per week */
  hoursPerWeek?: number;

  /** Percentage allocation (0-100+) */
  percentAllocation: number;

  /** Role or department name */
  role?: string;

  /** Notes or description */
  notes?: string;

  /** Created by user ID */
  createdBy?: string;

  /** Active status */
  isActive?: boolean;

  /** Unique ID */
  id?: string;
}

/**
 * Convert hours per week to allocation percentage
 *
 * @param hoursPerWeek - Number of hours per week
 * @param standardWeekHours - Standard work week hours (default: 40)
 * @returns Allocation percentage (e.g., 50 for 20 hours/week)
 *
 * @example
 * ```typescript
 * hoursToPercent(20);    // => 50 (50%)
 * hoursToPercent(40);    // => 100 (100%)
 * hoursToPercent(80);    // => 200 (200% - multi-role)
 * ```
 */
export function hoursToPercent(
  hoursPerWeek: number,
  standardWeekHours: number = 40
): number {
  return Math.round((hoursPerWeek / standardWeekHours) * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Convert allocation percentage to hours per week
 *
 * @param percentAllocation - Allocation percentage
 * @param standardWeekHours - Standard work week hours (default: 40)
 * @returns Hours per week
 *
 * @example
 * ```typescript
 * percentToHours(50);    // => 20 (hours)
 * percentToHours(100);   // => 40 (hours)
 * percentToHours(200);   // => 80 (hours - multi-role)
 * ```
 */
export function percentToHours(
  percentAllocation: number,
  standardWeekHours: number = 40
): number {
  return (percentAllocation / 100) * standardWeekHours;
}

/**
 * Merge consecutive allocation periods with the same percentage
 *
 * Reduces the number of allocation records by combining consecutive weeks
 * with identical allocation percentages into single period records.
 *
 * @param allocations - Array of allocation periods (will be sorted)
 * @returns Merged allocation periods
 *
 * @example
 * ```typescript
 * const allocations = [
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 50 },
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-24', endDate: '2025-06-30', percentAllocation: 50 },
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-07-01', endDate: '2025-07-07', percentAllocation: 75 },
 * ];
 *
 * const merged = mergeConsecutivePeriods(allocations);
 * // Result: 2 periods instead of 3
 * // [
 * //   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-30', percentAllocation: 50 },
 * //   { resourceId: 'r1', projectId: 'p1', startDate: '2025-07-01', endDate: '2025-07-07', percentAllocation: 75 },
 * // ]
 * ```
 */
export function mergeConsecutivePeriods(
  allocations: AllocationPeriod[]
): AllocationPeriod[] {
  if (allocations.length === 0) {
    return [];
  }

  // Sort by resource_id, project_id, start_date
  const sorted = [...allocations].sort((a, b) => {
    if (a.resourceId !== b.resourceId) {
      return a.resourceId.localeCompare(b.resourceId);
    }
    if (a.projectId !== b.projectId) {
      return a.projectId.localeCompare(b.projectId);
    }
    return a.startDate.localeCompare(b.startDate);
  });

  const merged: AllocationPeriod[] = [];
  let current: AllocationPeriod | null = null;

  for (const alloc of sorted) {
    if (current === null) {
      // First allocation
      current = { ...alloc };
      continue;
    }

    // Check if this allocation can be merged with current
    const canMerge =
      current.resourceId === alloc.resourceId &&
      current.projectId === alloc.projectId &&
      current.percentAllocation === alloc.percentAllocation &&
      areConsecutivePeriods(current.endDate, alloc.startDate);

    if (canMerge) {
      // Extend the current period
      current.endDate = alloc.endDate;

      // If tracking hours, add them up
      if (current.hoursPerWeek && alloc.hoursPerWeek) {
        // Note: This assumes hoursPerWeek is the same for merged periods
        // If they differ, we keep the original hours
      }
    } else {
      // Save current and start new period
      merged.push(current);
      current = { ...alloc };
    }
  }

  // Don't forget the last period
  if (current !== null) {
    merged.push(current);
  }

  return merged;
}

/**
 * Check if two date periods are consecutive (no gap between them)
 *
 * @param endDate - End date of first period (YYYY-MM-DD)
 * @param startDate - Start date of second period (YYYY-MM-DD)
 * @returns true if periods are consecutive (endDate + 1 day = startDate)
 *
 * @example
 * ```typescript
 * areConsecutivePeriods('2025-06-23', '2025-06-24');  // => true
 * areConsecutivePeriods('2025-06-23', '2025-06-25');  // => false (gap)
 * ```
 */
export function areConsecutivePeriods(endDate: string, startDate: string): boolean {
  const nextDay = addDays(endDate, 1);
  return nextDay === startDate;
}

/**
 * Aggregate allocations for a resource across multiple roles/departments
 *
 * Sums allocation percentages for the same resource in the same time period.
 * Useful for handling multi-role assignments (e.g., person working 50% Engineering + 50% QA = 100%).
 *
 * @param allocations - Array of allocation periods
 * @returns Aggregated allocation periods
 *
 * @example
 * ```typescript
 * const allocations = [
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 50, role: 'Engineering' },
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 50, role: 'QA' },
 * ];
 *
 * const aggregated = aggregateMultiRoleAllocations(allocations);
 * // Result: 1 period with 100% allocation
 * // [{ resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 100, role: 'Engineering, QA' }]
 * ```
 */
export function aggregateMultiRoleAllocations(
  allocations: AllocationPeriod[]
): AllocationPeriod[] {
  // Group by resource, project, start_date, end_date
  const groups = new Map<string, AllocationPeriod[]>();

  for (const alloc of allocations) {
    const key = `${alloc.resourceId}|${alloc.projectId}|${alloc.startDate}|${alloc.endDate}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(alloc);
  }

  // Aggregate each group
  const aggregated: AllocationPeriod[] = [];

  for (const [_key, group] of groups) {

    if (group.length === 1) {
      aggregated.push(group[0]);
    } else {
      // Sum percentages and combine roles
      const totalPercent = group.reduce((sum, a) => sum + a.percentAllocation, 0);
      const roles = group.map((a) => a.role).filter(Boolean);
      const hoursTotal = group.reduce((sum, a) => sum + (a.hoursPerWeek || 0), 0);

      aggregated.push({
        ...group[0],
        percentAllocation: Math.round(totalPercent * 100) / 100,
        role: roles.length > 0 ? roles.join(', ') : undefined,
        hoursPerWeek: hoursTotal > 0 ? hoursTotal : undefined,
        notes: `Aggregated from ${group.length} roles`,
      });
    }
  }

  return aggregated;
}

/**
 * Split a long allocation period into weekly periods
 *
 * Converts a single allocation period spanning multiple weeks into
 * individual weekly allocation records.
 *
 * @param allocation - Allocation period to split
 * @returns Array of weekly allocation periods
 *
 * @example
 * ```typescript
 * const allocation = {
 *   resourceId: 'r1',
 *   projectId: 'p1',
 *   startDate: '2025-06-17',
 *   endDate: '2025-06-30', // 2 weeks
 *   percentAllocation: 50
 * };
 *
 * const weekly = splitIntoWeeklyPeriods(allocation);
 * // Result: 2 weekly periods
 * ```
 */
export function splitIntoWeeklyPeriods(allocation: AllocationPeriod): AllocationPeriod[] {
  const periods: AllocationPeriod[] = [];
  let currentStart = allocation.startDate;

  while (currentStart <= allocation.endDate) {
    const weekEnd = addDays(currentStart, 6); // 7-day week
    const actualEnd = weekEnd <= allocation.endDate ? weekEnd : allocation.endDate;

    periods.push({
      ...allocation,
      startDate: currentStart,
      endDate: actualEnd,
    });

    currentStart = addDays(actualEnd, 1);
  }

  return periods;
}

/**
 * Calculate total allocated hours for a set of allocations
 *
 * @param allocations - Array of allocation periods
 * @param standardWeekHours - Standard work week hours (default: 40)
 * @returns Total hours across all allocations
 *
 * @example
 * ```typescript
 * const allocations = [
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 50 },
 *   { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-24', endDate: '2025-06-30', percentAllocation: 100 },
 * ];
 *
 * const totalHours = calculateTotalHours(allocations);
 * // => 60 (20 hours first week + 40 hours second week)
 * ```
 */
export function calculateTotalHours(
  allocations: AllocationPeriod[],
  standardWeekHours: number = 40
): number {
  let totalHours = 0;

  for (const alloc of allocations) {
    const days = daysBetween(alloc.startDate, alloc.endDate) + 1; // +1 to include end date
    const weeks = days / 7;
    const hoursPerWeek = percentToHours(alloc.percentAllocation, standardWeekHours);
    totalHours += hoursPerWeek * weeks;
  }

  return Math.round(totalHours * 100) / 100; // Round to 2 decimals
}

/**
 * Divide total weekly hours among multiple resources equally
 *
 * Useful for departments where hours need to be split among team members.
 *
 * @param totalHours - Total hours for the week
 * @param resourceIds - Array of resource IDs to divide hours among
 * @param standardWeekHours - Standard work week hours (default: 40)
 * @returns Map of resource ID to allocation percentage
 *
 * @example
 * ```typescript
 * const allocations = divideHoursEqually(120, ['r1', 'r2', 'r3']);
 * // => { r1: 100, r2: 100, r3: 100 } (40 hours each = 100%)
 * ```
 */
export function divideHoursEqually(
  totalHours: number,
  resourceIds: string[],
  standardWeekHours: number = 40
): Map<string, number> {
  if (resourceIds.length === 0) {
    return new Map();
  }

  const hoursPerPerson = totalHours / resourceIds.length;
  const percentPerPerson = hoursToPercent(hoursPerPerson, standardWeekHours);

  const allocations = new Map<string, number>();
  for (const resourceId of resourceIds) {
    allocations.set(resourceId, percentPerPerson);
  }

  return allocations;
}
