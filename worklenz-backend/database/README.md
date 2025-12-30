# Assurant MVP Database Documentation

This directory contains all database DDLs, DMLs, migrations, and schema documentation for the Assurant MVP application.

## Table of Contents

- [Schema Architecture](#schema-architecture)
- [Directory Structure](#directory-structure)
- [SQL File Execution Order](#sql-file-execution-order)
- [Prisma ORM Integration](#prisma-orm-integration)
- [Entity Relationship Diagrams](#entity-relationship-diagrams)
- [Complete Table Inventory](#complete-table-inventory)
- [Prisma Migration Roadmap](#prisma-migration-roadmap)
- [Setup Instructions](#setup-instructions)

---

## Schema Architecture

The database uses a **hybrid schema approach** with two management systems running side-by-side:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
├─────────────────────────────────┬───────────────────────────────┤
│      Legacy SQL Schema          │       Prisma ORM Schema       │
│   (Core Worklenz Tables)        │    (New Custom Modules)       │
├─────────────────────────────────┼───────────────────────────────┤
│ • 1_tables.sql                  │ • schema.prisma               │
│ • 3_views.sql                   │ • prisma/migrations/          │
│ • 4_functions.sql               │                               │
│ • triggers.sql                  │                               │
├─────────────────────────────────┼───────────────────────────────┤
│ ~80 tables                      │ 13 tables                     │
│ Users, Teams, Projects, Tasks   │ RCM + Inventory modules       │
└─────────────────────────────────┴───────────────────────────────┘
                    │                           │
                    └───────────┬───────────────┘
                                ▼
                    Shared Foreign Key References
                    • team_id → teams
                    • created_by → users  
                    • project_id → projects
```

### Why Hybrid?

1. **Legacy Compatibility**: Core Worklenz tables have complex relationships, views, functions, and triggers that work well with raw SQL
2. **New Module Development**: RCM and Inventory modules benefit from Prisma's type safety, migrations, and developer experience
3. **Incremental Migration**: Allows gradual transition to full Prisma without breaking existing functionality

---

## Directory Structure

```
database/
├── README.md                      # This documentation
├── 00_init.sh                     # Docker initialization script
├── sql/                           # Raw SQL files for legacy schema
│   ├── 0_extensions.sql           # PostgreSQL extensions (uuid-ossp, etc.)
│   ├── 1_tables.sql               # Core table definitions (~2300 lines)
│   ├── 2_dml.sql                  # Data inserts (seed data)
│   ├── 3_views.sql                # Database views
│   ├── 4_functions.sql            # Stored functions
│   ├── 5_database_user.sql        # Database user/role setup
│   ├── indexes.sql                # Performance indexes
│   ├── triggers.sql               # Database triggers
│   ├── text_length_checks.sql     # Validation constraints
│   └── truncate.sql               # Development utility
├── migrations/                    # Legacy migration scripts
├── pg-migrations/                 # PostgreSQL-specific migrations
├── worklenz_db_revision_1.svg     # ERD diagram (core schema)
└── worklenz_db_revision_2.svg     # ERD diagram (extended schema)
```

---

## SQL File Execution Order

When setting up the database manually, execute files in this order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `sql/0_extensions.sql` | PostgreSQL extensions (uuid-ossp, etc.) |
| 2 | `sql/1_tables.sql` | All table definitions, domains, enums, constraints |
| 3 | `sql/indexes.sql` | Performance indexes for queries |
| 4 | `sql/4_functions.sql` | Stored procedures and functions |
| 5 | `sql/triggers.sql` | Database triggers |
| 6 | `sql/3_views.sql` | Database views |
| 7 | `sql/2_dml.sql` | Seed data (priorities, statuses, timezones, etc.) |
| 8 | `sql/5_database_user.sql` | Application database user |

### Docker Setup

In Docker, the `00_init.sh` script handles execution order automatically:

1. Creates a `sql/` subdirectory if needed
2. Copies all `.sql` files into the subdirectory
3. Executes files in the correct order
4. Prevents duplicate execution errors

---

## Prisma ORM Integration

### Location

```
worklenz-backend/prisma/
├── schema.prisma          # Model definitions
└── migrations/            # Prisma migration history
```

### Current Prisma Models

The Prisma schema manages **13 tables** across two custom modules:

#### Resource Capacity Management (RCM) - 8 Models

| Model | Table Name | Description |
|-------|------------|-------------|
| `rcm_resources` | rcm_resources | Personnel and equipment registry |
| `rcm_departments` | rcm_departments | Organizational departments (hierarchical) |
| `rcm_skills` | rcm_skills | Skill definitions with categories |
| `rcm_resource_skills` | rcm_resource_skills | Resource-skill assignments with proficiency |
| `rcm_availability` | rcm_availability | Work hour configurations |
| `rcm_unavailability_periods` | rcm_unavailability_periods | Vacation, sick leave, etc. |
| `rcm_allocations` | rcm_allocations | Project resource allocations |
| `rcm_resource_department_assignments` | rcm_resource_department_assignments | Department memberships |

#### Inventory Management - 5 Models

| Model | Table Name | Description |
|-------|------------|-------------|
| `inv_suppliers` | inv_suppliers | Vendor/supplier registry |
| `inv_storage_locations` | inv_storage_locations | Storage locations (hierarchical) |
| `inv_components` | inv_components | Inventory items with QR codes |
| `inv_transactions` | inv_transactions | Stock in/out/adjust audit trail |
| `inv_barcode_mappings` | inv_barcode_mappings | Barcode/QR code data |

### Prisma Enums

```prisma
enum rcm_resource_type { personnel, equipment }
enum rcm_proficiency_level { beginner, intermediate, advanced, expert }
enum rcm_unavailability_type { vacation, sick_leave, holiday, training, maintenance, other }
enum inv_transaction_type { IN, OUT, ADJUST }
enum inv_owner_type { supplier, storage_location }
enum inv_barcode_type { QR_CODE, BARCODE_128, BARCODE_39, EAN_13, UPC_A }
```

### Running Prisma Commands

```bash
cd worklenz-backend

# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations to database
npx prisma migrate deploy

# Open Prisma Studio (database browser)
npx prisma studio
```

---

## Entity Relationship Diagrams

Visual ERD diagrams are available in this directory:

| File | Contents |
|------|----------|
| `worklenz_db_revision_1.svg` | Core schema: users, teams, projects, tasks |
| `worklenz_db_revision_2.svg` | Extended schema with additional relationships |

Open these SVG files in a browser for interactive viewing.

---

## Complete Table Inventory

### Tables in Prisma (Migration Complete)

| Table | Module | Prefix | FK References |
|-------|--------|--------|---------------|
| rcm_resources | RCM | `rcm_` | team_id, created_by |
| rcm_departments | RCM | `rcm_` | team_id, created_by, parent_dept_id |
| rcm_skills | RCM | `rcm_` | team_id, created_by |
| rcm_resource_skills | RCM | `rcm_` | resource_id, skill_id |
| rcm_availability | RCM | `rcm_` | resource_id, created_by |
| rcm_unavailability_periods | RCM | `rcm_` | resource_id, created_by |
| rcm_allocations | RCM | `rcm_` | resource_id, project_id, created_by |
| rcm_resource_department_assignments | RCM | `rcm_` | resource_id, department_id |
| inv_suppliers | Inventory | `inv_` | team_id, created_by |
| inv_storage_locations | Inventory | `inv_` | team_id, created_by, parent_location_id |
| inv_components | Inventory | `inv_` | team_id, supplier_id, storage_location_id |
| inv_transactions | Inventory | `inv_` | component_id, team_id, created_by |
| inv_barcode_mappings | Inventory | `inv_` | component_id, team_id, created_by |

### Legacy SQL Tables (Not Yet in Prisma)

#### Core Identity & Multi-tenancy

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| users | Identity | P1 | Central user table, ~20 FKs reference this |
| teams | Multi-tenancy | P1 | Root of all team-scoped data |
| team_members | Membership | P1 | User-team associations with roles |
| organizations | Billing | P2 | Organization/subscription data |
| roles | Authorization | P1 | Role definitions per team |
| permissions | Authorization | P2 | Permission definitions |
| role_permissions | Authorization | P2 | Role-permission mappings |

#### Project Management

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| projects | Projects | P1 | Core project entity |
| project_members | Projects | P1 | Team member project access |
| project_phases | Projects | P2 | Project phase definitions |
| project_categories | Projects | P3 | Project categorization |
| project_folders | Projects | P3 | Folder organization |
| project_access_levels | Projects | P3 | Access level definitions |
| project_comments | Projects | P3 | Project-level comments |
| project_subscribers | Projects | P3 | Project notification subscriptions |
| project_logs | Projects | P3 | Project activity logs |
| project_task_list_cols | Projects | P3 | Task list column configs |
| project_member_allocations | Projects | P3 | Member time allocations |
| archived_projects | Projects | P4 | User-archived project mappings |
| favorite_projects | Projects | P4 | User-favorited projects |

#### Task Management

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| tasks | Tasks | P1 | Core task entity (~30 columns) |
| task_statuses | Tasks | P1 | Per-project status definitions |
| task_priorities | Tasks | P2 | Global priority definitions |
| tasks_assignees | Tasks | P1 | Task assignments |
| task_labels | Tasks | P2 | Task-label associations |
| team_labels | Tasks | P2 | Team label definitions |
| task_phase | Tasks | P2 | Task-phase associations |
| task_comments | Tasks | P2 | Task comments |
| task_comment_contents | Tasks | P3 | Comment content/mentions |
| task_comment_mentions | Tasks | P3 | Comment @mentions |
| task_comment_reactions | Tasks | P3 | Comment reactions (likes) |
| task_comment_attachments | Tasks | P3 | Comment file attachments |
| task_attachments | Tasks | P2 | Task file attachments |
| task_work_log | Tasks | P2 | Time tracking entries |
| task_timers | Tasks | P3 | Active timer sessions |
| task_subscribers | Tasks | P3 | Task notification subscriptions |
| task_activity_logs | Tasks | P3 | Task change history |
| task_updates | Tasks | P3 | Task update notifications |
| task_dependencies | Tasks | P2 | Task blocking relationships |
| task_recurring_schedules | Tasks | P2 | Recurring task schedules |
| task_recurring_templates | Tasks | P2 | Recurring task templates |
| task_templates | Tasks | P3 | Quick task templates |
| task_templates_tasks | Tasks | P3 | Template task items |
| sys_task_status_categories | Tasks | P2 | Status category definitions |

#### Custom Columns

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| cc_custom_columns | Custom Fields | P3 | Column definitions |
| cc_column_configurations | Custom Fields | P3 | Column type configs |
| cc_column_values | Custom Fields | P3 | Task field values |
| cc_selection_options | Custom Fields | P3 | Dropdown options |
| cc_label_options | Custom Fields | P3 | Label options |

#### Project Templates

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| pt_project_templates | Templates | P4 | System project templates |
| pt_tasks | Templates | P4 | Template tasks |
| pt_statuses | Templates | P4 | Template statuses |
| pt_phases | Templates | P4 | Template phases |
| pt_labels | Templates | P4 | Template labels |
| pt_task_labels | Templates | P4 | Template task-label links |
| pt_task_phases | Templates | P4 | Template task-phase links |
| pt_task_statuses | Templates | P4 | Template task statuses |
| custom_project_templates | Templates | P4 | User-created templates |
| cpt_tasks | Templates | P4 | Custom template tasks |
| cpt_phases | Templates | P4 | Custom template phases |
| cpt_task_labels | Templates | P4 | Custom template task labels |
| cpt_task_phases | Templates | P4 | Custom template task phases |
| cpt_task_statuses | Templates | P4 | Custom template statuses |

#### Supporting Tables

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| pg_sessions | Sessions | P4 | Express session store |
| timezones | Reference | P3 | Timezone definitions |
| countries | Reference | P4 | Country list |
| job_titles | Reference | P4 | Team job titles |
| clients | Reference | P3 | Client/customer records |
| notification_settings | Notifications | P3 | User notification prefs |
| user_notifications | Notifications | P3 | Notification queue |
| email_invitations | Invitations | P3 | Pending team invites |
| email_logs | Logging | P4 | Email send history |
| bounced_emails | Email | P4 | Bounced email tracking |
| spam_emails | Email | P4 | Spam email list |
| personal_todo_list | Personal | P4 | User personal todos |
| users_data | Legacy | P4 | Legacy user data |
| worklenz_alerts | System | P4 | System-wide alerts |
| surveys | Surveys | P4 | Survey definitions |
| survey_questions | Surveys | P4 | Survey questions |
| survey_responses | Surveys | P4 | User responses |
| survey_answers | Surveys | P4 | Individual answers |
| organization_working_days | Settings | P4 | Org work schedule |

#### Licensing (SaaS-specific)

| Table | Category | Priority | Notes |
|-------|----------|----------|-------|
| licensing_pricing_plans | Licensing | P4 | Subscription plans |
| licensing_user_subscriptions | Licensing | P4 | User subscriptions |
| licensing_payment_details | Licensing | P4 | Payment records |
| licensing_coupon_codes | Licensing | P4 | Promo codes |
| licensing_coupon_logs | Licensing | P4 | Redemption logs |
| licensing_credit_subs | Licensing | P4 | Credit subscriptions |
| licensing_custom_subs | Licensing | P4 | Custom subscriptions |
| licensing_custom_subs_logs | Licensing | P4 | Custom sub logs |
| licensing_admin_users | Licensing | P4 | License admin users |
| licensing_app_sumo_batches | Licensing | P4 | AppSumo batches |
| licensing_settings | Licensing | P4 | License settings |
| licensing_user_subscription_modifiers | Licensing | P4 | Sub modifiers |
| sys_license_types | Licensing | P4 | License type defs |
| sys_project_statuses | System | P4 | Project status defs |
| sys_project_healths | System | P4 | Project health defs |

---

## Prisma Migration Roadmap

### Priority Levels

- **P1**: Core entities required for basic functionality
- **P2**: Important entities for full feature parity  
- **P3**: Supporting entities for complete migration
- **P4**: Low-priority entities (licensing, legacy)

### Phase 1: Core Identity (Recommended First)

```prisma
// Target models for Phase 1
model users {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String
  email       String   @unique
  password    String?
  active_team String?  @db.Uuid
  // ... additional fields
}

model teams {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name            String
  user_id         String   @db.Uuid
  organization_id String?  @db.Uuid
  // ... additional fields
}

model team_members {
  id       String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id  String? @db.Uuid
  team_id  String  @db.Uuid
  role_id  String  @db.Uuid
  // ... additional fields
}
```

### Phase 2: Project & Task Core

Migrate `projects`, `tasks`, `task_statuses`, `tasks_assignees`

### Phase 3: Task Extensions

Migrate comments, attachments, work logs, dependencies

### Phase 4: Everything Else

Templates, licensing, reference tables

### Migration Strategy

1. **Introspection**: Use `prisma db pull` to generate initial models from existing tables
2. **Baseline**: Create baseline migration that represents current state
3. **Incremental**: Add models in phases, updating relations
4. **Testing**: Validate each migration doesn't break existing queries

---

## Setup Instructions

### Docker-based Setup (Recommended)

```bash
# Start all services with local PostgreSQL
docker-compose --profile local up -d

# Database is automatically initialized by 00_init.sh
```

### Manual Setup

```bash
# 1. Create database
createdb worklenz_db

# 2. Execute SQL files in order
cd worklenz-backend
psql -U your_username -d worklenz_db -f database/sql/0_extensions.sql
psql -U your_username -d worklenz_db -f database/sql/1_tables.sql
psql -U your_username -d worklenz_db -f database/sql/indexes.sql
psql -U your_username -d worklenz_db -f database/sql/4_functions.sql
psql -U your_username -d worklenz_db -f database/sql/triggers.sql
psql -U your_username -d worklenz_db -f database/sql/3_views.sql
psql -U your_username -d worklenz_db -f database/sql/2_dml.sql
psql -U your_username -d worklenz_db -f database/sql/5_database_user.sql

# 3. Run Prisma migrations for RCM + Inventory tables
npx prisma migrate deploy
```

### Cloud Database (NeonDB)

```bash
# Set DATABASE_URL in .env
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# Initialize database
cd worklenz-backend
npm run db:init

# Run Prisma migrations
npx prisma migrate deploy
```

---

## Additional Resources

- [Environment Configuration Guide](../../environment-configuration.md)
- [Inventory System PRD](../../context/inventory-system-prd.md)
- [Prisma Documentation](https://www.prisma.io/docs)
