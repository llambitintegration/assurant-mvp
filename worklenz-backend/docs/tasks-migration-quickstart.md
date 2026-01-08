# Tasks Module Migration - Quick Start Guide

## Overview

This guide provides a rapid implementation path for migrating the Tasks module to Prisma ORM.

## Quick Stats

- **Total Queries**: 31
- **Simple CRUD (Tier 1)**: 5 queries (16%)
- **Complex Queries (Tier 2)**: 2 queries (6%)
- **Stored Procedures (Tier 3)**: 24 queries (78%)
- **Estimated Effort**: 5-7 days
- **Risk Level**: MEDIUM (mitigated by TDD + wrappers)

## Implementation Checklist

### Phase 1: Foundation (Day 1) ✓

- [ ] Create service file: `src/services/tasks/tasks-service.ts`
- [ ] Create DTOs file: `src/services/tasks/types/task-dtos.ts`
- [ ] Add feature flags to `.env`:
  ```bash
  ENABLE_PRISMA_TASKS=true
  ENABLE_PRISMA_TASKS_READ=true
  ENABLE_PRISMA_TASKS_WRITE=true
  ```
- [ ] Implement 5 Tier 1 operations:
  - [ ] `uploadAttachment()`
  - [ ] `updateDuration()`
  - [ ] `deleteById()`
  - [ ] `getTaskStatuses()`
  - [ ] `getProjectTaskAssignees()`
- [ ] Write unit tests for Tier 1 operations

### Phase 2: Core Operations (Days 2-3) ✓

- [ ] Implement 6 critical Tier 3 wrappers:
  - [ ] `createTask()` - create_task()
  - [ ] `updateTask()` - update_task()
  - [ ] `getTaskFormViewModel()` - get_task_form_view_model()
  - [ ] `handleTaskStatusChange()` - handle_on_task_status_change()
  - [ ] `updateTaskStatus()` - update_task_status()
  - [ ] `createTaskAssignee()` - create_task_assignee()
- [ ] Update controller to use service (with feature flag)
- [ ] Create contract tests: `tasks-core-operations.contract.spec.ts`
- [ ] Test assignee notifications
- [ ] Test activity logging

### Phase 3: View Operations (Day 4) ✓

- [ ] Implement 2 Tier 2 operations:
  - [ ] `getTasksBetweenRange()`
  - [ ] `getGanttTasksByProject()`
- [ ] Implement 6 Gantt/View Tier 3 wrappers:
  - [ ] `getGanttTasks()` - get_gantt_tasks()
  - [ ] `getProjectGanttTasks()` - get_project_gantt_tasks()
  - [ ] `getResourceGanttTasks()` - get_resource_gantt_tasks()
  - [ ] `getSelectedTasks()` - get_selected_tasks()
  - [ ] `getUnselectedTasks()` - get_unselected_tasks()
  - [ ] `getTasksByStatus()` - get_tasks_by_status()
- [ ] Create contract tests: `tasks-view-operations.contract.spec.ts`
- [ ] Verify hierarchical data structure

### Phase 4: Bulk Operations (Days 5-6) ✓

- [ ] Implement 2 Quick Create wrappers:
  - [ ] `createQuickTask()` - create_quick_task()
  - [ ] `createHomeTask()` - create_home_task()
- [ ] Implement 9 Bulk Operation wrappers:
  - [ ] `bulkChangeStatus()` - bulk_change_tasks_status()
  - [ ] `bulkChangePriority()` - bulk_change_tasks_priority()
  - [ ] `bulkChangePhase()` - bulk_change_tasks_phase()
  - [ ] `bulkDelete()` - bulk_delete_tasks()
  - [ ] `bulkArchive()` - bulk_archive_tasks()
  - [ ] `bulkAssignMe()` - bulk_assign_to_me()
  - [ ] `bulkAssignOrCreateLabel()` - bulk_assign_or_create_label()
  - [ ] `bulkAssignLabel()` - bulk_assign_label()
  - [ ] `createBulkTaskAssignees()` - create_bulk_task_assignees()
- [ ] Create contract tests: `tasks-bulk-operations.contract.spec.ts`
- [ ] Test transaction atomicity
- [ ] Test failure scenarios

### Phase 5: Testing & Refinement (Day 7) ✓

- [ ] Run all contract tests (target: 85%+ pass rate)
- [ ] Performance benchmarking
- [ ] Integration testing
- [ ] Edge case testing
- [ ] Documentation updates
- [ ] Code review

## Key Files to Create

### Service Layer
```
src/services/tasks/
├── tasks-service.ts              # Main service (31 operations)
└── types/
    └── task-dtos.ts              # All DTOs and interfaces
```

### Tests
```
src/tests/contract/tasks/
├── tasks-core-operations.contract.spec.ts    # CRUD operations
├── tasks-view-operations.contract.spec.ts    # Gantt/views
└── tasks-bulk-operations.contract.spec.ts    # Bulk ops
```

## Critical DTOs

