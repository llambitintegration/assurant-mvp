/**
 * Unavailability Period Test Fixtures
 * Provides mock unavailability data for testing
 */

/**
 * Base unavailability properties
 */
const baseUnavailabilityProps = {
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock unavailability period
 */
export function createMockUnavailability(overrides: any = {}): any {
  return {
    id: 'unavailability-1-uuid',
    resource_id: 'resource-1-uuid',
    unavailability_type: 'vacation',
    start_date: new Date('2024-01-15'),
    end_date: new Date('2024-01-20'),
    description: 'Annual vacation',
    ...baseUnavailabilityProps,
    ...overrides,
  };
}

/**
 * Create a vacation period
 */
export function createVacationPeriod(startDate: Date, days: number, resourceId = 'resource-1-uuid', overrides: any = {}): any {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  return createMockUnavailability({
    id: `vacation-${startDate.toISOString()}-uuid`,
    resource_id: resourceId,
    unavailability_type: 'vacation',
    start_date: startDate,
    end_date: endDate,
    description: `${days}-day vacation`,
    ...overrides,
  });
}

/**
 * Create a sick leave period
 */
export function createSickLeavePeriod(startDate: Date, days: number, resourceId = 'resource-1-uuid', overrides: any = {}): any {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  return createMockUnavailability({
    id: `sick-leave-${startDate.toISOString()}-uuid`,
    resource_id: resourceId,
    unavailability_type: 'sick_leave',
    start_date: startDate,
    end_date: endDate,
    description: `${days}-day sick leave`,
    ...overrides,
  });
}

/**
 * Create a training period
 */
export function createTrainingPeriod(startDate: Date, days: number, resourceId = 'resource-1-uuid', overrides: any = {}): any {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  return createMockUnavailability({
    id: `training-${startDate.toISOString()}-uuid`,
    resource_id: resourceId,
    unavailability_type: 'training',
    start_date: startDate,
    end_date: endDate,
    description: `${days}-day training course`,
    ...overrides,
  });
}

/**
 * Create a public holiday
 */
export function createPublicHoliday(date: Date, name: string, resourceId = 'resource-1-uuid', overrides: any = {}): any {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  return createMockUnavailability({
    id: `holiday-${date.toISOString()}-uuid`,
    resource_id: resourceId,
    unavailability_type: 'public_holiday',
    start_date: date,
    end_date: nextDay,
    description: name,
    ...overrides,
  });
}

/**
 * Create multiple unavailability periods that span across a time range
 */
export function createUnavailabilitySpanningPeriod(
  periodStart: Date,
  periodEnd: Date,
  resourceId = 'resource-1-uuid'
): any[] {
  const midPoint1 = new Date((periodStart.getTime() + periodEnd.getTime()) / 3);
  const midPoint2 = new Date(((periodStart.getTime() + periodEnd.getTime()) * 2) / 3);

  return [
    createVacationPeriod(midPoint1, 3, resourceId),
    createSickLeavePeriod(midPoint2, 2, resourceId),
  ];
}

/**
 * Create unavailability that partially overlaps with a period
 */
export function createPartiallyOverlappingUnavailability(
  periodStart: Date,
  _periodEnd: Date,
  resourceId = 'resource-1-uuid'
): any {
  // Starts before period, ends during period
  const startBefore = new Date(periodStart);
  startBefore.setDate(startBefore.getDate() - 5);

  const endDuring = new Date(periodStart);
  endDuring.setDate(endDuring.getDate() + 3);

  return createMockUnavailability({
    resource_id: resourceId,
    start_date: startBefore,
    end_date: endDuring,
    unavailability_type: 'vacation',
    description: 'Partially overlapping vacation',
  });
}

/**
 * Create unavailability that fully encompasses a period
 */
export function createFullyEncompassingUnavailability(
  periodStart: Date,
  periodEnd: Date,
  resourceId = 'resource-1-uuid'
): any {
  const startBefore = new Date(periodStart);
  startBefore.setDate(startBefore.getDate() - 5);

  const endAfter = new Date(periodEnd);
  endAfter.setDate(endAfter.getDate() + 5);

  return createMockUnavailability({
    resource_id: resourceId,
    start_date: startBefore,
    end_date: endAfter,
    unavailability_type: 'training',
    description: 'Extended training period',
  });
}

/**
 * Create a series of unavailability periods for a year
 */
export function createYearlyUnavailabilitySchedule(resourceId = 'resource-1-uuid'): any[] {
  return [
    createPublicHoliday(new Date('2024-01-01'), 'New Year\'s Day', resourceId),
    createVacationPeriod(new Date('2024-03-15'), 10, resourceId),
    createPublicHoliday(new Date('2024-07-04'), 'Independence Day', resourceId),
    createTrainingPeriod(new Date('2024-09-10'), 5, resourceId),
    createPublicHoliday(new Date('2024-12-25'), 'Christmas Day', resourceId),
  ];
}

/**
 * Create unavailability with no end date (ongoing)
 */
export function createOngoingUnavailability(startDate: Date, resourceId = 'resource-1-uuid', overrides: any = {}): any {
  // For testing purposes, set a far future end date to simulate "ongoing"
  const farFutureDate = new Date('2099-12-31');

  return createMockUnavailability({
    resource_id: resourceId,
    unavailability_type: 'other',
    start_date: startDate,
    end_date: farFutureDate,
    description: 'Long-term unavailability',
    ...overrides,
  });
}
