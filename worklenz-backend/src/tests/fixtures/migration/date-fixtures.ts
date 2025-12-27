/**
 * Date Test Fixtures
 *
 * Date test cases and ranges for testing date parsing and formatting.
 * Includes edge cases like leap years, month boundaries, year boundaries, etc.
 */

// ============================================================================
// DATE PARSING TEST CASES (M/D/YYYY → YYYY-MM-DD)
// ============================================================================

export interface DateParseTestCase {
  input: string;
  expected: string;
  description: string;
}

/**
 * Valid date parsing test cases.
 */
export const VALID_DATE_PARSE_CASES: DateParseTestCase[] = [
  // Standard dates
  {
    input: '1/1/2025',
    expected: '2025-01-01',
    description: 'New Year\'s Day',
  },
  {
    input: '12/31/2025',
    expected: '2025-12-31',
    description: 'New Year\'s Eve',
  },
  {
    input: '6/17/2025',
    expected: '2025-06-17',
    description: 'Mid-year date',
  },

  // Single-digit month and day
  {
    input: '1/5/2025',
    expected: '2025-01-05',
    description: 'Single-digit month and day',
  },
  {
    input: '9/9/2025',
    expected: '2025-09-09',
    description: 'Single-digit month and day (9/9)',
  },

  // Double-digit month and day
  {
    input: '10/15/2025',
    expected: '2025-10-15',
    description: 'Double-digit month and day',
  },
  {
    input: '12/25/2025',
    expected: '2025-12-25',
    description: 'Christmas',
  },

  // Leap year dates
  {
    input: '2/29/2024',
    expected: '2024-02-29',
    description: 'Leap day 2024',
  },
  {
    input: '2/28/2025',
    expected: '2025-02-28',
    description: 'Last day of Feb (non-leap year)',
  },

  // Month boundaries
  {
    input: '1/31/2025',
    expected: '2025-01-31',
    description: 'Last day of January',
  },
  {
    input: '2/1/2025',
    expected: '2025-02-01',
    description: 'First day of February',
  },
  {
    input: '3/31/2025',
    expected: '2025-03-31',
    description: 'Last day of March',
  },
  {
    input: '4/30/2025',
    expected: '2025-04-30',
    description: 'Last day of April (30 days)',
  },

  // Different years
  {
    input: '6/17/2023',
    expected: '2023-06-17',
    description: 'Year 2023',
  },
  {
    input: '6/17/2024',
    expected: '2024-06-17',
    description: 'Year 2024 (leap year)',
  },
  {
    input: '6/17/2026',
    expected: '2026-06-17',
    description: 'Year 2026',
  },
];

/**
 * Invalid date parsing test cases (malformed inputs).
 */
export const INVALID_DATE_PARSE_CASES: string[] = [
  '13/1/2025', // Invalid month
  '1/32/2025', // Invalid day
  '2/30/2025', // Invalid day for February
  '4/31/2025', // Invalid day for April
  '2/29/2025', // Not a leap year
  'invalid', // Not a date
  '2025-01-01', // Wrong format
  '01-01-2025', // Wrong format
  '', // Empty string
];

// ============================================================================
// WEEK DATE CALCULATION TEST CASES
// ============================================================================

export interface WeekEndTestCase {
  startDate: string; // YYYY-MM-DD
  weekLength: number;
  expected: string; // YYYY-MM-DD
  description: string;
}

/**
 * Week end date calculation test cases.
 */
