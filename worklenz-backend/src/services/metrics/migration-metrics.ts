/**
 * Migration Metrics Service
 *
 * Provides comprehensive metrics tracking for the Prisma migration effort.
 * Tracks mismatches, latency, error rates, and query counts for shadow mode validation.
 *
 * Metrics collected:
 * - shadow_mismatch_total: Counter for data mismatches between SQL and Prisma
 * - db_sql_latency_ms: Histogram for SQL query latency
 * - db_prisma_latency_ms: Histogram for Prisma query latency
 * - db_sql_errors_total: Counter for SQL query errors
 * - db_prisma_errors_total: Counter for Prisma query errors
 * - db_query_total: Counter for all database queries
 */

export interface MetricLabels {
  module?: string;
  queryName?: string;
  field?: string;
  source?: 'sql' | 'prisma';
  errorType?: string;
}

export interface LatencyMetric {
  module: string;
  queryName: string;
  durationMs: number;
  source: 'sql' | 'prisma';
  timestamp: Date;
}

export interface MismatchMetric {
  module: string;
  queryName: string;
  field: string;
  timestamp: Date;
}

export interface ErrorMetric {
  module: string;
  queryName: string;
  source: 'sql' | 'prisma';
  errorType: string;
  timestamp: Date;
}

export interface QueryMetric {
  module: string;
  queryName: string;
  source: 'sql' | 'prisma';
  timestamp: Date;
}

/**
 * In-memory metrics storage for development/testing.
 * In production, this should be replaced with Prometheus, StatsD, or similar.
 */
class MigrationMetrics {
  private mismatchCount: Map<string, number> = new Map();
  private latencyHistograms: LatencyMetric[] = [];
  private errorCounts: Map<string, number> = new Map();
  private queryCounts: Map<string, number> = new Map();

