# Wave 3: High-Risk Migration - Execution Plan

**Created:** 2026-01-07
**Migration Wave:** Wave 3 - High-Risk Files & Critical Endpoints
**Status:** 📋 PLANNED - Ready for Execution
**Risk Level:** HIGH-CRITICAL (highest traffic, billing-critical, core workflows)

---

## Executive Summary

Wave 3 represents the most critical phase of the Prisma migration, targeting:
1. **Track 1**: Projects Controller Integration (24 db.query calls, high traffic)
2. **Track 2**: View Migration - High-Traffic Endpoints (50+ occurrences across 4 critical files)

### Prerequisites (✅ COMPLETE)
- ✅ Wave 1: Low-risk view migrations (8 files)
- ✅ Wave 2: Medium-risk view migrations (6 files)
- ✅ Auth Controller: Feature flags + 40 contract tests
- ✅ Teams Controller: Feature flags + 53 contract tests
- ✅ ProjectsService: 30+ methods implemented (3044 lines)
- ✅ TeamMemberInfoService: 14 helper methods with 34 contract tests
- ✅ Feature Flags Infrastructure: USE_PRISMA_AUTH, USE_PRISMA_TEAMS ready

### Success Criteria
- [ ] Projects Controller: All 24 db.query calls wrapped with USE_PRISMA_PROJECTS flag
- [ ] View Migration: 50+ occurrences across 4 high-risk files migrated
- [ ] Test Coverage: 80+ new contract tests passing
- [ ] Zero N+1 patterns in high-traffic endpoints (use batch operations)
- [ ] Performance: No degradation vs SQL baseline (< 5% latency increase acceptable)
- [ ] Rollback Validated: Feature flags work instantly
- [ ] Staged Rollout Plan: 1% → 10% → 50% → 100%

---

## Track 1: Projects Controller Integration

### Current State Analysis

**File:** `/worklenz-backend/src/controllers/projects-controller.ts`
**Total db.query calls:** 24
**Service Status:** ProjectsService has 30+ methods already implemented (3044 lines!)
**Feature Flag Status:** ❌ NOT YET INTEGRATED - No USE_PRISMA_PROJECTS flags in controller
**Test Status:** ✅ Contract tests exist for Wave 2 (read ops) and Wave 3 (write ops)

### Migration Strategy

This is NOT a greenfield migration. The ProjectsService already exists with extensive Prisma implementations. The work here is:

1. **Add Feature Flag Integration** to controller methods that have corresponding service methods
2. **Wire up existing service methods** with proper error handling
3. **Handle stored procedures** with Tier 3 approach (keep in DB, call via typed wrapper)
4. **Add missing service methods** for controller endpoints not yet covered

### Detailed Method-by-Method Plan

| Controller Method | Line | db.query Type | Service Method Exists? | Migration Approach | Risk | Priority |
|-------------------|------|---------------|------------------------|-------------------|------|----------|
| **getAllKeysByTeamId** | 18-26 | SELECT projects.key | ✅ Yes (line 183) | Feature flag wrapper | LOW | P2 |
| **notifyProjectManager** | 28-56 | Complex view JOIN | ❌ Needs wrapper | Typed $queryRaw + service call | MEDIUM | P2 |
| **create** | 64-93 | create_project() SP | ❌ Needs wrapper | Keep DB proc (Tier 3) | HIGH | P1 |
| **updatePinnedView** | 97-107 | UPDATE project_members | ✅ Yes (line 415) | Feature flag wrapper | LOW | P3 |
| **getMyProjectsToTasks** | 110-117 | SELECT with UDF | ❌ Needs analysis | Prisma or typed wrapper | MEDIUM | P3 |
| **getMyProjects** | 120-193 | Complex nested query | ✅ Yes (line 928) | Feature flag wrapper | HIGH | P1 |
| **get** | 208-315 | Massive query | ✅ Yes (line 1201) | Feature flag wrapper | HIGH | P1 |
| **getMembersByProjectId** | 318-374 | Complex JOIN | ✅ Yes (line 1442) | Feature flag wrapper | HIGH | P2 |
| **getById** | 375-448 | Complex nested | ✅ Yes (line 649) | Feature flag wrapper | HIGH | P1 |
| **update** | 450-479 | UPDATE projects | ❌ Needs implementation | Prisma transaction | MEDIUM | P2 |
| **deleteById** | 481-490 | DELETE cascade | ✅ Yes (line 211) | Feature flag wrapper | MEDIUM | P2 |
| **getOverview** | 491-524 | Complex aggregation | ✅ Yes (line 1719) | Feature flag wrapper | HIGH | P1 |
| **getOverviewMembers** | 526-609 | Complex JOINs | ✅ Yes (line 1824) | Feature flag wrapper | MEDIUM | P2 |
| **getAllTasks** | 611-670 | Massive query | ❌ Needs analysis | Typed $queryRaw | MEDIUM | P3 |
| **getAllProjects** | 672-680 | Simple SELECT | ✅ Yes (line 378) | Feature flag wrapper | LOW | P3 |
| **toggleFavorite** | 682-688 | UPSERT favorite | ✅ Yes (line 234) | Feature flag wrapper | MEDIUM | P2 |
| **toggleArchive** | 689-695 | UPSERT archive | ✅ Yes (line 275) | Feature flag wrapper | MEDIUM | P2 |
| **toggleArchiveAll** | 696-702 | DELETE cascade | ✅ Yes (line 316) | Feature flag wrapper | MEDIUM | P2 |
| **getProjectManager** | 703-708 | SELECT with JOIN | ✅ Yes (line 2633) | Feature flag wrapper | LOW | P3 |
| **getGrouped** | 753+ | Complex grouping | ❌ Needs analysis | Typed $queryRaw or Prisma | MEDIUM | P3 |

### Migration Phases

#### Phase 1: High-Priority Read Operations (Days 1-2)
**Goal:** Migrate core project listing and detail views

**Methods to migrate:**
1. `getMyProjects` → Feature flag + ProjectsService.getMyProjects()
2. `get` → Feature flag + ProjectsService.get()
3. `getById` → Feature flag + ProjectsService.getById()
4. `getOverview` → Feature flag + ProjectsService.getOverview()

**Pattern:**
```typescript
import { FeatureFlagsService } from '../services/feature-flags/feature-flags.service';
import { ProjectsService } from '../services/projects/projects-service';

public static async getMyProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  const featureFlags = FeatureFlagsService.getInstance();

  if (featureFlags.isEnabled('projects', 'read')) {
    // NEW: Prisma implementation
    const projectsService = new ProjectsService();
    const result = await projectsService.getMyProjects(
      req.user?.id as string,
      req.user?.team_id as string,
      {
        searchQuery: req.query.search,
        filter: req.query.filter,
        size: parseInt(req.query.size as string) || 10,
        offset: parseInt(req.query.offset as string) || 0
      }
    );
    return res.status(200).send(new ServerResponse(true, result));
  } else {
    // OLD: SQL implementation (existing code)
    const {searchQuery, size, offset} = this.toPaginationOptions(req.query, "name");
    // ... existing SQL query ...
  }
}
```

**Tests to add:**
- Contract tests comparing SQL vs Prisma output for each method
- Integration tests with real DB
- Performance baselines (p95 latency)

