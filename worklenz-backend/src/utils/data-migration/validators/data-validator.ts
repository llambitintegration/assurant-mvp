/**
 * Data Validation Utilities
 *
 * Generic validation utilities for migration data quality checks.
 * Provides reusable validation patterns for sums, required fields, UUIDs, and more.
 *
 * @module data-validator
 */

import { isValidUuid } from '../uuid-generation/deterministic-uuid';
import { isValidIsoDate } from '../extractors/date-utils';

/**
 * Validation result with errors and warnings
 */
export interface ValidationResult {
  /** Overall validation status */
  isValid: boolean;

  /** Array of error messages (validation failures) */
  errors: string[];

  /** Array of warning messages (potential issues) */
  warnings: string[];

  /** Additional validation metadata */
  metadata?: Record<string, any>;
}

/**
 * Create a successful validation result
 */
export function validationSuccess(
  warnings: string[] = [],
  metadata?: Record<string, any>
): ValidationResult {
  return {
    isValid: true,
    errors: [],
    warnings,
    metadata,
  };
}

/**
 * Create a failed validation result
 */
export function validationFailure(
  errors: string[],
  warnings: string[] = [],
  metadata?: Record<string, any>
): ValidationResult {
  return {
    isValid: false,
    errors,
    warnings,
    metadata,
  };
}

/**
 * Validate that sum of values matches expected total
 *
 * @param values - Array of numbers to sum
 * @param expectedTotal - Expected sum
 * @param tolerance - Acceptable difference (default: 0.01 for floating-point)
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const hours = [10, 20, 30];
 * const result = validateSum(hours, 60);
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * const result2 = validateSum(hours, 100);
 * // => { isValid: false, errors: ['Sum validation failed...'], ... }
 * ```
 */
export function validateSum(
  values: number[],
  expectedTotal: number,
  tolerance: number = 0.01,
  fieldName: string = 'values'
): ValidationResult {
  const actualSum = values.reduce((sum, val) => sum + val, 0);
  const difference = Math.abs(actualSum - expectedTotal);

  if (difference > tolerance) {
    return validationFailure(
      [
        `Sum validation failed for ${fieldName}: ` +
          `expected ${expectedTotal}, got ${actualSum} ` +
          `(difference: ${difference.toFixed(2)})`,
      ],
      [],
      { actualSum, expectedTotal, difference }
    );
  }

  return validationSuccess([], { actualSum, expectedTotal, difference });
}

/**
 * Validate that all records have required fields
 *
 * @param records - Array of objects to validate
 * @param requiredFields - Array of required field names
 * @param recordType - Type of record being validated (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: '1', name: 'John', email: 'john@example.com' },
 *   { id: '2', name: 'Jane' }, // Missing email
 * ];
 *
 * const result = validateRequiredFields(users, ['id', 'name', 'email'], 'user');
 * // => { isValid: false, errors: ['Record 1 (user) missing required field: email'], ... }
 * ```
 */
export function validateRequiredFields<T extends Record<string, any>>(
  records: T[],
  requiredFields: (keyof T)[],
  recordType: string = 'record'
): ValidationResult {
  const errors: string[] = [];

  records.forEach((record, index) => {
    requiredFields.forEach((field) => {
      const value = record[field];
      if (value === null || value === undefined || value === '') {
        errors.push(
          `Record ${index} (${recordType}) missing required field: ${String(field)}`
        );
      }
    });
  });

  if (errors.length > 0) {
    return validationFailure(errors, [], {
      totalRecords: records.length,
      failedRecords: errors.length,
    });
  }

  return validationSuccess([], { totalRecords: records.length });
}

/**
 * Validate UUID format for a single UUID string
 *
 * @param uuid - UUID string to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * validateUuidField('74be27de-1e4e-593a-8b4e-7869e4a56af4', 'userId');
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * validateUuidField('invalid-uuid', 'userId');
 * // => { isValid: false, errors: ['Invalid UUID format for userId...'], ... }
 * ```
 */
export function validateUuidField(
  uuid: string,
  fieldName: string = 'UUID'
): ValidationResult {
  if (!isValidUuid(uuid)) {
    return validationFailure([`Invalid UUID format for ${fieldName}: ${uuid}`]);
  }

  return validationSuccess();
}

/**
 * Validate all UUIDs in an array of records
 *
 * @param records - Array of objects to validate
 * @param uuidFields - Array of UUID field names
 * @param recordType - Type of record being validated (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const records = [
 *   { id: '74be27de-1e4e-593a-8b4e-7869e4a56af4', userId: 'invalid-uuid' },
 * ];
 *
 * const result = validateUuidFields(records, ['id', 'userId']);
 * // => { isValid: false, errors: ['Record 0: Invalid UUID for userId...'], ... }
 * ```
 */
export function validateUuidFields<T extends Record<string, any>>(
  records: T[],
  uuidFields: (keyof T)[],
  recordType: string = 'record'
): ValidationResult {
  const errors: string[] = [];

  records.forEach((record, index) => {
    uuidFields.forEach((field) => {
      const value = record[field];
      if (value && typeof value === 'string' && !isValidUuid(value)) {
        errors.push(
          `Record ${index} (${recordType}): Invalid UUID for ${String(field)}: ${value}`
        );
      }
    });
  });

  if (errors.length > 0) {
    return validationFailure(errors, [], {
      totalRecords: records.length,
      failedValidations: errors.length,
    });
  }

  return validationSuccess([], { totalRecords: records.length });
}

