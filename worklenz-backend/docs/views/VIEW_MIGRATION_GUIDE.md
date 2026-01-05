# Database View Migration Guide

## Quick Start: Migrating a View to Prisma

This guide shows you how to migrate other database views using the **Tier 2 approach** (typed `$queryRaw` wrapper), following the pattern established in Phase 2B with `team_member_info_view`.

## When to Use This Approach

Use the Tier 2 approach when:
- ✅ View has complex joins or subqueries
- ✅ View is heavily used across the codebase
- ✅ PostgreSQL has optimized the view execution plan
- ✅ You want type safety without rewriting SQL logic
- ✅ Gradual migration is needed (high-risk changes)

**Don't use this for**:
- ❌ Simple queries (use pure Prisma)
- ❌ New features (write pure Prisma from the start)
- ❌ Views with < 10 usage locations (consider inline Prisma queries)

## Step-by-Step Migration Process

### Step 1: Analyze the View

1. **Find the view definition**
   ```bash
   grep -r "CREATE VIEW view_name" database/
   ```

2. **Count usage locations**
   ```bash
   grep -r "view_name" src/ --include="*.ts" | wc -l
   ```

3. **Understand the view's purpose**
   - What problem does it solve?
   - Why was a view created instead of queries?
   - What tables does it join?
   - What are the common query patterns?

4. **Document findings**
   Create a markdown file: `docs/views/VIEW_NAME.md`

### Step 2: Create the Service

1. **Create service file**
   ```
   src/services/views/[view-name].service.ts
   ```

2. **Define Zod schema**
   ```typescript
   import { z } from 'zod';
   import prisma from '../../config/prisma';

   // Mirror the view's output structure
   export const ViewNameSchema = z.object({
     field1: z.string(),
     field2: z.number().nullable(),
     // ... all view fields
   });

   export type ViewName = z.infer<typeof ViewNameSchema>;
   ```

3. **Create service class**
   ```typescript
   export interface IViewNameFilters {
     field1?: string;
     field2?: number;
     // Common filter fields
   }

   export class ViewNameService {
     async getViewData(filters?: IViewNameFilters): Promise<ViewName[]> {
       // Build WHERE clause
       const whereClauses: string[] = [];
       const params: any[] = [];
       let paramIndex = 1;

       if (filters?.field1) {
         whereClauses.push(`field1 = $${paramIndex}::text`);
         params.push(filters.field1);
         paramIndex++;
       }

       const whereClause = whereClauses.length > 0
         ? `WHERE ${whereClauses.join(' AND ')}`
         : '';

       // Query the view
       const query = `
         SELECT * FROM view_name
         ${whereClause}
         ORDER BY field1
       `;

       const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
       return result.map(row => ViewNameSchema.parse(row));
     }

     // Add helper methods for common operations
     async getById(id: string): Promise<ViewName | null> {
       const results = await this.getViewData({ field1: id });
       return results.length > 0 ? results[0] : null;
     }
   }

   export const viewNameService = new ViewNameService();
   ```

### Step 3: Create Contract Tests

1. **Create test file**
   ```
   src/tests/contract/views/[view-name].contract.spec.ts
   ```

2. **Test structure template**
   ```typescript
   import { expectParity } from '../../utils/contract-test';
   import db from '../../../config/db';
   import { ViewNameService } from '../../../services/views/view-name.service';

   describe('Contract Test: View Name Service', () => {
     let service: ViewNameService;
     let testData: any[] = [];

     beforeAll(async () => {
       service = new ViewNameService();
       // Create test data
     });

     afterAll(async () => {
       // Cleanup test data
     });

     describe('Basic Query Parity', () => {
       it('should match SQL behavior for basic query', async () => {
         const sqlQuery = async () => {
           const result = await db.query(
             'SELECT * FROM view_name WHERE field1 = $1',
             [testValue]
           );
           return result.rows;
         };

         const prismaQuery = async () => {
           return await service.getViewData({ field1: testValue });
         };

         await expectParity(sqlQuery, prismaQuery, {
           sortArraysBy: 'id'
         });
       });
     });

     describe('Filtering', () => {
       // Test each filter parameter
     });

     describe('Helper Methods', () => {
       // Test helper methods
     });

     describe('Edge Cases', () => {
       // Test nulls, empty results, etc.
     });

     describe('Schema Validation', () => {
       // Test Zod schema catches issues
     });

     describe('Performance', () => {
       it('should complete within reasonable time', async () => {
         const start = Date.now();
         await service.getViewData();
         const duration = Date.now() - start;
         expect(duration).toBeLessThan(500);
       });
     });
   });
   ```

### Step 4: Run Tests

```bash
npm test -- --config=jest.contract.config.js src/tests/contract/views/[view-name].contract.spec.ts
```

Fix any failing tests by:
- Adjusting Zod schema to match actual view output
- Fixing SQL type casting (add `::uuid`, `::text`, etc.)
- Handling nullable fields correctly

### Step 5: Document the Migration

Update `docs/views/VIEW_NAME.md` with:
- ✅ View definition and schema
- ✅ All usage locations (file:line)
- ✅ Migration patterns (before/after examples)
- ✅ Performance baseline
- ✅ Rollback procedure
- ✅ Future migration plans

### Step 6: Gradual Rollout (Optional)