export const WEEK_END_DATE_CASES: WeekEndTestCase[] = [
  // Standard 6-day weeks
  {
    startDate: '2025-01-01',
    weekLength: 6,
    expected: '2025-01-07',
    description: '6-day week starting New Year\'s Day',
  },
  {
    startDate: '2025-06-17',
    weekLength: 6,
    expected: '2025-06-23',
    description: '6-day week mid-year',
  },

  // 7-day weeks (full week)
  {
    startDate: '2025-01-01',
    weekLength: 7,
    expected: '2025-01-08',
    description: '7-day week starting New Year\'s Day',
  },

  // Month boundaries
  {
    startDate: '2025-01-28',
    weekLength: 6,
    expected: '2025-02-03',
    description: 'Week crossing January-February boundary',
  },
  {
    startDate: '2025-02-26',
    weekLength: 6,
    expected: '2025-03-04',
    description: 'Week crossing February-March boundary',
  },

  // Year boundary
  {
    startDate: '2024-12-28',
    weekLength: 6,
    expected: '2025-01-03',
    description: 'Week crossing year boundary',
  },

  // Leap year
  {
    startDate: '2024-02-26',
    weekLength: 6,
    expected: '2024-03-03',
    description: 'Week crossing Feb-Mar boundary (leap year)',
  },
];

// ============================================================================
// ISO DATE FORMATTING TEST CASES
// ============================================================================

export interface IsoDateTestCase {
  date: Date;
  expected: string; // YYYY-MM-DD
  description: string;
}

/**
 * ISO date formatting test cases.
 */
export const ISO_DATE_FORMAT_CASES: IsoDateTestCase[] = [
  {
    date: new Date(2025, 0, 1), // Jan 1, 2025
    expected: '2025-01-01',
    description: 'New Year\'s Day',
  },
  {
    date: new Date(2025, 5, 17), // Jun 17, 2025
    expected: '2025-06-17',
    description: 'Mid-year date',
  },
  {
    date: new Date(2025, 11, 31), // Dec 31, 2025
    expected: '2025-12-31',
    description: 'New Year\'s Eve',
  },
  {
    date: new Date(2024, 1, 29), // Feb 29, 2024 (leap year)
    expected: '2024-02-29',
    description: 'Leap day',
  },
];

// ============================================================================
// ISO DATETIME FORMATTING TEST CASES
// ============================================================================

export interface IsoDateTimeTestCase {
  date: Date;
  expectedPattern: RegExp;
  description: string;
}

/**
 * ISO DateTime formatting test cases.
 */
export const ISO_DATETIME_FORMAT_CASES: IsoDateTimeTestCase[] = [
  {
    date: new Date(2025, 0, 1, 12, 0, 0), // Jan 1, 2025 12:00:00
    expectedPattern: /^2025-01-01T12:00:00\.\d{3}Z$/,
    description: 'Noon on New Year\'s Day',
  },
  {
    date: new Date(2025, 5, 17, 14, 30, 45), // Jun 17, 2025 14:30:45
    expectedPattern: /^2025-06-17T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    description: 'Afternoon timestamp',
  },
];

// ============================================================================
// DATE ARITHMETIC TEST CASES
// ============================================================================

export interface DateArithmeticTestCase {
  startDate: string; // YYYY-MM-DD
  days: number;
  expected: string; // YYYY-MM-DD
  description: string;
}

/**
 * Add days test cases.
 */
export const ADD_DAYS_CASES: DateArithmeticTestCase[] = [
  {
    startDate: '2025-01-01',
    days: 1,
    expected: '2025-01-02',
    description: 'Add 1 day',
  },
  {
    startDate: '2025-01-01',
    days: 7,
    expected: '2025-01-08',
    description: 'Add 1 week',
  },
  {
    startDate: '2025-01-01',
    days: 31,
    expected: '2025-02-01',
    description: 'Add 31 days (crosses month boundary)',
  },
  {
    startDate: '2025-01-01',
    days: 365,
    expected: '2026-01-01',
    description: 'Add 1 year (non-leap)',
  },
  {
    startDate: '2024-01-01',
    days: 366,
    expected: '2025-01-01',
    description: 'Add 1 year (leap year)',
  },
  {
    startDate: '2025-01-31',
    days: 1,
    expected: '2025-02-01',
    description: 'Add 1 day at end of month',
  },
  {
    startDate: '2024-02-28',
    days: 1,
    expected: '2024-02-29',
    description: 'Add 1 day before leap day',
  },
  {
    startDate: '2024-02-29',
    days: 1,
    expected: '2024-03-01',
    description: 'Add 1 day after leap day',
  },
  {
    startDate: '2024-12-31',
    days: 1,
    expected: '2025-01-01',
    description: 'Add 1 day at end of year',
  },
];

