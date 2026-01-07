/**
 * Contract Test Utilities for SQL vs Prisma Migration
 *
 * Provides normalization and comparison utilities to ensure parity
 * between SQL and Prisma implementations during migration.
 */

import { isDeepStrictEqual } from 'util';
import moment from 'moment';

/**
 * Options for normalization
 */
export interface NormalizeOptions {
  sortArraysBy?: string | string[];
  removeFields?: string[];
  timestampTolerance?: number; // milliseconds
  treatNullAsUndefined?: boolean;
  roundDecimals?: number;
}

/**
 * Options for parity comparison
 */
export interface ParityOptions extends NormalizeOptions {
  throwOnMismatch?: boolean;
  logDifferences?: boolean;
  customComparator?: (a: any, b: any, path: string) => boolean | null;
}

/**
 * Normalize a value to ensure consistent comparison between SQL and Prisma results
 * Handles:
 * - Ordering differences
 * - Timestamp format variations
 * - null vs undefined
 * - BigInt serialization
 * - Decimal precision
 */
export function normalize<T>(value: T, options: NormalizeOptions = {}): T {
  const {
    sortArraysBy,
    removeFields = [],
    timestampTolerance = 1000,
    treatNullAsUndefined = true,
    roundDecimals
  } = options;

  // Handle null/undefined
  if (value === null && treatNullAsUndefined) {
    return undefined as any;
  }
  if (value === undefined || value === null) {
    return value;
  }

  // Handle BigInt (convert to number or string)
  if (typeof value === 'bigint') {
    return Number(value) as any;
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString() as any;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    let normalized = value.map(item => normalize(item, options));

    // Sort arrays if sortBy is specified
    if (sortArraysBy) {
      const sortKeys = Array.isArray(sortArraysBy) ? sortArraysBy : [sortArraysBy];
      normalized = normalized.sort((a, b) => {
        for (const key of sortKeys) {
          const aVal = getNestedValue(a, key);
          const bVal = getNestedValue(b, key);

          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
        }
        return 0;
      });
    }

    return normalized as any;
  }

  // Handle objects
  if (typeof value === 'object') {
    const normalized: any = {};

    for (const [key, val] of Object.entries(value)) {
      // Skip removed fields
      if (removeFields.includes(key)) {
        continue;
      }

      // Normalize nested values
      let normalizedVal = normalize(val, options);

      // Handle timestamp fields
      if (isTimestampField(key) && normalizedVal) {
        normalizedVal = normalizeTimestamp(normalizedVal, timestampTolerance);
      }

      // Handle decimal fields
      if (typeof normalizedVal === 'number' && roundDecimals !== undefined) {
        normalizedVal = Number(normalizedVal.toFixed(roundDecimals));
      }

      normalized[key] = normalizedVal;
    }

    return normalized as T;
  }

  // Primitive values
  return value;
}

/**
 * Normalize timestamp to ISO string, handling various input formats
 */
function normalizeTimestamp(value: any, tolerance: number): string | number | Date {
  let timestamp: moment.Moment;

  if (value instanceof Date) {
    timestamp = moment(value);
  } else if (typeof value === 'string') {
    timestamp = moment(value);
  } else if (typeof value === 'number') {
    timestamp = moment(value);
  } else {
    return value;
  }

  if (!timestamp.isValid()) {
    return value;
  }

  // Round to nearest second or specified tolerance
  if (tolerance >= 1000) {
    timestamp.milliseconds(0);
  }

  return timestamp.toISOString();
}

/**
 * Check if a field name indicates a timestamp
 */
function isTimestampField(fieldName: string): boolean {
  const timestampPatterns = [
    /created_at$/i,
    /updated_at$/i,
    /deleted_at$/i,
    /_date$/i,
    /_time$/i,
    /timestamp$/i
  ];

  return timestampPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Compare two values and return detailed differences
 */
export function findDifferences(
  actual: any,
  expected: any,
  path: string = 'root',
  differences: string[] = []
): string[] {
  // Both null/undefined
  if (actual == null && expected == null) {
    return differences;
  }

  // One is null/undefined
  if (actual == null || expected == null) {
    differences.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return differences;
  }

  // Different types
  if (typeof actual !== typeof expected) {
    differences.push(`${path}: type mismatch - expected ${typeof expected}, got ${typeof actual}`);
    return differences;
  }

  // Arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      differences.push(`${path}: length mismatch - expected ${expected.length}, got ${actual.length}`);
    }

    const maxLength = Math.max(actual.length, expected.length);
    for (let i = 0; i < maxLength; i++) {
      findDifferences(actual[i], expected[i], `${path}[${i}]`, differences);
    }

    return differences;
  }

  // Objects
  if (typeof actual === 'object' && typeof expected === 'object') {
    const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);

    for (const key of allKeys) {
      if (!(key in actual)) {
        differences.push(`${path}.${key}: missing in actual`);
      } else if (!(key in expected)) {
        differences.push(`${path}.${key}: missing in expected`);
      } else {
        findDifferences(actual[key], expected[key], `${path}.${key}`, differences);
      }
    }

    return differences;
  }

  // Primitives
  if (!isDeepStrictEqual(actual, expected)) {
    differences.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  return differences;
}

