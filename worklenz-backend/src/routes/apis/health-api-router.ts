/**
 * Health API Router
 *
 * Routes for health checks, migration status, and observability endpoints.
 */

import express from "express";
import healthController from "../../controllers/health-controller";

const healthApiRouter = express.Router();

/**
 * Basic health check
 * GET /health
 */
healthApiRouter.get("/", healthController.getHealth);

/**
 * Migration status
 * GET /health/migration-status
 */
healthApiRouter.get("/migration-status", healthController.getMigrationStatus);

/**
 * Feature flags
 * GET /health/feature-flags
 */
healthApiRouter.get("/feature-flags", healthController.getFeatureFlags);

/**
 * Shadow mode statistics
 * GET /health/shadow-mode-stats?module=auth&queryName=getUser
 */
healthApiRouter.get("/shadow-mode-stats", healthController.getShadowModeStats);

/**
 * Latency comparison
 * GET /health/latency-comparison
 */
healthApiRouter.get("/latency-comparison", healthController.getLatencyComparison);

/**
 * Reset metrics (dev/staging only)
 * POST /health/reset-metrics
 */
healthApiRouter.post("/reset-metrics", healthController.resetMetrics);

export default healthApiRouter;
