/**
 * Heatmap Utilization Calculations Unit Tests
 * Tests for calculateUtilizationForPeriod function
 */

// Mock Prisma client to avoid initialization issues
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    rcm_resources: {},
    rcm_allocations: {},
    rcm_availability: {},
    rcm_unavailability_periods: {},
    $queryRaw: jest.fn()
  }
}));

// Unmock the service module, @prisma/client, and fixture modules
jest.unmock('../../../../services/rcm/heatmap-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/rcm/allocation-fixtures');
jest.unmock('../../../fixtures/rcm/availability-fixtures');
jest.unmock('../../../fixtures/rcm/unavailability-fixtures');

import { calculateUtilizationForPeriod } from '../../../../services/rcm/heatmap-service';
import { ITimePeriod } from '../../../../interfaces/rcm/heatmap.interface';
import {
  createMockAllocation,
  createAllocationWithPercent,
  createOverlappingAllocations,
  createOverutilizedScenario
} from '../../../fixtures/rcm/allocation-fixtures';
import {
  createMockAvailability,
  createPartTimeAvailability,
  createFullTimeAvailability
} from '../../../fixtures/rcm/availability-fixtures';
import {
  createMockUnavailability,
  createVacationPeriod
} from '../../../fixtures/rcm/unavailability-fixtures';

