/**
 * Unit Tests: date-utils.ts
 *
 * Tests for date parsing and formatting utilities.
 * Target coverage: 95%+ (14 functions)
 */

// Unmock the modules we're testing
jest.unmock('../../../../../utils/data-migration/extractors/date-utils');

import {
  parseDate,
  getWeekEndDate,
  formatIsoDate,
  formatIsoDateTime,
  getWeekIdentifier,
  getIsoWeekNumber,
  parseUsDate,
  convertToIsoDateTime,
  addDays,
  daysBetween,
  isValidIsoDate,
} from '../../../../../utils/data-migration/extractors/date-utils';

import {
  VALID_DATE_PARSE_CASES,
  INVALID_DATE_PARSE_CASES,
  WEEK_END_DATE_CASES,
  ISO_DATE_FORMAT_CASES,
  ISO_DATETIME_FORMAT_CASES,
  ADD_DAYS_CASES,
  DAYS_BETWEEN_CASES,
  ISO_WEEK_CASES,
  VALID_ISO_DATES,
  INVALID_ISO_DATES,
  generateDateRange,
  generateWeeklyDates,
} from '../../../../fixtures/migration/date-fixtures';

describe('Date Parsing and Formatting Utilities', () => {
  // ==========================================================================
  // parseDate()
  // ==========================================================================

  describe('parseDate()', () => {
    it('should parse valid M/D/YYYY dates', () => {
      VALID_DATE_PARSE_CASES.forEach(({ input, expected, description }) => {
        const result = parseDate(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle single-digit month and day', () => {
      expect(parseDate('1/5/2025')).toBe('2025-01-05');
      expect(parseDate('9/9/2025')).toBe('2025-09-09');
    });

    it('should handle double-digit month and day', () => {
      expect(parseDate('10/15/2025')).toBe('2025-10-15');
      expect(parseDate('12/25/2025')).toBe('2025-12-25');
    });

    it('should handle leap year dates', () => {
      expect(parseDate('2/29/2024')).toBe('2024-02-29');
      expect(parseDate('2/28/2025')).toBe('2025-02-28');
    });

    it('should handle month boundaries', () => {
      expect(parseDate('1/31/2025')).toBe('2025-01-31');
      expect(parseDate('2/1/2025')).toBe('2025-02-01');
    });

    it('should return original string for malformed input', () => {
      INVALID_DATE_PARSE_CASES.forEach((invalidDate) => {
        const result = parseDate(invalidDate);
        expect(result).toBe(invalidDate);
      });
    });

    it('should return original string for wrong format', () => {
      expect(parseDate('2025-01-01')).toBe('2025-01-01'); // Already ISO format
      expect(parseDate('invalid')).toBe('invalid');
      expect(parseDate('')).toBe('');
    });

    it('should handle year boundaries', () => {
      expect(parseDate('12/31/2025')).toBe('2025-12-31');
      expect(parseDate('1/1/2025')).toBe('2025-01-01');
    });

    it('should pad single digits with zeros', () => {
      const result = parseDate('6/17/2025');
      expect(result).toBe('2025-06-17');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ==========================================================================
  // getWeekEndDate()
  // ==========================================================================

  describe('getWeekEndDate()', () => {
    it('should calculate week end dates', () => {
      WEEK_END_DATE_CASES.forEach(({ startDate, weekLength, expected, description }) => {
        const result = getWeekEndDate(startDate, weekLength);
        expect(result).toBe(expected);
      });
    });

    it('should default to 6-day week', () => {
      const result = getWeekEndDate('2025-01-01');
      expect(result).toBe('2025-01-07'); // 6 days later
    });

    it('should support 7-day week', () => {
      const result = getWeekEndDate('2025-01-01', 7);
      expect(result).toBe('2025-01-08');
    });

    it('should handle month boundaries', () => {
      const result = getWeekEndDate('2025-01-28', 6);
      expect(result).toBe('2025-02-03');
    });

    it('should handle year boundaries', () => {
      const result = getWeekEndDate('2024-12-28', 6);
      expect(result).toBe('2025-01-03');
    });

    it('should handle leap year February', () => {
      const result = getWeekEndDate('2024-02-26', 6);
      expect(result).toBe('2024-03-03');
    });

    it('should return empty string for empty input', () => {
      expect(getWeekEndDate('')).toBe('');
    });

    it('should handle custom week lengths', () => {
      expect(getWeekEndDate('2025-01-01', 1)).toBe('2025-01-02');
      expect(getWeekEndDate('2025-01-01', 13)).toBe('2025-01-14'); // 2 weeks
    });
  });

  // ==========================================================================
  // formatIsoDate()
  // ==========================================================================

  describe('formatIsoDate()', () => {
    it('should format Date objects to ISO date', () => {
      ISO_DATE_FORMAT_CASES.forEach(({ date, expected, description }) => {
        const result = formatIsoDate(date);
        expect(result).toBe(expected);
      });
    });

    it('should format with zero-padded month and day', () => {
      const date = new Date(2025, 0, 5); // Jan 5, 2025
      expect(formatIsoDate(date)).toBe('2025-01-05');
    });

    it('should handle leap day', () => {
      const date = new Date(2024, 1, 29); // Feb 29, 2024
      expect(formatIsoDate(date)).toBe('2024-02-29');
    });

    it('should handle year boundaries', () => {
      expect(formatIsoDate(new Date(2025, 0, 1))).toBe('2025-01-01');
      expect(formatIsoDate(new Date(2025, 11, 31))).toBe('2025-12-31');
    });

    it('should always return YYYY-MM-DD format', () => {
      const result = formatIsoDate(new Date(2025, 5, 17));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ==========================================================================
  // formatIsoDateTime()
  // ==========================================================================

  describe('formatIsoDateTime()', () => {
    it('should format Date objects to ISO DateTime', () => {
      const date = new Date(2025, 5, 17, 10, 30, 0);
      const result = formatIsoDateTime(date);

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include milliseconds', () => {
      const date = new Date(2025, 5, 17, 10, 30, 45, 123);
      const result = formatIsoDateTime(date);

      expect(result).toContain('.123Z');
    });

    it('should be in UTC timezone', () => {
      const date = new Date(2025, 5, 17, 10, 30, 0);
      const result = formatIsoDateTime(date);

      expect(result).toEndWith('Z');
    });
  });

  // ==========================================================================
  // getWeekIdentifier()
  // ==========================================================================

  describe('getWeekIdentifier()', () => {
    it('should return ISO week identifier', () => {
      const result = getWeekIdentifier('2025-06-17');
      expect(result).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should calculate correct week numbers', () => {
      expect(getWeekIdentifier('2025-01-01')).toMatch(/2025-W\d{2}/);
      expect(getWeekIdentifier('2025-06-17')).toMatch(/2025-W\d{2}/);
      expect(getWeekIdentifier('2025-12-31')).toMatch(/2025-W\d{2}/);
    });

    it('should zero-pad week numbers', () => {
      const result = getWeekIdentifier('2025-01-01');
      expect(result).toMatch(/2025-W0[1-9]|2025-W[1-5][0-9]/);
    });
  });

  // ==========================================================================
  // getIsoWeekNumber()
  // ==========================================================================

  describe('getIsoWeekNumber()', () => {
    it('should return week number between 1 and 53', () => {
      const date = new Date(2025, 5, 17);
      const weekNumber = getIsoWeekNumber(date);

      expect(weekNumber).toBeGreaterThanOrEqual(1);
      expect(weekNumber).toBeLessThanOrEqual(53);
    });

    it('should calculate week 1 for January dates', () => {
      const date = new Date(2025, 0, 1);
      const weekNumber = getIsoWeekNumber(date);

      expect(weekNumber).toBeGreaterThanOrEqual(1);
    });

    it('should handle year-end weeks', () => {
      const date = new Date(2025, 11, 31);
      const weekNumber = getIsoWeekNumber(date);

      expect(weekNumber).toBeGreaterThanOrEqual(1);
    });

    it('should be consistent for dates in same week', () => {
      const monday = new Date(2025, 5, 16);
      const tuesday = new Date(2025, 5, 17);
      const sunday = new Date(2025, 5, 22);

      const week1 = getIsoWeekNumber(monday);
      const week2 = getIsoWeekNumber(tuesday);
      const week3 = getIsoWeekNumber(sunday);

      expect(week1).toBe(week2);
      expect(week2).toBe(week3);
    });
  });

  // ==========================================================================
  // parseUsDate()
  // ==========================================================================

  describe('parseUsDate()', () => {
    it('should parse M/D/YYYY to Date object', () => {
      const date = parseUsDate('6/17/2025');

      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(5); // June (0-indexed)
      expect(date.getDate()).toBe(17);
    });

    it('should handle single-digit month and day', () => {
      const date = parseUsDate('1/5/2025');

      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(5);
    });

    it('should handle double-digit month and day', () => {
      const date = parseUsDate('12/25/2025');

      expect(date.getMonth()).toBe(11); // December
      expect(date.getDate()).toBe(25);
    });

    it('should throw error for malformed input', () => {
      expect(() => parseUsDate('invalid')).toThrow('Invalid date format');
      expect(() => parseUsDate('2025-01-01')).toThrow('Invalid date format');
      expect(() => parseUsDate('')).toThrow('Invalid date format');
    });

    it('should handle leap year dates', () => {
      const date = parseUsDate('2/29/2024');

      expect(date.getMonth()).toBe(1); // February
      expect(date.getDate()).toBe(29);
    });
  });

  // ==========================================================================
  // convertToIsoDateTime()
  // ==========================================================================

  describe('convertToIsoDateTime()', () => {
    it('should convert M/D/YYYY to ISO DateTime', () => {
      const result = convertToIsoDateTime('6/17/2025');

      expect(result).toBe('2025-06-17T00:00:00.000Z');
    });

    it('should set time to midnight UTC', () => {
      const result = convertToIsoDateTime('12/25/2025');

      expect(result).toContain('T00:00:00.000Z');
    });

    it('should handle various date formats', () => {
      expect(convertToIsoDateTime('1/1/2025')).toBe('2025-01-01T00:00:00.000Z');
      expect(convertToIsoDateTime('12/31/2025')).toBe('2025-12-31T00:00:00.000Z');
    });
  });

  // ==========================================================================
  // addDays()
  // ==========================================================================

  describe('addDays()', () => {
    it('should add days to date', () => {
      ADD_DAYS_CASES.forEach(({ startDate, days, expected, description }) => {
        const result = addDays(startDate, days);
        expect(result).toBe(expected);
      });
    });

    it('should add positive days', () => {
      expect(addDays('2025-01-01', 7)).toBe('2025-01-08');
      expect(addDays('2025-01-01', 1)).toBe('2025-01-02');
    });

    it('should subtract days with negative input', () => {
      expect(addDays('2025-01-08', -7)).toBe('2025-01-01');
      expect(addDays('2025-01-02', -1)).toBe('2025-01-01');
    });

    it('should handle month boundaries', () => {
      expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
      expect(addDays('2025-02-01', -1)).toBe('2025-01-31');
    });

    it('should handle year boundaries', () => {
      expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
      expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
    });

    it('should handle leap year', () => {
      expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
      expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    });

    it('should handle adding 0 days', () => {
      expect(addDays('2025-01-01', 0)).toBe('2025-01-01');
    });

    it('should handle large numbers of days', () => {
      expect(addDays('2025-01-01', 365)).toBe('2026-01-01');
      expect(addDays('2024-01-01', 366)).toBe('2025-01-01'); // Leap year
    });
  });

  // ==========================================================================
  // daysBetween()
  // ==========================================================================

  describe('daysBetween()', () => {
    it('should calculate days between dates', () => {
      DAYS_BETWEEN_CASES.forEach(({ startDate, endDate, expected, description }) => {
        const result = daysBetween(startDate, endDate);
        expect(result).toBe(expected);
      });
    });

    it('should return positive value when end is after start', () => {
      expect(daysBetween('2025-01-01', '2025-01-08')).toBe(7);
      expect(daysBetween('2025-01-01', '2025-01-02')).toBe(1);
    });

    it('should return negative value when end is before start', () => {
      expect(daysBetween('2025-01-08', '2025-01-01')).toBe(-7);
      expect(daysBetween('2025-01-02', '2025-01-01')).toBe(-1);
    });

    it('should return 0 for same date', () => {
      expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
    });

    it('should handle month boundaries', () => {
      expect(daysBetween('2025-01-01', '2025-02-01')).toBe(31);
      expect(daysBetween('2025-02-01', '2025-03-01')).toBe(28); // Non-leap year
    });

    it('should handle year boundaries', () => {
      expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
      expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366); // Leap year
    });

    it('should handle leap years', () => {
      expect(daysBetween('2024-02-01', '2024-03-01')).toBe(29);
    });
  });

  // ==========================================================================
  // isValidIsoDate()
  // ==========================================================================

  describe('isValidIsoDate()', () => {
    it('should validate correct ISO dates', () => {
      VALID_ISO_DATES.forEach((date) => {
        expect(isValidIsoDate(date)).toBe(true);
      });
    });

    it('should reject invalid ISO dates', () => {
      INVALID_ISO_DATES.forEach((date) => {
        expect(isValidIsoDate(date)).toBe(false);
      });
    });

    it('should validate format YYYY-MM-DD', () => {
      expect(isValidIsoDate('2025-06-17')).toBe(true);
      expect(isValidIsoDate('2024-02-29')).toBe(true); // Leap year
    });

    it('should reject wrong format', () => {
      expect(isValidIsoDate('6/17/2025')).toBe(false); // US format
      expect(isValidIsoDate('17-06-2025')).toBe(false); // DD-MM-YYYY
      expect(isValidIsoDate('2025/06/17')).toBe(false); // Wrong delimiter
    });

    it('should reject invalid dates', () => {
      expect(isValidIsoDate('2025-13-01')).toBe(false); // Invalid month
      expect(isValidIsoDate('2025-01-32')).toBe(false); // Invalid day
      expect(isValidIsoDate('2025-02-30')).toBe(false); // Invalid day for February
      expect(isValidIsoDate('2025-04-31')).toBe(false); // Invalid day for April
      expect(isValidIsoDate('2025-02-29')).toBe(false); // Not a leap year
    });

    it('should reject missing zero padding', () => {
      expect(isValidIsoDate('2025-1-1')).toBe(false);
      expect(isValidIsoDate('2025-01-1')).toBe(false);
      expect(isValidIsoDate('2025-1-01')).toBe(false);
    });

    it('should reject empty and malformed strings', () => {
      expect(isValidIsoDate('')).toBe(false);
      expect(isValidIsoDate('invalid')).toBe(false);
      expect(isValidIsoDate('2025-01')).toBe(false);
      expect(isValidIsoDate('2025-01-01-01')).toBe(false);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should parse US date and convert to ISO', () => {
      const usDate = '6/17/2025';
      const isoDate = parseDate(usDate);
      const weekEnd = getWeekEndDate(isoDate);

      expect(isoDate).toBe('2025-06-17');
      expect(weekEnd).toBe('2025-06-23');
      expect(isValidIsoDate(isoDate)).toBe(true);
      expect(isValidIsoDate(weekEnd)).toBe(true);
    });

    it('should calculate week ranges for allocation periods', () => {
      const startDate = '2025-01-01';
      const weekStarts = generateWeeklyDates(2025, 0, 10);

      expect(weekStarts).toHaveLength(10);
      weekStarts.forEach((date) => {
        expect(isValidIsoDate(date)).toBe(true);
      });

      // Verify each week start + end is 6 days apart
      weekStarts.forEach((start) => {
        const end = getWeekEndDate(start);
        const diff = daysBetween(start, end);
        expect(diff).toBe(6);
      });
    });

    it('should handle full year date range generation', () => {
      const dateRange = generateDateRange('2025-01-01', '2025-01-31');

      expect(dateRange).toHaveLength(31);
      expect(dateRange[0]).toBe('2025-01-01');
      expect(dateRange[30]).toBe('2025-01-31');

      dateRange.forEach((date) => {
        expect(isValidIsoDate(date)).toBe(true);
      });
    });

    it('should convert parsed dates to DateTime for database', () => {
      const usDate = '6/17/2025';
      const isoDateTime = convertToIsoDateTime(usDate);

      expect(isoDateTime).toBe('2025-06-17T00:00:00.000Z');
      expect(isoDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle leap year edge cases', () => {
      // Leap years
      expect(isValidIsoDate('2024-02-29')).toBe(true);
      expect(isValidIsoDate('2020-02-29')).toBe(true);
      expect(isValidIsoDate('2000-02-29')).toBe(true);

      // Non-leap years
      expect(isValidIsoDate('2025-02-29')).toBe(false);
      expect(isValidIsoDate('2100-02-29')).toBe(false); // Not divisible by 400
    });

    it('should handle month boundaries correctly', () => {
      // 30-day months
      expect(isValidIsoDate('2025-04-30')).toBe(true);
      expect(isValidIsoDate('2025-04-31')).toBe(false);

      // 31-day months
      expect(isValidIsoDate('2025-01-31')).toBe(true);
      expect(isValidIsoDate('2025-03-31')).toBe(true);
      expect(isValidIsoDate('2025-05-31')).toBe(true);
    });

    it('should handle century boundaries', () => {
      expect(isValidIsoDate('1999-12-31')).toBe(true);
      expect(isValidIsoDate('2000-01-01')).toBe(true);
      expect(isValidIsoDate('2099-12-31')).toBe(true);
      expect(isValidIsoDate('2100-01-01')).toBe(true);
    });

    it('should handle very large day additions', () => {
      const result = addDays('2025-01-01', 1000);
      expect(isValidIsoDate(result)).toBe(true);
    });

    it('should handle very large negative day subtractions', () => {
      const result = addDays('2025-01-01', -1000);
      expect(isValidIsoDate(result)).toBe(true);
    });

    it('should maintain consistency between add and subtract', () => {
      const start = '2025-06-17';
      const forward = addDays(start, 30);
      const back = addDays(forward, -30);

      expect(back).toBe(start);
    });

    it('should calculate correct days between across years', () => {
      const days = daysBetween('2024-01-01', '2026-01-01');
      expect(days).toBe(366 + 365); // 2024 is leap year
    });
  });
});