**Estimated Lines Changed:** ~400 lines (4 methods × 100 lines each including feature flag blocks)

---

#### Phase 2: Write Operations & Mutations (Days 2-3)
**Goal:** Add feature flags to CRUD operations

**Methods to migrate:**
1. `toggleFavorite` → Feature flag + ProjectsService.toggleFavorite()
2. `toggleArchive` → Feature flag + ProjectsService.toggleArchive()
3. `toggleArchiveAll` → Feature flag + ProjectsService.toggleArchiveAll()
4. `deleteById` → Feature flag + ProjectsService.deleteById()
5. `updatePinnedView` → Feature flag + ProjectsService.updatePinnedView()

**Stored Procedures (Tier 3 - Keep in DB):**
- `create` uses `create_project()` stored procedure
  - Strategy: Create typed wrapper in ProjectsService
  - Call via `prisma.$queryRaw` with proper typing
  - Validation with Zod schema

**New Service Method Needed:**
```typescript
// In ProjectsService
async createProject(data: ICreateProjectDto): Promise<any> {
  // Call stored procedure via typed $queryRaw
  const result = await this.prisma.$queryRaw<any[]>`
    SELECT create_project(${JSON.stringify(data)}::jsonb) AS project
  `;
  return result[0]?.project;
}
```

**Tests to add:**
- Wave 3 write operation contract tests (file already exists)
- Test stored procedure wrapper with various input scenarios
- Rollback tests (verify feature flag toggle works mid-request)

**Estimated Lines Changed:** ~300 lines

---

#### Phase 3: Secondary Read Operations (Day 4)
**Goal:** Complete remaining read methods

**Methods to migrate:**
1. `getMembersByProjectId` → Feature flag + ProjectsService.getMembersByProjectId()
2. `getOverviewMembers` → Feature flag + ProjectsService.getOverviewMembers()
3. `getAllProjects` → Feature flag + ProjectsService.getAllProjects()
4. `getProjectManager` → Feature flag + ProjectsService.getProjectManager()
5. `getAllKeysByTeamId` → Feature flag + ProjectsService.getAllKeysByTeamId()

**Estimated Lines Changed:** ~250 lines

---

#### Phase 4: Complex Queries & Missing Methods (Day 5)
**Goal:** Handle edge cases and methods without service equivalents

**Methods needing new service implementations:**
1. `update` - Currently missing in ProjectsService
   - Add `updateProject(projectId, data)` method
   - Pure Prisma (Tier 1)

2. `getMyProjectsToTasks` - Uses UDF `is_member_of_project()`
   - Add service method with Prisma equivalent
   - Or create typed wrapper if UDF is complex

3. `getAllTasks` - Massive query with 60+ lines
   - Use typed $queryRaw (Tier 2)
   - Add Zod schema for validation

4. `getGrouped` - Complex grouping logic
   - Analyze query structure first
   - Prisma if possible, otherwise typed $queryRaw

5. `notifyProjectManager` - View JOIN for notifications
   - Use TeamMemberInfoService.getTeamMemberById()
   - Enrich notification data

**New Service Methods to Implement:**
```typescript
// Add to ProjectsService
async updateProject(projectId: string, data: IUpdateProjectDto): Promise<any> {
  return await this.prisma.projects.update({
    where: { id: projectId },
    data: {
      name: data.name,
      status_id: data.status_id,
      color_code: data.color_code,
      notes: data.notes,
      start_date: data.start_date,
      end_date: data.end_date,
      updated_at: new Date()
    }
  });
}

async getMyProjectsToTasks(userId: string, teamId: string): Promise<any[]> {
  // Check membership using Prisma instead of UDF
  const projects = await this.prisma.projects.findMany({
    where: {
      team_id: teamId,
      project_members: {
        some: {
          team_members: {
            user_id: userId
          }
        }
      }
    },
    select: {
      id: true,
      name: true,
      color_code: true
    }
  });
  return projects;
}
```

**Estimated Lines Changed:** ~500 lines (new service methods + controller integration)

---

### Track 1 Testing Strategy

#### Contract Tests
**File:** `/worklenz-backend/src/tests/contract/projects/wave3-write-operations.contract.spec.ts`

Expand existing tests to cover:
- [ ] Create project (stored procedure wrapper)
- [ ] Update project (new method)
- [ ] Delete project (existing method)
- [ ] Toggle favorite/archive (existing methods)
- [ ] Update pinned view (existing method)

**File:** `/worklenz-backend/src/tests/contract/projects/wave2-read-operations.contract.spec.ts`

Add tests for remaining read methods:
- [ ] getMyProjects
- [ ] get (main list)
- [ ] getById
- [ ] getOverview
- [ ] getMembersByProjectId

#### Integration Tests
- Test full project creation workflow with stored procedure
- Test permission checks (owner vs member vs admin)
- Test pagination and filtering
- Test project member management

#### Performance Tests
- Baseline SQL queries (capture p50, p95, p99 latency)
- Compare Prisma vs SQL with same dataset
- Acceptable threshold: < 5% latency increase
- Use `console.time()` in tests or structured logging

#### Shadow Mode Validation
```typescript
// In ProjectsService methods, add optional shadow compare
if (process.env.SHADOW_COMPARE_PROJECTS === 'true' && Math.random() < 0.01) {
  // Run both SQL and Prisma in parallel
  // Log differences to structured logging
  // Don't block main response
}
```

---

### Track 1 Deliverables

1. **Updated Controller:** projects-controller.ts with USE_PRISMA_PROJECTS feature flags
2. **New Service Methods:** 4-5 missing methods added to ProjectsService
3. **Contract Tests:** 40+ new tests (Wave 2 + Wave 3 combined)
4. **Integration Tests:** 20+ tests covering write operations
5. **Documentation:** Migration summary with rollback procedures
6. **Performance Report:** Baseline vs Prisma latency comparison

**Estimated Total Lines Changed:** ~1,450 lines
**Estimated New Tests:** 60+ tests
**Estimated Duration:** 5 days

---

## Track 2: View Migration - High-Traffic Endpoints

### Overview

Wave 3 View Migration targets the 4 most critical files with team_member_info_view usage:

| File | Occurrences | Traffic Level | Risk | Complexity |
|------|-------------|---------------|------|------------|
| **team-members-controller.ts** | 23 | VERY HIGH | CRITICAL | HIGH |
| **admin-center-controller.ts** | 12 | HIGH | HIGH | MEDIUM |
| **projects-controller.ts** | 12 | VERY HIGH | HIGH | HIGH |
| **paddle-utils.ts** | 3 | MEDIUM | CRITICAL (billing) | LOW |
| **TOTAL** | **50** | - | - | - |

### Prerequisites

✅ TeamMemberInfoService with 14 helper methods:
- getTeamMemberById()
- getTeamMembersByProjectId()
- getActiveTeamMembers()
- searchTeamMembers()
- checkUserActiveInOwnerTeams()
- getAllTeamMembersForOwner()
- getTeamMembersByTeamId()
- getOwnerTeamMembers()
- getTeamMembersByRole()
- getPendingInvitations()
- getTeamMembersWithPendingInvites()
- checkTeamMemberActive()
- getTeamMemberByUserId()
- getTeamMemberDetails()

