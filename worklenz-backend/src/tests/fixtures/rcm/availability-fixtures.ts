/**
 * Availability Test Fixtures
 * Provides mock availability data for testing
 */

import { Prisma } from '@prisma/client';

/**
 * Base availability properties
 */
const baseAvailabilityProps = {
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock availability record
 */
export function createMockAvailability(overrides: any = {}): any {
  return {
    id: 'availability-1-uuid',
    resource_id: 'resource-1-uuid',
    effective_from: new Date('2024-01-01'),
    effective_to: null,
    hours_per_day: new Prisma.Decimal(8),
    days_per_week: new Prisma.Decimal(5),
    total_hours_per_week: new Prisma.Decimal(40),
    ...baseAvailabilityProps,
    ...overrides,
  };
}

/**
 * Create part-time availability (20 hours/week)
 */
export function createPartTimeAvailability(resourceId = 'resource-1-uuid', overrides: any = {}): any {
  return createMockAvailability({
    id: 'availability-part-time-uuid',
    resource_id: resourceId,
    hours_per_day: new Prisma.Decimal(4),
    days_per_week: new Prisma.Decimal(5),
    total_hours_per_week: new Prisma.Decimal(20),
    ...overrides,
  });
}

/**
 * Create full-time availability (40 hours/week)
 */
export function createFullTimeAvailability(resourceId = 'resource-1-uuid', overrides: any = {}): any {
  return createMockAvailability({
    id: 'availability-full-time-uuid',
    resource_id: resourceId,
    hours_per_day: new Prisma.Decimal(8),
    days_per_week: new Prisma.Decimal(5),
    total_hours_per_week: new Prisma.Decimal(40),
    ...overrides,
  });
}

/**
 * Create overtime availability (50 hours/week)
 */
export function createOvertimeAvailability(resourceId = 'resource-1-uuid', overrides: any = {}): any {
  return createMockAvailability({
    id: 'availability-overtime-uuid',
    resource_id: resourceId,
    hours_per_day: new Prisma.Decimal(10),
    days_per_week: new Prisma.Decimal(5),
    total_hours_per_week: new Prisma.Decimal(50),
    ...overrides,
  });
}

/**
 * Create availability with effective_to date (time-limited)
 */
export function createTimeLimitedAvailability(
  resourceId = 'resource-1-uuid',
  effectiveFrom: Date,
  effectiveTo: Date,
  overrides: any = {}
): any {
  return createMockAvailability({
    id: 'availability-time-limited-uuid',
    resource_id: resourceId,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    ...overrides,
  });
}

/**
 * Create multiple availability records for a resource (simulating changes over time)
 */
export function createAvailabilityHistory(resourceId = 'resource-1-uuid'): any[] {
  return [
    createMockAvailability({
      id: 'availability-1-uuid',
      resource_id: resourceId,
      effective_from: new Date('2023-01-01'),
      effective_to: new Date('2023-06-30'),
      total_hours_per_week: new Prisma.Decimal(40),
    }),
    createMockAvailability({
      id: 'availability-2-uuid',
      resource_id: resourceId,
      effective_from: new Date('2023-07-01'),
      effective_to: new Date('2023-12-31'),
      total_hours_per_week: new Prisma.Decimal(30), // Reduced hours
    }),
    createMockAvailability({
      id: 'availability-3-uuid',
      resource_id: resourceId,
      effective_from: new Date('2024-01-01'),
      effective_to: null, // Current availability
      total_hours_per_week: new Prisma.Decimal(40), // Back to full time
    }),
  ];
}

/**
 * Create availability for 4-day work week (32 hours)
 */
export function createFourDayWeekAvailability(resourceId = 'resource-1-uuid', overrides: any = {}): any {
  return createMockAvailability({
    id: 'availability-4day-uuid',
    resource_id: resourceId,
    hours_per_day: new Prisma.Decimal(8),
    days_per_week: new Prisma.Decimal(4),
    total_hours_per_week: new Prisma.Decimal(32),
    ...overrides,
  });
}

/**
 * Create availability for contractor (varied hours)
 */
export function createContractorAvailability(resourceId = 'resource-1-uuid', hoursPerWeek: number, overrides: any = {}): any {
  const hoursPerDay = hoursPerWeek / 5;
  return createMockAvailability({
    id: 'availability-contractor-uuid',
    resource_id: resourceId,
    hours_per_day: new Prisma.Decimal(hoursPerDay),
    days_per_week: new Prisma.Decimal(5),
    total_hours_per_week: new Prisma.Decimal(hoursPerWeek),
    ...overrides,
  });
}
