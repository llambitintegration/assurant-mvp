# Tasks Module - Complete Query Reference Map

## Visual Query Organization

```
Tasks Controller (31 queries)
├── TIER 1: Pure Prisma (5) ✓ EASY
│   ├── Line 44  → uploadAttachment           → INSERT task_attachments
│   ├── Line 189 → updateDuration             → UPDATE tasks
│   ├── Line 356 → getTaskStatuses            → SELECT task_statuses
│   ├── Line 400 → deleteById                 → DELETE tasks
│   └── Line 652 → getProjectTaskAssignees    → SELECT with JOINs
│
├── TIER 2: Prisma + Includes (2) ✓ MEDIUM
│   ├── Line 246 → getTasksBetweenRange       → Complex JOIN (tasks + assignees)
│   └── Line 291 → getGanttTasksByProject     → SELECT with hierarchy
│
└── TIER 3: Typed Wrappers (24) ⚠️ COMPLEX
    │
    ├── CORE OPERATIONS (6) 🔥 CRITICAL
    │   ├── Line 78  → create                 → create_task()
    │   ├── Line 166 → update                 → update_task()
    │   ├── Line 407 → getById                → get_task_form_view_model()
    │   ├── Line 138 → notifyStatusChange     → handle_on_task_status_change()
    │   ├── Line 202 → updateStatus           → update_task_status()
    │   └── Line 630 → createTaskAssignee     → create_task_assignee()
    │
    ├── GANTT & VIEWS (6) 📊 HIGH PRIORITY
    │   ├── Line 97  → getGanttTasks          → get_gantt_tasks()
    │   ├── Line 213 → getTasksByProject      → get_project_gantt_tasks()
    │   ├── Line 322 → getProjectTasksByTeam  → get_resource_gantt_tasks()
    │   ├── Line 330 → getSelectedTasks       → get_selected_tasks()
    │   ├── Line 338 → getUnselectedTasks     → get_unselected_tasks()
    │   └── Line 364 → getTasksByStatus       → get_tasks_by_status()
    │       └── Line 381 → (duplicate)        → get_tasks_by_status()
    │
    ├── QUICK CREATE (2) ⚡ MEDIUM PRIORITY
    │   ├── Line 468 → createQuickTask        → create_quick_task()
    │   └── Line 499 → createHomeTask         → create_home_task()
    │
    └── BULK OPERATIONS (9) 🔄 MEDIUM-HIGH PRIORITY
        ├── Line 507 → bulkChangeStatus       → bulk_change_tasks_status()
        ├── Line 518 → bulkChangePriority     → bulk_change_tasks_priority()
        ├── Line 529 → bulkChangePhase        → bulk_change_tasks_phase()
        ├── Line 544 → bulkDelete             → bulk_delete_tasks()
        ├── Line 553 → bulkArchive            → bulk_archive_tasks()
        ├── Line 568 → bulkAssignMe           → bulk_assign_to_me()
        ├── Line 602 → bulkAssignLabel        → bulk_assign_or_create_label()
        ├── Line 605 → bulkAssignLabel (alt)  → bulk_assign_label()
        └── Line 636 → createBulkAssignees    → create_bulk_task_assignees()
```

## Query Details by Category

### TIER 1: Pure Prisma (5 queries) - 16%

#### 1. uploadAttachment (Line 44)
```typescript
// Current SQL
const q = `
  INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, name, size, type, created_at, CONCAT($8::TEXT, '/', team_id, '/', project_id, '/', id, '.', type) AS url
`;

// Prisma Migration
async uploadAttachment(dto: IUploadAttachmentDto): Promise<ITaskAttachment> {
  return await prisma.task_attachments.create({
    data: {
      name: dto.file_name,
      task_id: null,
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
```
**Complexity**: LOW
**Dependencies**: None
**Side Effects**: None

---

