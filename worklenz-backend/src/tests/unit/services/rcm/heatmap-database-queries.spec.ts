/**
 * Heatmap Database Query Functions Unit Tests
 * Tests for getResourceAllocations, getResourceAvailability, getResourceUnavailability
 */

// Mock the Prisma client (must be before imports - inline to avoid hoisting issues)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
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
jest.unmock('../../../fixtures/rcm/allocation-fixtures');
jest.unmock('../../../fixtures/rcm/availability-fixtures');
jest.unmock('../../../fixtures/rcm/unavailability-fixtures');

import {
  getResourceAllocations,
  getResourceAvailability,
  getResourceUnavailability
} from '../../../../services/rcm/heatmap-service';
import prisma from '../../../../config/prisma';

// Get reference to the mocked prisma client
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;
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

describe('Database Query Functions', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getResourceAllocations', () => {
    it('should fetch allocations for a resource in date range', async () => {
      const mockAllocations = [
        createMockAllocation({
          id: 'alloc-1',
          resource_id: 'resource-1',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        })
      ];

      const mockProjects = [
        { id: 'project-1-uuid', name: 'Test Project' }
      ];

      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue(mockProjects as any);

      const result = await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(mockPrismaClient.rcm_allocations.findMany).toHaveBeenCalledWith({
        where: {
          resource_id: 'resource-1',
          is_active: true,
          AND: [
            { start_date: { lt: new Date('2024-01-31') } },
            { end_date: { gt: new Date('2024-01-01') } }
          ]
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('alloc-1');
    });

    it('should filter by project_id when provided', async () => {
      const mockAllocations = [
        createMockAllocation({
          project_id: 'project-specific',
          resource_id: 'resource-1'
        })
      ];

      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-specific', name: 'Specific Project' }] as any);

      await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'project-specific'
      );

      expect(mockPrismaClient.rcm_allocations.findMany).toHaveBeenCalledWith({
        where: {
          resource_id: 'resource-1',
          is_active: true,
          project_id: 'project-specific',
          AND: [
            { start_date: { lt: new Date('2024-01-31') } },
            { end_date: { gt: new Date('2024-01-01') } }
          ]
        }
      });
    });

    it('should attach project names to allocations', async () => {
      const mockAllocations = [
        createMockAllocation({
          id: 'alloc-1',
          project_id: 'project-alpha',
          resource_id: 'resource-1'
        }),
        createMockAllocation({
          id: 'alloc-2',
          project_id: 'project-beta',
          resource_id: 'resource-1'
        })
      ];

      const mockProjects = [
        { id: 'project-alpha', name: 'Project Alpha' },
        { id: 'project-beta', name: 'Project Beta' }
      ];

      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue(mockProjects as any);

      const result = await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result[0].project_name).toBe('Project Alpha');
      expect(result[1].project_name).toBe('Project Beta');
    });

    it('should handle missing project names gracefully', async () => {
      const mockAllocations = [
        createMockAllocation({
          id: 'alloc-1',
          project_id: 'unknown-project',
          resource_id: 'resource-1'
        })
      ];

      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([] as any); // No projects found

      const result = await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      // Should use fallback project name with format "Project {first-8-chars}"
      expect(result[0].project_name).toContain('Project');
      expect(result[0].project_name).toContain('unknown-'); // First 8 chars of project_id
    });

    it('should return empty array when no allocations found', async () => {
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue([]);
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual([]);
    });

    it('should only fetch active allocations', async () => {
      const mockAllocations = [
        createMockAllocation({ is_active: true })
      ];

      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-1-uuid', name: 'Test' }] as any);

      await getResourceAllocations(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      const callArgs = mockPrismaClient.rcm_allocations.findMany.mock.calls[0][0];
      expect(callArgs.where.is_active).toBe(true);
    });

    it('should handle overlapping date ranges correctly', async () => {
      const mockAllocations = [createMockAllocation()];
      mockPrismaClient.rcm_allocations.findMany.mockResolvedValue(mockAllocations as any);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ id: 'project-1-uuid', name: 'Test' }] as any);

      await getResourceAllocations(
        'resource-1',
        new Date('2024-01-15'),
        new Date('2024-02-15')
      );

      const callArgs = mockPrismaClient.rcm_allocations.findMany.mock.calls[0][0];
      expect(callArgs.where.AND[0].start_date.lt).toEqual(new Date('2024-02-15'));
      expect(callArgs.where.AND[1].end_date.gt).toEqual(new Date('2024-01-15'));
    });
  });

  describe('getResourceAvailability', () => {
    it('should fetch availability records for a resource', async () => {
      const mockAvailability = [
        createFullTimeAvailability('resource-1')
      ];

      mockPrismaClient.rcm_availability.findMany.mockResolvedValue(mockAvailability as any);

      const result = await getResourceAvailability('resource-1');

      expect(mockPrismaClient.rcm_availability.findMany).toHaveBeenCalledWith({
        where: {
          resource_id: 'resource-1'
        },
        orderBy: {
          effective_from: 'desc'
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].resource_id).toBe('resource-1');
    });

    it('should order availability records by effective_from descending', async () => {
      const mockAvailability = [
        createMockAvailability({
          id: 'avail-1',
          effective_from: new Date('2023-01-01')
        }),
        createMockAvailability({
          id: 'avail-2',
          effective_from: new Date('2024-01-01')
        })
      ];

      mockPrismaClient.rcm_availability.findMany.mockResolvedValue(mockAvailability as any);

      await getResourceAvailability('resource-1');

      const callArgs = mockPrismaClient.rcm_availability.findMany.mock.calls[0][0];
      expect(callArgs.orderBy.effective_from).toBe('desc');
    });

    it('should return empty array when no availability records found', async () => {
      mockPrismaClient.rcm_availability.findMany.mockResolvedValue([]);

      const result = await getResourceAvailability('resource-1');

      expect(result).toEqual([]);
    });

    it('should handle multiple availability records', async () => {
      const mockAvailability = [
        createFullTimeAvailability('resource-1', { id: 'avail-1' }),
        createPartTimeAvailability('resource-1', { id: 'avail-2' }),
        createFullTimeAvailability('resource-1', { id: 'avail-3' })
      ];

      mockPrismaClient.rcm_availability.findMany.mockResolvedValue(mockAvailability as any);

      const result = await getResourceAvailability('resource-1');

      expect(result).toHaveLength(3);
    });
  });

  describe('getResourceUnavailability', () => {
    it('should fetch unavailability periods for a resource in date range', async () => {
      const mockUnavailability = [
        createVacationPeriod(new Date('2024-01-15'), 5, 'resource-1')
      ];

      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue(mockUnavailability as any);

      const result = await getResourceUnavailability(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(mockPrismaClient.rcm_unavailability_periods.findMany).toHaveBeenCalledWith({
        where: {
          resource_id: 'resource-1',
          AND: [
            { start_date: { lt: new Date('2024-01-31') } },
            { end_date: { gt: new Date('2024-01-01') } }
          ]
        }
      });

      expect(result).toHaveLength(1);
      expect(result[0].unavailability_type).toBe('vacation');
    });

    it('should handle overlapping date ranges correctly', async () => {
      const mockUnavailability = [
        createMockUnavailability({
          start_date: new Date('2024-01-10'),
          end_date: new Date('2024-01-20')
        })
      ];

      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue(mockUnavailability as any);

      await getResourceUnavailability(
        'resource-1',
        new Date('2024-01-15'),
        new Date('2024-02-15')
      );

      const callArgs = mockPrismaClient.rcm_unavailability_periods.findMany.mock.calls[0][0];
      expect(callArgs.where.AND[0].start_date.lt).toEqual(new Date('2024-02-15'));
      expect(callArgs.where.AND[1].end_date.gt).toEqual(new Date('2024-01-15'));
    });

    it('should return empty array when no unavailability periods found', async () => {
      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue([]);

      const result = await getResourceUnavailability(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual([]);
    });

    it('should handle multiple unavailability periods', async () => {
      const mockUnavailability = [
        createVacationPeriod(new Date('2024-01-05'), 3, 'resource-1'),
        createVacationPeriod(new Date('2024-01-20'), 2, 'resource-1')
      ];

      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue(mockUnavailability as any);

      const result = await getResourceUnavailability(
        'resource-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(2);
    });

    it('should filter by resource_id', async () => {
      mockPrismaClient.rcm_unavailability_periods.findMany.mockResolvedValue([]);

      await getResourceUnavailability(
        'specific-resource-id',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      const callArgs = mockPrismaClient.rcm_unavailability_periods.findMany.mock.calls[0][0];
      expect(callArgs.where.resource_id).toBe('specific-resource-id');
    });
  });
});
