# Tasks Module Migration to Prisma - Comprehensive Analysis

## Executive Summary

**Objective**: Migrate Tasks module (tasks-controller.ts) from raw SQL (`db.query`) to Prisma ORM
**Scope**: 31 database queries across task CRUD, bulk operations, and complex views
**Complexity**: MEDIUM-HIGH (78% require typed $queryRaw wrappers)
**Timeline**: 5-7 days
**Risk**: MEDIUM (mitigated by TDD approach and typed wrappers)

## Query Inventory Analysis

### Complete List of 31 db.query Operations

| Line | Method | Query Type | Tier | Complexity | Priority |
|------|--------|------------|------|------------|----------|
| 44 | uploadAttachment | INSERT task_attachments | 1 | LOW | P2 |
| 78 | create | create_task() | 3 | HIGH | P1 |
| 97 | getGanttTasks | get_gantt_tasks() | 3 | HIGH | P2 |
| 138 | notifyStatusChange | handle_on_task_status_change() | 3 | HIGH | P1 |
| 166 | update | update_task() | 3 | HIGH | P1 |
| 189 | updateDuration | UPDATE tasks | 1 | LOW | P2 |
| 202 | updateStatus | update_task_status() | 3 | MEDIUM-HIGH | P1 |
| 213 | getTasksByProject | get_project_gantt_tasks() | 3 | HIGH | P2 |
| 246 | getTasksBetweenRange | Complex JOIN | 2 | MEDIUM | P3 |
| 291 | getGanttTasksByProject | Complex SELECT | 2 | MEDIUM | P3 |
| 322 | getProjectTasksByTeam | get_resource_gantt_tasks() | 3 | HIGH | P2 |
| 330 | getSelectedTasksByProject | get_selected_tasks() | 3 | MEDIUM | P3 |
| 338 | getUnselectedTasksByProject | get_unselected_tasks() | 3 | MEDIUM | P3 |
| 356 | getProjectTasksByStatusV2 | SELECT task_statuses | 1 | LOW | P2 |
| 364 | getProjectTasksByStatusV2 (loop) | get_tasks_by_status() | 3 | HIGH | P2 |
| 381 | getProjectTasksByStatus | get_tasks_by_status() | 3 | HIGH | P2 |
| 400 | deleteById | DELETE tasks | 1 | LOW | P1 |
| 407 | getById | get_task_form_view_model() | 3 | HIGH | P1 |
| 468 | createQuickTask | create_quick_task() | 3 | MEDIUM | P2 |
| 499 | createHomeTask | create_home_task() | 3 | MEDIUM | P2 |
| 507 | bulkChangeStatus | bulk_change_tasks_status() | 3 | HIGH | P1 |
| 518 | bulkChangePriority | bulk_change_tasks_priority() | 3 | MEDIUM | P2 |
| 529 | bulkChangePhase | bulk_change_tasks_phase() | 3 | MEDIUM | P2 |
| 544 | bulkDelete | bulk_delete_tasks() | 3 | MEDIUM-HIGH | P1 |
| 553 | bulkArchive | bulk_archive_tasks() | 3 | MEDIUM | P2 |
| 568 | bulkAssignMe | bulk_assign_to_me() | 3 | MEDIUM-HIGH | P2 |
| 602 | bulkAssignLabel | bulk_assign_or_create_label() | 3 | MEDIUM | P3 |
| 605 | bulkAssignLabel (else) | bulk_assign_label() | 3 | MEDIUM | P3 |
| 630 | createTaskAssignee | create_task_assignee() | 3 | MEDIUM | P1 |
| 636 | createTaskBulkAssignees | create_bulk_task_assignees() | 3 | MEDIUM | P2 |
| 652 | getProjectTaskAssignees | SELECT with JOINs | 2 | LOW-MEDIUM | P3 |

### Categorization by Tier

#### Tier 1: Pure Prisma (5 queries - 16%)
**Characteristics**: Simple CRUD operations, no complex business logic
**Migration Strategy**: Direct Prisma method calls

1. **uploadAttachment** (Line 44)
   - INSERT into task_attachments
   - Replace with: `prisma.task_attachments.create()`

2. **updateDuration** (Line 189)
   - UPDATE tasks SET start_date, end_date
   - Replace with: `prisma.tasks.update()`

3. **getProjectTasksByStatusV2 - Statuses** (Line 356)
   - SELECT task_statuses with category info
   - Replace with: `prisma.task_statuses.findMany({ include: { sys_task_status_categories: true } })`

4. **deleteById** (Line 400)
   - DELETE FROM tasks
   - Replace with: `prisma.tasks.delete()`

5. **getProjectTaskAssignees** (Line 652)
   - SELECT project members with team info
   - Replace with: `prisma.project_members.findMany({ include: { team_members: true } })`

#### Tier 2: Prisma + Complex Includes (2 queries - 6%)
**Characteristics**: Multi-table joins, can be expressed with Prisma includes
**Migration Strategy**: Prisma with nested includes and select

1. **getTasksBetweenRange** (Line 246)
   - Complex query with tasks, assignees, projects
   - Replace with: Prisma findMany with nested includes

2. **getGanttTasksByProject** (Line 291)
   - SELECT tasks with parent/child relationships
   - Replace with: Prisma recursive includes

#### Tier 3: Typed $queryRaw Wrappers (24 queries - 78%)
**Characteristics**: Complex stored procedures with business logic
**Migration Strategy**: Create typed $queryRaw wrappers maintaining exact behavior