#### 2. updateDuration (Line 189)
```typescript
// Current SQL
const q = `
  UPDATE tasks
  SET start_date = ($1)::TIMESTAMP,
      end_date   = ($2)::TIMESTAMP
  WHERE id = ($3)::UUID
  RETURNING id
`;

// Prisma Migration
async updateDuration(taskId: string, startDate: Date, endDate: Date): Promise<void> {
  await prisma.tasks.update({
    where: { id: taskId },
    data: {
      start_date: startDate,
      end_date: endDate
    }
  });
}
```
**Complexity**: LOW
**Dependencies**: None
**Side Effects**: Updates task timestamps

---

#### 3. getTaskStatuses (Line 356)
```typescript
// Current SQL
const q1 = `
  SELECT task_statuses.id, task_statuses.name, stsc.color_code
  FROM task_statuses
  INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
  WHERE project_id = $1 AND team_id = $2
  ORDER BY task_statuses.sort_order
`;

// Prisma Migration
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
```
**Complexity**: LOW
**Dependencies**: sys_task_status_categories
**Side Effects**: None

---

#### 4. deleteById (Line 400)
```typescript
// Current SQL
const q = `DELETE FROM tasks WHERE id = $1`;

// Prisma Migration
async deleteById(taskId: string): Promise<void> {
  await prisma.tasks.delete({
    where: { id: taskId }
  });
}
```
**Complexity**: LOW
**Dependencies**: Cascades to related tables
**Side Effects**: Deletes assignees, comments, logs, etc.

---

#### 5. getProjectTaskAssignees (Line 652)
```typescript
// Current SQL
const q = `
  SELECT project_members.team_member_id AS id,
         tmiv.name,
         tmiv.email,
         tmiv.avatar_url
  FROM project_members
  LEFT JOIN team_member_info_view tmiv ON project_members.team_member_id = tmiv.team_member_id
  WHERE project_id = $1
    AND EXISTS(SELECT 1 FROM tasks_assignees WHERE project_member_id = project_members.id)
`;

// Prisma Migration
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
```
**Complexity**: LOW-MEDIUM
**Dependencies**: project_members, team_members, users
**Side Effects**: None

---

### TIER 2: Prisma + Includes (2 queries) - 6%

#### 6. getTasksBetweenRange (Line 246)
```typescript
// Current SQL - Complex multi-table query
const q = `
  SELECT pm.id,
         (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
          FROM (SELECT t.id, t.name, t.start_date, t.project_id, t.priority_id, t.done, t.end_date,
                       (SELECT color_code FROM projects WHERE projects.id = t.project_id) AS color_code,
                       (SELECT name FROM task_statuses WHERE id = t.status_id) AS status
                FROM tasks_assignees ta, tasks t
                WHERE t.archived IS FALSE
                  AND ta.project_member_id = pm.id
                  AND t.id = ta.task_id
                  AND start_date IS NOT NULL
                  AND end_date IS NOT NULL
                ORDER BY start_date) rec) AS tasks
  FROM project_members pm
  WHERE project_id = $1
`;

// Prisma Migration
async getTasksBetweenRange(projectId: string): Promise<any> {
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
              projects: { select: { color_code: true } },
              task_statuses: { select: { name: true } }
            },
            orderBy: { start_date: 'asc' }
          }
        }
      }
    }
  });

  // Transform to expected format
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
```
**Complexity**: MEDIUM
**Dependencies**: project_members, tasks_assignees, tasks, projects, task_statuses
**Side Effects**: None
**Note**: Requires date range calculation in controller

---

