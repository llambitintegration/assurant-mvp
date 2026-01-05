# Grafana Dashboard Configuration for Prisma Migration

This directory contains Grafana dashboard and alert configurations for monitoring the Prisma migration progress and shadow mode validation.

## Files

- `prisma-migration-dashboard.json` - Main Grafana dashboard
- `alert-rules.yaml` - Prometheus/Grafana alert rules
- `README.md` - This file

## Dashboard Features

### Panels

1. **Shadow Mode Mismatch Rate** - Tracks data mismatches between SQL and Prisma
2. **SQL vs Prisma Latency Comparison** - Compares query performance
3. **Error Rate by Source** - Monitors SQL vs Prisma errors
4. **Query Count by Source** - Shows query distribution
5. **Migration Progress by Module** - Tracks migration completion
6. **Top Mismatches by Query** - Identifies problematic queries
7. **Feature Flag Status** - Shows which modules are enabled
8. **Latency Heatmaps** - Visualizes latency distribution
9. **Shadow Mode Sample Rate** - Current sampling percentage
10. **Total DB Queries** - Overall query volume
11. **Mismatch Rate Trend** - 24-hour mismatch trend

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| Mismatch rate > 0.1% | Critical | Page on-call, immediate rollback consideration |
| Latency regression > 20% | Critical | Page on-call, investigate performance |
| Error rate spike | Critical | Page on-call, check logs |
| Mismatch rate > 0.01% | Warning | Notify team, investigate |
| Latency regression > 50% | Warning | Notify team |

## Installation

### Option 1: Import Dashboard (Grafana UI)

1. Open Grafana
2. Navigate to Dashboards → Import
3. Upload `prisma-migration-dashboard.json`
4. Select Prometheus data source
5. Click Import

### Option 2: Provisioning (Recommended for Production)

1. Copy dashboard to Grafana provisioning directory:
   ```bash
   cp prisma-migration-dashboard.json /etc/grafana/provisioning/dashboards/
   ```

2. Create provisioning config:
   ```bash
   cat > /etc/grafana/provisioning/dashboards/prisma-migration.yaml <<EOF
   apiVersion: 1
   providers:
     - name: 'Prisma Migration'
       folder: 'Migrations'
       type: file
       options:
         path: /etc/grafana/provisioning/dashboards
   EOF
   ```

3. Restart Grafana:
   ```bash
   systemctl restart grafana-server
   ```

### Option 3: Terraform/IaC

```hcl
resource "grafana_dashboard" "prisma_migration" {
  config_json = file("${path.module}/prisma-migration-dashboard.json")
  folder      = grafana_folder.migrations.id
}
```

## Alert Configuration

### Prometheus Alertmanager

1. Copy alert rules to Prometheus:
   ```bash
   cp alert-rules.yaml /etc/prometheus/rules/prisma-migration.yaml
   ```

2. Update Prometheus config:
   ```yaml
   # /etc/prometheus/prometheus.yml
   rule_files:
     - /etc/prometheus/rules/prisma-migration.yaml
   ```

3. Reload Prometheus:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

### Grafana Alerting

1. Navigate to Alerting → Alert Rules
2. Import from `alert-rules.yaml`
3. Configure notification channels:
   - PagerDuty for critical alerts
   - Slack for warnings
   - Email for info

## Metric Requirements

The dashboard expects these Prometheus metrics to be available:

### Counters
- `shadow_mismatch_total{module, queryName, field}`
- `db_sql_errors_total{module, queryName, errorType}`
- `db_prisma_errors_total{module, queryName, errorType}`
- `db_query_total{source, module, queryName}`

### Histograms
- `db_sql_latency_ms{module, queryName}`
- `db_prisma_latency_ms{module, queryName}`

### Gauges
- `migration_progress_total{module, status}`
- `feature_flag_enabled{flag}`
- `shadow_sample_rate`

## Exporting Metrics to Prometheus

If using the in-memory metrics service, you'll need to export metrics to Prometheus:

