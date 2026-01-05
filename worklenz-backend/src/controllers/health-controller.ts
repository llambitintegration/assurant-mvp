/**
 * Health Check Controller
 *
 * Provides health check endpoints for the application, including
 * migration status, feature flags, and shadow mode statistics.
 */

import { Request, Response } from "express";
import { migrationMetrics } from "../services/metrics/migration-metrics";
import { mismatchLogger } from "../services/logging/mismatch-logger";
import { progressTracker } from "../services/migration/progress-tracker";

/**
 * Basic health check endpoint
 * GET /health
 */
export async function getHealth(req: Request, res: Response) {
  try {
    // Basic application health
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
      environment: process.env.NODE_ENV || "development"
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Migration status endpoint
 * GET /health/migration-status
 *
 * Returns current migration progress and statistics
 */
export async function getMigrationStatus(req: Request, res: Response) {
  try {
    const progress = progressTracker.getProgress();
    const metrics = migrationMetrics.getSummary();

    const status = {
      timestamp: new Date().toISOString(),
      progress: {
        totalQueries: progress.totalQueries,
        migrated: progress.migrated,
        inProgress: progress.inProgress,
        remaining: progress.remaining,
        percentComplete: progress.percentComplete,
        moduleProgress: progress.moduleProgress
      },
      metrics: {
        totalMismatches: metrics.totalMismatches,
        totalErrors: metrics.totalErrors,
        totalQueries: metrics.totalQueries,
        latencyMeasurements: metrics.latencyMeasurements
      },
      moduleDetails: metrics.byModule,
      shadowModeEnabled: {
        auth: process.env.SHADOW_COMPARE_AUTH === 'true',
        teams: process.env.SHADOW_COMPARE_TEAMS === 'true',
        projects: process.env.SHADOW_COMPARE_PROJECTS === 'true',
        tasks: process.env.SHADOW_COMPARE_TASKS === 'true'
      }
    };

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get migration status",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Feature flags endpoint
 * GET /health/feature-flags
 *
 * Returns current state of all feature flags
 */
export async function getFeatureFlags(req: Request, res: Response) {
  try {
    const flags = {
      timestamp: new Date().toISOString(),
      flags: {
        // Prisma module flags
        USE_PRISMA_AUTH: process.env.USE_PRISMA_AUTH === 'true',
        USE_PRISMA_TEAMS: process.env.USE_PRISMA_TEAMS === 'true',
        USE_PRISMA_PROJECTS: process.env.USE_PRISMA_PROJECTS === 'true',
        USE_PRISMA_TASKS: process.env.USE_PRISMA_TASKS === 'true',
        USE_PRISMA_REPORTING: process.env.USE_PRISMA_REPORTING === 'true',

        // Shadow mode flags
        SHADOW_COMPARE_AUTH: process.env.SHADOW_COMPARE_AUTH === 'true',
        SHADOW_COMPARE_TEAMS: process.env.SHADOW_COMPARE_TEAMS === 'true',
        SHADOW_COMPARE_PROJECTS: process.env.SHADOW_COMPARE_PROJECTS === 'true',
        SHADOW_COMPARE_TASKS: process.env.SHADOW_COMPARE_TASKS === 'true',

        // Shadow mode configuration
        SHADOW_SAMPLE_RATE: parseFloat(process.env.SHADOW_SAMPLE_RATE || '0.01'),

        // Metrics/logging flags
        MIGRATION_METRICS_ENABLED: process.env.MIGRATION_METRICS_ENABLED === 'true',
        MIGRATION_LOGGING_ENABLED: process.env.MIGRATION_LOGGING_ENABLED === 'true'
      },
      summary: {
        modulesEnabled: [
          process.env.USE_PRISMA_AUTH === 'true' && 'auth',
          process.env.USE_PRISMA_TEAMS === 'true' && 'teams',
          process.env.USE_PRISMA_PROJECTS === 'true' && 'projects',
          process.env.USE_PRISMA_TASKS === 'true' && 'tasks',
          process.env.USE_PRISMA_REPORTING === 'true' && 'reporting'
        ].filter(Boolean),
        shadowModeActive: [
          process.env.SHADOW_COMPARE_AUTH === 'true' && 'auth',
          process.env.SHADOW_COMPARE_TEAMS === 'true' && 'teams',
          process.env.SHADOW_COMPARE_PROJECTS === 'true' && 'projects',
          process.env.SHADOW_COMPARE_TASKS === 'true' && 'tasks'
        ].filter(Boolean)
      }
    };

    res.status(200).json(flags);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get feature flags",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Shadow mode statistics endpoint
 * GET /health/shadow-mode-stats
 *
 * Returns detailed shadow mode comparison statistics
 */
export async function getShadowModeStats(req: Request, res: Response) {
  try {
    const { module, queryName } = req.query;

    // Get overall summary
    const summary = migrationMetrics.getSummary();

    // Get module-specific stats if requested
    let moduleStats = null;
    if (module && typeof module === 'string') {
      const moduleMismatches = migrationMetrics.getMismatchCount(module, '');
      const moduleErrors = migrationMetrics.getErrorCount(module, '');
      const moduleQueries = migrationMetrics.getQueryCount(module);

      moduleStats = {
        module,
        mismatches: moduleMismatches,
        errors: moduleErrors,
        queries: moduleQueries
      };

      // Get query-specific latency stats if requested
      if (queryName && typeof queryName === 'string') {
        const sqlLatency = migrationMetrics.getLatencyStats(module, queryName, 'sql');
        const prismaLatency = migrationMetrics.getLatencyStats(module, queryName, 'prisma');

        moduleStats = {
          ...moduleStats,
          queryName,
          latency: {
            sql: sqlLatency,
            prisma: prismaLatency,
            regression: sqlLatency && prismaLatency
              ? ((prismaLatency.avg - sqlLatency.avg) / sqlLatency.avg * 100).toFixed(2) + '%'
              : null
          }
        };
      }
    }

    // Get rate limiting stats
    const rateLimitStats = mismatchLogger.getRateLimitStats();

    const stats = {
      timestamp: new Date().toISOString(),
      summary,
      moduleStats,
      rateLimiting: {
        activeKeys: rateLimitStats.activeKeys,
        totalSuppressed: rateLimitStats.totalSuppressed
      },
      configuration: {
        sampleRate: parseFloat(process.env.SHADOW_SAMPLE_RATE || '0.01'),
        metricsEnabled: process.env.MIGRATION_METRICS_ENABLED === 'true',
        loggingEnabled: process.env.MIGRATION_LOGGING_ENABLED === 'true'
      }
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get shadow mode stats",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Module latency comparison endpoint
 * GET /health/latency-comparison
 *
 * Returns latency comparison between SQL and Prisma for all modules
 */
export async function getLatencyComparison(req: Request, res: Response) {
  try {
    const modules = ['auth', 'teams', 'projects', 'tasks', 'reporting'];
    const comparison: any[] = [];

    for (const module of modules) {
      // Get all query names for this module from metrics
      const moduleQueries = migrationMetrics.getQueryCount(module);

      if (moduleQueries > 0) {
        // For simplicity, we'll aggregate at the module level
        // In production, you'd want to track individual queries
        comparison.push({
          module,
          queries: moduleQueries,
          // Add latency stats here when available per module
        });
      }
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      comparison
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get latency comparison",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Reset metrics endpoint (for testing only)
 * POST /health/reset-metrics
 *
 * Resets all migration metrics. Should only be enabled in non-production environments.
 */
export async function resetMetrics(req: Request, res: Response) {
  try {
    // Only allow in development/staging
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: "Forbidden",
        message: "Cannot reset metrics in production"
      });
    }

    migrationMetrics.reset();
    progressTracker.reset();

    res.status(200).json({
      success: true,
      message: "Metrics reset successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to reset metrics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Export metrics in Prometheus format
 * GET /metrics
 *
 * Returns metrics in Prometheus exposition format
 */
export async function getPrometheusMetrics(req: Request, res: Response) {
  try {
    const metrics = migrationMetrics.exportMetrics();
    const summary = migrationMetrics.getSummary();

    // Convert to Prometheus format
    let output = '';

    // Mismatches
    output += '# HELP shadow_mismatch_total Total number of shadow mode mismatches\n';
    output += '# TYPE shadow_mismatch_total counter\n';
    for (const [key, value] of Object.entries(metrics.mismatches)) {
      const parts = key.split(':');
      const labels = `module="${parts[1]}",queryName="${parts[2]}",field="${parts[3] || 'result'}"`;
      output += `shadow_mismatch_total{${labels}} ${value}\n`;
    }

    // Errors
    output += '# HELP db_errors_total Total number of database errors\n';
    output += '# TYPE db_errors_total counter\n';
    for (const [key, value] of Object.entries(metrics.errors)) {
      const parts = key.split(':');
      const labels = `module="${parts[1]}",queryName="${parts[2]}",source="${parts[3]}",errorType="${parts[4] || 'unknown'}"`;
      output += `db_errors_total{${labels}} ${value}\n`;
    }

    // Queries
    output += '# HELP db_query_total Total number of database queries\n';
    output += '# TYPE db_query_total counter\n';
    for (const [key, value] of Object.entries(metrics.queries)) {
      const parts = key.split(':');
      const labels = `module="${parts[1]}",queryName="${parts[2]}",source="${parts[3]}"`;
      output += `db_query_total{${labels}} ${value}\n`;
    }

    // Summary metrics
    output += '# HELP migration_total_mismatches Total mismatches across all modules\n';
    output += '# TYPE migration_total_mismatches gauge\n';
    output += `migration_total_mismatches ${summary.totalMismatches}\n`;

    output += '# HELP migration_total_errors Total errors across all modules\n';
    output += '# TYPE migration_total_errors gauge\n';
    output += `migration_total_errors ${summary.totalErrors}\n`;

    output += '# HELP migration_total_queries Total queries across all modules\n';
    output += '# TYPE migration_total_queries gauge\n';
    output += `migration_total_queries ${summary.totalQueries}\n`;

    // Progress metrics
    const progress = progressTracker.getProgress();
    output += '# HELP migration_progress_total Total queries by status\n';
    output += '# TYPE migration_progress_total gauge\n';
    output += `migration_progress_total{status="total"} ${progress.totalQueries}\n`;
    output += `migration_progress_total{status="migrated"} ${progress.migrated}\n`;
    output += `migration_progress_total{status="in_progress"} ${progress.inProgress}\n`;
    output += `migration_progress_total{status="remaining"} ${progress.remaining}\n`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(output);
  } catch (error) {
    res.status(500).json({
      error: "Failed to export metrics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export default {
  getHealth,
  getMigrationStatus,
  getFeatureFlags,
  getShadowModeStats,
  getLatencyComparison,
  resetMetrics,
  getPrometheusMetrics
};