```typescript
// Core DTOs (copy to task-dtos.ts)
export interface ICreateTaskDto {
  name: string;
  project_id: string;
  reporter_id: string;
  team_id: string;
  status_id?: string;
  priority_id?: string;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  total_minutes?: number;
  parent_task_id?: string;
  assignees?: string[];        // team_member_ids
  attachments?: string[];      // attachment_ids
  labels?: Array<{ name: string; color: string }>;
  sort_order?: number;
}

export interface IUpdateTaskDto extends Partial<ICreateTaskDto> {
  id: string;
  inline?: boolean; // Skip label updates if true
}

export interface ITaskFormViewModel {
  task: ITaskDetail;
  priorities: ITaskPriority[];
  projects: IProject[];
  statuses: ITaskStatus[];
  team_members: ITeamMember[];
  phases: IProjectPhase[];
}

export interface IBulkUpdateStatusDto {
  tasks: Array<{ id: string }>;
  status_id: string;
}
```

## Service Template

```typescript
// Copy to tasks-service.ts
import prisma from '../../config/prisma';
import db from '../../config/db';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

export class TasksService {
  private static instance: TasksService;

  public static getInstance(): TasksService {
    if (!TasksService.instance) {
      TasksService.instance = new TasksService();
    }
    return TasksService.instance;
  }

  // ==========================================
  // TIER 1: Simple CRUD (Pure Prisma)
  // ==========================================

  async deleteById(taskId: string): Promise<void> {
    await prisma.tasks.delete({
      where: { id: taskId }
    });
  }

  async updateDuration(taskId: string, startDate: Date, endDate: Date): Promise<void> {
    await prisma.tasks.update({
      where: { id: taskId },
      data: {
        start_date: startDate,
        end_date: endDate
      }
    });
  }

  // ==========================================
  // TIER 3: Typed $queryRaw Wrappers
  // ==========================================

  async createTask(body: string): Promise<any> {
    const usePrisma = FeatureFlagsService.getInstance().isEnabled('tasks', 'write');

    if (usePrisma) {
      const result = await prisma.$queryRaw<any[]>`
        SELECT create_task(${body}::json) AS task
      `;
      return result[0]?.task;
    } else {
      const result = await db.query('SELECT create_task($1) AS task', [body]);
      return result.rows[0]?.task;
    }
  }

  async updateTask(body: string): Promise<any> {
    const usePrisma = FeatureFlagsService.getInstance().isEnabled('tasks', 'write');

    if (usePrisma) {
      const result = await prisma.$queryRaw<any[]>`
        SELECT update_task(${body}::json) AS task
      `;
      return result[0]?.task;
    } else {
      const result = await db.query('SELECT update_task($1) AS task', [body]);
      return result.rows[0]?.task;
    }
  }

  async getTaskFormViewModel(
    userId: string,
    teamId: string,
    taskId: string,
    projectId: string
  ): Promise<any> {
    const usePrisma = FeatureFlagsService.getInstance().isEnabled('tasks', 'read');

    if (usePrisma) {
      const result = await prisma.$queryRaw<any[]>`
        SELECT get_task_form_view_model(
          ${userId}::uuid,
          ${teamId}::uuid,
          ${taskId}::uuid,
          ${projectId}::uuid
        ) AS view_model
      `;
      return result[0]?.view_model;
    } else {
      const result = await db.query(
        'SELECT get_task_form_view_model($1, $2, $3, $4) AS view_model',
        [userId, teamId, taskId, projectId]
      );
      return result.rows[0]?.view_model;
    }
  }

  // Add remaining 28 operations...
}
```

## Controller Integration Example

```typescript
// In tasks-controller.ts
import { TasksService } from '../services/tasks/tasks-service';

export default class TasksController extends TasksControllerBase {
  private static tasksService = TasksService.getInstance();

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;
    const teamId = req.user?.team_id as string;

    if (req.body.attachments_raw) {
      req.body.attachments = await this.uploadAttachment(req.body.attachments_raw, teamId, userId);
    }

    // Use service instead of direct db.query
    const task = await this.tasksService.createTask(JSON.stringify(req.body));

    // Notifications remain unchanged
    for (const member of task?.assignees || []) {
      NotificationsService.createTaskUpdate(
        "ASSIGN",
        userId,
        task.id,
        member.user_id,
        member.team_id
      );
    }

    return res.status(200).send(new ServerResponse(true, task));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    await this.tasksService.deleteById(req.params.id);
    return res.status(200).send(new ServerResponse(true, []));
  }
}
```

## Contract Test Template

