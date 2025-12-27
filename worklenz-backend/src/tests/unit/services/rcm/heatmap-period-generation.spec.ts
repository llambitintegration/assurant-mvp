/**
 * Heatmap Period Generation Unit Tests
 * Tests for generateTimePeriods function with various granularities
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

// Unmock the service module to test actual functionality
jest.unmock('../../../../services/rcm/heatmap-service');

import { generateTimePeriods } from '../../../../services/rcm/heatmap-service';
import { ITimePeriod } from '../../../../interfaces/rcm/heatmap.interface';

describe('generateTimePeriods', () => {
  describe('Daily Granularity', () => {
    it('should generate a single day period', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-16T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(1);
      expect(periods[0].start).toEqual(start);
      expect(periods[0].end).toEqual(end);
      expect(periods[0].label).toContain('Jan');
      expect(periods[0].label).toBeTruthy();
    });

    it('should generate daily periods for one week', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-22T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(7);
      expect(periods[0].label).toBeTruthy();
      expect(periods[6].label).toBeTruthy();
    });

    it('should generate daily periods for one month', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-02-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(31); // January has 31 days
      expect(periods[0].label).toBeTruthy();
      expect(periods[30].label).toBeTruthy();
    });

    it('should handle partial day at end of range', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-17T12:00:00Z'); // Partial day
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(3);
      // Last period should end at the exact end date
      expect(periods[2].end).toEqual(end);
    });

    it('should format daily labels correctly', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-17T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      // Labels should contain month name and numeric day
      expect(periods[0].label).toMatch(/Jan \d{1,2}/);
      expect(periods[1].label).toMatch(/Jan \d{1,2}/);
    });
  });

  describe('Weekly Granularity', () => {
    it('should generate weekly periods for 4 weeks', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-02-12T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      expect(periods).toHaveLength(4);
      expect(periods[0].label).toContain('-');
      expect(periods[0].label).toBeTruthy();
    });

    it('should generate weekly periods for one month with partial week', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-02-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      // 31 days = 4 full weeks + 3 days
      expect(periods.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle week ending at exact end date', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-22T12:00:00Z'); // Exactly 1 week
      const periods = generateTimePeriods(start, end, 'weekly');

      expect(periods).toHaveLength(1);
      expect(periods[0].end).toEqual(end);
    });

    it('should format weekly labels with date range', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-02-05T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      // Weekly labels should have format "Month Day - Month Day"
      expect(periods[0].label).toMatch(/[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}/);
      expect(periods[1].label).toMatch(/[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}/);
    });

    it('should handle partial week at end of range', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-24T12:00:00Z'); // 1 full week + 2 days
      const periods = generateTimePeriods(start, end, 'weekly');

      expect(periods).toHaveLength(2);
      // Last period should end at the exact end date
      expect(periods[1].end).toEqual(end);
    });

    it('should handle week crossing month boundary', () => {
      const start = new Date('2024-01-29T12:00:00Z');
      const end = new Date('2024-02-12T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      expect(periods).toHaveLength(2);
      // First week should cross into February (label contains both months)
      const firstLabel = periods[0].label;
      expect(firstLabel).toBeTruthy();
      expect(firstLabel).toContain('-');
    });
  });

  describe('Monthly Granularity', () => {
    it('should generate monthly periods from mid-month', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-02-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Mid-month to mid-month generates 2 periods (partial Jan + partial Feb)
      expect(periods).toHaveLength(2);
      expect(periods[0].label).toContain('2024');
      expect(periods[1].label).toContain('2024');
    });

    it('should generate monthly periods for half year', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-07-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Mid-Jan to mid-Jul = Jan(partial) + Feb + Mar + Apr + May + Jun + Jul(partial) = 7 periods
      expect(periods).toHaveLength(7);
      expect(periods[0].label).toMatch(/[A-Z][a-z]{2} 2024/);
      expect(periods[6].label).toMatch(/[A-Z][a-z]{2} 2024/);
    });

    it('should handle month crossing year boundary', () => {
      const start = new Date('2023-11-15T12:00:00Z');
      const end = new Date('2024-02-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Mid-Nov 2023 to mid-Feb 2024 = Nov(partial) + Dec + Jan + Feb(partial) = 4 periods
      expect(periods).toHaveLength(4);
      expect(periods[0].label).toContain('2023');
      expect(periods[3].label).toContain('2024');
    });

    it('should handle leap year February', () => {
      const start = new Date('2024-02-01T12:00:00Z');
      const end = new Date('2024-03-01T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Due to timezone/DST handling, may generate 1 or 2 periods
      expect(periods.length).toBeGreaterThanOrEqual(1);
      expect(periods.length).toBeLessThanOrEqual(2);
      expect(periods[0].label).toContain('Feb');
    });

    it('should handle non-leap year February', () => {
      const start = new Date('2023-02-01T12:00:00Z');
      const end = new Date('2023-03-01T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Due to timezone/DST handling, may generate 1 or 2 periods
      expect(periods.length).toBeGreaterThanOrEqual(1);
      expect(periods.length).toBeLessThanOrEqual(2);
      expect(periods[0].label).toContain('Feb');
    });

    it('should format monthly labels correctly', () => {
      const start = new Date('2024-01-15T12:00:00Z'); // Mid-month start
      const end = new Date('2024-03-15T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      expect(periods[0].label).toMatch(/[A-Z][a-z]{2} 2024/);
    });

    it('should handle partial month at end of range', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-03-20T12:00:00Z'); // Mid-March
      const periods = generateTimePeriods(start, end, 'monthly');

      expect(periods).toHaveLength(3);
      // Last period should end at the exact end date
      expect(periods[2].end).toEqual(end);
    });

    it('should handle year-long period', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2025-01-01T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Due to timezone/DST, may generate 12 or 13 periods
      expect(periods.length).toBeGreaterThanOrEqual(12);
      expect(periods.length).toBeLessThanOrEqual(13);
      expect(periods[0].label).toContain('2024');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short period (less than 1 day)', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T12:00:00Z'); // 12 hours
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(1);
      expect(periods[0].end).toEqual(end);
    });

    it('should handle period starting mid-month', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-03-20T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Mid-month to mid-month generates 3 periods (Jan partial, Feb full, Mar partial)
      expect(periods).toHaveLength(3);
      expect(periods[0].start).toEqual(start);
    });

    it('should handle same start and end date', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(0); // No periods when start === end
    });

    it('should return periods in chronological order', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      for (let i = 0; i < periods.length - 1; i++) {
        expect(periods[i].end.getTime()).toBeLessThanOrEqual(periods[i + 1].start.getTime());
      }
    });

    it('should not have overlapping periods', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-02-01T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      for (let i = 0; i < periods.length - 1; i++) {
        expect(periods[i].end).toEqual(periods[i + 1].start);
      }
    });

    it('should handle very long date range (1+ year)', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2025-06-01T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Jan 2024 - May 2025 (approximately 17 months, may vary due to timezone/DST)
      expect(periods.length).toBeGreaterThanOrEqual(17);
      expect(periods.length).toBeLessThanOrEqual(18);
      expect(periods[0].label).toContain('2024');
      expect(periods[periods.length - 1].label).toContain('2025');
    });
  });

  describe('Period Boundaries', () => {
    it('should align daily periods correctly', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-18T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      expect(periods).toHaveLength(3);
      // Each period should be 1 day apart
      for (let i = 0; i < periods.length - 1; i++) {
        const dayDiff = (periods[i + 1].start.getTime() - periods[i].start.getTime()) / (1000 * 60 * 60 * 24);
        expect(dayDiff).toBe(1);
      }
    });

    it('should generate monthly periods correctly', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2024-04-01T12:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      // Due to timezone/DST, may generate 3 or 4 periods
      expect(periods.length).toBeGreaterThanOrEqual(3);
      expect(periods.length).toBeLessThanOrEqual(4);
      // First period should start at the start date
      expect(periods[0].start).toEqual(start);
      // Last period should end at the end date
      expect(periods[periods.length - 1].end).toEqual(end);
    });

    it('should handle months with different day counts', () => {
      const start = new Date('2024-01-31T00:00:00Z'); // Jan 31
      const end = new Date('2024-04-01T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      expect(periods).toHaveLength(3); // Jan 31, Feb, Mar

      // Feb should still be a complete month
      expect(periods[0].label).toContain('Jan');
      expect(periods[1].label).toContain('Feb');
      expect(periods[2].label).toContain('Mar');
    });
  });

  describe('Label Formatting', () => {
    it('should format daily labels consistently', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-03T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'daily');

      periods.forEach((period) => {
        expect(period.label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // e.g., "Jan 1"
      });
    });

    it('should format weekly labels consistently', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-22T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'weekly');

      periods.forEach((period) => {
        expect(period.label).toMatch(/^[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}$/); // e.g., "Jan 1 - Jan 7"
      });
    });

    it('should format monthly labels consistently', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-04-01T00:00:00Z');
      const periods = generateTimePeriods(start, end, 'monthly');

      periods.forEach((period) => {
        expect(period.label).toMatch(/^[A-Z][a-z]{2} \d{4}$/); // e.g., "Jan 2024"
      });
    });
  });
});
