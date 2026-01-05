/**
 * Shadow Compare Utility for SQL vs Prisma Migration
 *
 * Enables safe dual-execution comparison in production with:
 * - PII-safe logging
 * - Sampling support
 * - Metrics tracking
 * - Non-blocking execution
 */

import { normalize, findDifferences, NormalizeOptions } from './contract-test';
import crypto from 'crypto';

/**
 * Shadow compare configuration
 */
export interface ShadowCompareConfig {
  enabled: boolean;
  sampleRate: number; // 0.0 to 1.0 (0.01 = 1%)
  logMismatches: boolean;
  logSuccesses: boolean;
  throwOnError: boolean; // Should errors in shadow path throw?
  timeout: number; // milliseconds
  piiFields: string[]; // Fields to redact in logs
  normalizeOptions?: NormalizeOptions;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ShadowCompareConfig = {
  enabled: process.env.SHADOW_MODE_ENABLED === 'true',
  sampleRate: parseFloat(process.env.SHADOW_MODE_SAMPLE_RATE || '0.01'),
  logMismatches: true,
  logSuccesses: false,
  throwOnError: false,
  timeout: 5000,
  piiFields: ['email', 'password', 'phone', 'ssn', 'address', 'credit_card']
};

/**
 * Shadow compare result
 */
export interface ShadowCompareResult<T> {
  primaryResult: T;
  shadowResult?: T;
  matched: boolean;
  differences: string[];
  primaryDuration: number;
  shadowDuration?: number;
  sampled: boolean;
  error?: string;
}

/**
 * Metrics tracker
 */
export class ShadowMetrics {
  private static instance: ShadowMetrics;
  private metrics: Map<string, MetricData>;

  private constructor() {
    this.metrics = new Map();
  }

  static getInstance(): ShadowMetrics {
    if (!ShadowMetrics.instance) {
      ShadowMetrics.instance = new ShadowMetrics();
    }
    return ShadowMetrics.instance;
  }

  recordComparison(
    name: string,
    matched: boolean,
    primaryDuration: number,
    shadowDuration: number,
    differenceCount: number
  ): void {
    const key = name;
    const existing = this.metrics.get(key) || {
      name,
      totalCalls: 0,
      sampledCalls: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      primaryLatencies: [],
      shadowLatencies: [],
      differenceHistogram: new Map()
    };

    existing.totalCalls++;
    existing.sampledCalls++;
    if (matched) {
      existing.matches++;
    } else {
      existing.mismatches++;
    }

    existing.primaryLatencies.push(primaryDuration);
    existing.shadowLatencies.push(shadowDuration);

    // Track difference counts
    const count = existing.differenceHistogram.get(differenceCount) || 0;
    existing.differenceHistogram.set(differenceCount, count + 1);

    this.metrics.set(key, existing);
  }

  recordError(name: string, isShadowError: boolean): void {
    const key = name;
    const existing = this.metrics.get(key) || {
      name,
      totalCalls: 0,
      sampledCalls: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      primaryLatencies: [],
      shadowLatencies: [],
      differenceHistogram: new Map()
    };

    existing.errors++;
    if (!isShadowError) {
      existing.totalCalls++;
    } else {
      existing.sampledCalls++;
    }

    this.metrics.set(key, existing);
  }

  recordSkipped(name: string): void {
    const key = name;
    const existing = this.metrics.get(key) || {
      name,
      totalCalls: 0,
      sampledCalls: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      primaryLatencies: [],
      shadowLatencies: [],
      differenceHistogram: new Map()
    };

    existing.totalCalls++;
    this.metrics.set(key, existing);
  }

  getMetrics(name?: string): MetricData | Map<string, MetricData> {
    if (name) {
      return this.metrics.get(name) || this.createEmptyMetric(name);
    }
    return new Map(this.metrics);
  }

