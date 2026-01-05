/**
 * Tests for Contract Test Utilities
 */

import {
  normalize,
  findDifferences,
  expectParity,
  expectFieldsParity,
  expectArrayParity,
  createSnapshot,
  compareWithSnapshot
} from './contract-test';

describe('Contract Test Utilities', () => {
  describe('normalize', () => {
    it('should normalize null to undefined when treatNullAsUndefined is true', () => {
      const result = normalize({ value: null }, { treatNullAsUndefined: true });
      expect(result.value).toBeUndefined();
    });

    it('should keep null when treatNullAsUndefined is false', () => {
      const result = normalize({ value: null }, { treatNullAsUndefined: false });
      expect(result.value).toBeNull();
    });

    it('should convert BigInt to number', () => {
      const result = normalize({ count: BigInt(100) });
      expect(result.count).toBe(100);
      expect(typeof result.count).toBe('number');
    });

    it('should convert Date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = normalize({ timestamp: date });
      expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should sort arrays by specified key', () => {
      const data = [
        { id: 3, name: 'C' },
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ];

      const result = normalize(data, { sortArraysBy: 'id' });

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it('should remove specified fields', () => {
      const data = {
        id: 1,
        name: 'Test',
        internal_field: 'secret'
      };

      const result = normalize(data, { removeFields: ['internal_field'] });

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(result).not.toHaveProperty('internal_field');
    });

    it('should round decimals when specified', () => {
      const data = { price: 9.999999 };

      const result = normalize(data, { roundDecimals: 2 });

      expect(result.price).toBe(10.00);
    });
  });

  describe('findDifferences', () => {
    it('should find no differences for identical objects', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 1, b: 'test' };

      const diffs = findDifferences(obj1, obj2);

      expect(diffs).toEqual([]);
    });

    it('should find differences in primitive values', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 2, b: 'test' };

      const diffs = findDifferences(obj1, obj2);

      expect(diffs.length).toBe(1);
      expect(diffs[0]).toContain('root.a');
    });

    it('should find missing fields', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 1 };

      const diffs = findDifferences(obj1, obj2);

      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some(d => d.includes('missing'))).toBe(true);
    });

    it('should find differences in nested objects', () => {
      const obj1 = { user: { name: 'Alice', age: 30 } };
      const obj2 = { user: { name: 'Bob', age: 30 } };

      const diffs = findDifferences(obj1, obj2);

      expect(diffs.length).toBe(1);
      expect(diffs[0]).toContain('root.user.name');
    });

    it('should find differences in arrays', () => {
      const obj1 = { items: [1, 2, 3] };
      const obj2 = { items: [1, 2, 4] };

      const diffs = findDifferences(obj1, obj2);

      expect(diffs.length).toBeGreaterThan(0);
    });
  });

  describe('expectParity', () => {
    it('should pass for identical results', async () => {
      const sqlFn = async () => ({ id: 1, name: 'Test' });
      const prismaFn = async () => ({ id: 1, name: 'Test' });

      await expect(expectParity(sqlFn, prismaFn)).resolves.not.toThrow();
    });

    it('should throw for different results when throwOnMismatch is true', async () => {
      const sqlFn = async () => ({ id: 1, name: 'SQL' });
      const prismaFn = async () => ({ id: 1, name: 'Prisma' });

      await expect(
        expectParity(sqlFn, prismaFn, { throwOnMismatch: true })
      ).rejects.toThrow();
    });

    it('should not throw for different results when throwOnMismatch is false', async () => {
      const sqlFn = async () => ({ id: 1, name: 'SQL' });
      const prismaFn = async () => ({ id: 1, name: 'Prisma' });

      await expect(
        expectParity(sqlFn, prismaFn, { throwOnMismatch: false })
      ).resolves.not.toThrow();
    });

    it('should normalize results before comparison', async () => {
      const sqlFn = async () => ({ id: 1, value: null });
      const prismaFn = async () => ({ id: 1, value: undefined });

      await expect(
        expectParity(sqlFn, prismaFn, { treatNullAsUndefined: true })
      ).resolves.not.toThrow();
    });
  });

  describe('expectFieldsParity', () => {
    it('should compare only specified fields', () => {
      const obj1 = { id: 1, name: 'Test', extra: 'data1' };
      const obj2 = { id: 1, name: 'Test', extra: 'data2' };

      expect(() => {
        expectFieldsParity(obj1, obj2, ['id', 'name']);
      }).not.toThrow();
    });

    it('should throw when specified fields differ', () => {
      const obj1 = { id: 1, name: 'Test1' };
      const obj2 = { id: 1, name: 'Test2' };

      expect(() => {
        expectFieldsParity(obj1, obj2, ['id', 'name']);
      }).toThrow();
    });
  });

  describe('expectArrayParity', () => {
    it('should compare arrays with same items in different order', () => {
      const arr1 = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ];
      const arr2 = [
        { id: 2, name: 'B' },
        { id: 1, name: 'A' }
      ];

      expect(() => {
        expectArrayParity(arr1, arr2, { sortArraysBy: 'id' });
      }).not.toThrow();
    });

    it('should throw for arrays with different items', () => {
      const arr1 = [{ id: 1, name: 'A' }];
      const arr2 = [{ id: 2, name: 'B' }];

      expect(() => {
        expectArrayParity(arr1, arr2);
      }).toThrow();
    });
  });

  describe('snapshot testing', () => {
    it('should create a snapshot', () => {
      const data = { id: 1, name: 'Test', value: 100 };

      const snapshot = createSnapshot(data);

      expect(snapshot.data).toEqual(data);
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.normalized).toBe(true);
    });

    it('should compare with snapshot successfully for identical data', () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSnapshot(data);

      expect(() => {
        compareWithSnapshot(data, snapshot);
      }).not.toThrow();
    });

    it('should throw when data differs from snapshot', () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSnapshot(data);
      const changedData = { id: 1, name: 'Changed' };

      expect(() => {
        compareWithSnapshot(changedData, snapshot);
      }).toThrow();
    });
  });
});
