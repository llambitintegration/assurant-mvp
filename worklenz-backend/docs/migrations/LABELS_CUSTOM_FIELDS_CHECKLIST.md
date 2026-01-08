# Labels & Custom Fields Migration - Implementation Checklist

## Quick Reference

**Branch**: `prisma/labels-custom-fields/migration` (recommended)
**Timeline**: 3-4 days
**Risk**: LOW
**Queries**: 10 total

## Completed Tasks ✅

### Day 1-2: Service Layer & Tests
- [x] Create labels service (`src/services/labels/labels-service.ts`)
  - [x] getLabels() - 6 labels with usage stats
  - [x] getLabelsByTask() - labels for specific task
  - [x] getLabelsByProject() - labels used in project
  - [x] updateLabelColor() - update color only
  - [x] updateLabel() - update name and/or color
  - [x] deleteLabel() - delete with cascade

- [x] Create custom columns service (`src/services/custom-columns/custom-columns-service.ts`)
  - [x] createCustomColumn() - transaction-based create
  - [x] getCustomColumns() - all columns for project
  - [x] getCustomColumnById() - specific column
  - [x] updateCustomColumn() - transaction-based update
  - [x] deleteCustomColumn() - delete with cascade
  - [x] getProjectColumns() - UI formatted columns

- [x] Add feature flags
  - [x] Update FeatureFlagModule type (added 'labels', 'custom_columns')
  - [x] Update getEnabledModules() method
  - [x] Update getMigrationStatus() method

- [x] Create contract tests
  - [x] Labels service tests (11 test cases)
  - [x] Custom columns service tests (8 test cases)

## Pending Tasks ⏳

### Day 3: Test Execution & Controller Integration

#### Testing
- [ ] Fix Jest environment configuration
  - Issue: `TypeError: Cannot read properties of undefined (reading 'flush')`
  - Likely cause: Missing environment variables or pg-native setup
  - Check: `.env.test` file exists with DATABASE_URL
  - Check: Jest setup file loads environment correctly

- [ ] Run labels contract tests
  ```bash
  npm test -- --testPathPattern="labels-service.contract.spec"
  ```

- [ ] Run custom columns contract tests
  ```bash
  npm test -- --testPathPattern="custom-columns-service.contract.spec"
  ```

- [ ] Validate 95%+ pass rate (target: 19/19 passing)

#### Controller Integration

**Labels Controller** (`src/controllers/labels-controller.ts`)
- [ ] Import LabelsService and FeatureFlagsService
- [ ] Update `get()` method (line 12-34)
  ```typescript
  const featureFlags = FeatureFlagsService.getInstance();
  if (featureFlags.isEnabled('labels')) {
    const labelsService = LabelsService.getInstance();
    const result = await labelsService.getLabels({
      team_id: req.user?.team_id,
      project_id: req.query.project || null
    });
    return res.status(200).send(new ServerResponse(true, result));
  }
  // Fallback to SQL...
  ```

- [ ] Update `getByTask()` method (line 37-46)
- [ ] Update `getByProject()` method (line 49-67)
- [ ] Update `updateColor()` method (line 70-81)
  - Add color validation before service call
- [ ] Update `updateLabel()` method (line 84-112)
  - Add color validation before service call
- [ ] Update `deleteById()` method (line 115-122)

**Custom Columns Controller** (`src/controllers/custom-columns-controller.ts`)
- [ ] Import CustomColumnsService and FeatureFlagsService
- [ ] Update `create()` method (line 11-164)
  ```typescript
  const featureFlags = FeatureFlagsService.getInstance();
  if (featureFlags.isEnabled('custom_columns')) {
    const customColumnsService = CustomColumnsService.getInstance();
    const result = await customColumnsService.createCustomColumn({
      project_id: req.body.project_id,
      name: req.body.name,
      key: req.body.key,
      field_type: req.body.field_type,
      width: req.body.width,
      is_visible: req.body.is_visible,
      configuration: req.body.configuration
    });
    return res.status(200).send(new ServerResponse(true, result));
  }
  // Fallback to SQL...
  ```

- [ ] Update `get()` method (line 167-214)
- [ ] Update `getById()` method (line 217-264)
- [ ] Update `update()` method (line 267-432)
- [ ] Update `deleteById()` method (line 435-448)
- [ ] Update `getProjectColumns()` method (line 451-530)

### Day 4: Testing & Deployment

#### Manual Testing
- [ ] Test label creation
- [ ] Test label update (color, name, both)
- [ ] Test label deletion
- [ ] Test label retrieval (by team, task, project)
- [ ] Test custom column creation (with selections)
- [ ] Test custom column creation (with labels)
- [ ] Test custom column update
- [ ] Test custom column deletion
- [ ] Test custom column retrieval

