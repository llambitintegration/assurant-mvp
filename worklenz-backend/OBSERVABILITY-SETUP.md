# Observability Infrastructure Setup Guide

This guide will help you integrate the observability infrastructure for the Prisma migration.

## Quick Start

### 1. Add Health Routes to Your Application

In your main application file (e.g., `src/server.ts` or `src/app.ts`):

```typescript
import healthApiRouter from "./routes/apis/health-api-router";
import healthController from "./controllers/health-controller";

// Add routes
app.use("/health", healthApiRouter);
app.use("/metrics", healthController.getPrometheusMetrics);
```

### 2. Set Environment Variables

Add to your `.env` file:

```bash
# Migration feature flags (default: false)
USE_PRISMA_AUTH=false
USE_PRISMA_TEAMS=false
USE_PRISMA_PROJECTS=false
USE_PRISMA_TASKS=false
USE_PRISMA_REPORTING=false

# Shadow mode flags (default: false)
SHADOW_COMPARE_AUTH=false
SHADOW_COMPARE_TEAMS=false
SHADOW_COMPARE_PROJECTS=false
SHADOW_COMPARE_TASKS=false
SHADOW_SAMPLE_RATE=0.01

# Metrics/logging (default: true)
MIGRATION_METRICS_ENABLED=true
MIGRATION_LOGGING_ENABLED=true
```

### 3. Create Data Directory

```bash
mkdir -p data
# OR for production
sudo mkdir -p /var/lib/worklenz
```

### 4. Test Endpoints

```bash
# Start your application
npm run dev

# Test health check
curl http://localhost:3000/health

# Test migration status
curl http://localhost:3000/health/migration-status

# Test feature flags
curl http://localhost:3000/health/feature-flags

# Test metrics export
curl http://localhost:3000/metrics
```

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic application health |
| `/health/migration-status` | GET | Migration progress and statistics |
| `/health/feature-flags` | GET | Current feature flag states |
| `/health/shadow-mode-stats` | GET | Shadow mode comparison stats |
| `/health/latency-comparison` | GET | SQL vs Prisma latency |
| `/health/reset-metrics` | POST | Reset metrics (dev only) |
| `/metrics` | GET | Prometheus metrics |

## Using the Metrics Service

```typescript
import { migrationMetrics } from './services/metrics/migration-metrics';

// Record latency
const start = Date.now();
const result = await queryDatabase();
migrationMetrics.recordLatency('auth', 'getUser', Date.now() - start, 'sql');

// Record mismatch
migrationMetrics.recordMismatch({ module: 'auth', queryName: 'getUser', field: 'email' });

// Record error
migrationMetrics.recordError('auth', 'getUser', 'sql', 'timeout');

// Record query execution
migrationMetrics.recordQuery('auth', 'getUser', 'sql');
```

## Using the Mismatch Logger

```typescript
import { mismatchLogger } from './services/logging/mismatch-logger';

// Log a mismatch
mismatchLogger.logMismatch({
  module: 'auth',
  queryName: 'getUser',
  sqlResult: { id: 1, email: 'user@example.com' },
  prismaResult: { id: 1, email: 'user@example.com' },
  diff: { field: 'email', sqlValue: 'old', prismaValue: 'new' }
});

// Log field-level mismatch
mismatchLogger.logFieldMismatch('auth', 'getUser', 'email', 'old@example.com', 'new@example.com');

// Log success
mismatchLogger.logSuccess('auth', 'getUser');

// Log error
mismatchLogger.logError('auth', 'getUser', 'sql', new Error('Query timeout'));
```

## Using the Progress Tracker

```typescript
import { progressTracker } from './services/migration/progress-tracker';

// Mark queries as migrated
progressTracker.markMigrated('auth', 5);

// Mark queries as in progress
progressTracker.markInProgress('auth', 3);

// Complete a module
progressTracker.completeModule('auth');

// Get progress
const progress = progressTracker.getProgress();
console.log(`Overall: ${progress.percentComplete}% complete`);

// Export progress
const markdown = progressTracker.exportMarkdown();
console.log(markdown);
```

## Setting Up Grafana

1. Import dashboard:
   ```bash
   cp config/grafana/prisma-migration-dashboard.json /etc/grafana/provisioning/dashboards/
   ```

2. Import alert rules:
   ```bash
   cp config/grafana/alert-rules.yaml /etc/prometheus/rules/
   ```

3. Reload Prometheus:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

4. Access dashboard:
   - URL: http://localhost:3000/grafana
   - Look for "Prisma Migration - Shadow Mode Monitoring"

## Rollback Procedures

See `/context/ROLLBACK-PROCEDURES.md` for comprehensive rollback guide.

Quick rollback:
```bash
# 1. Disable feature flag
export USE_PRISMA_AUTH=false

# 2. Restart application
pm2 restart worklenz-backend

# 3. Verify
curl http://localhost:3000/health/feature-flags
```

## Documentation

- **Full Documentation:** `/context/phase1-observability.md`
- **Rollback Procedures:** `/context/ROLLBACK-PROCEDURES.md`
- **Migration Plan:** `/context/prismaMigration.md`
- **Migration Inventory:** `/context/prisma-migration-inventory.md`

## Support

- **Slack:** #prisma-migration
- **Issues:** Create GitHub issue with `observability` label
- **On-call:** engineering-oncall@company.com