  // Configuration
  private readonly maxHistogramSize = 10000; // Keep last 10k latency measurements
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.MIGRATION_METRICS_ENABLED === 'true';
  }

  /**
   * Record a mismatch between SQL and Prisma results
   */
  recordMismatch(labels: Required<Pick<MetricLabels, 'module' | 'queryName' | 'field'>>): void {
    if (!this.enabled) return;

    const key = this.getMetricKey('mismatch', labels);
    const current = this.mismatchCount.get(key) || 0;
    this.mismatchCount.set(key, current + 1);

    // In production, send to metrics backend:
    // prometheus.counter('shadow_mismatch_total', labels).inc();
  }

  /**
   * Record query latency
   */
  recordLatency(
    module: string,
    queryName: string,
    durationMs: number,
    source: 'sql' | 'prisma'
  ): void {
    if (!this.enabled) return;

    const metric: LatencyMetric = {
      module,
      queryName,
      durationMs,
      source,
      timestamp: new Date()
    };

    this.latencyHistograms.push(metric);

    // Keep histogram size manageable
    if (this.latencyHistograms.length > this.maxHistogramSize) {
      this.latencyHistograms.shift();
    }

    // In production, send to metrics backend:
    // prometheus.histogram(`db_${source}_latency_ms`, { module, queryName }).observe(durationMs);
  }

  /**
   * Record database error
   */
  recordError(
    module: string,
    queryName: string,
    source: 'sql' | 'prisma',
    errorType: string
  ): void {
    if (!this.enabled) return;

    const key = this.getMetricKey('error', { module, queryName, source, errorType });
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);

    // In production, send to metrics backend:
    // prometheus.counter(`db_${source}_errors_total`, { module, queryName, errorType }).inc();
  }

  /**
   * Record query execution
   */
  recordQuery(module: string, queryName: string, source: 'sql' | 'prisma'): void {
    if (!this.enabled) return;

    const key = this.getMetricKey('query', { module, queryName, source });
    const current = this.queryCounts.get(key) || 0;
    this.queryCounts.set(key, current + 1);

    // In production, send to metrics backend:
    // prometheus.counter('db_query_total', { module, queryName, source }).inc();
  }

  /**
   * Get mismatch count for a specific metric
   */
  getMismatchCount(module: string, queryName: string, field?: string): number {
    const key = field
      ? this.getMetricKey('mismatch', { module, queryName, field })
      : `mismatch:${module}:${queryName}`;

    if (field) {
      return this.mismatchCount.get(key) || 0;
    }

    // Sum all fields for this query
    let total = 0;
    for (const [k, v] of this.mismatchCount.entries()) {
      if (k.startsWith(key)) {
        total += v;
      }
    }
    return total;
  }

  /**
   * Get latency statistics for a query
   */
  getLatencyStats(
    module: string,
    queryName: string,
    source?: 'sql' | 'prisma'
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const filtered = this.latencyHistograms.filter(
      m => m.module === module && m.queryName === queryName && (!source || m.source === source)
    );

    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: sum / durations.length,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    };
  }

  /**
   * Get error count for a specific metric
   */
  getErrorCount(module: string, queryName: string, source?: 'sql' | 'prisma'): number {
    if (source) {
      const key = `error:${module}:${queryName}:${source}`;
      let total = 0;
      for (const [k, v] of this.errorCounts.entries()) {
        if (k.startsWith(key)) {
          total += v;
        }
      }
      return total;
    }

    // Sum both sources
    const key = `error:${module}:${queryName}`;
    let total = 0;
    for (const [k, v] of this.errorCounts.entries()) {
      if (k.startsWith(key)) {
        total += v;
      }
    }
    return total;
  }

  /**
   * Get query count for a specific metric
   */
  getQueryCount(module: string, queryName?: string, source?: 'sql' | 'prisma'): number {
    let pattern = `query:${module}`;
    if (queryName) pattern += `:${queryName}`;
    if (source) pattern += `:${source}`;

    let total = 0;
    for (const [k, v] of this.queryCounts.entries()) {
      if (k.startsWith(pattern)) {
        total += v;
      }
    }
    return total;
  }

  /**
   * Get all metrics summary
   */
  getSummary(): {
    totalMismatches: number;
    totalErrors: number;
    totalQueries: number;
    latencyMeasurements: number;
    byModule: Record<string, {
      mismatches: number;
      errors: number;
      queries: number;
    }>;
  } {
    const modules = new Set<string>();

    // Collect all modules
    for (const key of this.mismatchCount.keys()) {
      const module = key.split(':')[1];
      if (module) modules.add(module);
    }
    for (const key of this.errorCounts.keys()) {
      const module = key.split(':')[1];
      if (module) modules.add(module);
    }
    for (const key of this.queryCounts.keys()) {
      const module = key.split(':')[1];
      if (module) modules.add(module);
    }

    const byModule: Record<string, { mismatches: number; errors: number; queries: number }> = {};

    for (const module of modules) {
      byModule[module] = {
        mismatches: this.getMismatchCount(module, ''),
        errors: this.getErrorCount(module, ''),
        queries: this.getQueryCount(module)
      };
    }

    return {
      totalMismatches: Array.from(this.mismatchCount.values()).reduce((a, b) => a + b, 0),
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      totalQueries: Array.from(this.queryCounts.values()).reduce((a, b) => a + b, 0),
      latencyMeasurements: this.latencyHistograms.length,
      byModule
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.mismatchCount.clear();
    this.latencyHistograms = [];
    this.errorCounts.clear();
    this.queryCounts.clear();
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    mismatches: Record<string, number>;
    errors: Record<string, number>;
    queries: Record<string, number>;
    latency: LatencyMetric[];
  } {
    return {
      mismatches: Object.fromEntries(this.mismatchCount),
      errors: Object.fromEntries(this.errorCounts),
      queries: Object.fromEntries(this.queryCounts),
      latency: [...this.latencyHistograms]
    };
  }

  // Helper methods

  private getMetricKey(type: string, labels: MetricLabels): string {
    const parts = [type];
    if (labels.module) parts.push(labels.module);
    if (labels.queryName) parts.push(labels.queryName);
    if (labels.field) parts.push(labels.field);
    if (labels.source) parts.push(labels.source);
    if (labels.errorType) parts.push(labels.errorType);
    return parts.join(':');
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

// Singleton instance
export const migrationMetrics = new MigrationMetrics();

// Convenience functions for common operations
export function recordMismatch(module: string, queryName: string, field: string): void {
  migrationMetrics.recordMismatch({ module, queryName, field });
}

export function recordLatency(
  module: string,
  queryName: string,
  durationMs: number,
  source: 'sql' | 'prisma'
): void {
  migrationMetrics.recordLatency(module, queryName, durationMs, source);
}

export function recordError(
  module: string,
  queryName: string,
  source: 'sql' | 'prisma',
  errorType: string
): void {
  migrationMetrics.recordError(module, queryName, source, errorType);
}

export function recordQuery(module: string, queryName: string, source: 'sql' | 'prisma'): void {
  migrationMetrics.recordQuery(module, queryName, source);
}

export default migrationMetrics;