#### 7. getGanttTasksByProject (Line 291)
```typescript
// Current SQL
const q = `
  SELECT id, name, start_date, project_id, priority_id, done, end_date,
         (SELECT color_code FROM projects WHERE projects.id = project_id) AS color_code,
         (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
         parent_task_id,
         parent_task_id IS NOT NULL AS is_sub_task,
         (SELECT name FROM tasks WHERE id = tasks.parent_task_id) AS parent_task_name,
         (SELECT COUNT('*')::INT FROM tasks WHERE parent_task_id = tasks.id) AS sub_tasks_count
  FROM tasks
  WHERE archived IS FALSE
    AND project_id = $1
    AND parent_task_id IS NULL
  ORDER BY start_date
`;

// Prisma Migration
async getGanttTasksByProject(projectId: string): Promise<any[]> {
  const tasks = await prisma.tasks.findMany({
    where: {
      project_id: projectId,
      parent_task_id: null,
      archived: false
    },
    include: {
      projects: { select: { color_code: true } },
      task_statuses: { select: { name: true } },
      tasks: { select: { name: true } }, // parent reference
      other_tasks: { // child tasks count
        where: { archived: false }
      }
    },
    orderBy: { start_date: 'asc' }
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
```
**Complexity**: MEDIUM
**Dependencies**: tasks (self-reference), projects, task_statuses
**Side Effects**: None

---

### TIER 3: Core Operations (6 queries) - Critical

#### 8. create_task() (Line 78) 🔥 CRITICAL
**Stored Procedure**: `create_task(_body json)`

**Business Logic**:
1. Insert task record
2. Loop through assignees → call create_task_assignee()
3. Loop through attachments → update task_id
4. Loop through labels → call assign_or_create_label()
5. Return full view model via get_task_form_view_model()

**Input JSON**:
```json
{
  "name": "Task name",
  "project_id": "uuid",
  "reporter_id": "uuid",
  "status_id": "uuid",
  "priority_id": "uuid",
  "start": "timestamp",
  "end": "timestamp",
  "description": "text",
  "parent_task_id": "uuid",
  "total_minutes": 120,
  "assignees": ["team_member_uuid1", "team_member_uuid2"],
  "attachments": ["attachment_uuid1"],
  "labels": [{"name": "Bug", "color": "#ff0000"}]
}
```

**Migration**:
```typescript
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
```

**Side Effects**:
- Creates task record
- Creates task_assignees records
- Updates task_attachments.task_id
- Creates task_labels records
- May create team_labels if labels don't exist

**Dependencies**: create_task_assignee(), assign_or_create_label(), get_task_form_view_model()

---

#### 9. update_task() (Line 166) 🔥 CRITICAL
**Stored Procedure**: `update_task(_body json)`

**Business Logic**:
1. Get old assignees (for notification diff)
2. Update task record
3. Delete all existing assignees
4. Loop through new assignees → call create_task_assignee()
5. Handle label updates (if not inline mode)
6. Get new assignees
7. Return {id, old_assignees, new_assignees}

**Return Structure**:
```json
{
  "id": "task_uuid",
  "old_assignees": [
    {"team_member_id": "uuid", "user_id": "uuid", "team_id": "uuid"}
  ],
  "new_assignees": [
    {"team_member_id": "uuid", "user_id": "uuid", "team_id": "uuid"}
  ]
}
```

**Critical Feature**: Returns assignee diff for notification logic

**Migration**:
```typescript
async updateTask(body: string): Promise<ITaskUpdateResult> {
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
```

**Side Effects**:
- Updates task record
- Replaces all assignees
- May update labels
- Triggers notifications (in controller)

---

#### 10. get_task_form_view_model() (Line 407) 🔥 CRITICAL
**Stored Procedure**: `get_task_form_view_model(_user_id, _team_id, _task_id, _project_id)`

**Returns Complete View Model**:
```json
{
  "task": {
    "id": "uuid",
    "name": "Task name",
    "description": "...",
    "status_id": "uuid",
    "priority_id": "uuid",
    "assignees": [...],
    "labels": [...],
    "attachments": [...],
    "timer_start_time": null,
    "total_minutes": 120,
    "status_color": "#70a6f3",
    // ... 20+ more fields
  },
  "priorities": [
    {"id": "uuid", "name": "High", "value": 3, "color_code": "#ff0000"}
  ],
  "projects": [
    {"id": "uuid", "name": "Project Name"}
  ],
  "statuses": [
    {"id": "uuid", "name": "Todo", "color_code": "#70a6f3"}
  ],
  "team_members": [
    {"team_member_id": "uuid", "name": "John Doe", "email": "..."}
  ],
  "phases": [
    {"id": "uuid", "name": "Phase 1"}
  ]
}
```

**Migration**:
```typescript
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
```

**Note**: This is the most complex read operation - provides all data for task modal

---

#### 11. handle_on_task_status_change() (Line 138)
**Stored Procedure**: `handle_on_task_status_change(_user_id, _task_id, _status_id)`

**Purpose**: Handle notification logic when task status changes

**Returns**:
```json
{
  "message": "Task moved to In Progress",
  "project_id": "uuid",
  "members": [
    {
      "user_id": "uuid",
      "team_id": "uuid",
      "socket_id": "socket_123"
    }
  ]
}
```

**Migration**: Typed wrapper (same pattern as above)

---

#### 12. update_task_status() (Line 202)
**Stored Procedure**: `update_task_status(_task_id, _project_id, _status_id, _from_index, _to_index)`

**Purpose**: Update status + handle sort order reordering

**Business Logic**:
1. Update task.status_id
2. If indexes changed, reorder tasks:
   - If moving down: decrement intermediate tasks
   - If moving up: increment intermediate tasks
3. Set task.sort_order = to_index

**Migration**: Typed wrapper

---

#### 13. create_task_assignee() (Line 630)
**Stored Procedure**: `create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_user_id)`

**Business Logic**:
1. Find project_member_id for team_member_id
2. If not found, create project_member
3. Insert into tasks_assignees
4. Return assignee info

**Critical**: Used by create_task, update_task, and bulk operations

**Migration**: Typed wrapper

---

### TIER 3: Gantt & Views (6 queries)

#### 14-19. Gantt Queries
All follow similar pattern - use typed $queryRaw wrappers:

- `get_gantt_tasks()` (Line 97)
- `get_project_gantt_tasks()` (Line 213)
- `get_resource_gantt_tasks()` (Line 322)
- `get_selected_tasks()` (Line 330)
- `get_unselected_tasks()` (Line 338)
- `get_tasks_by_status()` (Lines 364, 381)

**Migration Pattern**:
```typescript
async getGanttTasks(userId: string): Promise<any> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT get_gantt_tasks(${userId}::uuid) AS gantt_tasks
  `;
  return result[0]?.gantt_tasks;
}
```

---

### TIER 3: Quick Create (2 queries)

#### 20. create_quick_task() (Line 468)
#### 21. create_home_task() (Line 499)

**Migration**: Typed wrappers (similar to create_task)

---

### TIER 3: Bulk Operations (9 queries)

#### 22. bulk_change_tasks_status() (Line 507) 🔥
**Critical**: Includes activity logging and validation

**Business Logic**:
```sql
FOR _task IN tasks_array LOOP
  IF can_update_task(_task.id, new_status_id) THEN
    UPDATE tasks SET status_id = new_status_id
    INSERT INTO task_activity_logs (...)
  ELSE
    Add to _failed_tasks array
  END IF