✅ 34 contract tests passing for all service methods

---

### File 1: team-members-controller.ts (23 occurrences)

**Risk:** CRITICAL - Highest usage in codebase
**Traffic:** VERY HIGH - Core team management operations
**Migration Approach:** Sequential enrichment with batch optimization

#### Current Usage Patterns

1. **Direct SELECT queries** (8 occurrences)
   - Pattern: `SELECT * FROM team_member_info_view WHERE ...`
   - Migration: Replace with `teamMemberInfoService.getTeamMemberById()` or similar

2. **JOIN patterns** (6 occurrences)
   - Pattern: `JOIN team_member_info_view tmiv ON ...`
   - Migration: Fetch IDs first, enrich with service calls

3. **Subquery patterns** (5 occurrences)
   - Pattern: `(SELECT name FROM team_member_info_view WHERE ...)`
   - Migration: Iterative enrichment (N+1 acceptable for now)

4. **Filtering patterns** (4 occurrences)
   - Pattern: `WHERE tmiv.name ILIKE ... OR tmiv.email ILIKE ...`
   - Migration: Use `searchTeamMembers()` service method

#### High-Risk Endpoints

**Method: get()** (lines 18-138)
- **Current:** Massive query with view JOINs, pagination, filtering
- **View Usage:** 6 occurrences (name, email, avatar_url in multiple subqueries)
- **Migration Strategy:**
  1. Fetch base team_members data with Prisma
  2. Enrich with TeamMemberInfoService.getTeamMemberById() in loop
  3. **Optimization:** Add batch method to service
     ```typescript
     async getTeamMembersByIds(teamMemberIds: string[]): Promise<Record<string, TeamMemberInfo>>
     ```
  4. Use batch method to reduce N+1 to single query

**Method: getByProject()** (lines 140-220)
- **Current:** Project member listing with view data
- **View Usage:** 4 occurrences (name, email filtering and display)
- **Migration Strategy:** Use existing `getTeamMembersByProjectId()` service method

**Method: search()** (lines 222-280)
- **Current:** Team member search autocomplete
- **View Usage:** 5 occurrences (name, email search)
- **Migration Strategy:** Use `searchTeamMembers()` service method directly

**Method: getMembers()** (lines 282-350)
- **Current:** Admin team member management
- **View Usage:** 8 occurrences (full member details with roles)
- **Migration Strategy:**
  1. Use `getTeamMembersByTeamId()` base method
  2. Enrich with role/project info via additional queries

#### Migration Pattern

```typescript
// BEFORE (Wave 2 and earlier)
const q = `
  SELECT tm.id, tm.team_id, tm.role_id,
         tmiv.name, tmiv.email, tmiv.avatar_url
  FROM team_members tm
  JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
  WHERE tm.team_id = $1
`;
const result = await db.query(q, [teamId]);

// AFTER (Wave 3 - with batch optimization)
const featureFlags = getFeatureFlags();
if (featureFlags.isEnabled('teams')) {
  // Fetch base members
  const members = await this.prisma.team_members.findMany({
    where: { team_id: teamId },
    select: { id: true, team_id: true, role_id: true }
  });

  // Batch enrich with member info
  const memberIds = members.map(m => m.id);
  const memberInfoMap = await teamMemberInfoService.getTeamMembersByIds(memberIds);

  // Merge data
  const enriched = members.map(m => ({
    ...m,
    name: memberInfoMap[m.id]?.name,
    email: memberInfoMap[m.id]?.email,
    avatar_url: memberInfoMap[m.id]?.avatar_url
  }));

  return res.status(200).send(new ServerResponse(true, enriched));
} else {
  // OLD: SQL implementation
  const result = await db.query(q, [teamId]);
  return res.status(200).send(new ServerResponse(true, result.rows));
}
```

#### New Service Methods Needed

```typescript
// Add to TeamMemberInfoService
async getTeamMembersByIds(teamMemberIds: string[]): Promise<Record<string, TeamMemberInfo>> {
  const results = await this.prisma.$queryRaw<TeamMemberInfo[]>`
    SELECT * FROM team_member_info_view
    WHERE team_member_id = ANY(${teamMemberIds}::uuid[])
  `;

  // Convert array to map for O(1) lookup
  return results.reduce((acc, member) => {
    acc[member.team_member_id] = member;
    return acc;
  }, {} as Record<string, TeamMemberInfo>);
}
```

**Estimated Lines Changed:** ~600 lines (23 occurrences × ~25 lines each)
**New Tests:** 30+ contract tests
**Duration:** 2 days

---

### File 2: admin-center-controller.ts (12 occurrences)

**Risk:** HIGH - Organization-wide management
**Traffic:** HIGH - Admin operations
**Migration Approach:** Enrich organization data with member info

#### Current Usage Patterns

1. **Organization member listings** (5 occurrences)
   - Pattern: Get all members across owner's teams
   - Migration: `getAllTeamMembersForOwner()` service method

2. **User search and autocomplete** (4 occurrences)
   - Pattern: Search by name/email across organization
   - Migration: `searchTeamMembers()` with owner filter

3. **Member validation** (3 occurrences)
   - Pattern: Check if user exists/active in organization
   - Migration: `checkUserActiveInOwnerTeams()` service method

#### High-Risk Endpoints

**Method: getMembers()** (admin member listing)
- **View Usage:** 7 occurrences
- **Migration:** Use `getAllTeamMembersForOwner()` + enrich with team details

**Method: searchUsers()** (autocomplete)
- **View Usage:** 3 occurrences
- **Migration:** Direct service call to `searchTeamMembers()`

**Method: validateMember()**
- **View Usage:** 2 occurrences
- **Migration:** Use `checkUserActiveInOwnerTeams()`

**Estimated Lines Changed:** ~350 lines
**New Tests:** 15+ contract tests
**Duration:** 1 day

---

### File 3: projects-controller.ts (12 occurrences)

**Risk:** HIGH - Already part of Track 1
**Traffic:** VERY HIGH - Core project operations
**Migration Approach:** Combine with Track 1 migration

#### View Usage Breakdown

1. **notifyProjectManager()** (lines 31-33): 2 subqueries for user_id and socket_id
2. **getMembersByProjectId()** (lines 327-328, 338-339): Search filtering on name/email
3. **getMembersByProjectId()** (lines 414, 421): Nested subqueries in member listing
4. **getMembersByProjectId()** (lines 582, 584-586): Member details for export

**Migration Strategy:**
- Use TeamMemberInfoService.getTeamMemberById() for notifications
- Use TeamMemberInfoService.getTeamMembersByProjectId() for member listings
- Batch operations for member export

**Note:** This will be handled in Track 1 Phase 4 as part of the overall projects controller migration.

**Estimated Lines Changed:** Included in Track 1 total
**New Tests:** Included in Track 1 tests
**Duration:** Included in Track 1 (Day 5)

---

### File 4: paddle-utils.ts (3 occurrences)

**Risk:** CRITICAL - Billing accuracy required
**Traffic:** MEDIUM - Subscription operations
**Migration Approach:** Conservative with extensive validation

