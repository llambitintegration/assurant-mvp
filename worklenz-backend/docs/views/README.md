# Database Views Documentation

This directory contains documentation for migrating database views from raw SQL to Prisma-based service layers using the Tier 2 approach (typed `$queryRaw` wrapper).

## Overview

The Worklenz backend uses several database views to encapsulate complex queries and provide unified interfaces for common data access patterns. As part of the Prisma migration (Phase 2B+), we are systematically migrating these views to type-safe service layers.

## Migration Approach: Tier 2

We use the **Tier 2 approach** for view migrations:

- ✅ Keep the existing view query
- ✅ Wrap in Prisma's `$queryRaw`
- ✅ Add TypeScript types via Zod schemas
- ✅ Create service layer abstraction
- ✅ Add comprehensive contract tests
- ✅ Maintain behavioral parity

**Why Tier 2?**
- Complex SQL logic preserved
- PostgreSQL optimizations retained
- Type safety and validation added
- Gradual migration supported
- Lower risk than full rewrite

## Views in the System

### 1. team_member_info_view ✅ COMPLETE

**Status**: ✅ Migrated (Phase 2B)
**Service**: `/src/services/views/team-member-info.service.ts`
**Tests**: `/src/tests/contract/views/team-member-info-view.contract.spec.ts`
**Docs**: [TEAM_MEMBER_INFO_VIEW.md](./TEAM_MEMBER_INFO_VIEW.md)

**Summary**:
- 118 occurrences across 24 files
- 14 service methods implemented
- 34 contract tests (100% passing)
- Combines team_members, users, and email_invitations
- Handles pending invitations via COALESCE logic

**Usage**: Team member information display throughout the application

---

### 2. task_labels_view 🔄 PENDING

**Status**: 🔄 Not yet migrated
**Definition**: See `database/sql/3_views.sql`

**Purpose**: Provides task label information by joining task_labels and team_labels

**Estimated Complexity**: Low (simple JOIN)
**Usage Count**: ~20-30 occurrences (estimate)
**Recommended Approach**: Tier 2 or Tier 1 (pure Prisma)

---

### 3. tasks_with_status_view 🔄 PENDING

**Status**: 🔄 Not yet migrated
**Definition**: See `database/sql/3_views.sql`

**Purpose**: Provides task status categories (is_todo, is_doing, is_done) by joining tasks, task_statuses, and sys_task_status_categories

**Estimated Complexity**: Medium (multiple JOINs)
**Usage Count**: ~50-100 occurrences (estimate)
**Recommended Approach**: Tier 2

---

### 4. team_member_info_mv (Materialized View) 🔄 PENDING

**Status**: 🔄 Not yet migrated
**Type**: Materialized view (performance optimization)

**Purpose**: Pre-calculated version of team_member_info_view for high-traffic queries

**Refresh Function**: `refresh_team_member_info_mv()`

**Usage**: Analytics, reporting, dashboard aggregations

**Recommended Approach**: Tier 2 with refresh strategy

---

## Migration Status Dashboard

| View | Status | Tests | Docs | Service Methods | Priority |
|------|--------|-------|------|-----------------|----------|
| team_member_info_view | ✅ Complete | 34 ✅ | ✅ | 14 | P0 |
| task_labels_view | 🔄 Pending | - | - | - | P1 |
| tasks_with_status_view | 🔄 Pending | - | - | - | P1 |
| team_member_info_mv | 🔄 Pending | - | - | - | P2 |

**Legend**:
- ✅ Complete and tested
- 🔄 Pending migration
- 🚧 In progress
- ⚠️ Blocked

## Quick Start: Migrating a View

Follow the comprehensive guide: [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md)

**Quick Steps**:
1. Analyze the view (definition, usage, complexity)
2. Create service with Zod schema
3. Write contract tests (30+ tests recommended)
4. Document the migration
5. Run tests (target: 100% passing)
6. Update this README

## Testing Requirements

Each view migration must include:

- ✅ **Basic query parity tests** (SQL vs service)
- ✅ **Filtering tests** (all filter parameters)
- ✅ **Helper method tests** (all public methods)
- ✅ **Edge case tests** (nulls, empty results, etc.)
- ✅ **Schema validation tests** (Zod catches issues)
- ✅ **Performance tests** (< 500ms target)
- ✅ **Real-world pattern tests** (common usage)

