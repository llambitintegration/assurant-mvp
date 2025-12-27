-- Resource Capacity Management (RCM) Initial Schema
-- This migration creates all RCM tables, enums, constraints, and indexes

-- ============================================================================
-- CREATE ENUMS
-- ============================================================================

CREATE TYPE rcm_resource_type AS ENUM ('personnel', 'equipment');
CREATE TYPE rcm_proficiency_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE rcm_unavailability_type AS ENUM ('vacation', 'sick_leave', 'holiday', 'training', 'maintenance', 'other');

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Table: rcm_resources
-- Stores both personnel and equipment resources
CREATE TABLE rcm_resources (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type       rcm_resource_type NOT NULL,

    -- Personnel-specific fields
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    employee_id         VARCHAR(50),

    -- Equipment-specific fields
    equipment_name      VARCHAR(200),
    model               VARCHAR(100),
    serial_number       VARCHAR(100),

    -- Common fields
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,
    notes               TEXT,

    -- Check constraints to ensure data integrity based on resource type
    CONSTRAINT rcm_resources_personnel_check
        CHECK (
            (resource_type = 'personnel' AND first_name IS NOT NULL AND last_name IS NOT NULL)
            OR resource_type = 'equipment'
        ),
    CONSTRAINT rcm_resources_equipment_check
        CHECK (
            (resource_type = 'equipment' AND equipment_name IS NOT NULL)
            OR resource_type = 'personnel'
        ),
    CONSTRAINT rcm_resources_email_format_check
        CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes for rcm_resources
CREATE INDEX idx_rcm_resources_team_id ON rcm_resources(team_id);
CREATE INDEX idx_rcm_resources_resource_type ON rcm_resources(resource_type);
CREATE INDEX idx_rcm_resources_is_active ON rcm_resources(is_active);
CREATE INDEX idx_rcm_resources_email ON rcm_resources(email) WHERE email IS NOT NULL;
CREATE INDEX idx_rcm_resources_created_at ON rcm_resources(created_at);

-- Table: rcm_departments
-- Organizational departments with hierarchical support
CREATE TABLE rcm_departments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    parent_dept_id      UUID REFERENCES rcm_departments(id) ON DELETE CASCADE,
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,

    -- Prevent self-referencing departments
    CONSTRAINT rcm_departments_no_self_reference_check
        CHECK (id != parent_dept_id)
);

-- Indexes for rcm_departments
CREATE INDEX idx_rcm_departments_team_id ON rcm_departments(team_id);
CREATE INDEX idx_rcm_departments_parent_dept_id ON rcm_departments(parent_dept_id) WHERE parent_dept_id IS NOT NULL;
CREATE INDEX idx_rcm_departments_is_active ON rcm_departments(is_active);
CREATE INDEX idx_rcm_departments_name ON rcm_departments(name);

-- Table: rcm_resource_department_assignments
-- Many-to-many relationship between resources and departments
CREATE TABLE rcm_resource_department_assignments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id         UUID NOT NULL REFERENCES rcm_resources(id) ON DELETE CASCADE,
    department_id       UUID NOT NULL REFERENCES rcm_departments(id) ON DELETE CASCADE,
    is_primary          BOOLEAN DEFAULT FALSE NOT NULL,
    assigned_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by         UUID NOT NULL REFERENCES users(id),

    -- Ensure a resource can only be assigned to a department once
    CONSTRAINT rcm_resource_dept_unique UNIQUE (resource_id, department_id)
);

-- Indexes for rcm_resource_department_assignments
CREATE INDEX idx_rcm_res_dept_resource_id ON rcm_resource_department_assignments(resource_id);
CREATE INDEX idx_rcm_res_dept_department_id ON rcm_resource_department_assignments(department_id);
CREATE INDEX idx_rcm_res_dept_is_primary ON rcm_resource_department_assignments(is_primary) WHERE is_primary = TRUE;

-- Table: rcm_skills
-- Catalog of available skills
CREATE TABLE rcm_skills (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,

    -- Ensure skill names are unique per team
    CONSTRAINT rcm_skills_name_team_unique UNIQUE (team_id, name)
);

-- Indexes for rcm_skills
CREATE INDEX idx_rcm_skills_team_id ON rcm_skills(team_id);
CREATE INDEX idx_rcm_skills_category ON rcm_skills(category) WHERE category IS NOT NULL;
CREATE INDEX idx_rcm_skills_is_active ON rcm_skills(is_active);
CREATE INDEX idx_rcm_skills_name ON rcm_skills(name);

-- Table: rcm_resource_skills
-- Many-to-many relationship between resources and skills with proficiency
CREATE TABLE rcm_resource_skills (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id         UUID NOT NULL REFERENCES rcm_resources(id) ON DELETE CASCADE,
    skill_id            UUID NOT NULL REFERENCES rcm_skills(id) ON DELETE CASCADE,
    proficiency         rcm_proficiency_level NOT NULL,
    years_experience    INTEGER,
    assigned_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by         UUID NOT NULL REFERENCES users(id),

    -- Ensure a resource can only have one proficiency level per skill
    CONSTRAINT rcm_resource_skills_unique UNIQUE (resource_id, skill_id),

    -- Validate years of experience
    CONSTRAINT rcm_resource_skills_years_check
        CHECK (years_experience IS NULL OR years_experience >= 0)
);

-- Indexes for rcm_resource_skills
CREATE INDEX idx_rcm_resource_skills_resource_id ON rcm_resource_skills(resource_id);
CREATE INDEX idx_rcm_resource_skills_skill_id ON rcm_resource_skills(skill_id);
CREATE INDEX idx_rcm_resource_skills_proficiency ON rcm_resource_skills(proficiency);

