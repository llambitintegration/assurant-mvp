/**
 * Heatmap Helper Functions Unit Tests
 * Tests for calculateDaysBetween and getUtilizationStatus
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

import {
  calculateDaysBetween,
  getUtilizationStatus
} from '../../../../services/rcm/heatmap-service';

describe('Heatmap Helper Functions', () => {
  describe('calculateDaysBetween', () => {
    it('should return 0 for the same date', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = calculateDaysBetween(date, date);

      expect(result).toBe(0);
    });

    it('should return 1 for dates one day apart', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-16T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(1);
    });

    it('should return 7 for dates one week apart', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-22T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(7);
    });

    it('should return 31 for January (31 days)', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-02-01T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(31);
    });

    it('should return 29 for February in a leap year (2024)', () => {
      const start = new Date('2024-02-01T00:00:00Z');
      const end = new Date('2024-03-01T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(29);
    });

    it('should return 28 for February in a non-leap year (2023)', () => {
      const start = new Date('2023-02-01T00:00:00Z');
      const end = new Date('2023-03-01T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(28);
    });

    it('should handle negative result for reversed dates', () => {
      const start = new Date('2024-01-16T00:00:00Z');
      const end = new Date('2024-01-15T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(-1);
    });

    it('should handle fractional days correctly', () => {
      const start = new Date('2024-01-15T00:00:00Z');
      const end = new Date('2024-01-15T12:00:00Z'); // 12 hours = 0.5 days
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(0.5);
    });

    it('should handle dates across year boundary', () => {
      const start = new Date('2023-12-25T00:00:00Z');
      const end = new Date('2024-01-05T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(11); // 6 days in Dec + 5 days in Jan
    });

    it('should handle large date ranges', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-12-31T00:00:00Z');
      const result = calculateDaysBetween(start, end);

      expect(result).toBe(365); // 2024 is a leap year, so 366 days total, but Dec 31 is day 366
    });
  });

  describe('getUtilizationStatus', () => {
    it('should return AVAILABLE for 0% utilization', () => {
      expect(getUtilizationStatus(0)).toBe('AVAILABLE');
    });

    it('should return AVAILABLE for utilization below 40%', () => {
      expect(getUtilizationStatus(39)).toBe('AVAILABLE');
      expect(getUtilizationStatus(39.9)).toBe('AVAILABLE');
      expect(getUtilizationStatus(10)).toBe('AVAILABLE');
      expect(getUtilizationStatus(25)).toBe('AVAILABLE');
    });

    it('should return UNDERUTILIZED for 40-59% utilization', () => {
      expect(getUtilizationStatus(40)).toBe('UNDERUTILIZED');
      expect(getUtilizationStatus(50)).toBe('UNDERUTILIZED');
      expect(getUtilizationStatus(59)).toBe('UNDERUTILIZED');
      expect(getUtilizationStatus(59.9)).toBe('UNDERUTILIZED');
    });

    it('should return AVERAGE for 60-79% utilization', () => {
      expect(getUtilizationStatus(60)).toBe('AVERAGE');
      expect(getUtilizationStatus(70)).toBe('AVERAGE');
      expect(getUtilizationStatus(79)).toBe('AVERAGE');
      expect(getUtilizationStatus(79.9)).toBe('AVERAGE');
    });

    it('should return OPTIMAL for 80-99% utilization', () => {
      expect(getUtilizationStatus(80)).toBe('OPTIMAL');
      expect(getUtilizationStatus(90)).toBe('OPTIMAL');
      expect(getUtilizationStatus(99)).toBe('OPTIMAL');
      expect(getUtilizationStatus(99.9)).toBe('OPTIMAL');
    });

    it('should return OVERUTILIZED for 100% utilization', () => {
      expect(getUtilizationStatus(100)).toBe('OVERUTILIZED');
    });

    it('should return OVERUTILIZED for utilization above 100%', () => {
      expect(getUtilizationStatus(101)).toBe('OVERUTILIZED');
      expect(getUtilizationStatus(150)).toBe('OVERUTILIZED');
      expect(getUtilizationStatus(200)).toBe('OVERUTILIZED');
    });

    it('should handle boundary values correctly', () => {
      // Test exact boundaries
      expect(getUtilizationStatus(39.999)).toBe('AVAILABLE');
      expect(getUtilizationStatus(40.0)).toBe('UNDERUTILIZED');
      expect(getUtilizationStatus(59.999)).toBe('UNDERUTILIZED');
      expect(getUtilizationStatus(60.0)).toBe('AVERAGE');
      expect(getUtilizationStatus(79.999)).toBe('AVERAGE');
      expect(getUtilizationStatus(80.0)).toBe('OPTIMAL');
      expect(getUtilizationStatus(99.999)).toBe('OPTIMAL');
      expect(getUtilizationStatus(100.0)).toBe('OVERUTILIZED');
    });

    it('should handle negative utilization (edge case)', () => {
      // This shouldn't happen in practice, but test the behavior
      expect(getUtilizationStatus(-10)).toBe('AVAILABLE');
    });

    it('should handle very large utilization percentages', () => {
      expect(getUtilizationStatus(500)).toBe('OVERUTILIZED');
      expect(getUtilizationStatus(1000)).toBe('OVERUTILIZED');
    });

    // Parameterized test using test.each for comprehensive coverage
    it.each([
      [0, 'AVAILABLE'],
      [39, 'AVAILABLE'],
      [40, 'UNDERUTILIZED'],
      [59, 'UNDERUTILIZED'],
      [60, 'AVERAGE'],
      [79, 'AVERAGE'],
      [80, 'OPTIMAL'],
      [99, 'OPTIMAL'],
      [100, 'OVERUTILIZED'],
      [150, 'OVERUTILIZED']
    ])('should return %s for %d%% utilization', (percent, expected) => {
      expect(getUtilizationStatus(percent)).toBe(expected);
    });
  });
});
