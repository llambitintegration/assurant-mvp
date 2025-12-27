/**
 * Heatmap Test Fixtures
 * Provides mock heatmap filters and related data for testing
 */

import { IHeatmapFilters, ITimePeriod } from '../../../interfaces/rcm/heatmap.interface';

/**
 * Create mock heatmap filters with defaults
 */
export function createMockHeatmapFilters(overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return {
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    granularity: 'weekly',
    page: 1,
    size: 20,
    include_unavailability: false,
    ...overrides,
  };
}

/**
 * Create filters for a daily granularity heatmap
 */
export function createDailyHeatmapFilters(startDate: string, endDate: string, overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    start_date: startDate,
    end_date: endDate,
    granularity: 'daily',
    ...overrides,
  });
}

/**
 * Create filters for a weekly granularity heatmap
 */
export function createWeeklyHeatmapFilters(startDate: string, endDate: string, overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    start_date: startDate,
    end_date: endDate,
    granularity: 'weekly',
    ...overrides,
  });
}

/**
 * Create filters for a monthly granularity heatmap
 */
export function createMonthlyHeatmapFilters(startDate: string, endDate: string, overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    start_date: startDate,
    end_date: endDate,
    granularity: 'monthly',
    ...overrides,
  });
}

/**
 * Create filters with department filtering
 */
export function createDepartmentFilteredHeatmap(departmentIds: string[], overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    department_ids: departmentIds,
    ...overrides,
  });
}

/**
 * Create filters with resource type filtering
 */
export function createResourceTypeFilteredHeatmap(
  resourceTypes: ('personnel' | 'equipment')[],
  overrides: Partial<IHeatmapFilters> = {}
): IHeatmapFilters {
  return createMockHeatmapFilters({
    resource_types: resourceTypes,
    ...overrides,
  });
}

/**
 * Create filters with project filtering
 */
export function createProjectFilteredHeatmap(projectId: string, overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    project_id: projectId,
    ...overrides,
  });
}

/**
 * Create filters with pagination
 */
export function createPaginatedHeatmapFilters(page: number, size: number, overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    page,
    size,
    ...overrides,
  });
}

/**
 * Create a mock time period
 */
export function createMockTimePeriod(overrides: Partial<ITimePeriod> = {}): ITimePeriod {
  return {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-08'),
    label: 'Jan 1 - Jan 7',
    ...overrides,
  };
}

/**
 * Create daily time periods for a week
 */
export function createDailyPeriods(startDate: Date, days: number): ITimePeriod[] {
  const periods: ITimePeriod[] = [];

  for (let i = 0; i < days; i++) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + i);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    periods.push({
      start,
      end,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  return periods;
}

/**
 * Create weekly time periods for a month
 */
export function createWeeklyPeriods(startDate: Date, weeks: number): ITimePeriod[] {
  const periods: ITimePeriod[] = [];

  for (let i = 0; i < weeks; i++) {
    const start = new Date(startDate);
    start.setDate(start.getDate() + i * 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const weekEnd = new Date(end);
    weekEnd.setDate(weekEnd.getDate() - 1);

    periods.push({
      start,
      end,
      label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    });
  }

  return periods;
}

/**
 * Create monthly time periods for a year
 */
export function createMonthlyPeriods(startDate: Date, months: number): ITimePeriod[] {
  const periods: ITimePeriod[] = [];

  for (let i = 0; i < months; i++) {
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + i);

    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    periods.push({
      start,
      end,
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
  }

  return periods;
}

/**
 * Create filters for a large dataset (for testing pagination and performance)
 */
export function createLargeDatasetFilters(overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    start_date: '2024-01-01',
    end_date: '2024-06-30', // 6 months
    size: 100, // Large page size
    ...overrides,
  });
}

/**
 * Create filters with all optional parameters
 */
export function createFullyConfiguredFilters(overrides: Partial<IHeatmapFilters> = {}): IHeatmapFilters {
  return createMockHeatmapFilters({
    department_ids: ['dept-1-uuid', 'dept-2-uuid'],
    resource_types: ['personnel'],
    project_id: 'project-1-uuid',
    include_unavailability: true,
    page: 1,
    size: 50,
    ...overrides,
  });
}
