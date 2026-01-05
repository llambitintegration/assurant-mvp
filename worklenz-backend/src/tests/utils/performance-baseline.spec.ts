/**
 * Tests for Performance Baseline Utility
 */

import {
  benchmarkQuery,
  PerformanceMeasurement,
  captureBaseline,
  loadBaseline,
  compareBaseline
} from './performance-baseline';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Baseline Utility', () => {
  const testBaselinePath = path.join(__dirname, 'test-baseline.json');

  afterEach(() => {
    // Clean up test baseline file
    if (fs.existsSync(testBaselinePath)) {
      fs.unlinkSync(testBaselinePath);
    }
  });

  describe('benchmarkQuery', () => {
    it('should benchmark a simple query', async () => {
      const queryFn = async () => {
        // Simulate a query
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: 'test' };
      };

      const result = await benchmarkQuery('test-query', queryFn, {
        iterations: 10,
        warmup: 2,
        cooldown: 0
      });

      expect(result.name).toBe('test-query');
      expect(result.iterations).toBe(10);
      expect(result.measurements.length).toBe(10);
      expect(result.p50).toBeGreaterThan(0);
      expect(result.p95).toBeGreaterThan(0);
      expect(result.avg).toBeGreaterThan(0);
      expect(result.min).toBeGreaterThan(0);
      expect(result.max).toBeGreaterThanOrEqual(result.min);
    }, 30000);

    it('should calculate correct percentiles', async () => {
      const queryFn = async () => {
        return { data: 'test' };
      };

      const result = await benchmarkQuery('percentile-test', queryFn, {
        iterations: 100,
        warmup: 0,
        cooldown: 0
      });

      expect(result.p50).toBeLessThanOrEqual(result.p95);
      expect(result.p95).toBeLessThanOrEqual(result.p99);
      expect(result.min).toBeLessThanOrEqual(result.p50);
      expect(result.p99).toBeLessThanOrEqual(result.max);
    }, 30000);
  });

  describe('baseline capture and load', () => {
    it('should capture and load baseline', async () => {
      const queryFn = async () => ({ data: 'test' });

      const measurement = await benchmarkQuery('test', queryFn, {
        iterations: 5,
        warmup: 0,
        cooldown: 0
      });

      await captureBaseline(testBaselinePath, [measurement]);

      expect(fs.existsSync(testBaselinePath)).toBe(true);

      const loaded = loadBaseline(testBaselinePath);

      expect(loaded).not.toBeNull();
      expect(loaded!.measurements).toHaveProperty('test');
      expect(loaded!.measurements.test.iterations).toBe(5);
    }, 30000);

    it('should return null for non-existent baseline', () => {
      const loaded = loadBaseline('/non/existent/path.json');

      expect(loaded).toBeNull();
    });
  });

  describe('compareBaseline', () => {
    it('should detect no regression when performance is similar', async () => {
      const queryFn = async () => ({ data: 'test' });

      const baseline = await benchmarkQuery('test', queryFn, {
        iterations: 10,
        warmup: 0,
        cooldown: 0
      });

      await captureBaseline(testBaselinePath, [baseline]);
      const loadedBaseline = loadBaseline(testBaselinePath)!;

      const current = await benchmarkQuery('test', queryFn, {
        iterations: 10,
        warmup: 0,
        cooldown: 0
      });

      const comparisons = compareBaseline([current], loadedBaseline, {
        regressionThreshold: 50 // 50% threshold to account for variance
      });

      expect(comparisons.length).toBe(1);
      expect(comparisons[0].regressionDetected).toBe(false);
    }, 60000);

    it('should calculate percent change correctly', async () => {
      // Create mock baseline
      const baselineMeasurement: PerformanceMeasurement = {
        name: 'test',
        iterations: 10,
        measurements: [100, 100, 100, 100, 100],
        p50: 100,
        p95: 100,
        p99: 100,
        avg: 100,
        min: 100,
        max: 100,
        stdDev: 0,
        timestamp: new Date().toISOString()
      };

      const currentMeasurement: PerformanceMeasurement = {
        ...baselineMeasurement,
        p50: 150,
        p95: 150,
        p99: 150,
        avg: 150
      };

      await captureBaseline(testBaselinePath, [baselineMeasurement]);
      const loadedBaseline = loadBaseline(testBaselinePath)!;

      const comparisons = compareBaseline([currentMeasurement], loadedBaseline, {
        regressionThreshold: 40
      });

      expect(comparisons[0].percentChange.p50).toBeCloseTo(50, 0);
      expect(comparisons[0].percentChange.p95).toBeCloseTo(50, 0);
      expect(comparisons[0].regressionDetected).toBe(true);
    });
  });
});