```typescript
// tasks-core-operations.contract.spec.ts
import db from '../../../config/db';
import { getTestTeam, getTestUser } from '../setup';
import { TasksService } from '../../../services/tasks/tasks-service';

describe('Tasks Core Operations - Contract Tests', () => {
  let tasksService: TasksService;
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    const team = await getTestTeam();
    testTeamId = team.id;

    const user = await getTestUser(testTeamId);
    testUserId = user.id;

    // Create test project
    const projectResult = await db.query(
      `INSERT INTO projects (name, key, team_id, owner_id, status_id, color_code)
       VALUES ($1, $2, $3, $4,
         (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
         '#70a6f3')
       RETURNING id`,
      ['Tasks Test Project', 'TTP', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;

    tasksService = TasksService.getInstance();
  });

  describe('createTask() - create_task stored procedure', () => {
    it('should create task with Prisma matching SQL behavior', async () => {
      const statusResult = await db.query(
        'SELECT id FROM task_statuses WHERE project_id = $1 LIMIT 1',
        [testProjectId]
      );
      const statusId = statusResult.rows[0].id;

      const taskDto = {
        name: 'Contract Test Task',
        project_id: testProjectId,
        reporter_id: testUserId,
        status_id: statusId,
        assignees: []
      };

      // SQL version
      const sqlResult = await db.query(
        'SELECT create_task($1) AS task',
        [JSON.stringify(taskDto)]
      );
      const sqlTask = sqlResult.rows[0].task;

      // Prisma version
      const prismaTask = await tasksService.createTask(JSON.stringify(taskDto));

      // Verify structure matches
      expect(prismaTask).toHaveProperty('task');
      expect(prismaTask.task).toHaveProperty('id');
      expect(prismaTask.task.name).toBe(taskDto.name);

      // Verify both created actual tasks
      const sqlTaskCheck = await db.query('SELECT * FROM tasks WHERE id = $1', [sqlTask.task.id]);
      const prismaTaskCheck = await db.query('SELECT * FROM tasks WHERE id = $1', [prismaTask.task.id]);

      expect(sqlTaskCheck.rows.length).toBe(1);
      expect(prismaTaskCheck.rows.length).toBe(1);
    });
  });

  describe('deleteById() - Simple DELETE', () => {
    it('should delete task with Prisma', async () => {
      // Create test task
      const createResult = await db.query(
        `INSERT INTO tasks (name, project_id, reporter_id, status_id, priority_id)
         VALUES ($1, $2, $3,
           (SELECT id FROM task_statuses WHERE project_id = $2 LIMIT 1),
           (SELECT id FROM task_priorities WHERE value = 1 LIMIT 1))
         RETURNING id`,
        ['Task to Delete', testProjectId, testUserId]
      );
      const taskId = createResult.rows[0].id;

      // Delete with service
      await tasksService.deleteById(taskId);

      // Verify deletion
      const checkResult = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      expect(checkResult.rows.length).toBe(0);
    });
  });
});
```

## Testing Commands

```bash
# Run all contract tests
npm test -- tasks.*contract

# Run specific test suite
npm test -- tasks-core-operations.contract

# Run with coverage
npm test -- --coverage tasks

# Run in watch mode
npm test -- --watch tasks
```

## Feature Flag Testing

```bash
# Test with Prisma enabled
ENABLE_PRISMA_TASKS=true npm test

# Test with Prisma disabled (SQL fallback)
ENABLE_PRISMA_TASKS=false npm test

# Test write operations only
ENABLE_PRISMA_TASKS_WRITE=true npm test
```

## Common Issues & Solutions

### Issue: Assignee notifications not firing
**Solution**: Verify old_assignees/new_assignees diff in update_task wrapper

### Issue: Activity logs missing
**Solution**: Ensure bulk operations call stored procedures that include logging

### Issue: Sort order conflicts
**Solution**: Use update_task_status() procedure for status changes (handles reordering)

### Issue: Transaction rollback not working
**Solution**: Wrap bulk operations in prisma.$transaction()

## Performance Targets

- Simple CRUD: < 50ms
- create_task(): < 200ms
- get_task_form_view_model(): < 300ms
- Bulk operations (100 tasks): < 2s

## Rollback Procedures

### Instant Rollback
```bash
# In .env
ENABLE_PRISMA_TASKS=false

# Restart
npm run dev
```

### Partial Rollback
```bash
# Disable writes only
ENABLE_PRISMA_TASKS_WRITE=false

# Disable reads only
ENABLE_PRISMA_TASKS_READ=false
```

## Success Metrics

- ✅ All 31 operations migrated
- ✅ 85%+ contract test pass rate
- ✅ No performance regressions > 10%
- ✅ Feature flags working
- ✅ Rollback tested
- ✅ Documentation complete

## Next Steps After Completion

1. Monitor production metrics
2. Gradual rollout (10% → 50% → 100%)
3. Collect performance data
4. Optimize slow paths
5. Refactor wrappers to pure Prisma (Phase 4)

## Reference Files

- Full Analysis: `/docs/tasks-migration-analysis.md`
- Projects Service: `/src/services/projects/projects-service.ts`
- Contract Test Example: `/src/tests/contract/projects/wave3-write-operations.contract.spec.ts`
- Stored Procedures: `/database/sql/4_functions.sql`

## Timeline

- Day 1: Foundation (5 operations)
- Days 2-3: Core CRUD (6 operations)
- Day 4: Views (8 operations)
- Days 5-6: Bulk ops (11 operations)
- Day 7: Testing & polish

**Total: 5-7 days**