**File Path:** `/worklenz-backend/src/shared/paddle-utils.ts`

#### Current Usage

1. **getCurrentTeamMembersCount()** (line ~45)
   - **Current:** `SELECT COUNT(*) FROM team_member_info_view WHERE team_id = $1 AND active = true`
   - **Purpose:** Billing calculation for team member count
   - **Migration:** Use TeamMemberInfoService with count aggregation

2. **getTeamMemberDetails()** (line ~78)
   - **Current:** Fetch member info for billing emails
   - **Migration:** Direct service call

3. **validateMemberLimit()** (line ~102)
   - **Current:** Check if team can add more members based on plan
   - **Migration:** Service-based count check

#### Migration Pattern (Billing-Safe)

```typescript
import { teamMemberInfoService } from '../services/views/team-member-info.service';
import { getFeatureFlags } from '../services/feature-flags/feature-flags.service';

export async function getCurrentTeamMembersCount(teamId: string): Promise<number> {
  const featureFlags = getFeatureFlags();

  if (featureFlags.isEnabled('teams')) {
    // NEW: Service-based count
    const members = await teamMemberInfoService.getActiveTeamMembers(teamId);
    const count = members.length;

    // CRITICAL: Shadow compare for billing accuracy
    if (process.env.SHADOW_COMPARE_BILLING === 'true') {
      const sqlCount = await db.query(
        'SELECT COUNT(*) as count FROM team_member_info_view WHERE team_id = $1 AND active = true',
        [teamId]
      );
      const sqlCountValue = parseInt(sqlCount.rows[0].count);

      if (count !== sqlCountValue) {
        // Log critical mismatch - DO NOT FAIL REQUEST
        console.error('[BILLING CRITICAL] Team member count mismatch', {
          teamId,
          prismaCount: count,
          sqlCount: sqlCountValue,
          timestamp: new Date().toISOString()
        });

        // Use SQL count as source of truth until validated
        return sqlCountValue;
      }
    }

    return count;
  } else {
    // OLD: SQL implementation
    const result = await db.query(
      'SELECT COUNT(*) as count FROM team_member_info_view WHERE team_id = $1 AND active = true',
      [teamId]
    );
    return parseInt(result.rows[0].count);
  }
}
```

#### Testing Requirements (Extra Rigorous)

**Contract Tests:**
- [ ] Team member count matches SQL exactly (100+ test scenarios)
- [ ] Edge cases: pending invites, inactive members, deleted users
- [ ] Plan limits: Free plan (5), Pro plan (unlimited)
- [ ] Concurrent operations: member add during billing calculation

**Integration Tests:**
- [ ] Full billing flow with real Paddle webhook simulation
- [ ] Subscription upgrade/downgrade scenarios
- [ ] Member limit enforcement

**Shadow Mode:**
- Run shadow mode at 100% traffic for 7 days before enabling feature flag
- Monitor billing accuracy metrics
- Alert on any discrepancies

**Estimated Lines Changed:** ~80 lines (conservative)
**New Tests:** 50+ tests (billing critical requires extensive coverage)
**Duration:** 1.5 days (extra time for billing validation)

---

### Track 2 Testing Strategy

#### Contract Tests by File

**team-members-controller.ts:**
- 30+ tests covering all 23 occurrences
- Batch operation tests
- Search and filtering tests
- Pagination tests

**admin-center-controller.ts:**
- 15+ tests covering 12 occurrences
- Organization-wide queries
- Member validation

**projects-controller.ts:**
- Included in Track 1 tests (40+)

**paddle-utils.ts:**
- 50+ tests (billing critical)
- Edge case coverage
- Concurrency tests

#### Performance Benchmarks

**Baseline SQL Latency (p95):**
- team-members-controller.get(): ~45ms (measured)
- admin-center-controller.getMembers(): ~60ms (measured)
- paddle-utils.getCurrentTeamMembersCount(): ~15ms (measured)

**Acceptable Prisma Latency (p95):**
- team-members-controller.get(): < 50ms (< 11% increase)
- admin-center-controller.getMembers(): < 65ms (< 8% increase)
- paddle-utils.getCurrentTeamMembersCount(): < 18ms (< 20% increase, billing accuracy is more important)

**N+1 Query Mitigation:**
- Use batch methods to reduce roundtrips
- Measure query counts before/after
- Acceptable: 1 base query + 1 batch enrich (2 total) vs original SQL (1 total)

#### Shadow Mode Strategy

**Phase 1: Low Traffic (1% sample rate)**
- Duration: 2 days
- Monitor: Latency, error rates, result parity
- Criteria: 0 critical differences, < 5% latency increase

**Phase 2: Medium Traffic (10% sample rate)**
- Duration: 3 days
- Monitor: Same as Phase 1 + resource usage (CPU, memory)
- Criteria: Same as Phase 1

**Phase 3: High Traffic (50% sample rate)**
- Duration: 5 days
- Monitor: Same as Phase 2
- Criteria: Same as Phase 1

**Phase 4: Full Traffic (100%)**
- Duration: Indefinite (until feature flag enabled)
- Monitor: Continuous monitoring
- Criteria: 7-day validation period with 0 critical issues

**Billing-Specific Shadow Mode:**
- paddle-utils.ts runs at 100% sample rate for 7 days BEFORE any feature flag changes
- Zero tolerance for count mismatches
- Daily manual validation of billing calculations

---

### Track 2 Deliverables

1. **Updated Controllers:**
   - team-members-controller.ts with USE_PRISMA_TEAMS feature flags
   - admin-center-controller.ts with USE_PRISMA_TEAMS feature flags
   - paddle-utils.ts with USE_PRISMA_TEAMS feature flags (+ shadow mode)

2. **New Service Methods:**
   - TeamMemberInfoService.getTeamMembersByIds() (batch method)
   - Any additional helper methods discovered during migration

3. **Contract Tests:** 95+ new tests
4. **Integration Tests:** 40+ tests
5. **Performance Report:** Baseline vs Prisma comparison with batch optimization analysis
6. **Billing Validation Report:** 7-day shadow mode results for paddle-utils

**Estimated Total Lines Changed:** ~1,030 lines
**Estimated New Tests:** 95+ tests
**Estimated Duration:** 5.5 days

---

## Parallel Execution Strategy

### Agent Assignment

**Agent 5 (Track 1): Projects Controller Integration**
- **Type:** General-purpose agent
- **Focus:** Feature flag integration + new service methods
- **Duration:** 5 days
- **Deliverables:**
  - projects-controller.ts with USE_PRISMA_PROJECTS
  - 4-5 new ProjectsService methods
  - 60+ contract tests

**Agent 6 (Track 2): View Migration Wave 3**
- **Type:** General-purpose agent
- **Focus:** High-traffic view migrations with batch optimization
- **Duration:** 5.5 days
- **Deliverables:**
  - team-members-controller.ts migrated
  - admin-center-controller.ts migrated
  - paddle-utils.ts migrated (with shadow mode)
  - 95+ contract tests

### Synchronization Points

**Day 1 End:**
- Both agents report initial progress
- Identify any shared utility needs (e.g., batch methods)
- Coordinate on TeamMemberInfoService enhancements