/**
 * Days between test cases.
 */
export interface DaysBetweenTestCase {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  expected: number;
  description: string;
}

export const DAYS_BETWEEN_CASES: DaysBetweenTestCase[] = [
  {
    startDate: '2025-01-01',
    endDate: '2025-01-02',
    expected: 1,
    description: '1 day apart',
  },
  {
    startDate: '2025-01-01',
    endDate: '2025-01-08',
    expected: 7,
    description: '1 week apart',
  },
  {
    startDate: '2025-01-01',
    endDate: '2025-02-01',
    expected: 31,
    description: '1 month apart (Jan-Feb)',
  },
  {
    startDate: '2025-01-01',
    endDate: '2026-01-01',
    expected: 365,
    description: '1 year apart (non-leap)',
  },
  {
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    expected: 366,
    description: '1 year apart (leap year)',
  },
  {
    startDate: '2025-01-01',
    endDate: '2025-01-01',
    expected: 0,
    description: 'Same day',
  },
];

// ============================================================================
// ISO WEEK NUMBER TEST CASES
// ============================================================================

export interface IsoWeekTestCase {
  date: string; // YYYY-MM-DD
  expected: string; // YYYY-Www (e.g., "2025-W01")
  description: string;
}

/**
 * ISO week number test cases.
 */
export const ISO_WEEK_CASES: IsoWeekTestCase[] = [
  {
    date: '2025-01-01',
    expected: '2025-W01',
    description: 'First week of 2025',
  },
  {
    date: '2025-06-17',
    expected: '2025-W25',
    description: 'Mid-year week',
  },
  {
    date: '2025-12-31',
    expected: '2025-W53',
    description: 'Last week of 2025',
  },
  {
    date: '2024-12-30',
    expected: '2025-W01',
    description: 'Week belongs to next year',
  },
];

// ============================================================================
// DATE VALIDATION TEST CASES
// ============================================================================

/**
 * Valid ISO dates (YYYY-MM-DD format).
 */
export const VALID_ISO_DATES: string[] = [
  '2025-01-01',
  '2025-06-17',
  '2025-12-31',
  '2024-02-29', // Leap day
  '2023-02-28',
  '2025-10-15',
];

/**
 * Invalid ISO dates.
 */
export const INVALID_ISO_DATES: string[] = [
  '2025-13-01', // Invalid month
  '2025-01-32', // Invalid day
  '2025-02-30', // Invalid day for February
  '2025-04-31', // Invalid day for April
  '2025-02-29', // Not a leap year
  '25-01-01', // Wrong year format
  '2025/01/01', // Wrong delimiter
  '01-01-2025', // Wrong order
  '2025-1-1', // Missing zero padding
  'invalid',
  '',
];

// ============================================================================
// DATE RANGE GENERATORS
// ============================================================================

/**
 * Generate a range of dates.
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param stepDays - Number of days between dates (default: 1)
 * @returns Array of dates (YYYY-MM-DD)
 */
export function generateDateRange(
  startDate: string,
  endDate: string,
  stepDays: number = 1
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + stepDays)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

/**
 * Generate weekly dates for a year.
 *
 * @param year - Year (e.g., 2025)
 * @param startMonth - Starting month (0-11, default: 0)
 * @param weeks - Number of weeks (default: 52)
 * @returns Array of week start dates (YYYY-MM-DD)
 */
export function generateWeeklyDates(
  year: number,
  startMonth: number = 0,
  weeks: number = 52
): string[] {
  const dates: string[] = [];
  const startDate = new Date(year, startMonth, 1);

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + i * 7);

    const y = weekStart.getFullYear();
    const m = String(weekStart.getMonth() + 1).padStart(2, '0');
    const d = String(weekStart.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }

  return dates;
}
