# Labels & Custom Fields Migration - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. View implementation status
cat /home/llambit/repos/assurant-mvp/worklenz-backend/docs/migrations/IMPLEMENTATION_SUMMARY.md

# 2. Check what's done
cat /home/llambit/repos/assurant-mvp/worklenz-backend/docs/migrations/LABELS_CUSTOM_FIELDS_CHECKLIST.md

# 3. Run tests (after env fix)
npm test -- --testPathPattern="labels-service.contract.spec"
npm test -- --testPathPattern="custom-columns-service.contract.spec"
```

## 📁 File Locations

| File | Path | Lines |
|------|------|-------|
| Labels Service | `/src/services/labels/labels-service.ts` | 298 |
| Custom Columns Service | `/src/services/custom-columns/custom-columns-service.ts` | 596 |
| Labels Tests | `/src/tests/contract/labels/labels-service.contract.spec.ts` | 554 |
| Custom Columns Tests | `/src/tests/contract/custom-columns/custom-columns-service.contract.spec.ts` | 835 |
| Feature Flags | `/src/services/feature-flags/feature-flags.service.ts` | Modified |

## 🔧 Service Usage

### Labels Service

```typescript
import { LabelsService } from './services/labels/labels-service';

const labelsService = LabelsService.getInstance();

// Get all labels for team
const labels = await labelsService.getLabels({
  team_id: 'uuid',
  project_id: 'uuid' // optional
});

// Get labels for task
const taskLabels = await labelsService.getLabelsByTask({
  task_id: 'uuid'
});

// Get labels for project
const projectLabels = await labelsService.getLabelsByProject({
  project_id: 'uuid',
  team_id: 'uuid'
});

// Update color
await labelsService.updateLabelColor({
  id: 'uuid',
  team_id: 'uuid',
  color_code: '#FF0000'
});

// Update label (name and/or color)
await labelsService.updateLabel({
  id: 'uuid',
  team_id: 'uuid',
  name: 'New Name',
  color_code: '#00FF00'
});

// Delete label
await labelsService.deleteLabel({
  id: 'uuid',
  team_id: 'uuid'
});
```

### Custom Columns Service

```typescript
import { CustomColumnsService } from './services/custom-columns/custom-columns-service';

const customColumnsService = CustomColumnsService.getInstance();

// Create column (with transaction)
const column = await customColumnsService.createCustomColumn({
  project_id: 'uuid',
  name: 'Status',
  key: 'status_field',
  field_type: 'dropdown',
  width: 150,
  is_visible: true,
  configuration: {
    field_title: 'Status',
    field_type: 'dropdown',
    selections_list: [
      { selection_id: 's1', selection_name: 'Open', selection_color: '#00FF00' }
    ]
  }
});

// Get all columns
const columns = await customColumnsService.getCustomColumns({
  project_id: 'uuid'
});

// Get by ID
const column = await customColumnsService.getCustomColumnById({
  id: 'uuid'
});

// Update column (with transaction)
await customColumnsService.updateCustomColumn({
  id: 'uuid',
  name: 'Updated Status',
  field_type: 'dropdown',
  width: 200,
  is_visible: false,
  configuration: {...}
});

// Delete column
await customColumnsService.deleteCustomColumn({
  id: 'uuid'
});

// Get project columns (UI format)
const uiColumns = await customColumnsService.getProjectColumns({
  project_id: 'uuid'
});
```

## ⚙️ Feature Flags

### Environment Variables

```bash
# In .env file

# Enable Labels Prisma
USE_PRISMA_LABELS=false  # Set to true to enable

# Enable Custom Columns Prisma
USE_PRISMA_CUSTOM_COLUMNS=false  # Set to true to enable

# Master switch (overrides all)
USE_PRISMA_ALL=false  # Set to true to enable everything

# Shadow mode
SHADOW_MODE_ENABLED=false
SHADOW_COMPARE_LABELS=false
SHADOW_COMPARE_CUSTOM_COLUMNS=false
SHADOW_MODE_SAMPLE_RATE=0.01  # 1% of requests
```

### Controller Integration Example

```typescript
import { LabelsService } from '../services/labels/labels-service';
import { FeatureFlagsService } from '../services/feature-flags/feature-flags.service';

