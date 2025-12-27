/**
 * Fixture Validation Tests
 * Ensures all fixtures are correctly structured and functional
 */

// Unmock fixture modules to test their actual functionality
jest.unmock('./resource-fixtures');
jest.unmock('./allocation-fixtures');
jest.unmock('./availability-fixtures');
jest.unmock('./unavailability-fixtures');
jest.unmock('./heatmap-fixtures');
jest.unmock('@prisma/client');

import {
  createMockPersonnel,
  createMockEquipment,
  createMockResourceList,
  createMockResourceWithDepartment,
  createMixedResourceList,
} from './resource-fixtures';

import {
  createMockAllocation,
  createOverlappingAllocations,
  createOverutilizedScenario,
  createOptimalScenario,
  createAllocationWithPercent,
} from './allocation-fixtures';

import {
  createMockAvailability,
  createPartTimeAvailability,
  createFullTimeAvailability,
  createOvertimeAvailability,
  createAvailabilityHistory,
} from './availability-fixtures';

import {
  createMockUnavailability,
  createVacationPeriod,
  createSickLeavePeriod,
  createPublicHoliday,
  createYearlyUnavailabilitySchedule,
} from './unavailability-fixtures';

import {
  createMockHeatmapFilters,
  createDailyHeatmapFilters,
  createWeeklyHeatmapFilters,
  createMonthlyHeatmapFilters,
  createMockTimePeriod,
  createDailyPeriods,
  createWeeklyPeriods,
} from './heatmap-fixtures';

describe('Resource Fixtures', () => {
  it('should create a mock personnel resource', () => {
    const resource = createMockPersonnel();

    expect(resource.id).toBe('resource-1-uuid');
    expect(resource.resource_type).toBe('personnel');
    expect(resource.first_name).toBe('John');
    expect(resource.last_name).toBe('Doe');
    expect(resource.email).toBe('john.doe@example.com');
  });

  it('should create a mock equipment resource', () => {
    const equipment = createMockEquipment();

    expect(equipment.resource_type).toBe('equipment');
    expect(equipment.equipment_name).toBe('Laptop Dell XPS 15');
    expect(equipment.first_name).toBeNull();
  });

  it('should create a list of resources', () => {
    const resources = createMockResourceList(5);

    expect(resources).toHaveLength(5);
    expect(resources[0].id).toBe('resource-1-uuid');
    expect(resources[4].id).toBe('resource-5-uuid');
  });

  it('should create resource with department assignment', () => {
    const resource = createMockResourceWithDepartment('dept-1', 'Engineering');

    expect(resource.department_assignments).toHaveLength(1);
    expect(resource.department_assignments[0].department.name).toBe('Engineering');
  });

  it('should create mixed resource list', () => {
    const resources = createMixedResourceList(3, 2);

    expect(resources).toHaveLength(5);
    const personnel = resources.filter(r => r.resource_type === 'personnel');
    const equipment = resources.filter(r => r.resource_type === 'equipment');
    expect(personnel).toHaveLength(3);
    expect(equipment).toHaveLength(2);
  });
});

describe('Allocation Fixtures', () => {
  it('should create a mock allocation', () => {
    const allocation = createMockAllocation();

    expect(allocation.id).toBe('allocation-1-uuid');
    expect(allocation.resource_id).toBe('resource-1-uuid');
    expect(allocation.project_id).toBe('project-1-uuid');
    expect(Number(allocation.allocation_percent)).toBe(50);
  });

  it('should create allocation with specific percentage', () => {
    const allocation = createAllocationWithPercent(75);

    expect(Number(allocation.allocation_percent)).toBe(75);
  });

  it('should create overlapping allocations', () => {
    const allocations = createOverlappingAllocations();

    expect(allocations).toHaveLength(2);
    expect(Number(allocations[0].allocation_percent)).toBe(40);
    expect(Number(allocations[1].allocation_percent)).toBe(60);
  });

  it('should create overutilized scenario', () => {
    const allocations = createOverutilizedScenario();
    const totalPercent = allocations.reduce((sum, a) => sum + Number(a.allocation_percent), 0);

    expect(totalPercent).toBeGreaterThanOrEqual(100);
  });

  it('should create optimal scenario', () => {
    const allocations = createOptimalScenario();
    const totalPercent = allocations.reduce((sum, a) => sum + Number(a.allocation_percent), 0);

    expect(totalPercent).toBeGreaterThanOrEqual(80);
    expect(totalPercent).toBeLessThanOrEqual(100);
  });
});