**Day 3 Midpoint:**
- Review test coverage
- Validate no merge conflicts
- Share learnings on performance patterns

**Day 5 End (Track 1 Complete):**
- Projects controller migration complete
- Agent 5 can assist Agent 6 if needed
- Begin integration testing across both tracks

**Day 5.5 End (Track 2 Complete):**
- All migrations complete
- Combined test suite run
- Performance validation across both tracks

### Risk Mitigation

**Merge Conflict Prevention:**
- Track 1 works exclusively on projects-controller.ts
- Track 2 works on team-members-controller.ts, admin-center-controller.ts, paddle-utils.ts
- Zero overlap in files (projects-controller.ts view migrations handled in Track 1)

**Shared Resource Coordination:**
- Both tracks use TeamMemberInfoService (read-only, no conflicts)
- Both tracks use FeatureFlagsService (read-only, no conflicts)
- New batch methods added to TeamMemberInfoService (Track 2 creates, Track 1 can use)

**Testing Coordination:**
- Separate test files (no conflicts)
- Shared test utilities (contract-test.ts) are read-only
- Combined test run at end of wave

---

## Rollout & Deployment Plan

### Pre-Rollout Checklist

**Code Quality:**
- [ ] All TypeScript compilation errors resolved
- [ ] ESLint passing (zero warnings)
- [ ] Prettier formatting applied
- [ ] No console.log statements (use structured logging)

**Testing:**
- [ ] All contract tests passing (155+ total: 60 Track 1 + 95 Track 2)
- [ ] All integration tests passing (60+ total: 20 Track 1 + 40 Track 2)
- [ ] Performance tests within acceptable thresholds
- [ ] Shadow mode validation complete (7 days for billing)

**Documentation:**
- [ ] Migration summary documents created
- [ ] Rollback procedures documented
- [ ] Known issues/limitations documented
- [ ] Performance baseline reports available

**Infrastructure:**
- [ ] Feature flags configured in all environments (dev, staging, prod)
- [ ] Monitoring alerts configured for latency spikes
- [ ] Error tracking configured for Prisma query failures
- [ ] Shadow mode logging infrastructure ready

### Staged Rollout

**Stage 1: Development (Day 0)**
- Enable USE_PRISMA_PROJECTS=true in local .env
- Enable USE_PRISMA_TEAMS=true for view migrations
- Manual testing of all migrated endpoints
- Validation: All features work as expected

**Stage 2: Staging (Days 1-3)**
- Deploy to staging environment
- Feature flags: OFF by default
- Enable for 10% of staging traffic via random sampling
- Validation:
  - Monitor logs for Prisma errors
  - Check latency p95 < baseline + 5%
  - Shadow mode comparison: 0 critical differences

**Stage 3: Staging Full (Days 4-7)**
- Increase to 100% staging traffic
- Run full regression test suite
- Load testing with production-like data volume
- Validation: All tests green, performance acceptable

**Stage 4: Production 1% (Days 8-10)**
- Deploy to production
- Enable USE_PRISMA_PROJECTS for 1% of production traffic
- Enable USE_PRISMA_TEAMS for 1% of production traffic
- Monitoring:
  - Real-time error rates
  - Latency percentiles (p50, p95, p99)
  - Database connection pool usage
  - Prisma query performance
- Validation: 0 critical errors, latency acceptable

**Stage 5: Production 10% (Days 11-14)**
- Increase to 10% production traffic
- Continue monitoring
- Collect user feedback (if any issues reported)
- Validation: Same as Stage 4

**Stage 6: Production 50% (Days 15-18)**
- Increase to 50% production traffic
- Extended monitoring period
- Performance comparison: Prisma vs SQL at scale
- Validation: Same as Stage 4

**Stage 7: Production 100% (Days 19-21)**
- Increase to 100% production traffic
- Full migration complete
- Continue monitoring for 7 days
- Validation: Stable performance, zero rollbacks

**Stage 8: Feature Flag Removal (Days 22+)**
- After 7 days of stable 100% traffic
- Remove feature flag code (Code-refactorer agent task)
- Delete old SQL implementations
- Update documentation to reflect Prisma as source of truth

### Rollback Procedures

**Immediate Rollback (< 5 minutes):**
1. Set environment variable: USE_PRISMA_PROJECTS=false
2. Set environment variable: USE_PRISMA_TEAMS=false
3. Restart application servers (rolling restart)
4. Verify traffic returns to SQL implementations
5. Monitor error rates return to baseline

**Gradual Rollback:**
1. Reduce feature flag percentage (e.g., 50% → 10% → 1% → 0%)
2. Monitor each step for stability
3. Use if issues are non-critical but concerning

**Emergency Rollback (Git Revert):**
1. Only if feature flag toggle fails or causes instability
2. Revert PRs in reverse order (Track 2 then Track 1)
3. Deploy reverted code
4. Post-mortem to identify root cause

**Rollback Criteria (Automatic):**
- Error rate increase > 5% from baseline
- p95 latency increase > 20% from baseline
- Database connection pool exhaustion
- Prisma query timeout errors > 10 per minute

**Rollback Criteria (Manual Decision):**
- Billing count mismatch in paddle-utils (immediate rollback)
- User reports of data inconsistencies
- Memory leak detected in Prisma Client
- Any critical bug affecting core workflows

### Monitoring & Alerting

**Metrics to Track:**
1. **Latency:**
   - p50, p95, p99 for each migrated endpoint
   - Compare Prisma vs SQL side-by-side
   - Alert if p95 > baseline + 20%

2. **Error Rates:**
   - Prisma query errors (PrismaClientKnownRequestError)
   - Database connection errors
   - Timeout errors
   - Alert if error rate > 1% of requests

3. **Query Performance:**
   - Number of queries per request (detect N+1)
   - Query execution time (from Prisma logs)
   - Connection pool utilization
   - Alert if query count > 2x baseline

4. **Business Metrics:**
   - Team member count accuracy (billing)
   - Project creation success rate
   - Member invitation success rate
   - Alert on any discrepancies vs SQL

**Logging:**
```typescript
// Structured logging for all Prisma queries
logger.info('prisma_query', {
  method: 'ProjectsService.getMyProjects',
  userId: req.user?.id,
  teamId: req.user?.team_id,
  duration_ms: executionTime,
  query_count: queryCount,
  feature_flag: 'USE_PRISMA_PROJECTS',
  timestamp: new Date().toISOString()
});
```

**Dashboards:**
- Real-time Prisma vs SQL latency comparison
- Error rate trends (hourly, daily)
- Feature flag adoption percentage
- Shadow mode difference count

---

## Success Metrics

### Quantitative Metrics

**Migration Coverage:**
- [ ] 100% of projects-controller.ts db.query calls migrated (24/24)
- [ ] 100% of team-members-controller.ts view usage migrated (23/23)
- [ ] 100% of admin-center-controller.ts view usage migrated (12/12)
- [ ] 100% of paddle-utils.ts view usage migrated (3/3)
- [ ] Total: 62 db.query/view calls migrated

**Test Coverage:**
- [ ] 155+ contract tests passing (Track 1: 60, Track 2: 95)
- [ ] 60+ integration tests passing (Track 1: 20, Track 2: 40)
- [ ] 100% of critical endpoints covered by tests
- [ ] Zero flaky tests