1. **Add feature flag** (Phase 3)
2. **Migrate low-traffic endpoints** first
3. **Monitor performance and errors**
4. **Gradually migrate remaining usage sites**

## Common Patterns

### Pattern 1: Simple Lookup by ID

```typescript
async getById(id: string): Promise<ViewData | null> {
  const query = `
    SELECT * FROM view_name WHERE id = $1::uuid
  `;
  const result = await prisma.$queryRawUnsafe<any[]>(query, id);
  return result.length > 0 ? ViewNameSchema.parse(result[0]) : null;
}
```

### Pattern 2: List with Filters

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

  const query = `
    SELECT * FROM view_name
    ${whereClause}
    ORDER BY created_at DESC
  `;

  const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
  return result.map(row => ViewNameSchema.parse(row));
}
```

### Pattern 3: Existence Check

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

### Pattern 4: Count

```typescript
async count(filters: IFilters): Promise<number> {
  const whereClauses: string[] = [];
  const params: any[] = [];
  // ... build WHERE clause

  const query = `
    SELECT COUNT(*) as count
    FROM view_name
    ${whereClause}
  `;

  const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
  return parseInt(result[0]?.count || '0', 10);
}
```

### Pattern 5: Search

```typescript
async search(term: string, filters: IFilters): Promise<ViewData[]> {
  const whereClauses: string[] = [];
  const params: any[] = [term];
  let idx = 2; // $1 is reserved for search term

  whereClauses.push(`(name ILIKE $1 OR email ILIKE $1)`);

  // Add other filters...

  const query = `
    SELECT * FROM view_name
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY name
  `;

  const result = await prisma.$queryRawUnsafe<any[]>(
    query,
    `%${term}%`,
    ...params
  );
  return result.map(row => ViewNameSchema.parse(row));
}
```

## Common Issues and Solutions

### Issue 1: Type Casting Errors

**Error**: `operator does not exist: uuid = text`

**Solution**: Add explicit type casts to PostgreSQL parameters
```typescript
// Bad
WHERE user_id = $1

// Good
WHERE user_id = $1::uuid
```

### Issue 2: Nullable Field Validation

**Error**: Zod validation fails on null values

**Solution**: Mark fields as nullable in schema
```typescript
// Bad
field: z.string()

// Good
field: z.string().nullable()
```

### Issue 3: Date/Timestamp Handling

**Error**: Timestamp comparison issues

**Solution**: Use proper date handling in tests
```typescript
await expectParity(sqlQuery, prismaQuery, {
  timestampTolerance: 1000, // 1 second tolerance
  sortArraysBy: 'id'
});
```

### Issue 4: Empty Result Sets

**Error**: Zod validation fails on empty arrays

**Solution**: Handle empty results before validation
```typescript
const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
if (result.length === 0) return [];
return result.map(row => ViewNameSchema.parse(row));
```

### Issue 5: ORDER BY with NULLs

**Error**: Inconsistent sorting between SQL and service

**Solution**: Use `NULLS LAST` in ORDER BY
```typescript
ORDER BY name NULLS LAST
```

## Performance Checklist

- [ ] Query completes in < 500ms for typical data sets
- [ ] Proper indexes exist on filtered/joined columns
- [ ] Connection pooling configured (Prisma default: 10 connections)
- [ ] Consider materialized view for high-frequency queries
- [ ] Test concurrent query performance (10+ simultaneous)

## Testing Checklist

- [ ] Basic query parity with direct SQL
- [ ] All filter parameters tested
- [ ] Helper methods have tests
- [ ] Edge cases covered (nulls, empty results, invalid IDs)
- [ ] Schema validation tests
- [ ] Performance tests (< 500ms)
- [ ] Concurrent query tests
- [ ] Real-world usage pattern tests

## Documentation Checklist

- [ ] View definition documented
- [ ] Schema table with all fields
- [ ] Why view exists (problem it solves)
- [ ] All usage locations listed with file paths
- [ ] Migration patterns (before/after)
- [ ] Performance baseline
- [ ] Rollback procedure
- [ ] Future work section

## Quick Reference: File Locations

```
src/
  services/
    views/
      [view-name].service.ts          # Service implementation
  tests/
    contract/
      views/
        [view-name].contract.spec.ts  # Contract tests
docs/
  views/
    [VIEW_NAME].md                     # Documentation
database/
  sql/
    3_views.sql                        # View definitions
```

## Example: Full Implementation

See the reference implementation for `team_member_info_view`:

- **Service**: `/src/services/views/team-member-info.service.ts`
- **Tests**: `/src/tests/contract/views/team-member-info-view.contract.spec.ts`
- **Docs**: `/docs/views/TEAM_MEMBER_INFO_VIEW.md`

This implementation includes:
- 14 helper methods
- 34 passing contract tests
- Comprehensive documentation
- Performance benchmarks
- Real-world usage patterns

## Next View to Migrate

Other views in the system:
1. `task_labels_view` - Labels for tasks
2. `tasks_with_status_view` - Task status information
3. `team_member_info_mv` - Materialized view variant

Follow this guide for each migration!

## Questions?

Refer to:
- Phase 2B completion for `team_member_info_view`
- `/context/prisma-migration-agentic-workflow.md`
- `/context/prismaMigration.md`
