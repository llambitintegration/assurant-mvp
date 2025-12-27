/**
 * Heatmap Service Main Function Unit Tests
 * Tests for getHeatmapData function with filtering, pagination, and calculations
 */

// Mock the Prisma client (must be before imports - inline to avoid hoisting issues)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    rcm_resources: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    rcm_allocations: {
      findMany: jest.fn()
    },
    rcm_availability: {
      findMany: jest.fn()
    },
    rcm_unavailability_periods: {
      findMany: jest.fn()
    },
    $queryRaw: jest.fn()
  }
}));

// Unmock modules we need to test
jest.unmock('../../../../services/rcm/heatmap-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/rcm/resource-fixtures');
jest.unmock('../../../fixtures/rcm/allocation-fixtures');
jest.unmock('../../../fixtures/rcm/availability-fixtures');
jest.unmock('../../../fixtures/rcm/unavailability-fixtures');
jest.unmock('../../../fixtures/rcm/heatmap-fixtures');

import { getHeatmapData } from '../../../../services/rcm/heatmap-service';
import prisma from '../../../../config/prisma';
import { IHeatmapFilters } from '../../../../interfaces/rcm/heatmap.interface';

// Get reference to the mocked prisma client
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;

import {
  createMockPersonnel,
  createMockEquipment
} from '../../../fixtures/rcm/resource-fixtures';
import {
  createMockAllocation,
  createAllocationWithPercent
} from '../../../fixtures/rcm/allocation-fixtures';
import {
  createMockAvailability,
  createFullTimeAvailability,
  createPartTimeAvailability
} from '../../../fixtures/rcm/availability-fixtures';
import {
  createMockUnavailability,
  createVacationPeriod
} from '../../../fixtures/rcm/unavailability-fixtures';
import {
  createMockHeatmapFilters
} from '../../../fixtures/rcm/heatmap-fixtures';