/**
 * Assert parity between SQL and Prisma results
 * This is the main utility for contract testing
 */
export async function expectParity<T>(
  sqlFn: () => Promise<T>,
  prismaFn: () => Promise<T>,
  options: ParityOptions = {}
): Promise<void> {
  const {
    throwOnMismatch = true,
    logDifferences = true,
    customComparator,
    ...normalizeOpts
  } = options;

  // Execute both functions in parallel
  const [sqlResult, prismaResult] = await Promise.all([
    sqlFn().catch(err => ({ error: err })),
    prismaFn().catch(err => ({ error: err }))
  ]);

  // Check for errors - ensure results are not null/undefined before using 'in' operator
  if (sqlResult !== null && sqlResult !== undefined && typeof sqlResult === 'object' && 'error' in sqlResult) {
    throw new Error(`SQL function threw error: ${(sqlResult as any).error.message}`);
  }
  if (prismaResult !== null && prismaResult !== undefined && typeof prismaResult === 'object' && 'error' in prismaResult) {
    throw new Error(`Prisma function threw error: ${(prismaResult as any).error.message}`);
  }

  // Normalize both results
  const normalizedSql = normalize(sqlResult, normalizeOpts);
  const normalizedPrisma = normalize(prismaResult, normalizeOpts);

  // Use custom comparator if provided
  if (customComparator) {
    const result = customComparator(normalizedSql, normalizedPrisma, 'root');
    if (result === true) {
      return; // Match
    }
    if (result === false) {
      if (throwOnMismatch) {
        throw new Error('Custom comparator returned false - results do not match');
      }
      return;
    }
    // null means fall through to default comparison
  }

  // Find differences
  const differences = findDifferences(normalizedPrisma, normalizedSql);

  if (differences.length > 0) {
    if (logDifferences) {
      console.error('=== CONTRACT TEST MISMATCH ===');
      console.error('Differences found:');
      differences.forEach(diff => console.error(`  - ${diff}`));
      console.error('\nSQL Result:');
      console.error(JSON.stringify(normalizedSql, null, 2));
      console.error('\nPrisma Result:');
      console.error(JSON.stringify(normalizedPrisma, null, 2));
      console.error('==============================');
    }

    if (throwOnMismatch) {
      throw new Error(
        `Contract test failed: ${differences.length} difference(s) found:\n` +
        differences.slice(0, 5).join('\n') +
        (differences.length > 5 ? `\n... and ${differences.length - 5} more` : '')
      );
    }
  }
}

/**
 * Utility to compare only specific fields
 */
export function expectFieldsParity<T>(
  actual: T,
  expected: T,
  fields: string[],
  options: NormalizeOptions = {}
): void {
  const actualFiltered: any = {};
  const expectedFiltered: any = {};

  for (const field of fields) {
    actualFiltered[field] = getNestedValue(actual, field);
    expectedFiltered[field] = getNestedValue(expected, field);
  }

  const normalizedActual = normalize(actualFiltered, options);
  const normalizedExpected = normalize(expectedFiltered, options);

  const differences = findDifferences(normalizedActual, normalizedExpected);

  if (differences.length > 0) {
    throw new Error(
      `Field parity check failed for fields [${fields.join(', ')}]:\n` +
      differences.join('\n')
    );
  }
}

/**
 * Utility to check if two arrays contain the same items (order-independent)
 */
export function expectArrayParity<T>(
  actual: T[],
  expected: T[],
  options: NormalizeOptions = {}
): void {
  const normalizeOpts = { ...options, sortArraysBy: options.sortArraysBy || 'id' };

  const normalizedActual = normalize(actual, normalizeOpts);
  const normalizedExpected = normalize(expected, normalizeOpts);

  const differences = findDifferences(normalizedActual, normalizedExpected);

  if (differences.length > 0) {
    throw new Error(
      `Array parity check failed:\n` + differences.join('\n')
    );
  }
}

/**
 * Create a snapshot for regression testing
 */
export interface Snapshot<T> {
  data: T;
  timestamp: string;
  normalized: boolean;
}

export function createSnapshot<T>(
  data: T,
  options: NormalizeOptions = {}
): Snapshot<T> {
  return {
    data: normalize(data, options),
    timestamp: new Date().toISOString(),
    normalized: true
  };
}

/**
 * Compare current data with a snapshot
 */
export function compareWithSnapshot<T>(
  current: T,
  snapshot: Snapshot<T>,
  options: NormalizeOptions = {}
): void {
  const normalizedCurrent = normalize(current, options);
  const differences = findDifferences(normalizedCurrent, snapshot.data);

  if (differences.length > 0) {
    throw new Error(
      `Snapshot comparison failed:\n` +
      differences.slice(0, 10).join('\n') +
      (differences.length > 10 ? `\n... and ${differences.length - 10} more` : '')
    );
  }
}