describe('Availability Fixtures', () => {
  it('should create full-time availability', () => {
    const availability = createFullTimeAvailability();

    expect(Number(availability.total_hours_per_week)).toBe(40);
    expect(Number(availability.hours_per_day)).toBe(8);
  });

  it('should create part-time availability', () => {
    const availability = createPartTimeAvailability();

    expect(Number(availability.total_hours_per_week)).toBe(20);
    expect(Number(availability.hours_per_day)).toBe(4);
  });

  it('should create overtime availability', () => {
    const availability = createOvertimeAvailability();

    expect(Number(availability.total_hours_per_week)).toBe(50);
  });

  it('should create availability history', () => {
    const history = createAvailabilityHistory();

    expect(history).toHaveLength(3);
    expect(history[2].effective_to).toBeNull(); // Current availability
  });
});

describe('Unavailability Fixtures', () => {
  it('should create a mock unavailability period', () => {
    const unavailability = createMockUnavailability();

    expect(unavailability.unavailability_type).toBe('vacation');
    expect(unavailability.resource_id).toBe('resource-1-uuid');
  });

  it('should create vacation period with correct duration', () => {
    const startDate = new Date('2024-01-15');
    const vacation = createVacationPeriod(startDate, 5);

    const duration = (vacation.end_date.getTime() - vacation.start_date.getTime()) / (1000 * 60 * 60 * 24);
    expect(duration).toBe(5);
  });

  it('should create sick leave period', () => {
    const sickLeave = createSickLeavePeriod(new Date('2024-02-01'), 3);

    expect(sickLeave.unavailability_type).toBe('sick_leave');
  });

  it('should create public holiday', () => {
    const holiday = createPublicHoliday(new Date('2024-12-25'), 'Christmas Day');

    expect(holiday.description).toBe('Christmas Day');
    expect(holiday.unavailability_type).toBe('public_holiday');
  });

  it('should create yearly unavailability schedule', () => {
    const schedule = createYearlyUnavailabilitySchedule();

    expect(schedule.length).toBeGreaterThan(0);
  });
});

describe('Heatmap Fixtures', () => {
  it('should create mock heatmap filters', () => {
    const filters = createMockHeatmapFilters();

    expect(filters.start_date).toBe('2024-01-01');
    expect(filters.end_date).toBe('2024-01-31');
    expect(filters.granularity).toBe('weekly');
    expect(filters.page).toBe(1);
    expect(filters.size).toBe(20);
  });

  it('should create daily heatmap filters', () => {
    const filters = createDailyHeatmapFilters('2024-01-01', '2024-01-07');

    expect(filters.granularity).toBe('daily');
  });

  it('should create weekly heatmap filters', () => {
    const filters = createWeeklyHeatmapFilters('2024-01-01', '2024-01-31');

    expect(filters.granularity).toBe('weekly');
  });

  it('should create monthly heatmap filters', () => {
    const filters = createMonthlyHeatmapFilters('2024-01-01', '2024-12-31');

    expect(filters.granularity).toBe('monthly');
  });

  it('should create a mock time period', () => {
    const period = createMockTimePeriod();

    expect(period.start).toBeInstanceOf(Date);
    expect(period.end).toBeInstanceOf(Date);
    expect(period.label).toBeTruthy();
  });

  it('should create daily periods', () => {
    const periods = createDailyPeriods(new Date('2024-01-15'), 7);

    expect(periods).toHaveLength(7);
    expect(periods[0].label).toContain('Jan');
  });

  it('should create weekly periods', () => {
    const periods = createWeeklyPeriods(new Date('2024-01-01'), 4);

    expect(periods).toHaveLength(4);
    expect(periods[0].label).toContain('-');
  });
});
