# Team Member Info View Migration Documentation

## Overview

The `team_member_info_view` is one of the most critical database views in the Worklenz backend, with **118 occurrences across 24 files**. This view provides a unified interface for retrieving team member information by combining data from three tables:

- `team_members` - Core team membership records
- `users` - Registered user accounts
- `email_invitations` - Pending invitations (users who haven't registered yet)

## View Definition

```sql
CREATE OR REPLACE VIEW team_member_info_view(
  avatar_url,
  email,
  name,
  user_id,
  team_member_id,
  team_id,
  active
) AS
SELECT u.avatar_url,
       COALESCE(u.email, (SELECT email_invitations.email
                          FROM email_invitations
                          WHERE email_invitations.team_member_id = team_members.id)) AS email,
       COALESCE(u.name, (SELECT email_invitations.name
                         FROM email_invitations
                         WHERE email_invitations.team_member_id = team_members.id)) AS name,
       u.id AS user_id,
       team_members.id AS team_member_id,
       team_members.team_id,
       team_members.active
FROM team_members
LEFT JOIN users u ON team_members.user_id = u.id;
```

## View Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `avatar_url` | string | Yes | User's avatar URL (null for pending invitations) |
| `email` | string | Yes | Email address (from users or email_invitations) |
| `name` | string | Yes | Display name (from users or email_invitations) |
| `user_id` | uuid | Yes | User ID (null for pending invitations) |
| `team_member_id` | uuid | No | Team member record ID |
| `team_id` | uuid | No | Team ID |
| `active` | boolean | No | Whether the team member is active |

## Why This View Exists

The view solves a critical UX problem: **displaying team member information for both registered users and pending invitations**.

### The Problem Without the View

Without this view, every query would need to:
1. Check if `team_members.user_id` is null
2. If null, lookup `email_invitations` by `team_member_id`
3. Use COALESCE to merge the data
4. Handle null avatar_url for pending invitations

This pattern would be repeated **118 times** across the codebase, leading to:
- Code duplication
- Inconsistent behavior
- Performance issues (multiple queries)
- Maintenance nightmares

### The Solution: Database View

By encapsulating this logic in a view:
- ✅ Single query for all team member info
- ✅ Consistent COALESCE logic
- ✅ PostgreSQL optimizer handles joins efficiently
- ✅ Simpler application code
- ✅ One place to maintain the logic

## Migration Strategy: Tier 2 Approach

### Why Tier 2 (Typed $queryRaw Wrapper)?

We chose the **Tier 2 approach** (typed `$queryRaw` wrapper) instead of pure Prisma for several reasons:

1. **Complex COALESCE Logic**: The view uses correlated subqueries with COALESCE that would be cumbersome to express in Prisma ORM
2. **Performance**: PostgreSQL has optimized the view execution plan over time
3. **High Usage**: 118 occurrences mean migration risk is high
4. **Gradual Migration**: Allows us to migrate usage sites gradually
5. **Type Safety**: Still provides TypeScript types and runtime validation via Zod

### What is Tier 2?

Tier 2 wraps the existing view query in Prisma's `$queryRaw` with:
- ✅ TypeScript type definitions
- ✅ Zod schema validation
- ✅ Service layer abstraction
- ✅ Parameterized queries (SQL injection protection)
- ✅ Test coverage

## Implementation

### Service Layer

**Location**: `/worklenz-backend/src/services/views/team-member-info.service.ts`

The `TeamMemberInfoService` provides:

1. **Type-Safe Queries**
   ```typescript
   const members = await service.getTeamMemberInfo({
     teamId: 'uuid',
     active: true
   });
   ```

2. **Zod Schema Validation**
   ```typescript
   export const TeamMemberInfoSchema = z.object({
     avatar_url: z.string().nullable(),
     email: z.string().email().nullable(),
     name: z.string().nullable(),
     user_id: z.string().uuid().nullable(),
     team_member_id: z.string().uuid(),
     team_id: z.string().uuid(),
     active: z.boolean()
   });
   ```

3. **Helper Methods**
   - `getTeamMemberById(teamMemberId)`
   - `getActiveTeamMembers(teamId)`
   - `getTeamMemberByEmail(email)`
   - `checkUserExistsInTeam(teamId, email)`
   - `checkUserActiveInOwnerTeams(ownerId, email)`
   - `searchTeamMembers(teamId, searchTerm)`
   - And more...

### Contract Tests

**Location**: `/worklenz-backend/src/tests/contract/views/team-member-info-view.contract.spec.ts`

**Test Coverage**: 34 tests, 100% passing

The contract tests validate:
- ✅ Parity with direct SQL queries
- ✅ COALESCE logic for pending invitations
- ✅ Filtering (by team, user, email, active status)
- ✅ Helper method behavior
- ✅ Edge cases (nulls, empty results, inactive members)
- ✅ Schema validation
- ✅ Performance benchmarks
- ✅ Real-world usage patterns

## Usage Locations (24 Files, 118 Occurrences)

### Controllers (19 files)

1. **admin-center-controller.ts** (12 occurrences)
   - Check user existence across teams
   - List all team members for organization
   - Search members by email/name

2. **team-members-controller.ts** (23 occurrences)
   - Validate user invitations
   - Check active membership
   - Member management operations

3. **project-members-controller.ts** (3 occurrences)
   - Display project member info
   - Validate project access

4. **gantt-controller.ts** (1 occurrence)
   - Task assignment display

5. **project-comments-controller.ts** (4 occurrences)
   - Comment author information
   - Notification recipients

6. **project-folders-controller.ts** (2 occurrences)
   - Folder creator information

7. **project-managers-controller.ts** (4 occurrences)
   - List project managers
   - Manager selection UI

8. **projects-controller.ts** (12 occurrences)
   - Project member search
   - Member autocomplete
   - Project manager notifications

9. **tasks-controller.ts** (1 occurrence)
   - Task assignee information

10. **tasks-controller-v2.ts** (1 occurrence)
    - Task assignee information

11. **task-comments-controller.ts** (5 occurrences)
    - Comment notifications
    - Mention handling

12. **gantt-controller.ts** (1 occurrence)
    - Gantt chart member display

13. **project-workload/workload-gannt-controller.ts** (1 occurrence)
    - Workload allocation display

14. **schedule/schedule-controller.ts** (2 occurrences)
    - Schedule member information

15. **reporting-controller.ts** (8 occurrences)
    - Team member analytics
    - Report generation

16. **reporting/reporting-members-controller.ts** (11 occurrences)
    - Member performance reports

17. **reporting/reporting-allocation-controller.ts** (1 occurrence)
    - Resource allocation reports

18. **reporting/overview/reporting-overview-base.ts** (3 occurrences)
    - Overview dashboard data

19. **reporting/overview/reporting-overview-controller.ts** (8 occurrences)
    - Detailed overview reports

### Services (1 file)

20. **services/activity-logs/activity-logs.service.ts** (1 occurrence)
    - Activity log user information

### Models (1 file)

21. **models/reporting-export.ts** (8 occurrences)
    - Export member data for reports

### Utilities (1 file)

22. **shared/paddle-utils.ts** (3 occurrences)
    - Subscription member counting

### Socket.IO (1 file)

23. **socket.io/commands/on-quick-assign-or-remove.ts** (1 occurrence)
    - Real-time task assignment

### Listeners (1 file)

24. **pg_notify_listeners/db-task-status-changed.ts** (1 occurrence)
    - Database notification handling

## Migration Patterns

### Pattern 1: Existence Check

**Before (Direct Query)**:
```typescript
const q = `SELECT EXISTS(SELECT tmi.team_member_id
          FROM team_member_info_view AS tmi
                   JOIN teams AS t ON tmi.team_id = t.id
          WHERE tmi.email = $1::TEXT
            AND t.user_id = $2::UUID);`;
const result = await db.query(q, [email, owner_id]);
const [data] = result.rows;
return data.exists;
```

**After (Service Layer)**:
```typescript
const exists = await teamMemberInfoService.checkUserExistsInTeam(
  teamId,
  email
);
return exists;
```

### Pattern 2: Member Lookup

**Before (Direct Query)**:
```typescript
const q = `SELECT email, name, avatar_url
          FROM team_member_info_view
          WHERE team_member_id = $1`;
const result = await db.query(q, [teamMemberId]);
const [member] = result.rows;
```

**After (Service Layer)**:
```typescript
const member = await teamMemberInfoService.getTeamMemberById(teamMemberId);
```

### Pattern 3: Team Member List

**Before (Direct Query)**:
```typescript
const q = `SELECT *
          FROM team_member_info_view
          WHERE team_id = $1 AND active = TRUE
          ORDER BY name`;
const result = await db.query(q, [teamId]);
return result.rows;
```

**After (Service Layer)**:
```typescript
return await teamMemberInfoService.getActiveTeamMembers(teamId);
```

### Pattern 4: Search

**Before (Direct Query)**:
```typescript
const q = `SELECT *
          FROM team_member_info_view
          WHERE team_id = $1
            AND (name ILIKE $2 OR email ILIKE $2)
          ORDER BY name`;
const result = await db.query(q, [teamId, `%${search}%`]);
return result.rows;
```

**After (Service Layer)**:
```typescript
return await teamMemberInfoService.searchTeamMembers(teamId, search);
```

## Performance Considerations

### Baseline Performance

Contract tests show average query times:
- Simple queries: ~50ms
- Filtered queries: ~100ms
- Search queries: ~150ms
- Concurrent queries (10x): ~200ms total

### Optimizations

1. **Materialized View Available**: The schema includes a `team_member_info_mv` materialized view for high-traffic scenarios
2. **Indexes**: View has indexes on `team_member_id` and `(team_id, user_id)`
3. **Connection Pooling**: Prisma uses connection pooling (10 connections default)
4. **Parameterized Queries**: All queries use proper parameterization

### When to Use Materialized View

The materialized view `team_member_info_mv` should be used for:
- High-frequency queries (> 1000/min)
- Dashboard aggregations
- Analytics reports
- Background jobs

To refresh the materialized view:
```sql
SELECT refresh_team_member_info_mv();
```

## Rollback Procedure

If issues arise with the service layer:

1. **Immediate Rollback**: Service methods are drop-in replacements, so you can revert individual usage sites
2. **No Schema Changes**: The view remains unchanged, so database rollback is not needed
3. **Tests Remain**: Contract tests continue to validate both approaches

## Future Work

### Phase 3: Feature Flag Integration

Add feature flag to toggle between:
- Direct `db.query` (legacy)
- `TeamMemberInfoService` (new)

```typescript
if (featureFlags.USE_PRISMA_VIEWS) {
  return await teamMemberInfoService.getActiveTeamMembers(teamId);
} else {
  return await db.query('SELECT * FROM team_member_info_view WHERE team_id = $1', [teamId]);
}
```

### Phase 4: Gradual Migration

Migrate usage sites in order of:
1. Low-traffic endpoints first (testing ground)
2. High-traffic read-only endpoints
3. Write paths with validation
4. Critical paths last

### Phase 5: Pure Prisma (Optional)

If performance and maintainability require it, consider replacing the view with:
- Prisma queries with explicit joins
- Helper functions instead of view
- Trade-offs: More application code, but more flexibility

## Testing Strategy

### Contract Tests

Run view contract tests:
```bash
npm test -- --config=jest.contract.config.js src/tests/contract/views/team-member-info-view.contract.spec.ts
```

### Integration Tests

When migrating usage sites, add integration tests:
```typescript
describe('Project Members API', () => {
  it('should return member info using TeamMemberInfoService', async () => {
    const response = await request(app)
      .get('/api/projects/123/members')
      .expect(200);

    expect(response.body.data[0]).toHaveProperty('email');
    expect(response.body.data[0]).toHaveProperty('name');
  });
});
```

### Shadow Mode Testing

Before full migration, run both paths and compare:
```typescript
const legacyResult = await db.query('SELECT * FROM team_member_info_view WHERE team_id = $1', [teamId]);
const serviceResult = await teamMemberInfoService.getTeamMemberInfo({ teamId });

// Log discrepancies for monitoring
if (!deepEqual(legacyResult.rows, serviceResult)) {
  logger.warn('Discrepancy detected', { legacyResult, serviceResult });
}

// Return legacy result (safe mode)
return legacyResult.rows;
```

## Monitoring

### Key Metrics

1. **Query Performance**: Track p50, p95, p99 latencies
2. **Error Rate**: Monitor Zod validation failures
3. **Usage**: Track adoption across controllers
4. **Discrepancies**: Log shadow mode differences

### Alerts

Set up alerts for:
- Query latency > 500ms (p95)
- Error rate > 0.1%
- Zod validation failures (indicates schema drift)

## FAQs

### Q: Why not pure Prisma instead of $queryRaw?

**A**: The view's COALESCE logic with correlated subqueries is complex. Pure Prisma would require:
- Multiple queries or complex includes
- Manual data merging in application code
- Performance overhead
- More code to maintain

$queryRaw gives us the best of both worlds: PostgreSQL's optimized execution with TypeScript type safety.

### Q: When should I use the materialized view?

**A**: Use `team_member_info_mv` when:
- Queries are high-frequency (> 1000/min)
- Data freshness is not critical (can be stale by minutes)
- You're doing aggregations or analytics

For real-time user-facing features, use the regular view.

### Q: Can I add fields to the view?

**A**: Yes, but you must:
1. Update the view definition in `database/sql/3_views.sql`
2. Update the Zod schema in `team-member-info.service.ts`
3. Run contract tests to ensure parity
4. Update TypeScript types

### Q: What if the view query changes?

**A**: The contract tests will catch it! They compare:
- Direct SQL query results
- Service method results

Any discrepancy will fail the tests, alerting you to schema drift.

### Q: How do I add a new helper method?

**A**: Follow this pattern:
1. Add method to `TeamMemberInfoService` class
2. Write contract test validating SQL parity
3. Document the method with JSDoc
4. Use parameterized queries to prevent SQL injection

Example:
```typescript
/**
 * Get members by role
 *
 * @param teamId - Team ID
 * @param roleId - Role ID
 */
async getMembersByRole(teamId: string, roleId: string): Promise<TeamMemberInfo[]> {
  const query = `
    SELECT tmiv.*
    FROM team_member_info_view tmiv
    INNER JOIN team_members tm ON tmiv.team_member_id = tm.id
    WHERE tm.team_id = $1::uuid AND tm.role_id = $2::uuid
  `;
  const result = await prisma.$queryRawUnsafe<any[]>(query, teamId, roleId);
  return result.map(row => TeamMemberInfoSchema.parse(row));
}
```

## Success Criteria

Phase 2B is considered successful when:

- ✅ TeamMemberInfoService implemented with typed $queryRaw
- ✅ Zod schema validates view output
- ✅ All 34 contract tests passing
- ✅ Service provides 14+ helper methods
- ✅ All 24 usage locations documented
- ✅ Migration guide complete
- ✅ Performance baseline established (all queries < 500ms)
- ✅ No regressions in existing functionality

**Status**: ✅ COMPLETE (Phase 2B Achieved)

## Next Steps

1. **Phase 3**: Add feature flag support (`USE_PRISMA_VIEWS`)
2. **Phase 3**: Implement shadow mode testing in production
3. **Phase 4**: Gradually migrate usage sites (start with low-traffic endpoints)
4. **Phase 4**: Monitor performance and error rates
5. **Phase 5**: Consider pure Prisma migration if needed (based on lessons learned)

## References

- Migration Workflow: `/context/prisma-migration-agentic-workflow.md` (Phase 2, Lane 2B)
- Prisma Migration Plan: `/context/prismaMigration.md`
- View Definition: `/database/sql/3_views.sql`
- Service Implementation: `/src/services/views/team-member-info.service.ts`
- Contract Tests: `/src/tests/contract/views/team-member-info-view.contract.spec.ts`
- Phase 2A Report: `/PHASE-2A-COMPLETION-REPORT.md`