export default class LabelsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const featureFlags = FeatureFlagsService.getInstance();

    if (featureFlags.isEnabled('labels')) {
      // Use Prisma
      const labelsService = LabelsService.getInstance();
      const result = await labelsService.getLabels({
        team_id: req.user?.team_id,
        project_id: req.query.project || null
      });
      return res.status(200).send(new ServerResponse(true, result));
    }

    // Fallback to SQL (existing code)
    const q = `...`;
    const result = await db.query(q, [req.user?.team_id, req.query.project || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
```

## 🧪 Testing

### Run Tests

```bash
# All labels tests
npm test -- --testPathPattern="labels-service.contract.spec"

# All custom columns tests
npm test -- --testPathPattern="custom-columns-service.contract.spec"

# All migration tests
npm test -- --testPathPattern="labels|custom-columns"

# With coverage
npm test -- --testPathPattern="labels" --coverage
```

### Manual Testing Checklist

```bash
# Labels
✓ Create label via API
✓ Update label color
✓ Update label name
✓ Get labels for team
✓ Get labels for project
✓ Delete label
✓ Verify cascade to task_labels

# Custom Columns
✓ Create column with selections
✓ Create column with labels
✓ Update column
✓ Get all columns
✓ Get column by ID
✓ Delete column
✓ Verify transaction rollback on error
```

## 🚨 Rollback

### Immediate Rollback (Zero Downtime)

```bash
# Method 1: Environment variable
USE_PRISMA_LABELS=false
USE_PRISMA_CUSTOM_COLUMNS=false

# Method 2: Master switch
USE_PRISMA_ALL=false

# Restart is NOT required (feature flags check on every request)
# But recommended for consistency
npm run dev
```

### Verify Rollback

```bash
# Check feature flag status
curl http://localhost:3000/api/migration-status

# Should show:
# {
#   "labels": { "prisma": false, "shadow": false },
#   "custom_columns": { "prisma": false, "shadow": false }
# }
```

## 📊 Monitoring

### What to Monitor

```bash
# 1. Error logs
tail -f logs/error.log | grep -i "labels\|custom_columns"

# 2. Performance
# Check response times for:
# - GET /api/labels
# - GET /api/custom-columns
# - POST /api/custom-columns

# 3. Shadow mode discrepancies
tail -f logs/shadow-mode.log

# 4. Database connections
# Monitor Prisma connection pool usage
```

### Health Checks

```bash
# Test label operations
curl -X GET "http://localhost:3000/api/labels?team_id=UUID"

# Test custom column operations
curl -X GET "http://localhost:3000/api/custom-columns?project_id=UUID"
```

## 🐛 Troubleshooting

### Issue: Tests failing with pg-protocol error

```bash
# Check environment
cat .env.test

# Should have:
DATABASE_URL=postgresql://...

# Fix: Ensure Jest loads .env.test
# Check jest.config.js has setupFiles
```

### Issue: Prisma not being used even when flag is true

```bash
# 1. Check environment variable
echo $USE_PRISMA_LABELS

# 2. Verify feature flag service
# Add logging in controller
console.log('Prisma enabled:', featureFlags.isEnabled('labels'));

# 3. Restart server
npm run dev
```

### Issue: Transaction failing

```bash
# Check Prisma logs
DEBUG=prisma:* npm run dev

# Look for transaction errors
# Common causes:
# - Foreign key violations
# - Unique constraint violations
# - Missing required fields
```

## 📈 Success Criteria

- [ ] All 19 tests passing (100%)
- [ ] No SQL/Prisma discrepancies in shadow mode
- [ ] Response times equivalent to SQL
- [ ] Zero production errors
- [ ] Successful rollback test
- [ ] Manual testing complete

## 📞 Get Help

### Documentation
1. **Full Migration Guide**: `docs/migrations/labels-custom-fields-migration.md`
2. **Implementation Summary**: `docs/migrations/IMPLEMENTATION_SUMMARY.md`
3. **Checklist**: `docs/migrations/LABELS_CUSTOM_FIELDS_CHECKLIST.md`

### Key Contacts
- Migration lead: (Check team directory)
- Code review: (Check team directory)
- DevOps: (For deployment issues)

### Resources
- Prisma Docs: https://www.prisma.io/docs
- Project Wiki: (Internal wiki link)
- Slack Channel: #prisma-migration

## 🎯 Current Status

**Implementation**: ✅ COMPLETE
**Testing**: ⏳ PENDING (Jest env setup needed)
**Deployment**: ⏳ PENDING (After tests pass)
**Production**: ⏳ PENDING (After deployment)

**Last Updated**: 2026-01-07