##### Critical Core Operations (6)
1. **create_task()** (Line 78)
   - Creates task + assignees + attachments + labels in transaction
   - Returns full view model
   - **Wrapper**: `createTask(dto: ICreateTaskDto): Promise<ITaskViewModel>`

2. **update_task()** (Line 166)
   - Updates task + manages assignees + labels
   - Returns old/new assignees for notifications
   - **Wrapper**: `updateTask(dto: IUpdateTaskDto): Promise<ITaskUpdateResult>`

3. **get_task_form_view_model()** (Line 407)
   - Returns task with all related data (priorities, statuses, members, etc.)
   - **Wrapper**: `getTaskFormViewModel(userId: string, teamId: string, taskId: string, projectId: string): Promise<ITaskFormViewModel>`

4. **handle_on_task_status_change()** (Line 138)
   - Handles status change notifications
   - **Wrapper**: `handleTaskStatusChange(userId: string, taskId: string, statusId: string): Promise<IStatusChangeResult>`

5. **update_task_status()** (Line 202)
   - Updates status + reorders tasks
   - **Wrapper**: `updateTaskStatus(taskId: string, projectId: string, statusId: string, fromIndex: number, toIndex: number): Promise<any>`

6. **create_task_assignee()** (Line 630)
   - Creates task assignee with project member lookup
   - **Wrapper**: `createTaskAssignee(teamMemberId: string, projectId: string, taskId: string, userId: string): Promise<any>`

##### Gantt & View Operations (6)
7. **get_gantt_tasks()** (Line 97)
8. **get_project_gantt_tasks()** (Line 213)
9. **get_resource_gantt_tasks()** (Line 322)
10. **get_selected_tasks()** (Line 330)
11. **get_unselected_tasks()** (Line 338)
12. **get_tasks_by_status()** (Lines 364, 381)

##### Quick Create Operations (2)
13. **create_quick_task()** (Line 468)
14. **create_home_task()** (Line 499)

##### Bulk Operations (10)
15. **bulk_change_tasks_status()** (Line 507)
16. **bulk_change_tasks_priority()** (Line 518)
17. **bulk_change_tasks_phase()** (Line 529)
18. **bulk_delete_tasks()** (Line 544)
19. **bulk_archive_tasks()** (Line 553)
20. **bulk_assign_to_me()** (Line 568)
21. **bulk_assign_or_create_label()** (Line 602)
22. **bulk_assign_label()** (Line 605)
23. **create_bulk_task_assignees()** (Line 636)

## Data Model Analysis

### Core Entities

```typescript
// Main task entity
model tasks {
  id: string (UUID)
  name: string
  description: string?
  done: boolean
  total_minutes: Decimal
  start_date: DateTime?
  end_date: DateTime?
  priority_id: string -> task_priorities
  project_id: string -> projects
  reporter_id: string -> users
  parent_task_id: string? -> tasks (self-reference)
  status_id: string -> task_statuses
  sort_order: int
  // ... 10+ additional fields
}

// Task assignees (junction table)
model tasks_assignees {
  task_id: string -> tasks
  project_member_id: string -> project_members
  team_member_id: string -> team_members
  assigned_by: string -> users
}

// Related entities
- task_statuses (status workflow)
- task_priorities (priority levels)
- task_labels (many-to-many with team_labels)
- task_attachments (file uploads)
- task_comments (with mentions)
- task_activity_logs (audit trail)
- task_dependencies (task relationships)
```

### Key Relationships

1. **Tasks → Projects** (many-to-one)
   - Every task belongs to a project
   - Cascade delete on project deletion

2. **Tasks → Tasks** (self-reference for parent/child)
   - Hierarchical task structure
   - parent_task_id references tasks.id

3. **Tasks → Assignees** (many-to-many through tasks_assignees)
   - Complex junction with project_member_id AND team_member_id
   - Tracks who assigned (assigned_by)

4. **Tasks → Status** (many-to-one)
   - task_statuses with category (Todo, In Progress, Done)
   - Controls workflow and completion

5. **Tasks → Labels** (many-to-many through task_labels)
   - Tags for organization
   - Team-scoped labels

## Stored Procedure Deep Dive

### create_task() Analysis

**Location**: `database/sql/4_functions.sql:932-980`

**Business Logic**:
1. Insert base task record
2. For each assignee in JSON array:
   - Call create_task_assignee() sub-procedure
3. For each attachment in JSON array:
   - Update task_attachments.task_id
4. For each label in JSON array:
   - Call assign_or_create_label()
5. Return get_task_form_view_model()

**Input**: JSON object with:
- name, priority_id, project_id, reporter_id
- start, end, total_minutes, description
- parent_task_id, status_id, sort_order
- assignees: UUID[]
- attachments: UUID[]
- labels: {name, color}[]

**Output**: Full task view model (from get_task_form_view_model)

**Migration Strategy**:
```typescript
// Option 1: Pure Typed Wrapper (RECOMMENDED)
async createTask(body: string): Promise<any> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT create_task(${body}::json) AS task
  `;
  return result[0]?.task;
}