/**
 * Validate date format (YYYY-MM-DD)
 *
 * @param dateStr - Date string to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * validateDateField('2025-06-17', 'startDate');
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * validateDateField('6/17/2025', 'startDate');
 * // => { isValid: false, errors: ['Invalid date format...'], ... }
 * ```
 */
export function validateDateField(
  dateStr: string,
  fieldName: string = 'date'
): ValidationResult {
  if (!isValidIsoDate(dateStr)) {
    return validationFailure([
      `Invalid date format for ${fieldName}: ${dateStr}. Expected YYYY-MM-DD`,
    ]);
  }

  return validationSuccess();
}

/**
 * Validate numeric range
 *
 * @param value - Numeric value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * validateRange(50, 0, 100, 'percentage');
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * validateRange(150, 0, 100, 'percentage');
 * // => { isValid: false, errors: ['percentage value 150 exceeds maximum 100'], ... }
 * ```
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'value'
): ValidationResult {
  const errors: string[] = [];

  if (value < min) {
    errors.push(`${fieldName} value ${value} is below minimum ${min}`);
  }

  if (value > max) {
    errors.push(`${fieldName} value ${value} exceeds maximum ${max}`);
  }

  if (errors.length > 0) {
    return validationFailure(errors, [], { value, min, max });
  }

  return validationSuccess([], { value, min, max });
}

/**
 * Validate that values are unique (no duplicates)
 *
 * @param values - Array of values to check
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * validateUnique(['a', 'b', 'c'], 'ids');
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * validateUnique(['a', 'b', 'a'], 'ids');
 * // => { isValid: false, errors: ['Duplicate values found in ids: a'], ... }
 * ```
 */
export function validateUnique(
  values: any[],
  fieldName: string = 'values'
): ValidationResult {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  if (duplicates.size > 0) {
    const dupList = Array.from(duplicates).join(', ');
    return validationFailure(
      [`Duplicate values found in ${fieldName}: ${dupList}`],
      [],
      { duplicateCount: duplicates.size, duplicateValues: Array.from(duplicates) }
    );
  }

  return validationSuccess([], { totalValues: values.length });
}

/**
 * Validate foreign key references exist in a lookup set
 *
 * @param foreignKeys - Array of foreign key values to validate
 * @param validIds - Set of valid IDs
 * @param fieldName - Name of the foreign key field (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const validUserIds = new Set(['user1', 'user2', 'user3']);
 * const foreignKeys = ['user1', 'user4']; // user4 doesn't exist
 *
 * const result = validateForeignKeys(foreignKeys, validUserIds, 'userId');
 * // => { isValid: false, errors: ['Invalid foreign key reference for userId: user4'], ... }
 * ```
 */
export function validateForeignKeys(
  foreignKeys: string[],
  validIds: Set<string>,
  fieldName: string = 'foreignKey'
): ValidationResult {
  const invalid: string[] = [];

  for (const key of foreignKeys) {
    if (!validIds.has(key)) {
      invalid.push(key);
    }
  }

  if (invalid.length > 0) {
    const invalidList = invalid.join(', ');
    return validationFailure(
      [`Invalid foreign key references for ${fieldName}: ${invalidList}`],
      [],
      { invalidCount: invalid.length, invalidKeys: invalid }
    );
  }

  return validationSuccess([], { totalReferences: foreignKeys.length });
}

/**
 * Combine multiple validation results
 *
 * @param results - Array of validation results to combine
 * @returns Combined validation result (fails if any input fails)
 *
 * @example
 * ```typescript
 * const result1 = validateSum([10, 20], 30);
 * const result2 = validateRange(50, 0, 100);
 *
 * const combined = combineValidationResults([result1, result2]);
 * // => { isValid: true, errors: [], warnings: [] }
 * ```
 */
export function combineValidationResults(
  results: ValidationResult[]
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const combinedMetadata: Record<string, any> = {};

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);

    if (result.metadata) {
      Object.assign(combinedMetadata, result.metadata);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    metadata: combinedMetadata,
  };
}

/**
 * Validate count matches expected value
 *
 * @param actualCount - Actual count
 * @param expectedCount - Expected count
 * @param itemName - Name of items being counted (for error messages)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * validateCount(27, 27, 'resources');
 * // => { isValid: true, errors: [], warnings: [] }
 *
 * validateCount(25, 27, 'resources');
 * // => { isValid: false, errors: ['Count mismatch for resources...'], ... }
 * ```
 */
export function validateCount(
  actualCount: number,
  expectedCount: number,
  itemName: string = 'items'
): ValidationResult {
  if (actualCount !== expectedCount) {
    return validationFailure(
      [
        `Count mismatch for ${itemName}: expected ${expectedCount}, got ${actualCount}`,
      ],
      [],
      { actualCount, expectedCount }
    );
  }

  return validationSuccess([], { count: actualCount });
}
