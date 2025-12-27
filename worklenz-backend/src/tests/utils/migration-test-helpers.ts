/**
 * Migration Test Helpers
 *
 * Custom assertion helpers and utility functions for migration tests.
 * Provides specialized matchers and comparison functions for migration workflows.
 */

import { ValidationResult } from '../../utils/data-migration/validators/data-validator';
import { AllocationPeriod } from '../../utils/data-migration/extractors/allocation-calculator';

// ============================================================================
// VALIDATION ASSERTION HELPERS
// ============================================================================

/**
 * Assert that validation result is successful.
 *
 * @param result - Validation result to check
 * @param context - Optional context message for error
 *
 * @example
 * ```typescript
 * const validation = validateSum([10, 20], 30);
 * expectValidationSuccess(validation);
 * ```
 */
export function expectValidationSuccess(result: ValidationResult, context?: string): void {
  const message = context ? `${context}: ` : '';

  if (!result.isValid) {
    const errors = result.errors.join('\n  - ');
    throw new Error(`${message}Expected validation to succeed, but it failed:\n  - ${errors}`);
  }

  if (result.warnings.length > 0) {
    console.warn(`${message}Validation succeeded with warnings:`, result.warnings);
  }
}

/**
 * Assert that validation result failed.
 *
 * @param result - Validation result to check
 * @param errorPattern - Optional regex or string to match error message
 * @param context - Optional context message for error
 *
 * @example
 * ```typescript
 * const validation = validateSum([10, 20], 50); // Wrong sum
 * expectValidationFailure(validation, /Sum validation failed/);
 * ```
 */
export function expectValidationFailure(
  result: ValidationResult,
  errorPattern?: string | RegExp,
  context?: string
): void {
  const message = context ? `${context}: ` : '';

  if (result.isValid) {
    throw new Error(`${message}Expected validation to fail, but it succeeded`);
  }

  if (errorPattern) {
    const pattern = typeof errorPattern === 'string' ? new RegExp(errorPattern) : errorPattern;
    const hasMatch = result.errors.some((error) => pattern.test(error));

    if (!hasMatch) {
      const errors = result.errors.join('\n  - ');
      throw new Error(
        `${message}Expected error matching pattern "${errorPattern}", but got:\n  - ${errors}`
      );
    }
  }
}

/**
 * Assert that validation has warnings.
 *
 * @param result - Validation result to check
 * @param warningPattern - Optional regex or string to match warning message
 * @param context - Optional context message for error
 */
export function expectValidationWarnings(
  result: ValidationResult,
  warningPattern?: string | RegExp,
  context?: string
): void {
  const message = context ? `${context}: ` : '';

  if (result.warnings.length === 0) {
    throw new Error(`${message}Expected validation warnings, but found none`);
  }

  if (warningPattern) {
    const pattern = typeof warningPattern === 'string' ? new RegExp(warningPattern) : warningPattern;
    const hasMatch = result.warnings.some((warning) => pattern.test(warning));

    if (!hasMatch) {
      const warnings = result.warnings.join('\n  - ');
      throw new Error(
        `${message}Expected warning matching pattern "${warningPattern}", but got:\n  - ${warnings}`
      );
    }
  }
}

// ============================================================================
// UUID ASSERTION HELPERS
// ============================================================================

/**
 * Assert that value is a valid deterministic UUID.
 *
 * Checks:
 * - Valid UUID format (8-4-4-4-12)
 * - Version 5 (5xxx in third group)
 * - RFC 4122 variant ([89ab]xxx in fourth group)
 *
 * @param value - Value to check
 * @param context - Optional context message for error
 *
 * @example
 * ```typescript
 * const uuid = generateUuidV5('test');
 * expectDeterministicUuid(uuid);
 * ```
 */
export function expectDeterministicUuid(value: string, context?: string): void {
  const message = context ? `${context}: ` : '';

  // Check format
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(value)) {
    throw new Error(`${message}Expected valid UUID format, got: "${value}"`);
  }

  // Check version (should be 5)
  const versionChar = value.charAt(14); // Position of version nibble
  if (versionChar !== '5') {
    throw new Error(`${message}Expected UUID v5, but got version: ${versionChar}`);
  }

  // Check variant (should be RFC 4122: 10xx binary = 8, 9, a, b in hex)
  const variantChar = value.charAt(19); // Position of variant nibble
  const validVariants = ['8', '9', 'a', 'b', 'A', 'B'];
  if (!validVariants.includes(variantChar)) {
    throw new Error(`${message}Expected RFC 4122 variant, but got: ${variantChar}`);
  }
}

/**
 * Assert that two UUIDs are equal (case-insensitive).
 *
 * @param actual - Actual UUID
 * @param expected - Expected UUID
 * @param context - Optional context message for error
 */