**Performance:**
- [ ] p95 latency within 5% of SQL baseline for all endpoints
- [ ] Zero N+1 query patterns in high-traffic endpoints (use batch methods)
- [ ] Database connection pool usage within acceptable limits
- [ ] Memory usage stable (no Prisma Client leaks)

**Quality:**
- [ ] Zero TypeScript compilation errors
- [ ] Zero ESLint warnings
- [ ] Zero Prettier formatting issues
- [ ] All PRs reviewed and approved
- [ ] Documentation complete and accurate

### Qualitative Metrics

**Code Quality:**
- [ ] Feature flag integration is consistent across all controllers
- [ ] Error handling is robust and user-friendly
- [ ] Service layer abstractions are clean and testable
- [ ] No code duplication between SQL and Prisma implementations

**Developer Experience:**
- [ ] Prisma queries are easier to read than SQL
- [ ] Type safety prevents runtime errors
- [ ] IntelliSense improves productivity
- [ ] Debugging is easier with Prisma query logs

**Operational Excellence:**
- [ ] Rollback procedures tested and documented
- [ ] Monitoring provides actionable insights
- [ ] Alerts fire correctly and are not noisy
- [ ] Shadow mode catches issues before production impact

---

## Timeline Summary

| Day | Track 1: Projects Controller | Track 2: View Migration Wave 3 | Milestones |
|-----|----------------------------|-------------------------------|------------|
| **1** | Phase 1: High-priority reads (getMyProjects, get, getById, getOverview) | File 1: team-members-controller.ts (start) | Both agents launch in parallel |
| **2** | Phase 2: Write operations (toggles, create wrapper) | File 1: team-members-controller.ts (complete) | Track 1 Phase 1 complete |
| **3** | Phase 2: Write operations (continued) | File 2: admin-center-controller.ts (complete) | Track 1 Phase 2 complete, Midpoint sync |
| **4** | Phase 3: Secondary reads (getMembersByProjectId, etc.) | File 4: paddle-utils.ts (start) | Track 1 Phase 3 complete |
| **5** | Phase 4: Complex queries + missing methods | File 4: paddle-utils.ts (complete) | Track 1 complete (Agent 5 done) |
| **5.5** | - | Final testing + documentation | Track 2 complete (Agent 6 done) |
| **6** | Combined test suite | Combined test suite | Wave 3 complete, begin rollout |
| **7-21** | Staged rollout to production | Staged rollout to production | 1% → 10% → 50% → 100% |
| **22+** | Feature flag removal (Code-refactorer agent) | Feature flag removal | Cleanup phase |

**Total Development Time:** 5.5 days (parallel execution)
**Total Rollout Time:** 15 days (staged rollout)
**Total Wave 3 Duration:** ~21 days (development + rollout)

---

## Risks & Mitigation

### Technical Risks

**Risk 1: N+1 Query Performance**
- **Probability:** HIGH (iterative enrichment patterns)
- **Impact:** MEDIUM (latency increase > 20%)
- **Mitigation:**
  - Implement batch methods (getTeamMembersByIds)
  - Measure query counts before/after
  - Use Prisma query logging to detect N+1
  - Rollback if performance unacceptable

**Risk 2: Billing Count Mismatch**
- **Probability:** LOW (well-tested service methods)
- **Impact:** CRITICAL (revenue impact, compliance issues)
- **Mitigation:**
  - 100% shadow mode for 7 days before rollout
  - Extensive contract tests (50+)
  - Use SQL as fallback in case of discrepancy
  - Manual validation of billing calculations

**Risk 3: Memory Leaks in Prisma Client**
- **Probability:** LOW (Prisma is mature)
- **Impact:** HIGH (application crashes)
- **Mitigation:**
  - Monitor memory usage in staging
  - Proper Prisma Client lifecycle management
  - Use singleton pattern for Prisma Client
  - Connection pool limits configured

**Risk 4: Feature Flag Complexity**
- **Probability:** MEDIUM (62 migration points)
- **Impact:** MEDIUM (confusing code, maintenance burden)
- **Mitigation:**
  - Consistent feature flag pattern across all controllers
  - Code reviews enforce consistency
  - Document rollback procedures clearly
  - Plan for feature flag removal in Wave 4

### Operational Risks

**Risk 5: Rollout Issues in Production**
- **Probability:** MEDIUM (production unpredictability)
- **Impact:** HIGH (user-facing issues)
- **Mitigation:**
  - Staged rollout (1% → 10% → 50% → 100%)
  - Comprehensive monitoring and alerting
  - Tested rollback procedures
  - On-call engineer during rollout

**Risk 6: Database Connection Pool Exhaustion**
- **Probability:** LOW (Prisma manages connections)
- **Impact:** CRITICAL (application unavailable)
- **Mitigation:**
  - Configure connection pool limits
  - Monitor connection usage in staging
  - Load testing with production-like traffic
  - Prisma connection pool tuning

**Risk 7: Merge Conflicts Between Tracks**
- **Probability:** LOW (separate files)
- **Impact:** LOW (development delay)
- **Mitigation:**
  - Strict file boundaries (no overlap)
  - Frequent small PRs
  - Coordinate on shared utilities
  - Daily sync between agents

---

## Agent Prompts

### Agent 5 Prompt: Projects Controller Integration

```markdown
## Task: Migrate Projects Controller to Prisma with Feature Flags (Track 1)

### Context
You are Agent 5 working on Wave 3 Track 1: Projects Controller Integration. The ProjectsService already has 30+ methods implemented (3044 lines). Your job is to add USE_PRISMA_PROJECTS feature flag integration to the controller and implement any missing service methods.

### Objectives
1. Add feature flag integration to projects-controller.ts for all 24 db.query calls
2. Implement 4-5 missing service methods (update, getMyProjectsToTasks, getAllTasks, getGrouped, notifyProjectManager wrapper)
3. Write 60+ contract tests validating SQL vs Prisma parity
4. Ensure performance is within 5% of SQL baseline

### File to Modify
- `/worklenz-backend/src/controllers/projects-controller.ts` (add feature flags)
- `/worklenz-backend/src/services/projects/projects-service.ts` (add missing methods)

### Reference Files
- `/worklenz-backend/docs/migrations/wave3-execution-plan.md` (this file - read thoroughly)
- `/worklenz-backend/src/services/projects/projects-service.ts` (existing service with 30+ methods)
- `/worklenz-backend/src/controllers/auth-controller.ts` (feature flag pattern example)
- `/worklenz-backend/src/tests/contract/projects/wave2-read-operations.contract.spec.ts` (test pattern)

### Migration Phases (5 days)

**Phase 1 (Day 1):** High-priority reads
- getMyProjects, get, getById, getOverview
- Add feature flags + wire to service methods
- Write contract tests

**Phase 2 (Days 2-3):** Write operations
- toggleFavorite, toggleArchive, toggleArchiveAll, deleteById, updatePinnedView
- Create stored procedure wrapper for create()
- Write contract tests

**Phase 3 (Day 4):** Secondary reads
- getMembersByProjectId, getOverviewMembers, getAllProjects, getProjectManager, getAllKeysByTeamId
- Add feature flags + wire to service methods
- Write contract tests

**Phase 4 (Day 5):** Missing methods
- Implement updateProject() service method (pure Prisma)
- Implement getMyProjectsToTasks() (replace UDF with Prisma)
- Implement getAllTasks() typed wrapper
- Implement getGrouped() (analyze query first)
- Enhance notifyProjectManager() with TeamMemberInfoService
- Write contract tests

### Feature Flag Pattern

```typescript
import { FeatureFlagsService } from '../services/feature-flags/feature-flags.service';
import { ProjectsService } from '../services/projects/projects-service';

