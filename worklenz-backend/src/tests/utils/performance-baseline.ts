/**
 * Performance Baseline Utility for Prisma Migration
 *
 * Captures, stores, and compares query performance metrics to ensure
 * no regression during SQL to Prisma migration.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  name: string;
  iterations: number;
  measurements: number[]; // Individual execution times in ms
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  stdDev: number;
  timestamp: string;
}

/**
 * Baseline comparison result
 */
export interface BaselineComparison {
  name: string;
  baseline: PerformanceMeasurement;
  current: PerformanceMeasurement;
  regressionDetected: boolean;
  percentChange: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  thresholdExceeded: boolean;
  threshold: number;
}

/**
 * Baseline storage
 */
export interface BaselineStorage {
  version: string;
  created: string;
  measurements: { [key: string]: PerformanceMeasurement };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;

  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;

  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate statistics from measurements
 */
function calculateStats(measurements: number[]): {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  stdDev: number;
} {
  if (measurements.length === 0) {
    return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0, stdDev: 0 };
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;

  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev: calculateStdDev(measurements, avg)
  };
}

/**
 * Benchmark a query function
 */
export async function benchmarkQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
  options: {
    iterations?: number;
    warmup?: number;
    cooldown?: number;
  } = {}
): Promise<PerformanceMeasurement> {
  const {
    iterations = 100,
    warmup = 5,
    cooldown = 100 // ms between iterations
  } = options;

  const measurements: number[] = [];

  // Warmup runs (not measured)
  console.log(`[BENCHMARK] ${name}: Warming up with ${warmup} iterations...`);
  for (let i = 0; i < warmup; i++) {
    await queryFn();
    if (cooldown > 0) {
      await new Promise(resolve => setTimeout(resolve, cooldown));
    }
  }

  // Actual benchmark runs
  console.log(`[BENCHMARK] ${name}: Running ${iterations} measured iterations...`);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await queryFn();
    const duration = performance.now() - start;

    measurements.push(duration);

    if (cooldown > 0 && i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, cooldown));
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`[BENCHMARK] ${name}: ${i + 1}/${iterations} complete`);
    }
  }

  const stats = calculateStats(measurements);

  const result: PerformanceMeasurement = {
    name,
    iterations,
    measurements,
    ...stats,
    timestamp: new Date().toISOString()
  };

  console.log(`[BENCHMARK] ${name}: Complete`);
  console.log(`  p50: ${result.p50.toFixed(2)}ms`);
  console.log(`  p95: ${result.p95.toFixed(2)}ms`);
  console.log(`  p99: ${result.p99.toFixed(2)}ms`);
  console.log(`  avg: ${result.avg.toFixed(2)}ms ± ${result.stdDev.toFixed(2)}ms`);

  return result;
}

/**
 * Benchmark multiple queries in sequence
 */
export async function benchmarkSuite(
  queries: Array<{ name: string; fn: () => Promise<any> }>,
  options: {
    iterations?: number;
    warmup?: number;
    cooldown?: number;
  } = {}
): Promise<PerformanceMeasurement[]> {
  const results: PerformanceMeasurement[] = [];

  for (const query of queries) {
    const result = await benchmarkQuery(query.name, query.fn, options);
    results.push(result);
  }

  return results;
}

/**
 * Capture baseline measurements
 */
