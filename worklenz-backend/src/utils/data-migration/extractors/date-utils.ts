/**
 * Date Parsing and Formatting Utilities
 *
 * Utilities for parsing various date formats and converting to ISO 8601.
 * Handles common US date formats (M/D/YYYY) and week calculations.
 *
 * @module date-utils
 */

/**
 * Parse M/D/YYYY format date string to ISO date (YYYY-MM-DD)
 *
 * @param dateStr - Date string in M/D/YYYY format (e.g., "6/17/2025")
 * @returns ISO date string (YYYY-MM-DD) or original string if parsing fails
 *
 * @example
 * ```typescript
 * parseDate('6/17/2025');   // => '2025-06-17'
 * parseDate('12/1/2024');   // => '2024-12-01'
 * ```
 */
export function parseDate(dateStr: string): string {
  // Expected format: M/D/YYYY
  const parts = dateStr.split('/');

  if (parts.length !== 3) {
    return dateStr; // Return original if not in expected format
  }

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2];

  return `${year}-${month}-${day}`;
}

/**
 * Calculate week end date from week start date
 *
 * @param startDate - Week start date in YYYY-MM-DD format
 * @param weekLength - Number of days in week (default: 6, making 7 days total including start)
 * @returns Week end date in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * getWeekEndDate('2025-06-17');  // => '2025-06-23' (6 days later)
 * ```
 */
export function getWeekEndDate(startDate: string, weekLength: number = 6): string {
  if (!startDate || startDate === '') {
    return '';
  }

  // Parse the date manually to avoid timezone issues
  const [year, month, day] = startDate.split('-').map(Number);

  // Create date (month is 0-indexed in Date constructor)
  const date = new Date(year, month - 1, day);

  // Add days to get end date
  date.setDate(date.getDate() + weekLength);

  // Format as YYYY-MM-DD
  return formatIsoDate(date);
}

/**
 * Format a Date object to ISO 8601 date string (YYYY-MM-DD)
 *
 * @param date - Date object
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * const date = new Date(2025, 5, 17); // June 17, 2025
 * formatIsoDate(date);  // => '2025-06-17'
 * ```
 */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to ISO 8601 DateTime string
 *
 * @param date - Date object
 * @returns ISO DateTime string (YYYY-MM-DDTHH:mm:ss.sssZ)
 *
 * @example
 * ```typescript
 * const date = new Date(2025, 5, 17, 10, 30, 0);
 * formatIsoDateTime(date);  // => '2025-06-17T10:30:00.000Z'
 * ```
 */
export function formatIsoDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Get ISO week identifier (YYYY-Www format)
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns ISO week identifier (e.g., "2025-W25")
 *
 * @example
 * ```typescript
 * getWeekIdentifier('2025-06-17');  // => '2025-W25'
 * ```
 */
export function getWeekIdentifier(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  // Calculate ISO week number
  const weekNumber = getIsoWeekNumber(date);

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Get ISO week number for a date
 *
 * @param date - Date object
 * @returns ISO week number (1-53)
 *
 * @example
 * ```typescript
 * const date = new Date(2025, 5, 17);
 * getIsoWeekNumber(date);  // => 25
 * ```
 */
export function getIsoWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());

  // ISO week starts on Monday
  const dayNumber = (date.getDay() + 6) % 7;

  // Set to nearest Thursday (current date + 4 - current day number)
  target.setDate(target.getDate() - dayNumber + 3);

  // January 4th is always in week 1
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNumber = Math.ceil(
    ((target.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7
  );

  return weekNumber;
}

/**
 * Parse MM/DD/YYYY format to Date object
 *
 * @param dateStr - Date string in MM/DD/YYYY or M/D/YYYY format
 * @returns Date object
 *
 * @example
 * ```typescript
 * parseUsDate('6/17/2025');   // => Date(2025, 5, 17)
 * parseUsDate('12/01/2024');  // => Date(2024, 11, 1)
 * ```
 */
export function parseUsDate(dateStr: string): Date {
  const parts = dateStr.split('/');

  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected M/D/YYYY or MM/DD/YYYY`);
  }

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  return new Date(year, month - 1, day);
}

/**
 * Convert M/D/YYYY to ISO DateTime string (midnight UTC)
 *
 * @param dateStr - Date string in M/D/YYYY format
 * @returns ISO DateTime string
 *
 * @example
 * ```typescript
 * convertToIsoDateTime('6/17/2025');
 * // => '2025-06-17T00:00:00.000Z'
 * ```
 */
export function convertToIsoDateTime(dateStr: string): string {
  const isoDate = parseDate(dateStr);
  return `${isoDate}T00:00:00.000Z`;
}

/**
 * Add days to a date string
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * addDays('2025-06-17', 7);   // => '2025-06-24'
 * addDays('2025-06-17', -7);  // => '2025-06-10'
 * ```
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

/**
 * Calculate number of days between two dates
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Number of days (positive if endDate is after startDate)
 *
 * @example
 * ```typescript
 * daysBetween('2025-06-17', '2025-06-24');  // => 7
 * daysBetween('2025-06-24', '2025-06-17');  // => -7
 * ```
 */
export function daysBetween(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date string is in valid YYYY-MM-DD format
 *
 * @param dateStr - Date string to validate
 * @returns true if valid YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * isValidIsoDate('2025-06-17');   // => true
 * isValidIsoDate('6/17/2025');    // => false
 * isValidIsoDate('invalid');      // => false
 * ```
 */
export function isValidIsoDate(dateStr: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateStr)) {
    return false;
  }

  // Check if it's a valid date
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