  getSummary(name: string): MetricSummary {
    const data = this.metrics.get(name) || this.createEmptyMetric(name);

    return {
      name: data.name,
      totalCalls: data.totalCalls,
      sampledCalls: data.sampledCalls,
      sampleRate: data.totalCalls > 0 ? data.sampledCalls / data.totalCalls : 0,
      matches: data.matches,
      mismatches: data.mismatches,
      errors: data.errors,
      matchRate: data.sampledCalls > 0 ? data.matches / data.sampledCalls : 0,
      primaryLatency: this.calculatePercentiles(data.primaryLatencies),
      shadowLatency: this.calculatePercentiles(data.shadowLatencies),
      latencyOverhead: this.calculateLatencyOverhead(
        data.primaryLatencies,
        data.shadowLatencies
      )
    };
  }

  getAllSummaries(): MetricSummary[] {
    return Array.from(this.metrics.keys()).map(name => this.getSummary(name));
  }

  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  private createEmptyMetric(name: string): MetricData {
    return {
      name,
      totalCalls: 0,
      sampledCalls: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      primaryLatencies: [],
      shadowLatencies: [],
      differenceHistogram: new Map()
    };
  }

  private calculatePercentiles(values: number[]): LatencyStats {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  private calculateLatencyOverhead(
    primary: number[],
    shadow: number[]
  ): number {
    if (primary.length === 0 || shadow.length === 0) {
      return 0;
    }

    const avgPrimary = primary.reduce((a, b) => a + b, 0) / primary.length;
    const avgShadow = shadow.reduce((a, b) => a + b, 0) / shadow.length;

    return avgShadow - avgPrimary;
  }
}

/**
 * Metric data structure
 */
interface MetricData {
  name: string;
  totalCalls: number;
  sampledCalls: number;
  matches: number;
  mismatches: number;
  errors: number;
  primaryLatencies: number[];
  shadowLatencies: number[];
  differenceHistogram: Map<number, number>;
}

/**
 * Latency statistics
 */
interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

/**
 * Metric summary
 */
export interface MetricSummary {
  name: string;
  totalCalls: number;
  sampledCalls: number;
  sampleRate: number;
  matches: number;
  mismatches: number;
  errors: number;
  matchRate: number;
  primaryLatency: LatencyStats;
  shadowLatency: LatencyStats;
  latencyOverhead: number;
}

/**
 * Redact PII from an object for safe logging
 */
function redactPII(data: any, piiFields: string[]): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactPII(item, piiFields));
  }

  if (typeof data === 'object') {
    const redacted: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (piiFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        // Hash the PII value
        redacted[key] = hashValue(value);
      } else {
        redacted[key] = redactPII(value, piiFields);
      }
    }

    return redacted;
  }

  return data;
}

/**
 * Hash a value for PII-safe logging
 */
function hashValue(value: any): string {
  if (value === null || value === undefined) {
    return '[REDACTED:null]';
  }

  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const hash = crypto.createHash('sha256').update(str).digest('hex').substring(0, 8);

  return `[REDACTED:${hash}]`;
}

/**
 * Determine if this call should be sampled
 */
function shouldSample(sampleRate: number): boolean {
  if (sampleRate >= 1.0) return true;
  if (sampleRate <= 0.0) return false;

  return Math.random() < sampleRate;
}

/**
 * Execute a function with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

/**
 * Main shadow compare function
 * Executes both primary and shadow functions, compares results, and tracks metrics
 */