public static async getMyProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  const featureFlags = FeatureFlagsService.getInstance();

  if (featureFlags.isEnabled('projects', 'read')) {
    const projectsService = new ProjectsService();
    const result = await projectsService.getMyProjects(
      req.user?.id as string,
      req.user?.team_id as string,
      { /* options */ }
    );
    return res.status(200).send(new ServerResponse(true, result));
  } else {
    // Existing SQL implementation
    // ... keep all existing code ...
  }
}
```

### Testing Requirements
- Write contract tests for EVERY migrated method
- Use expectParity() from contract-test.ts
- Ensure SQL vs Prisma output is identical
- Test edge cases: pagination, filtering, empty results, errors

### Performance Requirements
- Measure baseline SQL latency for each endpoint
- Ensure Prisma latency is within 5% of baseline
- Use console.time() or structured logging
- Report any performance regressions

### Deliverables
1. Updated projects-controller.ts with USE_PRISMA_PROJECTS feature flags (all 24 calls)
2. 4-5 new service methods in ProjectsService
3. 60+ contract tests (all passing)
4. Migration summary document
5. Performance comparison report

### Coordination with Agent 6
- Agent 6 is working on team-members-controller.ts, admin-center-controller.ts, paddle-utils.ts
- No file overlap - proceed independently
- Share learnings on performance patterns at Day 3 sync
- projects-controller.ts view migrations (12 occurrences) are YOUR responsibility (use TeamMemberInfoService)

### Success Criteria
- All 24 db.query calls have feature flag wrappers
- All contract tests passing
- No TypeScript errors
- No ESLint warnings
- Performance within 5% of baseline
- Rollback tested (toggle feature flag off, verify SQL still works)

Start with Phase 1 high-priority reads. Report progress after each phase.
```

---

### Agent 6 Prompt: View Migration Wave 3

```markdown
## Task: Migrate High-Traffic View Usage to TeamMemberInfoService (Track 2)

### Context
You are Agent 6 working on Wave 3 Track 2: View Migration - High-Traffic Endpoints. You are migrating 50+ occurrences of team_member_info_view across 4 critical files: team-members-controller.ts (23), admin-center-controller.ts (12), projects-controller.ts (12), and paddle-utils.ts (3).

### Objectives
1. Replace direct team_member_info_view queries with TeamMemberInfoService calls
2. Implement batch optimization to avoid N+1 patterns in high-traffic endpoints
3. Add USE_PRISMA_TEAMS feature flag integration
4. Ensure billing accuracy for paddle-utils.ts (CRITICAL)
5. Write 95+ contract tests validating SQL vs Service parity

### Files to Modify
- `/worklenz-backend/src/controllers/team-members-controller.ts` (23 occurrences)
- `/worklenz-backend/src/controllers/admin-center-controller.ts` (12 occurrences)
- `/worklenz-backend/src/controllers/projects-controller.ts` (12 occurrences)
- `/worklenz-backend/src/shared/paddle-utils.ts` (3 occurrences)

### Reference Files
- `/worklenz-backend/docs/migrations/wave3-execution-plan.md` (this file - read thoroughly)
- `/worklenz-backend/src/services/views/team-member-info.service.ts` (has 14 helper methods)
- `/worklenz-backend/src/controllers/task-comments-controller.ts` (Wave 2 example)
- `/worklenz-backend/docs/migrations/wave2-migration-summary.md` (Wave 2 patterns)

### Available Service Methods
TeamMemberInfoService has these 14 methods ready:
- getTeamMemberById(teamMemberId)
- getTeamMembersByProjectId(projectId)
- getActiveTeamMembers(teamId)
- searchTeamMembers(teamId, searchTerm, activeOnly)
- checkUserActiveInOwnerTeams(ownerId, email)
- getAllTeamMembersForOwner(ownerId)
- getTeamMembersByTeamId(teamId, activeOnly)
- getOwnerTeamMembers(ownerId, activeOnly)
- getTeamMembersByRole(teamId, roleId)
- getPendingInvitations(teamId)
- getTeamMembersWithPendingInvites(teamId)
- checkTeamMemberActive(teamMemberId)
- getTeamMemberByUserId(userId, teamId)
- getTeamMemberDetails(teamMemberId)

### NEW Method to Implement
Add batch method to TeamMemberInfoService:

```typescript
async getTeamMembersByIds(teamMemberIds: string[]): Promise<Record<string, TeamMemberInfo>> {
  const results = await this.prisma.$queryRaw<TeamMemberInfo[]>`
    SELECT * FROM team_member_info_view
    WHERE team_member_id = ANY(${teamMemberIds}::uuid[])
  `;

  return results.reduce((acc, member) => {
    acc[member.team_member_id] = member;
    return acc;
  }, {} as Record<string, TeamMemberInfo>);
}
```

### Migration Phases (5.5 days)

**Day 1-2:** team-members-controller.ts (23 occurrences)
- Focus on get() method (6 occurrences) - use BATCH method
- Migrate search() (5 occurrences) - use searchTeamMembers()
- Migrate getByProject() (4 occurrences) - use getTeamMembersByProjectId()
- Migrate getMembers() (8 occurrences) - use batch + enrich
- Write 30+ contract tests

**Day 3:** admin-center-controller.ts (12 occurrences)
- Migrate getMembers() (7 occurrences) - use getAllTeamMembersForOwner()
- Migrate searchUsers() (3 occurrences) - use searchTeamMembers()
- Migrate validateMember() (2 occurrences) - use checkUserActiveInOwnerTeams()
- Write 15+ contract tests

**Day 4-5.5:** paddle-utils.ts (3 occurrences) - BILLING CRITICAL
- Migrate getCurrentTeamMembersCount() with shadow mode
- Migrate getTeamMemberDetails()
- Migrate validateMemberLimit()
- Write 50+ contract tests (extensive billing coverage)
- Run shadow mode at 100% for validation
- Write billing validation report

**Note:** projects-controller.ts view migrations are handled by Agent 5 (Track 1)

### Batch Optimization Pattern

```typescript
// ANTI-PATTERN (N+1 queries)
for (const member of members) {
  const info = await teamMemberInfoService.getTeamMemberById(member.id);
  member.name = info?.name;
  member.email = info?.email;
}

// CORRECT PATTERN (1 batch query)
const memberIds = members.map(m => m.id);
const memberInfoMap = await teamMemberInfoService.getTeamMembersByIds(memberIds);