describe('calculateUtilizationForPeriod', () => {
  const createPeriod = (start: Date, end: Date, label = 'Test Period'): ITimePeriod => ({
    start,
    end,
    label
  });

  describe('No Allocations', () => {
    it('should return AVAILABLE status with 0% utilization when no allocations', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations: any[] = [];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(0);
      expect(result.utilization_percent).toBe(0);
      expect(result.status).toBe('AVAILABLE');
      expect(result.allocations).toHaveLength(0);
      expect(result.net_available_hours).toBeGreaterThan(0);
    });

    it('should handle no allocations with part-time availability', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations: any[] = [];
      const availability = [createPartTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.status).toBe('AVAILABLE');
      expect(result.utilization_percent).toBe(0);
      // Part-time = 20 hours/week, so 7 days = 20 hours
      expect(result.net_available_hours).toBeCloseTo(20, 1);
    });
  });

  describe('Single Allocation', () => {
    it('should calculate UNDERUTILIZED status for 40% allocation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(40, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        project_name: 'Project A'
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(40);
      expect(result.utilization_percent).toBeCloseTo(40, 1);
      expect(result.status).toBe('UNDERUTILIZED');
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].project_name).toBe('Project A');
      expect(result.allocations[0].allocation_percent).toBe(40);
    });

    it('should calculate AVERAGE status for 70% allocation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(70, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(70);
      expect(result.utilization_percent).toBeCloseTo(70, 1);
      expect(result.status).toBe('AVERAGE');
    });

    it('should calculate OPTIMAL status for 90% allocation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(90, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(90);
      expect(result.utilization_percent).toBeCloseTo(90, 1);
      expect(result.status).toBe('OPTIMAL');
    });

    it('should calculate OVERUTILIZED status for 120% allocation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(120, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(120);
      expect(result.utilization_percent).toBeCloseTo(120, 1);
      expect(result.status).toBe('OVERUTILIZED');
    });
  });

  describe('Multiple Allocations', () => {
    it('should sum multiple allocations totaling 100%', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(60, {
          id: 'alloc-1',
          project_id: 'project-1',
          project_name: 'Project A',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(40, {
          id: 'alloc-2',
          project_id: 'project-2',
          project_name: 'Project B',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(100);
      expect(result.utilization_percent).toBeCloseTo(100, 1);
      expect(result.status).toBe('OVERUTILIZED');
      expect(result.allocations).toHaveLength(2);
    });

    it('should sum multiple allocations totaling 150% (overutilized)', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(80, {
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(40, {
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(30, {
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(150);
      expect(result.utilization_percent).toBeCloseTo(150, 1);
      expect(result.status).toBe('OVERUTILIZED');
      expect(result.allocations).toHaveLength(3);
    });
  });

  describe('Partial Period Overlap', () => {
    it('should include allocation that partially overlaps period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(50, {
          start_date: new Date('2024-01-10'), // Starts before period
          end_date: new Date('2024-01-20'), // Ends during period
          project_name: 'Overlapping Project'
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(50);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].project_name).toBe('Overlapping Project');
    });

    it('should exclude allocation that does not overlap period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(50, {
          start_date: new Date('2024-01-01'), // Ends before period starts
          end_date: new Date('2024-01-10')
        }),
        createAllocationWithPercent(60, {
          start_date: new Date('2024-01-25'), // Starts after period ends
          end_date: new Date('2024-01-31')
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(0);
      expect(result.allocations).toHaveLength(0);
    });

    it('should include allocation that fully encompasses period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(75, {
          start_date: new Date('2024-01-01'), // Starts before period
          end_date: new Date('2024-01-31'), // Ends after period
          project_name: 'Encompassing Project'
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(75);
      expect(result.allocations).toHaveLength(1);
    });
  });

  describe('With Unavailability', () => {
    it('should reduce available hours with vacation period', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()]; // 40 hours/week
      const unavailability = [
        createVacationPeriod(new Date('2024-01-15'), 7) // 7 days vacation
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      // With 7 days vacation, available hours should be reduced
      expect(result.unavailable_hours).toBeGreaterThan(0);
      expect(result.net_available_hours).toBeLessThan(result.net_available_hours + result.unavailable_hours);
      expect(result.unavailabilities).toBeDefined();
      expect(result.unavailabilities).toHaveLength(1);
    });

    it('should handle multiple unavailability periods', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(80, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-05'), 3),
        createVacationPeriod(new Date('2024-01-20'), 2)
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.unavailabilities).toHaveLength(2);
      expect(result.unavailable_hours).toBeGreaterThan(0);
    });

    it('should handle unavailability that partially overlaps period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-10'), 10) // Overlaps with period start
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      // Should only count unavailable hours within the period
      expect(result.unavailable_hours).toBeGreaterThan(0);
      expect(result.unavailabilities).toHaveLength(1);
    });

    it('should exclude unavailability that does not overlap period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-01'), 5) // Ends before period
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.unavailable_hours).toBe(0);
      expect(result.unavailabilities).toBeUndefined();
    });
  });

  describe('Different Availability Hours', () => {
    it('should use part-time hours (20 hours/week)', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-08T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createPartTimeAvailability()]; // 20 hours/week
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      // 7 days at 20 hours/week = 20 hours
      expect(result.net_available_hours).toBeCloseTo(20, 1);
      expect(result.allocated_hours).toBeCloseTo(10, 1); // 50% of 20 hours
    });

    it('should default to 40 hours/week when no availability records', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-08T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability: any[] = []; // No availability records
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      // 7 days at 40 hours/week (default) = 40 hours
      expect(result.net_available_hours).toBeCloseTo(40, 1);
      expect(result.allocated_hours).toBeCloseTo(20, 1); // 50% of 40 hours
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% allocation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(0, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(0);
      expect(result.utilization_percent).toBe(0);
      expect(result.status).toBe('AVAILABLE');
    });

    it('should handle unavailability covering entire period', () => {
      const period = createPeriod(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-22T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(50, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-10'), 20) // Covers entire period
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      // Net available hours should be 0 or very small
      expect(result.net_available_hours).toBeLessThan(1);
      expect(result.utilization_percent).toBe(0); // Can't utilize if no hours available
    });

    it('should map allocation details correctly', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [
        createAllocationWithPercent(60, {
          project_id: 'project-alpha-uuid',
          project_name: 'Project Alpha',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(30, {
          project_id: 'project-beta-uuid',
          project_name: 'Project Beta',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        })
      ];
      const availability = [createFullTimeAvailability()];
      const unavailability: any[] = [];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0].project_id).toBe('project-alpha-uuid');
      expect(result.allocations[0].project_name).toBe('Project Alpha');
      expect(result.allocations[0].allocation_percent).toBe(60);
      expect(result.allocations[1].project_id).toBe('project-beta-uuid');
      expect(result.allocations[1].project_name).toBe('Project Beta');
      expect(result.allocations[1].allocation_percent).toBe(30);
    });

    it('should map unavailability details correctly', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations: any[] = [];
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-15'), 5, 'resource-1-uuid', {
          id: 'vacation-uuid',
          unavailability_type: 'vacation'
        })
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.unavailabilities).toBeDefined();
      expect(result.unavailabilities).toHaveLength(1);
      expect(result.unavailabilities![0].unavailability_id).toBe('vacation-uuid');
      expect(result.unavailabilities![0].unavailability_type).toBe('vacation');
      expect(result.unavailabilities![0].hours).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle part-time resource with vacation', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = [createAllocationWithPercent(80, {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      })];
      const availability = [createPartTimeAvailability()]; // 20 hours/week
      const unavailability = [
        createVacationPeriod(new Date('2024-01-15'), 7) // 1 week vacation
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(80);
      // Utilization should be high (80% or higher) because of reduced available hours
      expect(result.utilization_percent).toBeGreaterThanOrEqual(80);
      expect(result.unavailable_hours).toBeGreaterThan(0);
    });

    it('should calculate correctly with overlapping allocations and unavailability', () => {
      const period = createPeriod(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T00:00:00Z')
      );
      const allocations = createOverlappingAllocations();
      const availability = [createFullTimeAvailability()];
      const unavailability = [
        createVacationPeriod(new Date('2024-01-08'), 3)
      ];

      const result = calculateUtilizationForPeriod(period, allocations, availability, unavailability);

      expect(result.total_allocation_percent).toBe(100); // 40% + 60%
      expect(result.unavailable_hours).toBeGreaterThan(0);
      expect(result.allocations.length).toBeGreaterThan(0);
    });
  });
});
