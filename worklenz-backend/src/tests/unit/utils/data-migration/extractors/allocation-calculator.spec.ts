/**
 * Unit Tests: allocation-calculator.ts
 *
 * Tests for allocation calculation and merging utilities.
 * Target coverage: 90%+ (9 functions)
 *
 * Special focus on mergeConsecutivePeriods() - the key optimization
 * that reduced P0003C allocations from 1,712 to 677 records (60% reduction).
 */

// Unmock the modules we're testing
jest.unmock('../../../../../utils/data-migration/extractors/allocation-calculator');
jest.unmock('../../../../../utils/data-migration/extractors/date-utils');

import {
  hoursToPercent,
  percentToHours,
  mergeConsecutivePeriods,
  areConsecutivePeriods,
  aggregateMultiRoleAllocations,
  splitIntoWeeklyPeriods,
  calculateTotalHours,
  divideHoursEqually,
  AllocationPeriod,
} from '../../../../../utils/data-migration/extractors/allocation-calculator';

import {
  assertAllocationTotalsMatch,
  assertAllocationsMerged,
  assertValidDateRanges,
} from '../../../../utils/migration-test-helpers';

import {
  createAllocation,
  createAllocationSequence,
  createConsecutiveAllocations,
  createNonConsecutiveAllocations,
  createConsecutiveDifferentPercentAllocations,
  createMultiResourceAllocations,
  createMultiProjectAllocations,
  createMixedAllocations,
  createMultiRoleAllocations,
  createLongAllocation,
  getExpectedMergedCount,
  HOURS_TO_PERCENT_CASES,
} from '../../../../fixtures/migration/allocation-fixtures';