-- Table: rcm_availability
-- Base availability/capacity for resources
CREATE TABLE rcm_availability (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id             UUID NOT NULL REFERENCES rcm_resources(id) ON DELETE CASCADE,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    hours_per_day           DECIMAL(5, 2) NOT NULL,
    days_per_week           DECIMAL(3, 1) NOT NULL,
    total_hours_per_week    DECIMAL(5, 2) NOT NULL,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Validate date range
    CONSTRAINT rcm_availability_date_range_check
        CHECK (effective_to IS NULL OR effective_to >= effective_from),

    -- Validate hours and days
    CONSTRAINT rcm_availability_hours_per_day_check
        CHECK (hours_per_day > 0 AND hours_per_day <= 24),
    CONSTRAINT rcm_availability_days_per_week_check
        CHECK (days_per_week > 0 AND days_per_week <= 7),
    CONSTRAINT rcm_availability_total_hours_check
        CHECK (total_hours_per_week > 0 AND total_hours_per_week <= 168)
);

-- Indexes for rcm_availability
CREATE INDEX idx_rcm_availability_resource_id ON rcm_availability(resource_id);
CREATE INDEX idx_rcm_availability_effective_from ON rcm_availability(effective_from);
CREATE INDEX idx_rcm_availability_effective_to ON rcm_availability(effective_to) WHERE effective_to IS NOT NULL;
CREATE INDEX idx_rcm_availability_date_range ON rcm_availability(resource_id, effective_from, effective_to);

-- Table: rcm_unavailability_periods
-- Tracks PTO, holidays, maintenance periods, etc.
CREATE TABLE rcm_unavailability_periods (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id             UUID NOT NULL REFERENCES rcm_resources(id) ON DELETE CASCADE,
    unavailability_type     rcm_unavailability_type NOT NULL,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    description             TEXT,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Validate date range
    CONSTRAINT rcm_unavailability_date_range_check
        CHECK (end_date >= start_date)
);

-- Indexes for rcm_unavailability_periods
CREATE INDEX idx_rcm_unavailability_resource_id ON rcm_unavailability_periods(resource_id);
CREATE INDEX idx_rcm_unavailability_start_date ON rcm_unavailability_periods(start_date);
CREATE INDEX idx_rcm_unavailability_end_date ON rcm_unavailability_periods(end_date);
CREATE INDEX idx_rcm_unavailability_type ON rcm_unavailability_periods(unavailability_type);
CREATE INDEX idx_rcm_unavailability_date_range ON rcm_unavailability_periods(resource_id, start_date, end_date);

-- Table: rcm_allocations
-- Resource allocations to projects
CREATE TABLE rcm_allocations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id             UUID NOT NULL REFERENCES rcm_resources(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    allocation_percent      DECIMAL(5, 2) NOT NULL,
    notes                   TEXT,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active               BOOLEAN DEFAULT TRUE NOT NULL,

    -- Validate date range
    CONSTRAINT rcm_allocations_date_range_check
        CHECK (end_date >= start_date),

    -- Validate allocation percentage (0-100%)
    CONSTRAINT rcm_allocations_percent_check
        CHECK (allocation_percent >= 0 AND allocation_percent <= 100)
);

-- Indexes for rcm_allocations
CREATE INDEX idx_rcm_allocations_resource_id ON rcm_allocations(resource_id);
CREATE INDEX idx_rcm_allocations_project_id ON rcm_allocations(project_id);
CREATE INDEX idx_rcm_allocations_start_date ON rcm_allocations(start_date);
CREATE INDEX idx_rcm_allocations_end_date ON rcm_allocations(end_date);
CREATE INDEX idx_rcm_allocations_is_active ON rcm_allocations(is_active);
CREATE INDEX idx_rcm_allocations_date_range ON rcm_allocations(resource_id, start_date, end_date);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create a generic trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION rcm_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all RCM tables with updated_at column
CREATE TRIGGER rcm_resources_updated_at
    BEFORE UPDATE ON rcm_resources
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

CREATE TRIGGER rcm_departments_updated_at
    BEFORE UPDATE ON rcm_departments
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

CREATE TRIGGER rcm_skills_updated_at
    BEFORE UPDATE ON rcm_skills
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

CREATE TRIGGER rcm_availability_updated_at
    BEFORE UPDATE ON rcm_availability
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

CREATE TRIGGER rcm_unavailability_periods_updated_at
    BEFORE UPDATE ON rcm_unavailability_periods
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

CREATE TRIGGER rcm_allocations_updated_at
    BEFORE UPDATE ON rcm_allocations
    FOR EACH ROW
    EXECUTE FUNCTION rcm_update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE rcm_resources IS 'Stores both personnel and equipment resources with type-specific fields';
COMMENT ON TABLE rcm_departments IS 'Organizational departments with hierarchical structure support';
COMMENT ON TABLE rcm_resource_department_assignments IS 'Many-to-many assignments between resources and departments';
COMMENT ON TABLE rcm_skills IS 'Catalog of available skills across the organization';
COMMENT ON TABLE rcm_resource_skills IS 'Resource skills with proficiency levels and experience';
COMMENT ON TABLE rcm_availability IS 'Base availability/capacity schedule for resources';
COMMENT ON TABLE rcm_unavailability_periods IS 'Tracks time periods when resources are unavailable (PTO, holidays, maintenance, etc.)';
COMMENT ON TABLE rcm_allocations IS 'Resource allocations to projects with percentage and date ranges';

COMMENT ON TYPE rcm_resource_type IS 'Type of resource: personnel (human) or equipment';
COMMENT ON TYPE rcm_proficiency_level IS 'Skill proficiency levels from beginner to expert';
COMMENT ON TYPE rcm_unavailability_type IS 'Types of unavailability: vacation, sick leave, holidays, training, maintenance, or other';