describe('getHeatmapData', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Date Validation', () => {
    it('should throw error when start_date is missing', async () => {
      const filters = {
        end_date: '2024-01-31',
        granularity: 'daily' as const
      };

      await expect(getHeatmapData(filters, 'team-1'))
        .rejects.toThrow('Start date and end date are required');
    });

    it('should throw error when end_date is missing', async () => {
      const filters = {
        start_date: '2024-01-01',
        granularity: 'daily' as const
      };

      await expect(getHeatmapData(filters, 'team-1'))
        .rejects.toThrow('Start date and end date are required');
    });

    it('should throw error when end_date is before start_date', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-02-01',
        end_date: '2024-01-01'
      });

      await expect(getHeatmapData(filters, 'team-1'))
        .rejects.toThrow('End date must be after start date');
    });

    it('should throw error when end_date equals start_date', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-15',
        end_date: '2024-01-15'
      });

      await expect(getHeatmapData(filters, 'team-1'))
        .rejects.toThrow('End date must be after start date');
    });
  });

  describe('Basic Scenarios', () => {
    it('should fetch heatmap data with valid filters', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        granularity: 'weekly'
      });

      const mockResource = createMockPersonnel({
        id: 'resource-1',
        team_id: 'team-1'
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result).toBeDefined();
      expect(result.resources).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.period_labels).toBeDefined();
    });

    it('should return empty result when no resources found', async () => {
      const filters = createMockHeatmapFilters();

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle single resource with allocations', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });
      const mockAllocation = createMockAllocation({
        resource_id: 'resource-1',
        project_id: 'project-1',
        allocation_percent: 50
      });
      const mockAvailability = createFullTimeAvailability('resource-1');
      const mockProjects = [{ id: 'project-1', name: 'Test Project' }];

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([mockAllocation] as any);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([mockAvailability] as any);
      mockPrismaClient.$queryRaw.mockResolvedValue(mockProjects as any);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].summary.active_projects_count).toBeGreaterThan(0);
      expect(result.resources[0].summary.total_hours_allocated).toBeGreaterThan(0);
    });
  });

  describe('Filtering', () => {
    it('should filter by department_ids', async () => {
      const filters = createMockHeatmapFilters({
        department_ids: ['dept-1', 'dept-2']
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      await getHeatmapData(filters, 'team-1');

      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department_assignments: {
              some: {
                department_id: {
                  in: ['dept-1', 'dept-2']
                }
              }
            }
          })
        })
      );
    });

    it('should filter by resource_types', async () => {
      const filters = createMockHeatmapFilters({
        resource_types: ['personnel', 'equipment']
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      await getHeatmapData(filters, 'team-1');

      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resource_type: {
              in: ['personnel', 'equipment']
            }
          })
        })
      );
    });

    it('should filter by project_id for allocations', async () => {
      const filters = createMockHeatmapFilters({
        project_id: 'specific-project'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });
      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await getHeatmapData(filters, 'team-1');

      // Verify allocations query includes project_id
      expect(mockPrismaClient.rcm_allocations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: 'specific-project'
          })
        })
      );
    });

    it('should always filter by team_id and is_active', async () => {
      const filters = createMockHeatmapFilters();

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      await getHeatmapData(filters, 'team-123');

      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            team_id: 'team-123',
            is_active: true
          })
        })
      );
    });
  });

  describe('Pagination', () => {
    it('should use default pagination (page 1, size 20)', async () => {
      const filters = createMockHeatmapFilters();

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.page).toBe(1);
      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20
        })
      );
    });

    it('should handle custom page and size', async () => {
      const filters = createMockHeatmapFilters({
        page: 3,
        size: 10
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(50);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);
      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page 3 - 1) * size 10
          take: 10
        })
      );
    });

    it('should calculate totalPages correctly', async () => {
      const filters = createMockHeatmapFilters({ size: 15 });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(47);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.totalPages).toBe(4); // ceil(47 / 15) = 4
    });

    it('should handle page 2 with results', async () => {
      const filters = createMockHeatmapFilters({
        page: 2,
        size: 5
      });

      const mockResource = createMockPersonnel();
      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(10);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.page).toBe(2);
      expect(mockPrismaClient.rcm_resources.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });
  });

  describe('Resource Name Formatting', () => {
    it('should format personnel name correctly', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockPersonnel({
        first_name: 'John',
        last_name: 'Doe',
        resource_type: 'personnel'
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].name).toBe('John Doe');
      expect(result.resources[0].resource_type).toBe('personnel');
    });

    it('should format equipment name correctly', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockEquipment({
        equipment_name: 'Laptop Dell XPS',
        resource_type: 'equipment'
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].name).toBe('Laptop Dell XPS');
      expect(result.resources[0].resource_type).toBe('equipment');
    });

    it('should handle personnel with missing names', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockPersonnel({
        first_name: null,
        last_name: null
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].name).toBe('');
    });
  });

  describe('Department Assignment', () => {
    it('should include primary department information', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockPersonnel({
        department_assignments: [{
          department_id: 'dept-1',
          is_primary: true,
          department: {
            name: 'Engineering'
          }
        }]
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].department_id).toBe('dept-1');
      expect(result.resources[0].department_name).toBe('Engineering');
    });

    it('should handle resource without department assignment', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockPersonnel({
        department_assignments: []
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].department_id).toBeUndefined();
      expect(result.resources[0].department_name).toBeUndefined();
    });
  });

  describe('Summary Calculations', () => {
    it('should calculate average utilization correctly', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-08', // 1 week
        granularity: 'daily'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });
      const mockAllocation = createAllocationWithPercent(80, {
        resource_id: 'resource-1',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-08')
      });
      const mockAvailability = createFullTimeAvailability('resource-1');

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([mockAllocation] as any);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([mockAvailability] as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-1', name: 'Test' }] as any);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].summary.avg_utilization_percent).toBeGreaterThan(0);
      expect(result.resources[0].summary.avg_utilization_percent).toBeLessThanOrEqual(100);
    });

    it('should calculate total hours allocated correctly', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        granularity: 'monthly'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });
      const mockAllocation = createAllocationWithPercent(50, {
        resource_id: 'resource-1',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      });
      const mockAvailability = createFullTimeAvailability('resource-1');

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([mockAllocation] as any);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([mockAvailability] as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-1', name: 'Test' }] as any);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].summary.total_hours_allocated).toBeGreaterThan(0);
    });

    it('should count active projects correctly with multiple allocations', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });
      const mockAllocations = [
        createAllocationWithPercent(30, {
          resource_id: 'resource-1',
          project_id: 'project-1',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(40, {
          resource_id: 'resource-1',
          project_id: 'project-2',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        }),
        createAllocationWithPercent(20, {
          resource_id: 'resource-1',
          project_id: 'project-1', // Same project
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        })
      ];
      const mockAvailability = createFullTimeAvailability('resource-1');
      const mockProjects = [
        { id: 'project-1', name: 'Project A' },
        { id: 'project-2', name: 'Project B' }
      ];

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([mockAvailability] as any);
      mockPrismaClient.$queryRaw.mockResolvedValue(mockProjects as any);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].summary.active_projects_count).toBe(2); // Unique projects
    });

    it('should handle zero utilization for resource with no allocations', async () => {
      const filters = createMockHeatmapFilters();

      const mockResource = createMockPersonnel({ id: 'resource-1' });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources[0].summary.avg_utilization_percent).toBe(0);
      expect(result.resources[0].summary.total_hours_allocated).toBe(0);
      expect(result.resources[0].summary.active_projects_count).toBe(0);
    });
  });

  describe('Unavailability Handling', () => {
    it('should fetch unavailability when include_unavailability is true', async () => {
      const filters = createMockHeatmapFilters({
        include_unavailability: true
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await getHeatmapData(filters, 'team-1');

      expect(mockPrismaClient.rcm_unavailability_periods.findMany).toHaveBeenCalled();
    });

    it('should not fetch unavailability when include_unavailability is false', async () => {
      const filters = createMockHeatmapFilters({
        include_unavailability: false
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await getHeatmapData(filters, 'team-1');

      expect(mockPrismaClient.rcm_unavailability_periods.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Period Labels', () => {
    it('should generate period labels based on granularity', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        granularity: 'weekly'
      });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(0);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.period_labels).toBeDefined();
      expect(result.period_labels.length).toBeGreaterThan(0);
    });

    it('should match period labels with utilization periods', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-08',
        granularity: 'daily'
      });

      const mockResource = createMockPersonnel({ id: 'resource-1' });

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue([mockResource] as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(1);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.period_labels.length).toBe(result.resources[0].utilization_periods.length);
    });
  });

  describe('Multiple Resources', () => {
    it('should handle multiple resources correctly', async () => {
      const filters = createMockHeatmapFilters();

      const mockResources = [
        createMockPersonnel({ id: 'resource-1', first_name: 'Alice' }),
        createMockPersonnel({ id: 'resource-2', first_name: 'Bob' }),
        createMockEquipment({ id: 'resource-3', equipment_name: 'Laptop' })
      ];

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue(mockResources as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(3);
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should process each resource independently', async () => {
      const filters = createMockHeatmapFilters({
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      });

      const mockResources = [
        createMockPersonnel({ id: 'resource-1' }),
        createMockPersonnel({ id: 'resource-2' })
      ];

      const allocationsResource1 = [createAllocationWithPercent(80, { resource_id: 'resource-1' })];
      const allocationsResource2 = [createAllocationWithPercent(40, { resource_id: 'resource-2' })];

      mockPrismaClient.rcm_resources.findMany.mockResolvedValue(mockResources as any);
      mockPrismaClient.rcm_resources.count.mockResolvedValue(2);

      // Mock allocations to return different results per resource
      mockPrismaClient.rcm_allocations.findMany
        .mockResolvedValueOnce(allocationsResource1 as any)
        .mockResolvedValueOnce(allocationsResource2 as any);

      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-1', name: 'Test' }] as any);

      const result = await getHeatmapData(filters, 'team-1');

      expect(result.resources).toHaveLength(2);
      // Each resource should have been processed
      expect(mockPrismaClient.rcm_allocations.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
