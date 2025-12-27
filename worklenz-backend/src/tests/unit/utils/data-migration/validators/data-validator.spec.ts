/**
 * Unit Tests: data-validator.ts
 *
 * Tests for data validation utilities.
 * Target coverage: 95%+ (13 functions)
 */

// Unmock the modules we're testing
jest.unmock('../../../../../utils/data-migration/validators/data-validator');
jest.unmock('../../../../../utils/data-migration/uuid-generation/deterministic-uuid');
jest.unmock('../../../../../utils/data-migration/extractors/date-utils');

import {
  ValidationResult,
  validationSuccess,
  validationFailure,
  validateSum,
  validateRequiredFields,
  validateUuidField,
  validateUuidFields,
  validateDateField,
  validateRange,
  validateUnique,
  validateForeignKeys,
  combineValidationResults,
  validateCount,
} from '../../../../../utils/data-migration/validators/data-validator';

import {
  expectValidationSuccess,
  expectValidationFailure,
  expectValidationWarnings,
  formatValidationResult,
} from '../../../../utils/migration-test-helpers';

import { generateResourceId } from '../../../../../utils/data-migration/uuid-generation/deterministic-uuid';

describe('Data Validation Utilities', () => {
  // ==========================================================================
  // validationSuccess() & validationFailure()
  // ==========================================================================

  describe('validationSuccess()', () => {
    it('should create successful validation result', () => {
      const result = validationSuccess();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should include warnings', () => {
      const result = validationSuccess(['Warning message']);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual(['Warning message']);
    });

    it('should include metadata', () => {
      const result = validationSuccess([], { count: 10 });

      expect(result.metadata).toEqual({ count: 10 });
    });
  });

  describe('validationFailure()', () => {
    it('should create failed validation result', () => {
      const result = validationFailure(['Error message']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Error message']);
      expect(result.warnings).toEqual([]);
    });

    it('should include warnings', () => {
      const result = validationFailure(['Error'], ['Warning']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Error']);
      expect(result.warnings).toEqual(['Warning']);
    });

    it('should include metadata', () => {
      const result = validationFailure(['Error'], [], { detail: 'info' });

      expect(result.metadata).toEqual({ detail: 'info' });
    });
  });

  // ==========================================================================
  // validateSum()
  // ==========================================================================

  describe('validateSum()', () => {
    it('should validate correct sum', () => {
      const result = validateSum([10, 20, 30], 60);

      expectValidationSuccess(result);
      expect(result.metadata?.actualSum).toBe(60);
      expect(result.metadata?.expectedTotal).toBe(60);
    });

    it('should fail for incorrect sum', () => {
      const result = validateSum([10, 20, 30], 100);

      expectValidationFailure(result, /Sum validation failed/);
      expect(result.metadata?.actualSum).toBe(60);
      expect(result.metadata?.expectedTotal).toBe(100);
      expect(result.metadata?.difference).toBe(40);
    });

    it('should handle floating point numbers with tolerance', () => {
      const result = validateSum([0.1, 0.2, 0.3], 0.6, 0.01);

      expectValidationSuccess(result);
    });

    it('should respect custom tolerance', () => {
      const result = validateSum([10, 20, 30], 60.5, 1); // Tolerance of 1

      expectValidationSuccess(result);
    });

    it('should fail when difference exceeds tolerance', () => {
      const result = validateSum([10, 20, 30], 60.5, 0.1); // Tolerance too small

      expectValidationFailure(result);
    });

    it('should include custom field name in error', () => {
      const result = validateSum([10, 20], 50, 0.01, 'hours');

      expectValidationFailure(result, /hours/);
    });

    it('should handle empty array', () => {
      const result = validateSum([], 0);

      expectValidationSuccess(result);
      expect(result.metadata?.actualSum).toBe(0);
    });

    it('should handle negative numbers', () => {
      const result = validateSum([-10, 20, -5], 5);

      expectValidationSuccess(result);
    });

    it('should handle large sums', () => {
      const values = Array.from({ length: 1000 }, () => 100);
      const result = validateSum(values, 100000);

      expectValidationSuccess(result);
    });
  });

  // ==========================================================================
  // validateRequiredFields()
  // ==========================================================================

  describe('validateRequiredFields()', () => {
    it('should validate records with all required fields', () => {
      const records = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane', email: 'jane@example.com' },
      ];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expectValidationSuccess(result);
      expect(result.metadata?.totalRecords).toBe(2);
    });

    it('should fail when field is missing', () => {
      const records = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane' }, // Missing email
      ];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expectValidationFailure(result, /missing required field: email/);
    });

    it('should fail when field is null', () => {
      const records = [{ id: '1', name: null, email: 'john@example.com' }];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expectValidationFailure(result, /missing required field: name/);
    });

    it('should fail when field is undefined', () => {
      const records = [{ id: '1', name: undefined, email: 'john@example.com' }];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expectValidationFailure(result, /missing required field: name/);
    });

    it('should fail when field is empty string', () => {
      const records = [{ id: '1', name: '', email: 'john@example.com' }];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expectValidationFailure(result, /missing required field: name/);
    });

    it('should include record index in error message', () => {
      const records = [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', name: 'Jane' }, // Missing email at index 1
      ];

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expect(result.errors[0]).toContain('Record 1');
    });

    it('should include custom record type in error message', () => {
      const records = [{ id: '1', name: '' }];

      const result = validateRequiredFields(records, ['id', 'name'], 'user');

      expectValidationFailure(result, /user/);
    });

    it('should handle empty records array', () => {
      const result = validateRequiredFields([], ['id', 'name']);

      expectValidationSuccess(result);
      expect(result.metadata?.totalRecords).toBe(0);
    });

    it('should report all missing fields', () => {
      const records = [{ id: '1' }]; // Missing name and email

      const result = validateRequiredFields(records, ['id', 'name', 'email']);

      expect(result.errors).toHaveLength(2);
    });
  });

  // ==========================================================================
  // validateUuidField()
  // ==========================================================================

  describe('validateUuidField()', () => {
    it('should validate correct UUID', () => {
      const uuid = generateResourceId('test@example.com');
      const result = validateUuidField(uuid);

      expectValidationSuccess(result);
    });

    it('should fail for invalid UUID', () => {
      const result = validateUuidField('invalid-uuid');

      expectValidationFailure(result, /Invalid UUID format/);
    });

    it('should include field name in error', () => {
      const result = validateUuidField('invalid', 'userId');

      expectValidationFailure(result, /userId/);
    });

    it('should handle empty string', () => {
      const result = validateUuidField('');

      expectValidationFailure(result);
    });
  });

  // ==========================================================================
  // validateUuidFields()
  // ==========================================================================

  describe('validateUuidFields()', () => {
    it('should validate records with valid UUIDs', () => {
      const records = [
        { id: generateResourceId('user1@example.com'), userId: generateResourceId('user2@example.com') },
        { id: generateResourceId('user3@example.com'), userId: generateResourceId('user4@example.com') },
      ];

      const result = validateUuidFields(records, ['id', 'userId']);

      expectValidationSuccess(result);
    });

    it('should fail when UUID is invalid', () => {
      const records = [
        { id: generateResourceId('user1@example.com'), userId: 'invalid-uuid' },
      ];

      const result = validateUuidFields(records, ['id', 'userId']);

      expectValidationFailure(result, /Invalid UUID/);
    });

    it('should skip null/undefined values', () => {
      const records = [
        { id: generateResourceId('user1@example.com'), userId: null },
        { id: generateResourceId('user2@example.com'), userId: undefined },
      ];

      const result = validateUuidFields(records, ['id', 'userId']);

      expectValidationSuccess(result);
    });

    it('should include record index and field name in error', () => {
      const records = [
        { id: 'invalid', userId: generateResourceId('user@example.com') },
      ];

      const result = validateUuidFields(records, ['id', 'userId']);

      expect(result.errors[0]).toContain('Record 0');
      expect(result.errors[0]).toContain('id');
    });

    it('should include custom record type in error', () => {
      const records = [{ id: 'invalid' }];

      const result = validateUuidFields(records, ['id'], 'resource');

      expectValidationFailure(result, /resource/);
    });

    it('should handle empty records array', () => {
      const result = validateUuidFields([], ['id']);

      expectValidationSuccess(result);
    });

    it('should report all invalid UUIDs', () => {
      const records = [
        { id: 'invalid1', userId: 'invalid2', projectId: generateResourceId('test@example.com') },
      ];

      const result = validateUuidFields(records, ['id', 'userId', 'projectId']);

      expect(result.errors).toHaveLength(2); // id and userId are invalid
    });
  });

  // ==========================================================================
  // validateDateField()
  // ==========================================================================

  describe('validateDateField()', () => {
    it('should validate correct ISO date', () => {
      const result = validateDateField('2025-06-17');

      expectValidationSuccess(result);
    });

    it('should fail for invalid date format', () => {
      const result = validateDateField('6/17/2025');

      expectValidationFailure(result, /Invalid date format/);
    });

    it('should fail for invalid date value', () => {
      const result = validateDateField('2025-13-01'); // Invalid month

      expectValidationFailure(result);
    });

    it('should include field name in error', () => {
      const result = validateDateField('invalid', 'startDate');

      expectValidationFailure(result, /startDate/);
    });

    it('should validate leap year dates', () => {
      expect(validateDateField('2024-02-29').isValid).toBe(true);
      expect(validateDateField('2025-02-29').isValid).toBe(false);
    });
  });

  // ==========================================================================
  // validateRange()
  // ==========================================================================

  describe('validateRange()', () => {
    it('should validate value within range', () => {
      const result = validateRange(50, 0, 100);

      expectValidationSuccess(result);
      expect(result.metadata?.value).toBe(50);
      expect(result.metadata?.min).toBe(0);
      expect(result.metadata?.max).toBe(100);
    });

    it('should validate minimum boundary', () => {
      const result = validateRange(0, 0, 100);

      expectValidationSuccess(result);
    });

    it('should validate maximum boundary', () => {
      const result = validateRange(100, 0, 100);

      expectValidationSuccess(result);
    });

    it('should fail when value below minimum', () => {
      const result = validateRange(-10, 0, 100);

      expectValidationFailure(result, /below minimum/);
    });

    it('should fail when value above maximum', () => {
      const result = validateRange(150, 0, 100);

      expectValidationFailure(result, /exceeds maximum/);
    });

    it('should include field name in error', () => {
      const result = validateRange(150, 0, 100, 'percentage');

      expectValidationFailure(result, /percentage/);
    });

    it('should handle negative ranges', () => {
      const result = validateRange(-5, -10, 10);

      expectValidationSuccess(result);
    });

    it('should handle fractional values', () => {
      const result = validateRange(0.5, 0, 1);

      expectValidationSuccess(result);
    });
  });

  // ==========================================================================
  // validateUnique()
  // ==========================================================================

  describe('validateUnique()', () => {
    it('should validate unique values', () => {
      const result = validateUnique(['a', 'b', 'c']);

      expectValidationSuccess(result);
      expect(result.metadata?.totalValues).toBe(3);
    });

    it('should fail when duplicates exist', () => {
      const result = validateUnique(['a', 'b', 'a']);

      expectValidationFailure(result, /Duplicate values found/);
      expect(result.metadata?.duplicateCount).toBe(1);
      expect(result.metadata?.duplicateValues).toContain('a');
    });

    it('should detect multiple duplicates', () => {
      const result = validateUnique(['a', 'b', 'a', 'b', 'c']);

      expectValidationFailure(result);
      expect(result.metadata?.duplicateCount).toBe(2); // a and b
    });

    it('should include field name in error', () => {
      const result = validateUnique(['a', 'a'], 'userId');

      expectValidationFailure(result, /userId/);
    });

    it('should handle empty array', () => {
      const result = validateUnique([]);

      expectValidationSuccess(result);
    });

    it('should handle single value', () => {
      const result = validateUnique(['a']);

      expectValidationSuccess(result);
    });

    it('should handle numeric values', () => {
      const result = validateUnique([1, 2, 3, 1]);

      expectValidationFailure(result);
      expect(result.metadata?.duplicateValues).toContain(1);
    });

    it('should handle null and undefined as distinct values', () => {
      const result = validateUnique([null, undefined, null]);

      expectValidationFailure(result);
    });
  });

  // ==========================================================================
  // validateForeignKeys()
  // ==========================================================================

  describe('validateForeignKeys()', () => {
    it('should validate all foreign keys exist', () => {
      const validIds = new Set(['id1', 'id2', 'id3']);
      const result = validateForeignKeys(['id1', 'id2'], validIds);

      expectValidationSuccess(result);
      expect(result.metadata?.totalReferences).toBe(2);
    });

    it('should fail when foreign key does not exist', () => {
      const validIds = new Set(['id1', 'id2']);
      const result = validateForeignKeys(['id1', 'id3'], validIds);

      expectValidationFailure(result, /Invalid foreign key references/);
      expect(result.metadata?.invalidCount).toBe(1);
      expect(result.metadata?.invalidKeys).toContain('id3');
    });

    it('should detect multiple invalid keys', () => {
      const validIds = new Set(['id1']);
      const result = validateForeignKeys(['id1', 'id2', 'id3'], validIds);

      expectValidationFailure(result);
      expect(result.metadata?.invalidCount).toBe(2);
    });

    it('should include field name in error', () => {
      const validIds = new Set(['id1']);
      const result = validateForeignKeys(['id2'], validIds, 'userId');

      expectValidationFailure(result, /userId/);
    });

    it('should handle empty foreign keys array', () => {
      const validIds = new Set(['id1']);
      const result = validateForeignKeys([], validIds);

      expectValidationSuccess(result);
    });

    it('should handle empty valid IDs set', () => {
      const validIds = new Set<string>();
      const result = validateForeignKeys(['id1'], validIds);

      expectValidationFailure(result);
    });
  });

  // ==========================================================================
  // combineValidationResults()
  // ==========================================================================

  describe('combineValidationResults()', () => {
    it('should combine successful results', () => {
      const result1 = validationSuccess();
      const result2 = validationSuccess();

      const combined = combineValidationResults([result1, result2]);

      expectValidationSuccess(combined);
    });

    it('should fail if any result fails', () => {
      const result1 = validationSuccess();
      const result2 = validationFailure(['Error']);

      const combined = combineValidationResults([result1, result2]);

      expectValidationFailure(combined);
    });

    it('should collect all errors', () => {
      const result1 = validationFailure(['Error 1']);
      const result2 = validationFailure(['Error 2']);
      const result3 = validationSuccess();

      const combined = combineValidationResults([result1, result2, result3]);

      expect(combined.errors).toHaveLength(2);
      expect(combined.errors).toContain('Error 1');
      expect(combined.errors).toContain('Error 2');
    });

    it('should collect all warnings', () => {
      const result1 = validationSuccess(['Warning 1']);
      const result2 = validationSuccess(['Warning 2']);

      const combined = combineValidationResults([result1, result2]);

      expect(combined.warnings).toHaveLength(2);
      expect(combined.warnings).toContain('Warning 1');
      expect(combined.warnings).toContain('Warning 2');
    });

    it('should merge metadata', () => {
      const result1 = validationSuccess([], { count1: 10 });
      const result2 = validationSuccess([], { count2: 20 });

      const combined = combineValidationResults([result1, result2]);

      expect(combined.metadata?.count1).toBe(10);
      expect(combined.metadata?.count2).toBe(20);
    });

    it('should handle empty results array', () => {
      const combined = combineValidationResults([]);

      expectValidationSuccess(combined);
    });

    it('should handle single result', () => {
      const result = validationSuccess(['Warning']);
      const combined = combineValidationResults([result]);

      expectValidationSuccess(combined);
      expectValidationWarnings(combined);
    });
  });

  // ==========================================================================
  // validateCount()
  // ==========================================================================

  describe('validateCount()', () => {
    it('should validate matching count', () => {
      const result = validateCount(27, 27);

      expectValidationSuccess(result);
      expect(result.metadata?.count).toBe(27);
    });

    it('should fail when counts do not match', () => {
      const result = validateCount(25, 27);

      expectValidationFailure(result, /Count mismatch/);
      expect(result.metadata?.actualCount).toBe(25);
      expect(result.metadata?.expectedCount).toBe(27);
    });

    it('should include item name in error', () => {
      const result = validateCount(10, 20, 'resources');

      expectValidationFailure(result, /resources/);
    });

    it('should handle zero counts', () => {
      const result = validateCount(0, 0);

      expectValidationSuccess(result);
    });

    it('should handle large counts', () => {
      const result = validateCount(1000000, 1000000);

      expectValidationSuccess(result);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should validate complete migration data set', () => {
      const resources = [
        { id: generateResourceId('user1@example.com'), name: 'User 1', email: 'user1@example.com' },
        { id: generateResourceId('user2@example.com'), name: 'User 2', email: 'user2@example.com' },
      ];

      const validations = [
        validateRequiredFields(resources, ['id', 'name', 'email'], 'resource'),
        validateUuidFields(resources, ['id'], 'resource'),
        validateCount(resources.length, 2, 'resources'),
      ];

      const combined = combineValidationResults(validations);

      expectValidationSuccess(combined);
    });

    it('should detect and report all validation failures', () => {
      const resources = [
        { id: 'invalid-uuid', name: '', email: 'user1@example.com' }, // Invalid UUID, missing name
        { id: generateResourceId('user2@example.com'), name: 'User 2' }, // Missing email
      ];

      const validations = [
        validateRequiredFields(resources, ['id', 'name', 'email'], 'resource'),
        validateUuidFields(resources, ['id'], 'resource'),
        validateCount(resources.length, 3, 'resources'), // Wrong count
      ];

      const combined = combineValidationResults(validations);

      expectValidationFailure(combined);
      expect(combined.errors.length).toBeGreaterThan(2);
    });

    it('should validate P0003C allocation totals', () => {
      // Simulate P0003C weekly hours validation
      const weeklyHours = Array.from({ length: 71 }, () => Math.random() * 40);
      const expectedTotal = weeklyHours.reduce((sum, h) => sum + h, 0);

      const result = validateSum(weeklyHours, expectedTotal, 0.01, 'weekly hours');

      expectValidationSuccess(result);
    });

    it('should validate foreign key relationships', () => {
      const resourceIds = new Set([
        generateResourceId('user1@example.com'),
        generateResourceId('user2@example.com'),
      ]);

      const allocations = [
        { resourceId: generateResourceId('user1@example.com') },
        { resourceId: generateResourceId('user2@example.com') },
      ];

      const foreignKeys = allocations.map((a) => a.resourceId);
      const result = validateForeignKeys(foreignKeys, resourceIds, 'resourceId');

      expectValidationSuccess(result);
    });

    it('should detect orphaned foreign keys', () => {
      const resourceIds = new Set([generateResourceId('user1@example.com')]);

      const allocations = [
        { resourceId: generateResourceId('user1@example.com') },
        { resourceId: generateResourceId('user999@example.com') }, // Orphaned
      ];

      const foreignKeys = allocations.map((a) => a.resourceId);
      const result = validateForeignKeys(foreignKeys, resourceIds, 'resourceId');

      expectValidationFailure(result);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large error lists', () => {
      const records = Array.from({ length: 1000 }, () => ({ id: '' }));
      const result = validateRequiredFields(records, ['id']);

      expect(result.errors.length).toBe(1000);
    });

    it('should handle very large validation combinations', () => {
      const results = Array.from({ length: 100 }, () => validationSuccess());
      const combined = combineValidationResults(results);

      expectValidationSuccess(combined);
    });

    it('should handle mixed success and failure in combination', () => {
      const results = [
        validationSuccess(),
        validationFailure(['Error 1']),
        validationSuccess(['Warning']),
        validationFailure(['Error 2']),
      ];

      const combined = combineValidationResults(results);

      expect(combined.isValid).toBe(false);
      expect(combined.errors).toHaveLength(2);
      expect(combined.warnings).toHaveLength(1);
    });

    it('should handle special characters in error messages', () => {
      const result = validateRange(150, 0, 100, 'field with "quotes" and <brackets>');

      expect(result.errors[0]).toContain('field with "quotes" and <brackets>');
    });

    it('should handle very long field names', () => {
      const longName = 'a'.repeat(1000);
      const result = validateRange(150, 0, 100, longName);

      expect(result.errors[0]).toContain(longName);
    });
  });
});