// Option 2: Hybrid (Prisma + wrapper for sub-procs)
async createTask(dto: ICreateTaskDto): Promise<ITaskViewModel> {
  return await prisma.$transaction(async (tx) => {
    // Create base task with Prisma
    const task = await tx.tasks.create({...});

    // Use wrapper for complex assignee logic
    for (const assigneeId of dto.assignees) {
      await this.createTaskAssignee(assigneeId, dto.project_id, task.id, dto.reporter_id);
    }

    // Return view model
    return await this.getTaskFormViewModel(...);
  });
}
```

**Recommendation**: Start with Option 1 (typed wrapper) for safety, refactor to Option 2 in future iterations.

### update_task() Analysis

**Location**: `database/sql/4_functions.sql:5581-5656`

**Business Logic**:
1. Update base task fields
2. Get old assignees (before changes)
3. Delete all existing assignees
4. For each new assignee:
   - Call create_task_assignee()
5. Handle inline vs full label updates
6. Get new assignees (after changes)
7. Return {id, old_assignees, new_assignees}

**Critical Feature**: Returns diff of assignees for notification logic

**Migration Strategy**: Typed wrapper (same as create_task)

### get_task_form_view_model() Analysis

**Location**: `database/sql/4_functions.sql:3461-3558`

**Returns**:
```json
{
  "task": { /* full task with all fields */ },
  "priorities": [ /* all task priorities */ ],
  "projects": [ /* user's projects */ ],
  "statuses": [ /* project statuses */ ],
  "team_members": [ /* project members */ ],
  "phases": [ /* project phases */ ]
}
```

**Migration Strategy**: Typed wrapper (complex multi-table query)

### Bulk Operations Pattern

All bulk operations follow similar pattern:
1. Loop through JSON array of tasks
2. Perform operation on each task
3. Track failures/successes
4. Insert activity logs
5. Return results

**Example: bulk_change_tasks_status()**
```sql
FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
LOOP
  IF can_update_task((_task ->> 'id')::UUID, (_body ->> 'status_id')::UUID)
  THEN
    UPDATE tasks SET status_id = ...
    INSERT INTO task_activity_logs ...
  ELSE
    _failed_tasks := array_append(_failed_tasks, (_task ->> 'id')::UUID);
  END IF;
END LOOP;
```

**Migration Strategy**: Typed wrapper + Prisma transaction for atomicity

## DTOs Design

```typescript
/**
 * Base task data transfer object
 */
export interface ITaskBase {
  name: string;
  description?: string;
  project_id: string;
  status_id: string;
  priority_id?: string;
  start_date?: Date;
  end_date?: Date;
  total_minutes?: number;
  parent_task_id?: string;
}

/**
 * Create task DTO
 * Used by: create(), createQuickTask(), createHomeTask()
 */
export interface ICreateTaskDto extends ITaskBase {
  reporter_id: string;
  team_id: string;
  assignees?: string[]; // team_member_ids
  attachments?: string[]; // attachment_ids
  labels?: Array<{ name: string; color: string }>;
  sort_order?: number;
}

/**
 * Update task DTO
 * Used by: update()
 */
export interface IUpdateTaskDto extends Partial<ITaskBase> {
  id: string;
  reporter_id: string;
  team_id: string;
  assignees?: string[];
  labels?: Array<{ name: string; color: string }>;
  inline?: boolean; // If true, skip label updates
}

/**
 * Task view model (returned by getById)
 */
export interface ITaskFormViewModel {
  task: ITaskDetail;
  priorities: ITaskPriority[];
  projects: IProject[];
  statuses: ITaskStatus[];
  team_members: ITeamMember[];
  phases: IProjectPhase[];
}

/**
 * Detailed task info
 */
export interface ITaskDetail extends ITaskBase {
  id: string;
  task_no: number;
  done: boolean;
  archived: boolean;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  assignees: ITaskAssignee[];
  labels: ITaskLabel[];
  attachments: ITaskAttachment[];
  // Additional computed fields
  timer_start_time?: number;
  total_hours?: number;
  total_minutes_display?: number;
  complete_ratio?: number;
  status_color?: string;
}

/**
 * Bulk status update DTO
 */
export interface IBulkUpdateStatusDto {
  tasks: Array<{ id: string }>;
  status_id: string;
}

/**
 * Bulk priority update DTO
 */
export interface IBulkUpdatePriorityDto {
  tasks: Array<{ id: string }>;
  priority_id: string;
}

/**
 * Bulk phase update DTO
 */
export interface IBulkUpdatePhaseDto {
  tasks: Array<{ id: string }>;
  phase_id: string;
}

/**
 * Bulk delete DTO
 */
export interface IBulkDeleteDto {
  tasks: Array<{ id: string }>;
}

/**
 * Bulk archive DTO
 */
export interface IBulkArchiveDto {
  tasks: Array<{ id: string }>;
  type: 'archive' | 'unarchive';
}

/**
 * Bulk assign to me DTO
 */
export interface IBulkAssignMeDto {
  tasks: Array<{ id: string }>;
  team_id: string;
  user_id: string;
}

/**
 * Bulk assign label DTO
 */
export interface IBulkAssignLabelDto {
  tasks: Array<{ id: string }>;
  label_id?: string;
  text?: string; // For creating new label
  team_id?: string;
  color?: string;
}

/**
 * Task update result (from update_task)
 */
export interface ITaskUpdateResult {
  id: string;
  old_assignees: ITaskAssignee[];
  new_assignees: ITaskAssignee[];
}

/**
 * Status change result
 */