END LOOP
RETURN _failed_tasks
```

**Returns**: Array of failed task IDs

**Migration**:
```typescript
async bulkChangeStatus(body: string, userId: string): Promise<any> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT bulk_change_tasks_status(${body}::json, ${userId}::uuid) AS task
  `;
  return result[0]?.task;
}
```

#### 23-30. Other Bulk Operations
All follow similar pattern:
- `bulk_change_tasks_priority()` (Line 518)
- `bulk_change_tasks_phase()` (Line 529)
- `bulk_delete_tasks()` (Line 544)
- `bulk_archive_tasks()` (Line 553)
- `bulk_assign_to_me()` (Line 568)
- `bulk_assign_or_create_label()` (Line 602)
- `bulk_assign_label()` (Line 605)
- `create_bulk_task_assignees()` (Line 636)

**Migration**: All use typed $queryRaw wrappers

---

## Implementation Priority Matrix

### Phase 1: Quick Wins (Day 1)
```
Tier 1 Operations (5)
├── deleteById              ⭐ Start here
├── updateDuration          ⭐ Simple
├── uploadAttachment        ⭐ Straightforward
├── getTaskStatuses         ⭐ Easy join
└── getProjectTaskAssignees ⭐ Medium complexity
```

### Phase 2: Critical Path (Days 2-3)
```
Core Operations (6)
├── createTask              🔥 P1 - Most used
├── updateTask              🔥 P1 - Most used
├── getTaskFormViewModel    🔥 P1 - Task modal
├── createTaskAssignee      🔥 P1 - Used by others
├── updateTaskStatus        🔥 P2 - Drag & drop
└── handleTaskStatusChange  🔥 P2 - Notifications
```