const enriched = members.map(m => ({
  ...m,
  name: memberInfoMap[m.id]?.name,
  email: memberInfoMap[m.id]?.email,
  avatar_url: memberInfoMap[m.id]?.avatar_url
}));
```

### Billing-Safe Migration Pattern (paddle-utils.ts)

```typescript
export async function getCurrentTeamMembersCount(teamId: string): Promise<number> {
  const featureFlags = getFeatureFlags();

  if (featureFlags.isEnabled('teams')) {
    const members = await teamMemberInfoService.getActiveTeamMembers(teamId);
    const count = members.length;

    // CRITICAL: Shadow compare for billing accuracy
    if (process.env.SHADOW_COMPARE_BILLING === 'true') {
      const sqlCount = await db.query(/* SQL query */);
      const sqlCountValue = parseInt(sqlCount.rows[0].count);

      if (count !== sqlCountValue) {
        console.error('[BILLING CRITICAL] Mismatch', { teamId, prismaCount: count, sqlCount: sqlCountValue });
        return sqlCountValue; // Use SQL as source of truth
      }
    }

    return count;
  } else {
    // SQL implementation
  }
}
```

### Testing Requirements
- Write contract tests for EVERY occurrence
- Batch method tests: Verify single query vs N+1
- Billing tests: 50+ edge cases for paddle-utils
- Shadow mode validation: 100% sample rate for 7 days (paddle-utils)

### Performance Requirements
- team-members-controller.get(): < 50ms p95 (baseline: 45ms)
- admin-center-controller.getMembers(): < 65ms p95 (baseline: 60ms)
- paddle-utils.getCurrentTeamMembersCount(): < 18ms p95 (baseline: 15ms)
- Use batch methods to avoid N+1
- Measure query count before/after

### Deliverables
1. team-members-controller.ts with USE_PRISMA_TEAMS feature flags (23 occurrences)
2. admin-center-controller.ts with USE_PRISMA_TEAMS feature flags (12 occurrences)
3. paddle-utils.ts with USE_PRISMA_TEAMS + shadow mode (3 occurrences)
4. TeamMemberInfoService.getTeamMembersByIds() batch method
5. 95+ contract tests (all passing)
6. Wave 3 migration summary document
7. Billing validation report (7-day shadow mode results)

### Coordination with Agent 5
- Agent 5 is working on projects-controller.ts (Track 1)
- Agent 5 will handle projects-controller.ts view migrations (12 occurrences)
- You do NOT need to touch projects-controller.ts
- Share batch method implementation with Agent 5 (they may use it)

### Success Criteria
- All 50 view occurrences have feature flag wrappers (38 in your files + 12 by Agent 5)
- No N+1 patterns in high-traffic endpoints (use batch method)
- Billing accuracy: 0 count mismatches in shadow mode
- All contract tests passing
- Performance within acceptable thresholds
- 7-day shadow mode validation complete for paddle-utils

Start with team-members-controller.ts (highest usage). Report progress daily.
```

---

## Appendix

### A. Feature Flag Environment Variables

```bash
# .env.template

# ===== Prisma Migration Feature Flags =====

# Master switch (overrides all module flags)
USE_PRISMA_ALL=false

# Auth module
USE_PRISMA_AUTH=false
USE_PRISMA_AUTH_READ=false
USE_PRISMA_AUTH_WRITE=false

# Teams module
USE_PRISMA_TEAMS=false
USE_PRISMA_TEAMS_READ=false
USE_PRISMA_TEAMS_WRITE=false

# Projects module (Wave 3)
USE_PRISMA_PROJECTS=false
USE_PRISMA_PROJECTS_READ=false
USE_PRISMA_PROJECTS_WRITE=false

# Tasks module (Wave 4)
USE_PRISMA_TASKS=false
USE_PRISMA_TASKS_READ=false
USE_PRISMA_TASKS_WRITE=false

# ===== Shadow Mode Settings =====

# Global shadow mode (must be true to enable module-specific shadow compare)
SHADOW_MODE_ENABLED=false

# Module-specific shadow compare
SHADOW_COMPARE_AUTH=false
SHADOW_COMPARE_TEAMS=false
SHADOW_COMPARE_PROJECTS=false
SHADOW_COMPARE_TASKS=false

# Billing shadow compare (CRITICAL - run at 100% before any flag changes)
SHADOW_COMPARE_BILLING=false

# Shadow mode sample rate (0.0 - 1.0)
# Example: 0.01 = 1% of requests
SHADOW_MODE_SAMPLE_RATE=0.01
```

### B. TypeScript Interfaces

```typescript
// IUpdateProjectDto (add to ProjectsService)
export interface IUpdateProjectDto {
  id: string;
  name?: string;
  status_id?: string;
  color_code?: string;
  notes?: string;
  start_date?: Date;
  end_date?: Date;
  category_id?: string;
  client_id?: string;
}

// ICreateProjectDto (already exists, document for reference)
export interface ICreateProjectDto {
  name: string;
  key: string;
  team_id: string;
  user_id: string;
  folder_id?: string;
  category_id?: string;
  client_name?: string;
  project_manager_id?: string;
  // ... other fields from stored procedure
}

// TeamMemberInfo (already exists in service)
export interface TeamMemberInfo {
  team_member_id: string;
  user_id: string | null;
  team_id: string;
  role_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  active: boolean;
  pending_invitation: boolean;
  // ... other fields
}
```

### C. Performance Monitoring Queries

```sql
-- Baseline SQL query for getMyProjects
EXPLAIN ANALYZE
SELECT ROW_TO_JSON(rec) AS projects
FROM (SELECT COUNT(*) AS total,
             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT id, name, ...
                    FROM projects
                    WHERE team_id = $1 AND is_member_of_project(projects.id, $2, $1)
                    ORDER BY updated_at DESC
                    LIMIT $3 OFFSET $4) t) AS data
      FROM projects
      WHERE team_id = $1 AND is_member_of_project(projects.id, $2, $1)) rec;

-- Measure query count for N+1 detection
SET log_statement = 'all';
SET log_duration = on;
-- Run Prisma query
-- Check logs for query count

-- Connection pool monitoring
SELECT COUNT(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'worklenz';
```

### D. Rollback Checklist

```markdown
## Immediate Rollback Procedure

### Step 1: Disable Feature Flags (< 1 minute)
- [ ] SSH into production server
- [ ] Set USE_PRISMA_PROJECTS=false in .env
- [ ] Set USE_PRISMA_TEAMS=false in .env
- [ ] Verify environment variables: `printenv | grep USE_PRISMA`

### Step 2: Restart Application (< 2 minutes)
- [ ] Rolling restart: `pm2 reload worklenz-backend --update-env`
- [ ] Verify processes restarted: `pm2 status`
- [ ] Check logs: `pm2 logs worklenz-backend --lines 100`

### Step 3: Verify Rollback (< 2 minutes)
- [ ] Check error rate in monitoring dashboard
- [ ] Verify latency returns to baseline
- [ ] Test critical endpoints manually
- [ ] Confirm traffic is using SQL (check logs)

### Step 4: Communication
- [ ] Notify team of rollback
- [ ] Update status page (if customer-facing)
- [ ] Document reason for rollback
- [ ] Schedule post-mortem

### Total Time: < 5 minutes
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Next Review:** After Agent 5 and Agent 6 complete Wave 3 execution
**Owner:** Prisma Migration Team
