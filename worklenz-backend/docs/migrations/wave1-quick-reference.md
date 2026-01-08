# Wave 1 Migration - Quick Reference Guide

## Feature Flag Control

### Enable New Implementation
```bash
# .env file
USE_PRISMA_TEAMS=true
```

### Disable (Rollback)
```bash
# .env file
USE_PRISMA_TEAMS=false
```

## Testing the Migration

### 1. Test Individual Endpoints

#### Email Notifications (db-task-status-changed.ts)
```bash
# Trigger by completing a task that has subscribers
# Check email notifications contain correct member names
```

#### Quick Assign/Remove (on-quick-assign-or-remove.ts)
```bash
# Test via WebSocket
# Endpoint: Socket.IO event "quick_assign_or_remove"
# Check assignee lookup by user_id and team_id
```

#### Gantt Workload (gantt-controller.ts)
```bash
GET /api/gantt/workload?project_id={projectId}
# Check member names, avatars, and task lists
```

#### Task Assignees (tasks-controller.ts)
```bash
GET /api/tasks/project/{projectId}/assignees
# Verify assignee list with metadata
```

#### Task Assignment Check (tasks-controller-v2.ts)
```bash
# Internal method: checkUserAssignedToTask()
# Used by various task update operations
```

#### Project Folders (project-folders-controller.ts)
```bash
GET /api/project-folders?parent={folderId}
# Check created_by names are populated
```

#### Schedule (schedule-controller.ts)
```bash
GET /api/schedule/{teamId}/projects?timeZone=UTC
# Verify project member allocations and names
```

#### Workload Gantt (workload-gannt-controller.ts)
```bash
GET /api/workload/{projectId}/members?timeZone=UTC
# Check member workload data and names
```

### 2. Shadow Mode Testing (Optional)

Shadow mode runs both SQL and Prisma queries and compares results:

```bash
# .env file
USE_PRISMA_TEAMS=false
SHADOW_MODE_ENABLED=true
SHADOW_COMPARE_TEAMS=true
SHADOW_MODE_SAMPLE_RATE=1.0  # 100% of requests
```

Check logs for discrepancies:
```bash
tail -f logs/shadow-mode.log | grep "MISMATCH"
```

### 3. Performance Testing

Compare response times:

```bash
# With legacy SQL
USE_PRISMA_TEAMS=false npm run dev
# Test endpoints, measure response times

# With new service
USE_PRISMA_TEAMS=true npm run dev
# Test same endpoints, compare
```

Expected performance:
- Simple lookups: < 50ms overhead
- Iterative enrichment: 10-30ms per member
- Complex queries: Similar to SQL

## Monitoring

### Key Metrics to Watch

1. **Response Times**
   - Baseline: Legacy SQL response times
   - Target: < 20% increase acceptable for Wave 1

2. **Error Rates**
   - Should remain at 0% for successful rollout
   - Any increase = immediate rollback

3. **Database Queries**
   - Watch for N+1 query patterns
   - Monitor connection pool usage

### Logging

Key log messages to watch for:

```typescript
// Feature flag checks
"[TeamMemberInfoService] Feature flag enabled"
"[TeamMemberInfoService] Using legacy SQL path"

// Service calls
"[TeamMemberInfoService] getTeamMemberById: {id}"
"[TeamMemberInfoService] getTeamMemberByTeamAndUser: {teamId}, {userId}"
```

## Rollback Procedure

### Immediate Rollback

1. Set environment variable:
```bash
USE_PRISMA_TEAMS=false
```

2. Restart application:
```bash
npm run dev
# or
pm2 restart worklenz-backend
```

3. Verify:
```bash
# Test critical endpoints
curl http://localhost:3000/api/tasks/project/{projectId}/assignees
```

4. Check logs:
```bash
tail -f logs/application.log | grep "ERROR"
```

### Rollback Verification Checklist

- [ ] All endpoints return 200 OK
- [ ] No new errors in logs
- [ ] Response times back to baseline
- [ ] Team member data displays correctly
- [ ] Email notifications work

## Common Issues & Solutions

### Issue 1: Missing team_member_id
**Symptom:** `Cannot read property 'team_member_id' of null`

**Solution:**
```typescript
// Check if memberInfo exists before using
if (memberInfo && memberInfo.team_member_id) {
  // Use memberInfo
}
```

### Issue 2: Slow response times
**Symptom:** Response times > 2x baseline

**Cause:** N+1 queries in iterative enrichment

**Solution:**
1. Acceptable for Wave 1 (low traffic)
2. Consider batch queries for Wave 2
3. Add caching if persistent

### Issue 3: Feature flag not working
**Symptom:** Still using old SQL despite flag=true

**Solution:**
```bash
# Check .env file
cat .env | grep USE_PRISMA_TEAMS

# Verify service is reading flag
# Check logs for feature flag status
```

## Migration Patterns Reference

### Pattern 1: Simple Lookup
```typescript
const memberInfo = await teamMemberInfoService.getTeamMemberByTeamAndUser(teamId, userId);
```
**Use case:** Direct team_member_id lookup

### Pattern 2: Iterative Enrichment
```typescript
for (const member of members) {
  const info = await teamMemberInfoService.getTeamMemberById(member.team_member_id);
  Object.assign(member, info);
}
```
**Use case:** Enriching query results with member data

### Pattern 3: Post-Query Enrichment
```typescript
const results = await complexQuery();
if (featureFlags.isEnabled('teams')) {
  for (const result of results.rows) {
    const info = await teamMemberInfoService.getTeamMemberById(result.team_member_id);
    result.name = info?.name;
    result.avatar_url = info?.avatar_url;
  }
}
```
**Use case:** Complex queries that are hard to migrate fully

## Service Methods Available

### getTeamMemberById(teamMemberId)
Returns: `TeamMemberInfo | null`
```typescript
{
  avatar_url: string | null,
  email: string | null,
  name: string | null,
  user_id: string | null,
  team_member_id: string,
  team_id: string,
  active: boolean
}
```

### getTeamMemberByTeamAndUser(teamId, userId)
Returns: `TeamMemberInfo | null`

### getActiveTeamMembers(teamId)
Returns: `TeamMemberInfo[]`

### checkUserExistsInTeam(teamId, email)
Returns: `boolean`

### Full list
See: `worklenz-backend/src/services/views/team-member-info.service.ts`

## Support & Troubleshooting

### Get Migration Status
```typescript
const featureFlags = getFeatureFlags();
console.log('Teams flag:', featureFlags.isEnabled('teams'));
console.log('All status:', featureFlags.getMigrationStatus());
```

### Enable Debug Logging
```bash
# .env file
LOG_LEVEL=debug
```

### Contact
- Migration issues: Check `docs/migrations/wave1-team-member-info-view-migration-summary.md`
- Service issues: Check `src/services/views/team-member-info.service.ts`
- Feature flags: Check `src/services/feature-flags/feature-flags.service.ts`

## Next Steps

After successful Wave 1 validation:

1. ✅ Monitor for 24-48 hours
2. ✅ Collect performance metrics
3. ✅ Gather user feedback
4. ⏭️ Proceed to Wave 2 (medium-traffic endpoints)
5. ⏭️ Plan Wave 3 (high-traffic endpoints)

## Wave 2 Preview

Next endpoints to migrate:
- team-controller.ts (multiple high-traffic endpoints)
- projects-controller.ts (project member management)
- Additional schedule/workload methods
- Reports and analytics endpoints

Expected timeline: 1-2 weeks after Wave 1 validation