### Phase 3: Views (Day 4)
```
View Operations (8)
├── getGanttTasksByProject  📊 P1 - Tier 2
├── getTasksBetweenRange    📊 P2 - Tier 2
├── getGanttTasks           📊 P2
├── getProjectGanttTasks    📊 P2
├── getResourceGanttTasks   📊 P3
├── getSelectedTasks        📊 P3
├── getUnselectedTasks      📊 P3
└── getTasksByStatus        📊 P2
```

### Phase 4: Bulk Operations (Days 5-6)
```
Bulk Operations (11)
├── bulkChangeStatus        🔄 P1 - Most used
├── bulkDelete              🔄 P1
├── bulkAssignMe            🔄 P2
├── bulkChangePriority      🔄 P2
├── bulkChangePhase         🔄 P2
├── bulkArchive             🔄 P2
├── bulkAssignLabel         🔄 P3
├── bulkAssignOrCreateLabel 🔄 P3
├── createQuickTask         ⚡ P2
├── createHomeTask          ⚡ P2
└── createBulkAssignees     🔄 P3
```

## Summary Statistics

| Category | Count | % | Complexity | Days |
|----------|-------|---|------------|------|
| Tier 1: Pure Prisma | 5 | 16% | LOW | 1 |
| Tier 2: Includes | 2 | 6% | MEDIUM | 1 |
| Tier 3: Core Ops | 6 | 19% | HIGH | 2 |
| Tier 3: Views | 6 | 19% | MEDIUM-HIGH | 1 |
| Tier 3: Quick Create | 2 | 6% | MEDIUM | 0.5 |
| Tier 3: Bulk Ops | 10 | 32% | MEDIUM-HIGH | 1.5 |
| **TOTAL** | **31** | **100%** | **MIXED** | **7** |

## Dependencies Graph

```
create_task()
└── create_task_assignee()
└── assign_or_create_label()
└── get_task_form_view_model()

update_task()
└── create_task_assignee()
└── assign_or_create_label()

bulk_change_tasks_status()
└── can_update_task()

bulk_assign_to_me()
└── create_task_assignee()

bulk_assign_label()
└── assign_or_create_label()

getTaskFormViewModel()
└── (returns full view model)
    ├── task (with all fields)
    ├── priorities
    ├── projects
    ├── statuses
    ├── team_members
    └── phases
```

## Next Steps

1. **Start with Tier 1** - Build confidence with simple operations
2. **Move to Core Ops** - Implement critical path (create/update/get)
3. **Add Views** - Gantt and list views
4. **Finish Bulk Ops** - Complete remaining operations
5. **Test Everything** - Contract tests for all 31 queries
6. **Performance Tune** - Benchmark and optimize

**Total Implementation Time**: 5-7 days
**Risk**: MEDIUM (mitigated by TDD + feature flags)
**Success Criteria**: 85%+ test pass rate, no performance regression