export function expectUuidEqual(actual: string, expected: string, context?: string): void {
  const message = context ? `${context}: ` : '';

  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${message}Expected UUID "${expected}", got "${actual}"`);
  }
}

// ============================================================================
// TSV COMPARISON HELPERS
// ============================================================================

/**
 * Compare TSV rows to JSON output.
 *
 * Validates that JSON output correctly represents TSV input.
 *
 * @param tsvRows - 2D array of TSV data
 * @param jsonOutput - JSON output objects
 * @param options - Comparison options
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('resources.tsv');
 * const json = extractResources(rows);
 * compareTsvToJson(rows, json.resources, { skipHeaders: true });
 * ```
 */
export interface TsvJsonCompareOptions {
  skipHeaders?: boolean; // Skip first row (default: true)
  columnMapping?: Record<string, number>; // Field name → column index
  tolerance?: number; // Numeric comparison tolerance
}

export function compareTsvToJson(
  tsvRows: string[][],
  jsonOutput: any[],
  options: TsvJsonCompareOptions = {}
): void {
  const { skipHeaders = true, columnMapping = {}, tolerance = 0.01 } = options;

  const dataRows = skipHeaders ? tsvRows.slice(1) : tsvRows;

  if (dataRows.length !== jsonOutput.length) {
    throw new Error(
      `Row count mismatch: TSV has ${dataRows.length} rows, JSON has ${jsonOutput.length} objects`
    );
  }

  // If column mapping provided, validate field values
  if (Object.keys(columnMapping).length > 0) {
    dataRows.forEach((row, index) => {
      const jsonObj = jsonOutput[index];

      Object.entries(columnMapping).forEach(([fieldName, columnIndex]) => {
        const tsvValue = row[columnIndex];
        const jsonValue = jsonObj[fieldName];

        // Numeric comparison with tolerance
        if (typeof jsonValue === 'number') {
          const tsvNum = parseFloat(tsvValue);
          if (Math.abs(tsvNum - jsonValue) > tolerance) {
            throw new Error(
              `Row ${index}, field "${fieldName}": Expected ${tsvNum}, got ${jsonValue}`
            );
          }
        } else {
          // String comparison
          if (tsvValue !== String(jsonValue)) {
            throw new Error(
              `Row ${index}, field "${fieldName}": Expected "${tsvValue}", got "${jsonValue}"`
            );
          }
        }
      });
    });
  }
}

// ============================================================================
// ALLOCATION ASSERTION HELPERS
// ============================================================================

/**
 * Assert that allocation totals match source hours.
 *
 * Validates that the sum of allocation hours matches the expected total.
 *
 * @param sourceHours - Expected total hours
 * @param allocations - Allocation periods
 * @param tolerance - Tolerance for floating point comparison (default: 0.01)
 * @param context - Optional context message for error
 *
 * @example
 * ```typescript
 * const allocations = extractAllocations(tsvData);
 * assertAllocationTotalsMatch(16249, allocations);
 * ```
 */
export function assertAllocationTotalsMatch(
  sourceHours: number,
  allocations: AllocationPeriod[],
  tolerance: number = 0.01,
  context?: string
): void {
  const message = context ? `${context}: ` : '';

  const totalHours = allocations.reduce((sum, alloc) => sum + (alloc.hoursPerWeek || 0), 0);
  const difference = Math.abs(totalHours - sourceHours);

  if (difference > tolerance) {
    throw new Error(
      `${message}Allocation total mismatch: Expected ${sourceHours} hours, got ${totalHours} hours (difference: ${difference.toFixed(2)})`
    );
  }
}

/**
 * Assert that allocations are properly merged.
 *
 * Validates that consecutive periods with same allocation % have been merged.
 *
 * @param allocations - Allocation periods (should be merged)
 * @param context - Optional context message for error
 */
export function assertAllocationsMerged(
  allocations: AllocationPeriod[],
  context?: string
): void {
  const message = context ? `${context}: ` : '';

  // Check for consecutive periods that should have been merged
  for (let i = 0; i < allocations.length - 1; i++) {
    const current = allocations[i];
    const next = allocations[i + 1];

    const areConsecutive =
      current.resourceId === next.resourceId &&
      current.projectId === next.projectId &&
      current.percentAllocation === next.percentAllocation &&
      isNextDay(current.endDate, next.startDate);

    if (areConsecutive) {
      throw new Error(
        `${message}Found consecutive periods that should be merged:\n` +
          `  Period 1: ${current.startDate} to ${current.endDate} (${current.percentAllocation}%)\n` +
          `  Period 2: ${next.startDate} to ${next.endDate} (${next.percentAllocation}%)`
      );
    }
  }
}

/**
 * Assert that allocations have valid date ranges.
 *
 * Validates that start dates are before end dates and dates are in correct format.
 *
 * @param allocations - Allocation periods
 * @param context - Optional context message for error
 */
export function assertValidDateRanges(
  allocations: AllocationPeriod[],
  context?: string
): void {
  const message = context ? `${context}: ` : '';
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  allocations.forEach((alloc, index) => {
    // Check date format
    if (!datePattern.test(alloc.startDate)) {
      throw new Error(
        `${message}Allocation ${index}: Invalid start date format "${alloc.startDate}"`
      );
    }

    if (!datePattern.test(alloc.endDate)) {
      throw new Error(
        `${message}Allocation ${index}: Invalid end date format "${alloc.endDate}"`
      );
    }

    // Check start < end
    const start = new Date(alloc.startDate);
    const end = new Date(alloc.endDate);

    if (start >= end) {
      throw new Error(
        `${message}Allocation ${index}: Start date ${alloc.startDate} is not before end date ${alloc.endDate}`
      );
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if second date is the day after first date.
 */
function isNextDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  const nextDay = new Date(d1);
  nextDay.setDate(d1.getDate() + 1);

  return nextDay.getTime() === d2.getTime();
}

/**
 * Pretty-print validation result for debugging.
 */
export function formatValidationResult(result: ValidationResult): string {
  const parts: string[] = [];

  parts.push(`Valid: ${result.isValid}`);

  if (result.errors.length > 0) {
    parts.push('Errors:');
    result.errors.forEach((error) => parts.push(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    parts.push('Warnings:');
    result.warnings.forEach((warning) => parts.push(`  - ${warning}`));
  }

  if (result.metadata && Object.keys(result.metadata).length > 0) {
    parts.push('Metadata:');
    Object.entries(result.metadata).forEach(([key, value]) => {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    });
  }

  return parts.join('\n');
}

/**
 * Deep clone an object (for test data manipulation).
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate a range of numbers.
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}