#### Shadow Mode Testing (Optional)
- [ ] Enable shadow mode for labels
  ```bash
  SHADOW_MODE_ENABLED=true
  SHADOW_COMPARE_LABELS=true
  SHADOW_MODE_SAMPLE_RATE=0.01
  ```

- [ ] Enable shadow mode for custom columns
  ```bash
  SHADOW_COMPARE_CUSTOM_COLUMNS=true
  ```

- [ ] Monitor logs for discrepancies
- [ ] Adjust sample rate as needed

#### Deployment
- [ ] Create feature branch
  ```bash
  git checkout -b prisma/labels-custom-fields/migration
  ```

- [ ] Commit service layer
  ```bash
  git add src/services/labels src/services/custom-columns
  git commit -m "Add Labels & Custom Columns Prisma services"
  ```

- [ ] Commit tests
  ```bash
  git add src/tests/contract/labels src/tests/contract/custom-columns
  git commit -m "Add contract tests for Labels & Custom Columns"
  ```

- [ ] Commit feature flags
  ```bash
  git add src/services/feature-flags/feature-flags.service.ts
  git commit -m "Add feature flags for Labels & Custom Columns"
  ```

- [ ] Commit controller updates
  ```bash
  git add src/controllers/labels-controller.ts src/controllers/custom-columns-controller.ts
  git commit -m "Integrate Prisma services into Labels & Custom Columns controllers"
  ```

- [ ] Deploy with feature flags OFF
  ```bash
  USE_PRISMA_LABELS=false
  USE_PRISMA_CUSTOM_COLUMNS=false
  ```

#### Gradual Rollout
- [ ] Day 1: Shadow mode at 1% traffic
- [ ] Day 2: Shadow mode at 10% traffic (if no issues)
- [ ] Day 3: Enable Prisma for labels at 10%
  ```bash
  USE_PRISMA_LABELS=true
  ```
- [ ] Day 4: Enable Prisma for custom columns at 10%
  ```bash
  USE_PRISMA_CUSTOM_COLUMNS=true
  ```
- [ ] Day 5: Increase to 50% (if no issues)
- [ ] Day 6: Increase to 100%

#### Monitoring
- [ ] Check error logs daily
- [ ] Monitor response times
- [ ] Check for data discrepancies
- [ ] Verify cascade deletions work correctly
- [ ] Verify transactions complete successfully

### Day 5+: Cleanup

- [ ] Remove SQL code from controllers (after 1 week of successful Prisma operation)
- [ ] Remove feature flag checks (after 2 weeks)
- [ ] Update API documentation
- [ ] Archive migration documents
- [ ] Close migration ticket

## Quick Commands

### Run All Tests
```bash
npm test -- --testPathPattern="labels|custom-columns"
```

### Run Specific Test Suite
```bash
npm test -- --testPathPattern="labels-service.contract.spec"
npm test -- --testPathPattern="custom-columns-service.contract.spec"
```

### Enable Feature Flags
```bash
# In .env file
USE_PRISMA_LABELS=true
USE_PRISMA_CUSTOM_COLUMNS=true

# Or master switch
USE_PRISMA_ALL=true
```

### Rollback
```bash
# In .env file
USE_PRISMA_LABELS=false
USE_PRISMA_CUSTOM_COLUMNS=false

# Restart server
npm run dev
```

## Validation Checklist

Before marking complete:
- [ ] All 19 contract tests passing (11 labels + 8 custom columns)
- [ ] Manual testing completed for all operations
- [ ] No SQL/Prisma discrepancies in shadow mode
- [ ] Performance metrics acceptable
- [ ] Error handling tested
- [ ] Rollback procedure verified

## Notes

- **Test Environment Issue**: Jest currently failing with pg-protocol error. Needs environment setup fix before tests can run.
- **Transaction Complexity**: Custom columns service uses complex transactions. Extra testing recommended.
- **Color Validation**: Labels controller validates colors against `WorklenzColorShades`. Keep this validation in controller.
- **Alpha Transparency**: `getLabelsByProject()` adds `TASK_PRIORITY_COLOR_ALPHA` to colors. This is preserved in Prisma implementation.

## Support

If issues arise:
1. Check feature flag status: `GET /api/migration-status`
2. Review logs for SQL/Prisma comparisons
3. Use rollback procedure immediately if critical
4. Consult migration documentation in `/docs/migrations/`

## Success Criteria

✅ All 10 queries migrated to Prisma
✅ 95%+ test pass rate (19/19 tests)
✅ Zero production incidents
✅ No breaking changes to API
✅ Feature flag rollback capability