describe('Allocation Calculation and Merging Utilities', () => {
  // ==========================================================================
  // hoursToPercent()
  // ==========================================================================

  describe('hoursToPercent()', () => {
    it('should convert hours to percentage', () => {
      HOURS_TO_PERCENT_CASES.forEach(({ hours, percent, description }) => {
        const result = hoursToPercent(hours);
        expect(result).toBe(percent);
      });
    });

    it('should handle standard allocations', () => {
      expect(hoursToPercent(0)).toBe(0); // No hours
      expect(hoursToPercent(10)).toBe(25); // Quarter time
      expect(hoursToPercent(20)).toBe(50); // Half time
      expect(hoursToPercent(30)).toBe(75); // Three-quarter time
      expect(hoursToPercent(40)).toBe(100); // Full time
    });

    it('should handle overtime', () => {
      expect(hoursToPercent(50)).toBe(125);
      expect(hoursToPercent(60)).toBe(150);
      expect(hoursToPercent(80)).toBe(200); // Double time (multi-role)
    });

    it('should handle fractional hours', () => {
      expect(hoursToPercent(1)).toBe(2.5);
      expect(hoursToPercent(5)).toBe(12.5);
      expect(hoursToPercent(15)).toBe(37.5);
      expect(hoursToPercent(35)).toBe(87.5);
    });

    it('should support custom standard week hours', () => {
      expect(hoursToPercent(20, 20)).toBe(100); // 20 hours is 100% of 20-hour week
      expect(hoursToPercent(10, 20)).toBe(50); // 10 hours is 50% of 20-hour week
    });

    it('should round to 2 decimal places', () => {
      const result = hoursToPercent(13.333); // Would be 33.3325%
      expect(result).toBe(33.33);
    });

    it('should handle negative hours (edge case)', () => {
      const result = hoursToPercent(-10);
      expect(result).toBe(-25);
    });

    it('should handle zero hours', () => {
      expect(hoursToPercent(0)).toBe(0);
    });
  });

  // ==========================================================================
  // percentToHours()
  // ==========================================================================

  describe('percentToHours()', () => {
    it('should convert percentage to hours', () => {
      expect(percentToHours(0)).toBe(0);
      expect(percentToHours(25)).toBe(10);
      expect(percentToHours(50)).toBe(20);
      expect(percentToHours(75)).toBe(30);
      expect(percentToHours(100)).toBe(40);
    });

    it('should handle overtime percentages', () => {
      expect(percentToHours(125)).toBe(50);
      expect(percentToHours(150)).toBe(60);
      expect(percentToHours(200)).toBe(80);
    });

    it('should support custom standard week hours', () => {
      expect(percentToHours(100, 20)).toBe(20);
      expect(percentToHours(50, 20)).toBe(10);
    });

    it('should handle fractional percentages', () => {
      expect(percentToHours(12.5)).toBe(5);
      expect(percentToHours(37.5)).toBe(15);
      expect(percentToHours(87.5)).toBe(35);
    });

    it('should be inverse of hoursToPercent', () => {
      const hours = 23;
      const percent = hoursToPercent(hours);
      const backToHours = percentToHours(percent);

      expect(backToHours).toBeCloseTo(hours, 2);
    });
  });

  // ==========================================================================
  // areConsecutivePeriods()
  // ==========================================================================

  describe('areConsecutivePeriods()', () => {
    it('should detect consecutive periods', () => {
      expect(areConsecutivePeriods('2025-06-23', '2025-06-24')).toBe(true);
      expect(areConsecutivePeriods('2025-01-31', '2025-02-01')).toBe(true);
      expect(areConsecutivePeriods('2024-12-31', '2025-01-01')).toBe(true);
    });

    it('should detect non-consecutive periods (with gap)', () => {
      expect(areConsecutivePeriods('2025-06-23', '2025-06-25')).toBe(false); // 1-day gap
      expect(areConsecutivePeriods('2025-06-23', '2025-06-30')).toBe(false); // 6-day gap
    });

    it('should detect overlapping periods', () => {
      expect(areConsecutivePeriods('2025-06-24', '2025-06-23')).toBe(false);
    });

    it('should handle leap year dates', () => {
      expect(areConsecutivePeriods('2024-02-28', '2024-02-29')).toBe(true);
      expect(areConsecutivePeriods('2024-02-29', '2024-03-01')).toBe(true);
    });

    it('should handle month boundaries', () => {
      expect(areConsecutivePeriods('2025-01-31', '2025-02-01')).toBe(true);
      expect(areConsecutivePeriods('2025-04-30', '2025-05-01')).toBe(true);
    });
  });

  // ==========================================================================
  // mergeConsecutivePeriods() - KEY OPTIMIZATION
  // ==========================================================================

  describe('mergeConsecutivePeriods()', () => {
    it('should merge consecutive periods with same allocation', () => {
      const allocations = createConsecutiveAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(1); // 3 consecutive periods → 1 merged period
      expect(merged[0].startDate).toBe(allocations[0].startDate);
      expect(merged[0].endDate).toBe(allocations[2].endDate);
      expect(merged[0].percentAllocation).toBe(allocations[0].percentAllocation);
    });

    it('should NOT merge non-consecutive periods', () => {
      const allocations = createNonConsecutiveAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(3); // All 3 periods remain separate
      assertAllocationsMerged(merged); // No consecutive periods remain
    });

    it('should NOT merge consecutive periods with different percentages', () => {
      const allocations = createConsecutiveDifferentPercentAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(3); // All 3 periods remain separate
      assertAllocationsMerged(merged);
    });

    it('should NOT merge different resources', () => {
      const allocations = createMultiResourceAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(3); // All 3 periods remain separate
    });

    it('should NOT merge different projects', () => {
      const allocations = createMultiProjectAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(3); // All 3 periods remain separate
    });

    it('should handle mixed consecutive and non-consecutive periods', () => {
      const allocations = createMixedAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      // Expected: Group 1 (2 periods) → 1, Gap, Group 2 (1 period) → 1, Group 3 (3 periods) → 1
      expect(merged).toHaveLength(3);
      assertAllocationsMerged(merged);
    });

    it('should handle empty array', () => {
      const merged = mergeConsecutivePeriods([]);
      expect(merged).toEqual([]);
    });

    it('should handle single allocation', () => {
      const allocation = createAllocation();
      const merged = mergeConsecutivePeriods([allocation]);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(allocation);
    });

    it('should sort allocations before merging', () => {
      // Create allocations in random order
      const allocations = [
        createAllocation({ startDate: '2025-01-15', endDate: '2025-01-21', percentAllocation: 50 }),
        createAllocation({ startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 50 }),
        createAllocation({ startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 50 }),
      ];

      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(1);
      expect(merged[0].startDate).toBe('2025-01-01');
      expect(merged[0].endDate).toBe('2025-01-21');
    });

    it('should preserve allocation properties', () => {
      const allocations = [
        createAllocation({
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          percentAllocation: 50,
          role: 'Engineer',
          notes: 'Test allocation',
          isActive: true,
        }),
        createAllocation({
          startDate: '2025-01-08',
          endDate: '2025-01-14',
          percentAllocation: 50,
          role: 'Engineer',
        }),
      ];

      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(1);
      expect(merged[0].role).toBe('Engineer');
      expect(merged[0].notes).toBe('Test allocation');
    });

    it('should demonstrate 60% reduction (P0003C scenario)', () => {
      // Simulate 71 weeks of consecutive 50% allocation
      const allocations = createAllocationSequence(71, { percentAllocation: 50 });
      const merged = mergeConsecutivePeriods(allocations);

      expect(merged).toHaveLength(1); // 71 weeks → 1 period
      const reductionPercent = Math.round((1 - merged.length / allocations.length) * 100);
      expect(reductionPercent).toBeGreaterThan(95); // >95% reduction
    });

    it('should handle date ranges correctly after merge', () => {
      const allocations = createConsecutiveAllocations();
      const merged = mergeConsecutivePeriods(allocations);

      assertValidDateRanges(merged);
    });
  });

  // ==========================================================================
  // aggregateMultiRoleAllocations()
  // ==========================================================================

  describe('aggregateMultiRoleAllocations()', () => {
    it('should aggregate multi-role allocations', () => {
      const allocations = createMultiRoleAllocations();
      const aggregated = aggregateMultiRoleAllocations(allocations);

      expect(aggregated).toHaveLength(1); // 3 roles → 1 aggregated
      expect(aggregated[0].percentAllocation).toBe(60); // 30% + 20% + 10%
      expect(aggregated[0].role).toContain('Purchasing');
      expect(aggregated[0].role).toContain('Quoting');
      expect(aggregated[0].role).toContain('Buying');
    });

    it('should sum percentages correctly', () => {
      const allocations = [
        createAllocation({ percentAllocation: 25, role: 'Dev' }),
        createAllocation({ percentAllocation: 25, role: 'QA' }),
        createAllocation({ percentAllocation: 50, role: 'PM' }),
      ];

      const aggregated = aggregateMultiRoleAllocations(allocations);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].percentAllocation).toBe(100); // 25 + 25 + 50
    });

    it('should sum hours correctly', () => {
      const allocations = [
        createAllocation({ hoursPerWeek: 10, percentAllocation: 25, role: 'Dev' }),
        createAllocation({ hoursPerWeek: 10, percentAllocation: 25, role: 'QA' }),
        createAllocation({ hoursPerWeek: 20, percentAllocation: 50, role: 'PM' }),
      ];

      const aggregated = aggregateMultiRoleAllocations(allocations);

      expect(aggregated[0].hoursPerWeek).toBe(40); // 10 + 10 + 20
    });

    it('should handle single-role allocations (no aggregation needed)', () => {
      const allocation = createAllocation();
      const aggregated = aggregateMultiRoleAllocations([allocation]);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0]).toEqual(allocation);
    });

    it('should group by resource, project, and dates', () => {
      const allocations = [
        createAllocation({
          resourceId: 'r1',
          projectId: 'p1',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          percentAllocation: 50,
        }),
        createAllocation({
          resourceId: 'r1',
          projectId: 'p1',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          percentAllocation: 50,
        }),
        createAllocation({
          resourceId: 'r1',
          projectId: 'p1',
          startDate: '2025-01-08',
          endDate: '2025-01-14',
          percentAllocation: 25,
        }),
      ];

      const aggregated = aggregateMultiRoleAllocations(allocations);

      expect(aggregated).toHaveLength(2); // First 2 aggregate, third separate
      expect(aggregated[0].percentAllocation).toBe(100);
      expect(aggregated[1].percentAllocation).toBe(25);
    });

    it('should handle empty array', () => {
      const aggregated = aggregateMultiRoleAllocations([]);
      expect(aggregated).toEqual([]);
    });

    it('should round percentages to 2 decimals', () => {
      const allocations = [
        createAllocation({ percentAllocation: 33.333, role: 'A' }),
        createAllocation({ percentAllocation: 33.333, role: 'B' }),
        createAllocation({ percentAllocation: 33.334, role: 'C' }),
      ];

      const aggregated = aggregateMultiRoleAllocations(allocations);

      expect(aggregated[0].percentAllocation).toBe(100); // Rounded sum
    });
  });

  // ==========================================================================
  // splitIntoWeeklyPeriods()
  // ==========================================================================

  describe('splitIntoWeeklyPeriods()', () => {
    it('should split long period into weekly periods', () => {
      const allocation = createLongAllocation();
      const weekly = splitIntoWeeklyPeriods(allocation);

      expect(weekly.length).toBeGreaterThan(1);
      weekly.forEach((period) => {
        expect(period.percentAllocation).toBe(allocation.percentAllocation);
        assertValidDateRanges([period]);
      });
    });

    it('should handle exactly 1 week', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-07',
      });
      const weekly = splitIntoWeeklyPeriods(allocation);

      expect(weekly).toHaveLength(1);
      expect(weekly[0]).toEqual(allocation);
    });

    it('should handle exactly 2 weeks', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-14',
      });
      const weekly = splitIntoWeeklyPeriods(allocation);

      expect(weekly).toHaveLength(2);
      expect(weekly[0].startDate).toBe('2025-01-01');
      expect(weekly[0].endDate).toBe('2025-01-07');
      expect(weekly[1].startDate).toBe('2025-01-08');
      expect(weekly[1].endDate).toBe('2025-01-14');
    });

    it('should handle partial final week', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-10', // 1 full week + 3 days
      });
      const weekly = splitIntoWeeklyPeriods(allocation);

      expect(weekly).toHaveLength(2);
      expect(weekly[1].endDate).toBe('2025-01-10'); // Partial week ends early
    });

    it('should preserve allocation properties', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        percentAllocation: 75,
        role: 'Engineer',
        notes: 'Test',
      });
      const weekly = splitIntoWeeklyPeriods(allocation);

      weekly.forEach((period) => {
        expect(period.percentAllocation).toBe(75);
        expect(period.role).toBe('Engineer');
        expect(period.notes).toBe('Test');
      });
    });
  });

  // ==========================================================================
  // calculateTotalHours()
  // ==========================================================================

  describe('calculateTotalHours()', () => {
    it('should calculate total hours for single period', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        percentAllocation: 50,
      });
      const total = calculateTotalHours([allocation]);

      expect(total).toBe(20); // 50% of 40 hours = 20 hours
    });

    it('should calculate total hours for multiple periods', () => {
      const allocations = [
        createAllocation({
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          percentAllocation: 50,
        }),
        createAllocation({
          startDate: '2025-01-08',
          endDate: '2025-01-14',
          percentAllocation: 100,
        }),
      ];
      const total = calculateTotalHours(allocations);

      expect(total).toBe(60); // 20 + 40
    });

    it('should handle partial weeks', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-03', // 3 days
        percentAllocation: 100,
      });
      const total = calculateTotalHours([allocation]);

      const expectedHours = (40 / 7) * 4; // 4 days worth of hours (including end date)
      expect(total).toBeCloseTo(expectedHours, 1);
    });

    it('should handle zero hours', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        percentAllocation: 0,
      });
      const total = calculateTotalHours([allocation]);

      expect(total).toBe(0);
    });

    it('should handle empty array', () => {
      const total = calculateTotalHours([]);
      expect(total).toBe(0);
    });

    it('should support custom standard week hours', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        percentAllocation: 100,
      });
      const total = calculateTotalHours([allocation], 20); // 20-hour work week

      expect(total).toBe(20);
    });

    it('should round to 2 decimal places', () => {
      const allocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-02', // Odd number of days
        percentAllocation: 33.33,
      });
      const total = calculateTotalHours([allocation]);

      expect(total.toString()).toMatch(/^\d+\.\d{1,2}$/);
    });
  });

  // ==========================================================================
  // divideHoursEqually()
  // ==========================================================================

  describe('divideHoursEqually()', () => {
    it('should divide hours equally among resources', () => {
      const allocations = divideHoursEqually(120, ['r1', 'r2', 'r3']);

      expect(allocations.size).toBe(3);
      expect(allocations.get('r1')).toBe(100); // 40 hours = 100%
      expect(allocations.get('r2')).toBe(100);
      expect(allocations.get('r3')).toBe(100);
    });

    it('should handle uneven division', () => {
      const allocations = divideHoursEqually(100, ['r1', 'r2']);

      expect(allocations.size).toBe(2);
      expect(allocations.get('r1')).toBe(125); // 50 hours = 125%
      expect(allocations.get('r2')).toBe(125);
    });

    it('should handle single resource', () => {
      const allocations = divideHoursEqually(40, ['r1']);

      expect(allocations.size).toBe(1);
      expect(allocations.get('r1')).toBe(100);
    });

    it('should handle empty resource list', () => {
      const allocations = divideHoursEqually(100, []);

      expect(allocations.size).toBe(0);
    });

    it('should handle zero hours', () => {
      const allocations = divideHoursEqually(0, ['r1', 'r2']);

      expect(allocations.get('r1')).toBe(0);
      expect(allocations.get('r2')).toBe(0);
    });

    it('should support custom standard week hours', () => {
      const allocations = divideHoursEqually(40, ['r1', 'r2'], 20);

      expect(allocations.get('r1')).toBe(100); // 20 hours is 100% of 20-hour week
      expect(allocations.get('r2')).toBe(100);
    });

    it('should handle fractional percentages', () => {
      const allocations = divideHoursEqually(50, ['r1', 'r2', 'r3']);

      const expectedPercent = hoursToPercent(50 / 3);
      expect(allocations.get('r1')).toBe(expectedPercent);
      expect(allocations.get('r2')).toBe(expectedPercent);
      expect(allocations.get('r3')).toBe(expectedPercent);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should aggregate multi-role, then merge consecutive periods', () => {
      const allocations = [
        // Week 1 - multi-role
        createAllocation({ startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 30, role: 'Dev' }),
        createAllocation({ startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 20, role: 'QA' }),
        // Week 2 - multi-role (same total as week 1)
        createAllocation({ startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 30, role: 'Dev' }),
        createAllocation({ startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 20, role: 'QA' }),
      ];

      // First aggregate
      const aggregated = aggregateMultiRoleAllocations(allocations);
      expect(aggregated).toHaveLength(2); // 4 roles → 2 weeks

      // Then merge
      const merged = mergeConsecutivePeriods(aggregated);
      expect(merged).toHaveLength(1); // 2 consecutive weeks → 1 period

      expect(merged[0].percentAllocation).toBe(50); // 30 + 20
      expect(merged[0].startDate).toBe('2025-01-01');
      expect(merged[0].endDate).toBe('2025-01-14');
    });

    it('should split long period, calculate hours, verify total', () => {
      const longAllocation = createAllocation({
        startDate: '2025-01-01',
        endDate: '2025-01-28', // 4 weeks
        percentAllocation: 50,
      });

      const weekly = splitIntoWeeklyPeriods(longAllocation);
      expect(weekly).toHaveLength(4);

      const totalHours = calculateTotalHours(weekly);
      expect(totalHours).toBe(80); // 4 weeks * 20 hours/week
    });

    it('should handle full workflow: parse, aggregate, merge, calculate', () => {
      // Simulate raw TSV data: 2 resources, 3 weeks, some multi-role
      const rawAllocations = [
        // Resource 1 - consistent 50%
        createAllocation({ resourceId: 'r1', startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 50 }),
        createAllocation({ resourceId: 'r1', startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 50 }),
        createAllocation({ resourceId: 'r1', startDate: '2025-01-15', endDate: '2025-01-21', percentAllocation: 50 }),

        // Resource 2 - multi-role first 2 weeks
        createAllocation({ resourceId: 'r2', startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 30, role: 'Dev' }),
        createAllocation({ resourceId: 'r2', startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 20, role: 'QA' }),
        createAllocation({ resourceId: 'r2', startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 30, role: 'Dev' }),
        createAllocation({ resourceId: 'r2', startDate: '2025-01-08', endDate: '2025-01-14', percentAllocation: 20, role: 'QA' }),
        createAllocation({ resourceId: 'r2', startDate: '2025-01-15', endDate: '2025-01-21', percentAllocation: 100 }),
      ];

      // Step 1: Aggregate multi-role
      const aggregated = aggregateMultiRoleAllocations(rawAllocations);
      expect(aggregated.length).toBeLessThan(rawAllocations.length);

      // Step 2: Merge consecutive
      const merged = mergeConsecutivePeriods(aggregated);
      expect(merged.length).toBeLessThan(aggregated.length);

      // Step 3: Calculate total hours
      const totalHours = calculateTotalHours(merged);
      expect(totalHours).toBeGreaterThan(0);

      // Verify: Should have 2 allocations (r1: 1 merged, r2: 2 periods)
      expect(merged).toHaveLength(3);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large percentages (multi-role)', () => {
      const percent = hoursToPercent(200); // 500% allocation
      expect(percent).toBe(500);

      const hoursBack = percentToHours(percent);
      expect(hoursBack).toBe(200);
    });

    it('should handle very small percentages', () => {
      const percent = hoursToPercent(0.1);
      expect(percent).toBe(0.25);
    });

    it('should handle leap year in period calculations', () => {
      const allocation = createAllocation({
        startDate: '2024-02-28',
        endDate: '2024-03-06', // Crosses leap day
        percentAllocation: 100,
      });

      const total = calculateTotalHours([allocation]);
      expect(total).toBeGreaterThan(0);
    });

    it('should handle year boundary in merge', () => {
      const allocations = [
        createAllocation({ startDate: '2024-12-25', endDate: '2024-12-31', percentAllocation: 50 }),
        createAllocation({ startDate: '2025-01-01', endDate: '2025-01-07', percentAllocation: 50 }),
      ];

      const merged = mergeConsecutivePeriods(allocations);
      expect(merged).toHaveLength(1);
      expect(merged[0].startDate).toBe('2024-12-25');
      expect(merged[0].endDate).toBe('2025-01-07');
    });

    it('should maintain precision with many small allocations', () => {
      const allocations = Array.from({ length: 100 }, (_, i) =>
        createAllocation({
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          percentAllocation: 1,
        })
      );

      const totalHours = calculateTotalHours(allocations);
      expect(totalHours).toBeCloseTo(40, 1); // 100 * 1% = 100% = 40 hours
    });
  });
});