### Option 1: Prometheus Client (Recommended)

Install Prometheus client:
```bash
npm install prom-client
```

Create metrics exporter:
```typescript
// src/services/metrics/prometheus-exporter.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { migrationMetrics } from './migration-metrics';

const register = new Registry();

// Define metrics
const mismatchCounter = new Counter({
  name: 'shadow_mismatch_total',
  help: 'Total shadow mode mismatches',
  labelNames: ['module', 'queryName', 'field'],
  registers: [register]
});

const latencyHistogram = new Histogram({
  name: 'db_latency_ms',
  help: 'Database query latency',
  labelNames: ['source', 'module', 'queryName'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register]
});

// Export endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Option 2: Push Gateway

For batch jobs or serverless:
```typescript
import { Pushgateway } from 'prom-client';

const gateway = new Pushgateway('http://pushgateway:9091');
gateway.pushAdd({ jobName: 'worklenz-backend' }, (err, resp, body) => {
  if (err) console.error('Error pushing metrics:', err);
});
```

### Option 3: StatsD

If using StatsD/Datadog:
```typescript
import StatsD from 'hot-shots';

const statsd = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'worklenz.migration.'
});

statsd.increment('shadow_mismatch_total', 1, {
  module: 'auth',
  queryName: 'getUser'
});
```

## Access

### Development
- URL: http://localhost:3000/grafana
- Username: admin
- Password: admin

### Staging
- URL: https://grafana.staging.company.com/d/prisma-migration
- Auth: SSO

### Production
- URL: https://grafana.company.com/d/prisma-migration
- Auth: SSO + MFA

## Dashboard Variables

The dashboard supports these variables:

- `$module` - Filter by module (auth, teams, projects, tasks, reporting)
- `$environment` - Filter by environment (production, staging, development)

## Annotations

The dashboard shows annotations for:

- **Deployments** - Marked with blue vertical lines
- **Incidents** - Marked with red vertical lines
- **Rollbacks** - Marked with orange vertical lines

Add annotations via Grafana API:
```bash
curl -X POST http://grafana:3000/api/annotations \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Deployed Prisma migration v1.2.3",
    "tags": ["deployment", "release"],
    "time": '$(date +%s000)'
  }'
```

## Troubleshooting

### Dashboard shows "No Data"

1. Check Prometheus is scraping metrics:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Verify metrics endpoint is accessible:
   ```bash
   curl http://localhost:3000/metrics
   ```

3. Check metrics exist in Prometheus:
   ```bash
   curl http://localhost:9090/api/v1/query?query=shadow_mismatch_total
   ```

### Alerts not firing

1. Check alert rules are loaded:
   ```bash
   curl http://localhost:9090/api/v1/rules
   ```

2. Verify Alertmanager config:
   ```bash
   curl http://localhost:9093/api/v1/status
   ```

3. Test notification channels in Grafana UI

### High cardinality warnings

If you see "too many time series" warnings:

1. Reduce label cardinality (avoid high-cardinality labels like user IDs)
2. Increase metric retention period
3. Use recording rules to pre-aggregate:
   ```yaml
   groups:
     - name: prisma_migration_recording
       interval: 1m
       rules:
         - record: module:shadow_mismatch_total:rate5m
           expr: rate(shadow_mismatch_total[5m])
   ```

## Best Practices

1. **Keep dashboard focused** - Don't add too many panels
2. **Use template variables** - Allow filtering by module/environment
3. **Set appropriate time ranges** - Default to last 1 hour, allow 24h view
4. **Configure alerts carefully** - Avoid alert fatigue
5. **Document changes** - Update this README when adding panels
6. **Version control** - Commit dashboard JSON changes
7. **Test in staging first** - Never edit production dashboards directly

## Support

- **Documentation**: https://docs.company.com/monitoring/grafana
- **Runbooks**: https://docs.company.com/runbooks/prisma-migration
- **Slack**: #backend-monitoring
- **On-call**: engineering-oncall@company.com