export async function captureBaseline(
  baselinePath: string,
  measurements: PerformanceMeasurement[]
): Promise<void> {
  const baseline: BaselineStorage = {
    version: '1.0.0',
    created: new Date().toISOString(),
    measurements: {}
  };

  for (const measurement of measurements) {
    baseline.measurements[measurement.name] = measurement;
  }

  // Ensure directory exists
  const dir = path.dirname(baselinePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write baseline file
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');

  console.log(`[BASELINE] Captured ${measurements.length} measurements to ${baselinePath}`);
}

/**
 * Load baseline from file
 */
export function loadBaseline(baselinePath: string): BaselineStorage | null {
  if (!fs.existsSync(baselinePath)) {
    console.warn(`[BASELINE] Baseline file not found: ${baselinePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(baselinePath, 'utf-8');
    return JSON.parse(content) as BaselineStorage;
  } catch (error) {
    console.error(`[BASELINE] Failed to load baseline: ${error}`);
    return null;
  }
}

/**
 * Compare current measurements against baseline
 */
export function compareBaseline(
  current: PerformanceMeasurement[],
  baseline: BaselineStorage,
  options: {
    regressionThreshold?: number; // Percentage, e.g., 10 = 10% slower is regression
    metrics?: Array<'p50' | 'p95' | 'p99' | 'avg'>;
  } = {}
): BaselineComparison[] {
  const {
    regressionThreshold = 10,
    metrics = ['p95']
  } = options;

  const comparisons: BaselineComparison[] = [];

  for (const currentMeasurement of current) {
    const baselineMeasurement = baseline.measurements[currentMeasurement.name];

    if (!baselineMeasurement) {
      console.warn(`[BASELINE] No baseline found for: ${currentMeasurement.name}`);
      continue;
    }

    // Calculate percent change for each metric
    const percentChange = {
      p50: ((currentMeasurement.p50 - baselineMeasurement.p50) / baselineMeasurement.p50) * 100,
      p95: ((currentMeasurement.p95 - baselineMeasurement.p95) / baselineMeasurement.p95) * 100,
      p99: ((currentMeasurement.p99 - baselineMeasurement.p99) / baselineMeasurement.p99) * 100,
      avg: ((currentMeasurement.avg - baselineMeasurement.avg) / baselineMeasurement.avg) * 100
    };

    // Check if any monitored metric exceeds threshold
    const thresholdExceeded = metrics.some(metric => {
      return percentChange[metric] > regressionThreshold;
    });

    const regressionDetected = thresholdExceeded;

    comparisons.push({
      name: currentMeasurement.name,
      baseline: baselineMeasurement,
      current: currentMeasurement,
      regressionDetected,
      percentChange,
      thresholdExceeded,
      threshold: regressionThreshold
    });
  }

  return comparisons;
}

/**
 * Print baseline comparison report
 */
export function printComparisonReport(
  comparisons: BaselineComparison[],
  options: { verbose?: boolean } = {}
): void {
  const { verbose = false } = options;

  console.log('\n=== Performance Baseline Comparison ===\n');

  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  for (const comparison of comparisons) {
    totalTests++;

    const status = comparison.regressionDetected ? 'REGRESSION' : 'PASS';
    const symbol = comparison.regressionDetected ? '✗' : '✓';

    console.log(`${symbol} ${comparison.name}: ${status}`);

    if (verbose || comparison.regressionDetected) {
      console.log(`  Baseline p95: ${comparison.baseline.p95.toFixed(2)}ms`);
      console.log(`  Current  p95: ${comparison.current.p95.toFixed(2)}ms`);
      console.log(`  Change: ${comparison.percentChange.p95.toFixed(1)}%`);

      if (comparison.regressionDetected) {
        console.log(`  ⚠️  Exceeded threshold of ${comparison.threshold}%`);
      }

      console.log('');
    }

    if (comparison.regressionDetected) {
      failed++;
    } else {
      passed++;
    }
  }

  console.log('=======================================');
  console.log(`Total: ${totalTests}, Passed: ${passed}, Failed: ${failed}`);
  console.log('=======================================\n');

  if (failed > 0) {
    throw new Error(`Performance regression detected in ${failed} test(s)`);
  }
}

/**
 * Compare SQL vs Prisma performance
 */
export async function compareSQLvsPrisma(
  name: string,
  sqlFn: () => Promise<any>,
  prismaFn: () => Promise<any>,
  options: {
    iterations?: number;
    warmup?: number;
    acceptableOverhead?: number; // Percentage
  } = {}
): Promise<{
  sql: PerformanceMeasurement;
  prisma: PerformanceMeasurement;
  overhead: number;
  acceptable: boolean;
}> {
  const { iterations = 100, warmup = 5, acceptableOverhead = 20 } = options;

  console.log(`\n[PERF COMPARE] ${name}: SQL vs Prisma`);

  const sqlResult = await benchmarkQuery(`${name} (SQL)`, sqlFn, {
    iterations,
    warmup
  });

  const prismaResult = await benchmarkQuery(`${name} (Prisma)`, prismaFn, {
    iterations,
    warmup
  });

  // Calculate overhead based on p95
  const overhead = ((prismaResult.p95 - sqlResult.p95) / sqlResult.p95) * 100;
  const acceptable = overhead <= acceptableOverhead;

  console.log(`\n[PERF COMPARE] ${name}: Results`);
  console.log(`  SQL p95:    ${sqlResult.p95.toFixed(2)}ms`);
  console.log(`  Prisma p95: ${prismaResult.p95.toFixed(2)}ms`);
  console.log(`  Overhead:   ${overhead.toFixed(1)}%`);
  console.log(`  Status:     ${acceptable ? 'ACCEPTABLE' : 'OVERHEAD TOO HIGH'}`);

  if (!acceptable) {
    console.warn(`  ⚠️  Overhead exceeds ${acceptableOverhead}% threshold`);
  }

  return {
    sql: sqlResult,
    prisma: prismaResult,
    overhead,
    acceptable
  };
}

/**
 * Export results to JSON
 */
export function exportResults(
  measurements: PerformanceMeasurement[],
  filePath: string
): void {
  const result = {
    timestamp: new Date().toISOString(),
    measurements: measurements.map(m => ({
      name: m.name,
      iterations: m.iterations,
      p50: m.p50,
      p95: m.p95,
      p99: m.p99,
      avg: m.avg,
      min: m.min,
      max: m.max,
      stdDev: m.stdDev
    }))
  };

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`[EXPORT] Exported ${measurements.length} results to ${filePath}`);
}