export interface IStatusChangeResult {
  message: string;
  project_id: string;
  members: Array<{
    user_id: string;
    team_id: string;
    socket_id: string;
  }>;
}
```

## Service Layer Architecture

### File Structure

```
src/services/tasks/
├── tasks-service.ts              # Main service (singleton)
├── tasks-bulk-operations.ts      # Bulk operation helpers
├── tasks-gantt.ts                # Gantt view helpers
├── tasks-view-models.ts          # View model builders
└── types/
    ├── task-dtos.ts              # All DTOs
    └── task-models.ts            # Return types
```

### TasksService Class Structure

```typescript
/**
 * Tasks Service
 * Handles task management using Prisma ORM
 *
 * Migration Strategy:
 * - Tier 1: Pure Prisma methods
 * - Tier 2: Prisma with complex includes
 * - Tier 3: Typed $queryRaw wrappers for stored procedures
 */
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

  /**
   * Upload task attachment
   * Replaces: tasks-controller.ts:44
   */
  async uploadAttachment(dto: IUploadAttachmentDto): Promise<ITaskAttachment> {
    return await prisma.task_attachments.create({
      data: {
        name: dto.file_name,
        task_id: null, // Updated later
        team_id: dto.team_id,
        project_id: dto.project_id,
        uploaded_by: dto.user_id,
        size: dto.size,
        type: dto.type
      },
      select: {
        id: true,
        name: true,
        size: true,
        type: true,
        created_at: true
      }
    });
  }

  /**
   * Update task duration
   * Replaces: tasks-controller.ts:189
   */
  async updateDuration(taskId: string, startDate: Date, endDate: Date): Promise<void> {
    await prisma.tasks.update({
      where: { id: taskId },
      data: {
        start_date: startDate,
        end_date: endDate
      }
    });
  }

  /**
   * Delete task by ID
   * Replaces: tasks-controller.ts:400
   */
  async deleteById(taskId: string): Promise<void> {
    await prisma.tasks.delete({
      where: { id: taskId }
    });
  }

  /**
   * Get task statuses for project
   * Replaces: tasks-controller.ts:356
   */
  async getTaskStatuses(projectId: string, teamId: string): Promise<ITaskStatus[]> {
    return await prisma.task_statuses.findMany({
      where: {
        project_id: projectId,
        team_id: teamId
      },
      include: {
        sys_task_status_categories: {
          select: {
            color_code: true
          }
        }
      },
      orderBy: {
        sort_order: 'asc'
      }
    });
  }

  /**
   * Get project task assignees
   * Replaces: tasks-controller.ts:652
   */
  async getProjectTaskAssignees(projectId: string): Promise<ITeamMember[]> {
    const members = await prisma.project_members.findMany({
      where: {
        project_id: projectId,
        tasks_assignees: {
          some: {}
        }
      },
      include: {
        team_members: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                avatar_url: true
              }
            }
          }
        }
      }
    });

    return members.map(pm => ({
      id: pm.team_member_id,
      name: pm.team_members.user?.name || '',
      email: pm.team_members.user?.email || '',
      avatar_url: pm.team_members.user?.avatar_url || null
    }));
  }

  // ==========================================
  // TIER 2: Complex Queries (Prisma + Includes)
  // ==========================================

  /**
   * Get tasks between date range
   * Replaces: tasks-controller.ts:246
   */
  async getTasksBetweenRange(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    const members = await prisma.project_members.findMany({
      where: { project_id: projectId },
      include: {
        tasks_assignees: {
          include: {
            tasks: {
              where: {
                archived: false,
                start_date: { not: null },
                end_date: { not: null }
              },
              include: {
                projects: {
                  select: {
                    color_code: true
                  }
                },
                task_statuses: {
                  select: {
                    name: true
                  }
                }
              },
              orderBy: {
                start_date: 'asc'
              }
            }
          }
        }
      }
    });

    // Transform to match expected format
    const result: any = {};
    for (const member of members) {
      result[member.id] = member.tasks_assignees.map(ta => ({
        id: ta.tasks.id,
        name: ta.tasks.name,
        start_date: ta.tasks.start_date,
        end_date: ta.tasks.end_date,
        project_id: ta.tasks.project_id,
        priority_id: ta.tasks.priority_id,
        done: ta.tasks.done,
        color_code: ta.tasks.projects.color_code,
        status: ta.tasks.task_statuses.name
      }));
    }

    return result;
  }

  /**
   * Get gantt tasks by project
   * Replaces: tasks-controller.ts:291
   */
  async getGanttTasksByProject(projectId: string): Promise<any[]> {
    const tasks = await prisma.tasks.findMany({
      where: {
        project_id: projectId,
        parent_task_id: null,
        archived: false
      },
      include: {
        projects: {
          select: {
            color_code: true
          }
        },
        task_statuses: {
          select: {
            name: true
          }
        },
        tasks: { // parent task reference
          select: {
            name: true
          }
        },
        other_tasks: { // child tasks
          where: {
            archived: false
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      start_date: task.start_date,
      end_date: task.end_date,
      project_id: task.project_id,
      priority_id: task.priority_id,
      done: task.done,
      parent_task_id: task.parent_task_id,
      is_sub_task: task.parent_task_id !== null,
      parent_task_name: task.tasks?.name || null,
      sub_tasks_count: task.other_tasks.length,
      color_code: task.projects.color_code,
      status: task.task_statuses.name,
      show_sub_tasks: false,
      sub_tasks: []
    }));
  }

  // ==========================================
  // TIER 3: Typed $queryRaw Wrappers
  // ==========================================

  /**
   * Create task (stored procedure wrapper)
   * Replaces: tasks-controller.ts:78
   *
   * Uses: create_task() stored procedure
   * Business Logic:
   * - Creates task record
   * - Assigns team members
   * - Attaches files
   * - Applies labels
   * - Returns full view model
   */
  async createTask(body: string): Promise<any> {
    const usePrisma = FeatureFlagsService.getInstance().isEnabled('tasks', 'write');

    if (usePrisma) {
      // Use typed wrapper
      const result = await prisma.$queryRaw<any[]>`
        SELECT create_task(${body}::json) AS task
      `;
      return result[0]?.task;
    } else {
      // Fallback to SQL
      const result = await db.query(
        'SELECT create_task($1) AS task',
        [body]
      );
      return result.rows[0]?.task;
    }
  }

  /**
   * Update task (stored procedure wrapper)
   * Replaces: tasks-controller.ts:166
   *
   * Uses: update_task() stored procedure
   * Returns: { id, old_assignees[], new_assignees[] }
   */
  async updateTask(body: string): Promise<ITaskUpdateResult> {
    const usePrisma = FeatureFlagsService.getInstance().isEnabled('tasks', 'write');

    if (usePrisma) {
      const result = await prisma.$queryRaw<any[]>`
        SELECT update_task(${body}::json) AS task
      `;
      return result[0]?.task;
    } else {
      const result = await db.query(
        'SELECT update_task($1) AS task',
        [body]
      );
      return result.rows[0]?.task;
    }
  }

  /**
   * Get task form view model (stored procedure wrapper)
   * Replaces: tasks-controller.ts:407
   *
   * Uses: get_task_form_view_model() stored procedure
   * Returns: Full task with all related dropdowns
   */
  async getTaskFormViewModel(
    userId: string,
    teamId: string,
    taskId: string,
    projectId: string
  ): Promise<ITaskFormViewModel> {
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

  /**
   * Handle task status change (stored procedure wrapper)
   * Replaces: tasks-controller.ts:138
   *
   * Uses: handle_on_task_status_change() stored procedure
   * Side Effects: Creates notifications
   */
  async handleTaskStatusChange(
    userId: string,
    taskId: string,
    statusId: string
  ): Promise<IStatusChangeResult> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT handle_on_task_status_change(
        ${userId}::uuid,
        ${taskId}::uuid,
        ${statusId}::uuid
      ) AS res
    `;
    return result[0]?.res;
  }

  /**
   * Update task status with reordering
   * Replaces: tasks-controller.ts:202
   */
  async updateTaskStatus(
    taskId: string,
    projectId: string,
    statusId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<any> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT update_task_status(
        ${taskId}::uuid,
        ${projectId}::uuid,
        ${statusId}::uuid,
        ${fromIndex}::integer,
        ${toIndex}::integer
      ) AS status
    `;
    return result[0]?.status;
  }

  /**
   * Create task assignee (helper procedure)
   * Replaces: tasks-controller.ts:630
   */
  async createTaskAssignee(
    teamMemberId: string,
    projectId: string,
    taskId: string,
    userId: string
  ): Promise<any> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT create_task_assignee(
        ${teamMemberId}::uuid,
        ${projectId}::uuid,
        ${taskId}::uuid,
        ${userId}::uuid
      )
    `;
    return result[0];
  }

  // ... Additional Tier 3 wrappers for:
  // - get_gantt_tasks()
  // - get_project_gantt_tasks()
  // - get_resource_gantt_tasks()
  // - get_selected_tasks()
  // - get_unselected_tasks()
  // - get_tasks_by_status()
  // - create_quick_task()
  // - create_home_task()
  // - All bulk operations
}
```

## Migration Phases

### Phase 1: Foundation (Day 1)

**Goal**: Set up service layer and simple operations

1. **Create Service File**
   - `src/services/tasks/tasks-service.ts`
   - Singleton pattern
   - Feature flag integration

2. **Define All DTOs**
   - `src/services/tasks/types/task-dtos.ts`
   - Complete type coverage for all 31 operations

3. **Implement Tier 1 Operations** (5 queries)
   - uploadAttachment
   - updateDuration
   - deleteById
   - getTaskStatuses
   - getProjectTaskAssignees

4. **Add Feature Flag**
   - `ENABLE_PRISMA_TASKS=true`
   - `ENABLE_PRISMA_TASKS_READ=true`
   - `ENABLE_PRISMA_TASKS_WRITE=true`

**Deliverables**:
- Service skeleton with 5 working Tier 1 methods
- Complete DTO definitions
- Feature flag integration
- Basic unit tests

### Phase 2: Core Operations (Days 2-3)

**Goal**: Migrate critical task CRUD operations

1. **Implement Core Tier 3 Wrappers**
   - createTask (create_task)
   - updateTask (update_task)
   - getTaskFormViewModel (get_task_form_view_model)
   - handleTaskStatusChange
   - updateTaskStatus
   - createTaskAssignee

2. **Integrate with Controller**
   - Update tasks-controller.ts to use service
   - Maintain backward compatibility with feature flag

3. **Contract Tests**
   - Create `tasks-core-operations.contract.spec.ts`
   - Test each operation for SQL/Prisma parity
   - Verify assignee notifications
   - Verify activity logging

**Deliverables**:
- 6 critical operations migrated
- Contract tests for core CRUD
- Controller integration complete

### Phase 3: View Operations (Day 4)

**Goal**: Migrate Gantt and view queries

1. **Implement Tier 2 Operations**
   - getTasksBetweenRange (Prisma includes)
   - getGanttTasksByProject (Prisma includes)

2. **Implement Gantt Tier 3 Wrappers**
   - getGanttTasks
   - getProjectGanttTasks
   - getResourceGanttTasks
   - getSelectedTasks
   - getUnselectedTasks
   - getTasksByStatus

3. **Contract Tests**
   - Create `tasks-view-operations.contract.spec.ts`
   - Test view model structure
   - Verify hierarchical data

**Deliverables**:
- 8 view operations migrated
- Contract tests for views
- Gantt functionality verified

### Phase 4: Quick Create & Bulk Operations (Days 5-6)

**Goal**: Migrate bulk operations and quick task creation

1. **Implement Quick Create Wrappers**
   - createQuickTask
   - createHomeTask

2. **Implement Bulk Operation Wrappers**
   - bulkChangeStatus
   - bulkChangePriority
   - bulkChangePhase
   - bulkDelete
   - bulkArchive
   - bulkAssignMe
   - bulkAssignLabel
   - createBulkTaskAssignees

3. **Contract Tests**
   - Create `tasks-bulk-operations.contract.spec.ts`
   - Test transaction atomicity
   - Verify activity log creation
   - Test failure handling

**Deliverables**:
- 11 bulk operations migrated
- Contract tests for bulk ops
- Transaction safety verified

### Phase 5: Testing & Refinement (Day 7)

**Goal**: Comprehensive testing and bug fixes

1. **Integration Tests**
   - End-to-end task workflows
   - Create → Update → Assign → Complete
   - Bulk operations with rollback

2. **Performance Testing**
   - Benchmark Prisma vs SQL
   - Identify slow queries
   - Add indexes if needed

3. **Edge Case Testing**
   - Null handling
   - Concurrent updates
   - Orphaned records

4. **Documentation**
   - Migration guide
   - API documentation
   - Rollback procedures

**Deliverables**:
- 85%+ contract test pass rate
- Performance benchmarks
- Complete documentation

## Testing Strategy

### Contract Test Structure

```typescript
/**
 * Tasks Module - Contract Tests
 * Validates SQL/Prisma parity for all 31 operations
 */

describe('Tasks Module Migration - Contract Tests', () => {
  let tasksService: TasksService;
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let testTaskId: string;

  beforeAll(async () => {
    // Setup test data
    const team = await getTestTeam();
    testTeamId = team.id;

    const user = await getTestUser(testTeamId);
    testUserId = user.id;

    // Create test project with statuses
    testProjectId = await createTestProject(testTeamId, testUserId);

    tasksService = TasksService.getInstance();
  });

  describe('Tier 1: Simple CRUD', () => {
    it('should delete task with Prisma matching SQL behavior', async () => {
      // Create task with SQL
      const sqlTask = await db.query('INSERT INTO tasks (...) RETURNING id');
      const sqlTaskId = sqlTask.rows[0].id;

      // Delete with Prisma
      await tasksService.deleteById(sqlTaskId);

      // Verify deletion
      const deleted = await db.query('SELECT * FROM tasks WHERE id = $1', [sqlTaskId]);
      expect(deleted.rows.length).toBe(0);
    });

    it('should update task duration matching SQL', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-15');

      // SQL version
      const sqlResult = await db.query(
        'UPDATE tasks SET start_date = $1, end_date = $2 WHERE id = $3 RETURNING *',
        [start, end, testTaskId]
      );

      // Prisma version (on copy of task)
      const prismaTaskId = await createTaskCopy(testTaskId);
      await tasksService.updateDuration(prismaTaskId, start, end);

      const prismaResult = await db.query(
        'SELECT * FROM tasks WHERE id = $1',
        [prismaTaskId]
      );

      // Compare results
      expectTasksEqual(sqlResult.rows[0], prismaResult.rows[0], {
        ignoreFields: ['id', 'updated_at']
      });
    });
  });

  describe('Tier 3: create_task() - Core Creation', () => {
    it('should create task with assignees matching stored procedure', async () => {
      const taskDto = {
        name: 'Test Task',
        project_id: testProjectId,
        reporter_id: testUserId,
        status_id: await getDefaultStatusId(testProjectId),
        priority_id: await getDefaultPriorityId(),
        assignees: [await getTestTeamMemberId(testUserId)]
      };

      // SQL version
      const sqlResult = await db.query(
        'SELECT create_task($1) AS task',
        [JSON.stringify(taskDto)]
      );
      const sqlTask = sqlResult.rows[0].task;

      // Prisma version
      const prismaTask = await tasksService.createTask(JSON.stringify(taskDto));

      // Compare structure
      expect(prismaTask).toHaveProperty('id');
      expect(prismaTask).toHaveProperty('assignees');
      expect(prismaTask.assignees.length).toBe(1);

      // Compare with SQL result structure
      expectTaskViewModelsEqual(sqlTask, prismaTask, {
        ignoreFields: ['id', 'created_at', 'task_no']
      });

      // Verify assignees were created
      const assignees = await db.query(
        'SELECT * FROM tasks_assignees WHERE task_id = $1',
        [prismaTask.task.id]
      );
      expect(assignees.rows.length).toBe(1);
    });

    it('should create task with labels and attachments', async () => {
      const attachmentId = await createTestAttachment(testProjectId, testUserId);

      const taskDto = {
        name: 'Task with Labels',
        project_id: testProjectId,
        reporter_id: testUserId,
        status_id: await getDefaultStatusId(testProjectId),
        labels: [
          { name: 'Bug', color: '#ff0000' },
          { name: 'Urgent', color: '#ff9900' }
        ],
        attachments: [attachmentId]
      };

      const prismaTask = await tasksService.createTask(JSON.stringify(taskDto));

      // Verify labels
      const labels = await db.query(
        'SELECT * FROM task_labels WHERE task_id = $1',
        [prismaTask.task.id]
      );
      expect(labels.rows.length).toBe(2);

      // Verify attachment linked
      const attachment = await db.query(
        'SELECT * FROM task_attachments WHERE id = $1',
        [attachmentId]
      );
      expect(attachment.rows[0].task_id).toBe(prismaTask.task.id);
    });
  });

  describe('Tier 3: update_task() - Core Update', () => {
    it('should update task and return assignee diff', async () => {
      // Create task with initial assignee
      const member1 = await getTestTeamMemberId(testUserId);
      const member2 = await createTestTeamMember(testTeamId);

      const createDto = {
        name: 'Task to Update',
        project_id: testProjectId,
        reporter_id: testUserId,
        assignees: [member1]
      };

      const created = await tasksService.createTask(JSON.stringify(createDto));

      // Update with different assignee
      const updateDto = {
        id: created.task.id,
        name: 'Updated Task',
        project_id: testProjectId,
        reporter_id: testUserId,
        assignees: [member2]
      };

      const result = await tasksService.updateTask(JSON.stringify(updateDto));

      // Verify assignee diff
      expect(result.old_assignees.length).toBe(1);
      expect(result.old_assignees[0].team_member_id).toBe(member1);
      expect(result.new_assignees.length).toBe(1);
      expect(result.new_assignees[0].team_member_id).toBe(member2);
    });
  });

  describe('Tier 3: Bulk Operations', () => {
    it('should bulk update status with activity logging', async () => {
      // Create multiple tasks
      const tasks = await Promise.all([
        createTestTask(testProjectId, testUserId),
        createTestTask(testProjectId, testUserId),
        createTestTask(testProjectId, testUserId)
      ]);

      const newStatusId = await getStatusIdByCategory(testProjectId, 'in_progress');

      const bulkDto = {
        tasks: tasks.map(t => ({ id: t.id })),
        status_id: newStatusId
      };

      // Execute bulk update
      const result = await tasksService.bulkChangeStatus(
        JSON.stringify(bulkDto),
        testUserId
      );

      // Verify all tasks updated
      for (const task of tasks) {
        const updated = await db.query(
          'SELECT status_id FROM tasks WHERE id = $1',
          [task.id]
        );
        expect(updated.rows[0].status_id).toBe(newStatusId);
      }

      // Verify activity logs created
      const logs = await db.query(
        'SELECT * FROM task_activity_logs WHERE task_id = ANY($1) AND attribute_type = $2',
        [tasks.map(t => t.id), 'status']
      );
      expect(logs.rows.length).toBe(3);
    });

    it('should handle partial failures in bulk operations', async () => {
      // Create task with "done" status (cannot be changed due to business rule)
      const doneTask = await createTestTask(testProjectId, testUserId, {
        status_category: 'done'
      });
      const normalTask = await createTestTask(testProjectId, testUserId);

      const newStatusId = await getStatusIdByCategory(testProjectId, 'todo');

      const bulkDto = {
        tasks: [
          { id: doneTask.id },
          { id: normalTask.id }
        ],
        status_id: newStatusId
      };

      const result = await tasksService.bulkChangeStatus(
        JSON.stringify(bulkDto),
        testUserId
      );

      // Verify failed_tasks contains the done task
      expect(result.failed_tasks).toContain(doneTask.id);
      expect(result.failed_tasks).not.toContain(normalTask.id);

      // Verify normal task was updated
      const updated = await db.query(
        'SELECT status_id FROM tasks WHERE id = $1',
        [normalTask.id]
      );
      expect(updated.rows[0].status_id).toBe(newStatusId);
    });
  });

  describe('View Models', () => {
    it('should return complete task form view model', async () => {
      const viewModel = await tasksService.getTaskFormViewModel(
        testUserId,
        testTeamId,
        testTaskId,
        testProjectId
      );

      // Verify structure
      expect(viewModel).toHaveProperty('task');
      expect(viewModel).toHaveProperty('priorities');
      expect(viewModel).toHaveProperty('projects');
      expect(viewModel).toHaveProperty('statuses');
      expect(viewModel).toHaveProperty('team_members');
      expect(viewModel).toHaveProperty('phases');

      // Verify task detail
      expect(viewModel.task.id).toBe(testTaskId);
      expect(viewModel.task.assignees).toBeInstanceOf(Array);

      // Verify dropdown data
      expect(viewModel.priorities.length).toBeGreaterThan(0);
      expect(viewModel.statuses.length).toBeGreaterThan(0);
    });
  });
});
```

### Test Utilities

```typescript
/**
 * Test helper utilities for tasks migration
 */

/**
 * Create test task
 */
async function createTestTask(
  projectId: string,
  userId: string,
  options?: {
    status_category?: 'todo' | 'in_progress' | 'done';
    with_assignees?: string[];
    with_labels?: Array<{ name: string; color: string }>;
  }
): Promise<any> {
  const statusId = options?.status_category
    ? await getStatusIdByCategory(projectId, options.status_category)
    : await getDefaultStatusId(projectId);

  const taskDto = {
    name: `Test Task ${Date.now()}`,
    project_id: projectId,
    reporter_id: userId,
    status_id: statusId,
    assignees: options?.with_assignees || [],
    labels: options?.with_labels || []
  };

  const result = await db.query(
    'SELECT create_task($1) AS task',
    [JSON.stringify(taskDto)]
  );

  return result.rows[0].task.task;
}

/**
 * Compare task objects for equality
 */
function expectTasksEqual(
  task1: any,
  task2: any,
  options?: { ignoreFields?: string[] }
) {
  const ignore = options?.ignoreFields || [];

  for (const key of Object.keys(task1)) {
    if (ignore.includes(key)) continue;

    expect(task2).toHaveProperty(key);
    expect(task2[key]).toEqual(task1[key]);
  }
}

/**
 * Compare task view models
 */
function expectTaskViewModelsEqual(
  vm1: any,
  vm2: any,
  options?: { ignoreFields?: string[] }
) {
  expect(vm2).toHaveProperty('task');
  expect(vm2).toHaveProperty('priorities');
  expect(vm2).toHaveProperty('statuses');

  expectTasksEqual(vm1.task, vm2.task, options);
}
```

## Risk Assessment & Mitigation

### High Risks

1. **Complex Stored Procedure Logic (78% of queries)**
   - **Risk**: Behavioral differences between wrapper and original
   - **Mitigation**:
     - Use typed $queryRaw wrappers initially
     - Comprehensive contract tests
     - Feature flag for instant rollback

2. **Assignee Notification Side Effects**
   - **Risk**: Missing or duplicate notifications
   - **Mitigation**:
     - Carefully track old_assignees vs new_assignees
     - Test notification integration
     - Add logging for debugging

3. **Bulk Operation Transaction Safety**
   - **Risk**: Partial failures leaving inconsistent state
   - **Mitigation**:
     - Use Prisma $transaction
     - Implement proper error handling
     - Test rollback scenarios

4. **Activity Log Integrity**
   - **Risk**: Missing audit trail entries
   - **Mitigation**:
     - Verify activity log creation in tests
     - Add explicit logging checks

### Medium Risks

1. **Sort Order Management**
   - **Risk**: Sort order conflicts causing unique constraint violations
   - **Mitigation**:
     - Use existing stored procedure logic for reordering
     - Test concurrent updates

2. **Performance Regression**
   - **Risk**: Prisma slower than optimized SQL
   - **Mitigation**:
     - Benchmark critical paths
     - Add indexes as needed
     - Use $queryRaw for hot paths

3. **View Model Structure Changes**
   - **Risk**: Breaking frontend expectations
   - **Mitigation**:
     - Maintain exact output structure
     - Test JSON serialization
     - Validate against TypeScript types

### Low Risks

1. **Simple CRUD Operations**
   - **Risk**: Low (straightforward Prisma methods)
   - **Mitigation**: Standard contract tests

## Success Criteria

### Code Quality
- All 31 operations migrated
- TypeScript types for all DTOs
- Feature flag integration complete
- Zero TypeScript errors

### Test Coverage
- 85%+ contract test pass rate
- All critical paths tested
- Edge cases covered
- Bulk operations tested

### Performance
- No regressions > 10% on critical paths
- Bulk operations complete in < 2s for 100 tasks
- View models load in < 500ms

### Documentation
- Migration guide complete
- API documentation for service
- Rollback procedures documented
- Known issues documented

## Rollback Plan

### Instant Rollback (< 1 minute)
```bash
# In .env
ENABLE_PRISMA_TASKS=false

# Restart server
npm run dev
```

### Partial Rollback (Specific Operations)
```bash
# Disable write operations only
ENABLE_PRISMA_TASKS_WRITE=false

# Disable read operations only
ENABLE_PRISMA_TASKS_READ=false
```

### Emergency Procedures
1. Set `ENABLE_PRISMA_ALL=false`
2. Restart all server instances
3. Verify SQL fallback active
4. Check error logs
5. Report issues to team

## Timeline & Milestones

### Day 1: Foundation
- Service setup
- DTOs defined
- Tier 1 operations (5)
- Feature flags integrated

### Days 2-3: Core Operations
- Tier 3 wrappers (6 core)
- Controller integration
- Contract tests for CRUD

### Day 4: Views
- Tier 2 operations (2)
- Tier 3 wrappers (6 views)
- Contract tests for views

### Days 5-6: Bulk Operations
- Tier 3 wrappers (11 bulk ops)
- Transaction safety
- Contract tests for bulk

### Day 7: Testing & Polish
- Integration tests
- Performance benchmarks
- Documentation
- Bug fixes

**Target Completion**: 7 days
**Buffer**: +2 days for unexpected issues

## Conclusion

The Tasks module migration is a MEDIUM-HIGH complexity project requiring careful attention to:
1. Complex stored procedure logic (78% of operations)
2. Assignee notification side effects
3. Bulk operation transaction safety
4. Activity logging integrity

**Recommended Approach**:
- Start with typed $queryRaw wrappers for safety
- Comprehensive TDD with contract tests
- Feature flags for instant rollback
- Gradual rollout with monitoring

**Key Success Factors**:
- Maintain exact behavioral parity
- Test all side effects (notifications, logs)
- Performance benchmarking
- Clear rollback procedures

With proper TDD implementation and the established migration pattern, this migration can achieve **85%+ test pass rate** while maintaining system stability.