export async function shadowCompare<T>(
  name: string,
  primaryFn: () => Promise<T>,
  shadowFn: () => Promise<T>,
  config: Partial<ShadowCompareConfig> = {}
): Promise<ShadowCompareResult<T>> {
  const cfg: ShadowCompareConfig = { ...DEFAULT_CONFIG, ...config };
  const metrics = ShadowMetrics.getInstance();

  // Check if shadow mode is enabled
  if (!cfg.enabled) {
    const primaryResult = await primaryFn();
    return {
      primaryResult,
      matched: true,
      differences: [],
      primaryDuration: 0,
      sampled: false
    };
  }

  // Check sampling
  const sampled = shouldSample(cfg.sampleRate);
  if (!sampled) {
    metrics.recordSkipped(name);
    const primaryResult = await primaryFn();
    return {
      primaryResult,
      matched: true,
      differences: [],
      primaryDuration: 0,
      sampled: false
    };
  }

  // Execute primary function
  const primaryStart = Date.now();
  let primaryResult: T;
  let primaryError: Error | undefined;

  try {
    primaryResult = await primaryFn();
  } catch (err) {
    primaryError = err as Error;
    metrics.recordError(name, false);
    throw err; // Re-throw primary errors
  } finally {
    const primaryDuration = Date.now() - primaryStart;

    // If primary failed, don't execute shadow
    if (primaryError) {
      return {
        primaryResult: undefined as any,
        matched: false,
        differences: [],
        primaryDuration,
        sampled: true,
        error: primaryError.message
      };
    }
  }

  const primaryDuration = Date.now() - primaryStart;

  // Execute shadow function (non-blocking, with timeout)
  const shadowStart = Date.now();
  let shadowResult: T | undefined;
  let shadowError: Error | undefined;

  try {
    shadowResult = await withTimeout(shadowFn(), cfg.timeout);
  } catch (err) {
    shadowError = err as Error;
    metrics.recordError(name, true);

    if (cfg.throwOnError) {
      throw err;
    }
  }

  const shadowDuration = Date.now() - shadowStart;

  // If shadow failed, return primary result
  if (shadowError) {
    if (cfg.logMismatches) {
      console.warn(`[SHADOW] ${name}: Shadow execution failed`, {
        error: shadowError.message,
        primaryDuration,
        shadowDuration
      });
    }

    return {
      primaryResult,
      matched: false,
      differences: [],
      primaryDuration,
      shadowDuration,
      sampled: true,
      error: shadowError.message
    };
  }

  // Normalize results
  const normalizedPrimary = normalize(primaryResult, cfg.normalizeOptions);
  const normalizedShadow = normalize(shadowResult, cfg.normalizeOptions);

  // Find differences
  const differences = findDifferences(normalizedPrimary, normalizedShadow);
  const matched = differences.length === 0;

  // Record metrics
  metrics.recordComparison(
    name,
    matched,
    primaryDuration,
    shadowDuration,
    differences.length
  );

  // Log results
  if (matched && cfg.logSuccesses) {
    console.log(`[SHADOW] ${name}: Match`, {
      primaryDuration,
      shadowDuration,
      latencyDiff: shadowDuration - primaryDuration
    });
  }

  if (!matched && cfg.logMismatches) {
    console.warn(`[SHADOW] ${name}: Mismatch detected`, {
      differences: differences.slice(0, 5),
      differenceCount: differences.length,
      primaryDuration,
      shadowDuration,
      primarySample: redactPII(primaryResult, cfg.piiFields),
      shadowSample: redactPII(shadowResult, cfg.piiFields)
    });
  }

  return {
    primaryResult,
    shadowResult,
    matched,
    differences,
    primaryDuration,
    shadowDuration,
    sampled: true
  };
}

/**
 * Decorator for shadow compare (for use with class methods)
 */
export function ShadowCompare(
  name: string,
  shadowFn: (...args: any[]) => Promise<any>,
  config: Partial<ShadowCompareConfig> = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await shadowCompare(
        name,
        () => originalMethod.apply(this, args),
        () => shadowFn.apply(this, args),
        config
      );

      return result.primaryResult;
    };

    return descriptor;
  };
}

/**
 * Export metrics to JSON for tracking
 */
export function exportMetrics(filePath?: string): string {
  const metrics = ShadowMetrics.getInstance();
  const summaries = metrics.getAllSummaries();

  const report = {
    timestamp: new Date().toISOString(),
    summaries,
    totalComparisons: summaries.reduce((sum, s) => sum + s.sampledCalls, 0),
    totalMismatches: summaries.reduce((sum, s) => sum + s.mismatches, 0),
    overallMatchRate: calculateOverallMatchRate(summaries)
  };

  const json = JSON.stringify(report, null, 2);

  if (filePath) {
    const fs = require('fs');
    fs.writeFileSync(filePath, json, 'utf-8');
  }

  return json;
}

function calculateOverallMatchRate(summaries: MetricSummary[]): number {
  const totals = summaries.reduce(
    (acc, s) => ({
      matches: acc.matches + s.matches,
      total: acc.total + s.sampledCalls
    }),
    { matches: 0, total: 0 }
  );

  return totals.total > 0 ? totals.matches / totals.total : 0;
}