**Target**: 30+ tests, 100% passing, > 90% coverage

## Performance Standards

All view queries must meet these targets:

| Query Type | Target (p95) | Acceptable (p99) |
|-----------|--------------|------------------|
| Simple lookup | < 100ms | < 200ms |
| Filtered query | < 200ms | < 300ms |
| Search query | < 300ms | < 500ms |
| Aggregation | < 500ms | < 1000ms |
| Concurrent (10x) | < 1000ms | < 2000ms |

**Monitoring**: Performance benchmarks included in all contract tests

## Documentation Standards

Each view migration must include:

### 1. View-Specific Documentation (e.g., TEAM_MEMBER_INFO_VIEW.md)

Required sections:
- Overview and view definition
- Schema table with field descriptions
- Why the view exists (problem it solves)
- All usage locations (file:line)
- Service implementation summary
- Migration patterns (before/after)
- Performance baseline
- Rollback procedure
- FAQs

**Target**: 3,000+ words, comprehensive

### 2. Code Documentation

- JSDoc comments on all service methods
- Usage examples in comments
- Parameter descriptions
- Return type documentation
- Edge case notes

### 3. Test Documentation

- Clear test descriptions
- Setup/teardown comments
- Assertion explanations

## Common Patterns

### Pattern 1: Existence Check

```typescript
async exists(id: string): Promise<boolean> {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM view_name WHERE id = $1::uuid
    ) AS exists
  `;
  const result = await prisma.$queryRawUnsafe<any[]>(query, id);
  return result[0]?.exists || false;
}
```

### Pattern 2: Filtered List

```typescript
async getList(filters: IFilters): Promise<ViewData[]> {
  const whereClauses: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.field1) {
    whereClauses.push(`field1 = $${idx}::text`);
    params.push(filters.field1);
    idx++;
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const query = `SELECT * FROM view_name ${whereClause} ORDER BY created_at DESC`;
  const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
  return result.map(row => ViewNameSchema.parse(row));
}
```

### Pattern 3: Search

```typescript
async search(term: string): Promise<ViewData[]> {
  const query = `
    SELECT * FROM view_name
    WHERE name ILIKE $1 OR description ILIKE $1
    ORDER BY name
  `;
  const result = await prisma.$queryRawUnsafe<any[]>(query, `%${term}%`);
  return result.map(row => ViewNameSchema.parse(row));
}
```

See [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md) for more patterns.

## Troubleshooting

### Common Issues

1. **Type casting errors**: Add `::uuid`, `::text`, etc. to SQL parameters
2. **Null handling**: Use `.nullable()` in Zod schemas
3. **Empty results**: Handle `[]` before schema validation
4. **Date comparisons**: Use `timestampTolerance` in tests
5. **Sorting with nulls**: Use `ORDER BY field NULLS LAST`

See [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md) for detailed solutions.

## Resources

- **Migration Guide**: [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md)
- **Reference Implementation**: [TEAM_MEMBER_INFO_VIEW.md](./TEAM_MEMBER_INFO_VIEW.md)
- **Service Template**: `/src/services/views/team-member-info.service.ts`
- **Test Template**: `/src/tests/contract/views/team-member-info-view.contract.spec.ts`
- **Phase 2 Report**: `/PHASE-2-COMPLETION-REPORT.md`

## Next View to Migrate

**Recommended**: `task_labels_view`

**Rationale**:
- Simpler than team_member_info_view (good learning opportunity)
- Lower usage count (lower risk)
- Single JOIN (straightforward Tier 2 implementation)
- Can validate migration process before tackling tasks_with_status_view

**Estimated Effort**: 2-4 hours

**Steps**:
1. Follow [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md)
2. Use team_member_info_view as reference
3. Create 20-30 contract tests
4. Document thoroughly
5. Update this README

## Questions?

- See [VIEW_MIGRATION_GUIDE.md](./VIEW_MIGRATION_GUIDE.md) for detailed guidance
- Check [TEAM_MEMBER_INFO_VIEW.md](./TEAM_MEMBER_INFO_VIEW.md) for reference implementation
- Review `/PHASE-2-COMPLETION-REPORT.md` for migration context

---

**Last Updated**: 2026-01-05
**Phase**: Phase 2B Complete
**Migrations Completed**: 1 of 4 views
**Next Priority**: task_labels_view (P1)
