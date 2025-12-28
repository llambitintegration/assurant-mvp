-- Inventory Management System Initial Schema
-- This migration creates all inventory tables, enums, constraints, and indexes

-- ============================================================================
-- CREATE ENUMS
-- ============================================================================

CREATE TYPE inv_transaction_type AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE inv_owner_type AS ENUM ('supplier', 'storage_location');
CREATE TYPE inv_barcode_type AS ENUM ('QR_CODE', 'BARCODE_128', 'BARCODE_39', 'EAN_13', 'UPC_A');

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Table: inv_suppliers
-- Stores supplier information
CREATE TABLE inv_suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    contact_person  VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    address         TEXT,
    notes           TEXT,
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,

    -- Ensure supplier names are unique per team
    CONSTRAINT inv_suppliers_name_team_unique UNIQUE (team_id, name),

    -- Validate email format
    CONSTRAINT inv_suppliers_email_format_check
        CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes for inv_suppliers
CREATE INDEX idx_inv_suppliers_team_id ON inv_suppliers(team_id);
CREATE INDEX idx_inv_suppliers_is_active ON inv_suppliers(is_active);
CREATE INDEX idx_inv_suppliers_name ON inv_suppliers(name);

-- Table: inv_storage_locations
-- Stores storage location information with hierarchical support
CREATE TABLE inv_storage_locations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code       VARCHAR(50) NOT NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    parent_location_id  UUID REFERENCES inv_storage_locations(id) ON DELETE CASCADE,
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,

    -- Ensure location codes are unique per team
    CONSTRAINT inv_storage_locations_code_team_unique UNIQUE (team_id, location_code),

    -- Prevent self-referencing locations
    CONSTRAINT inv_storage_locations_no_self_reference_check
        CHECK (id != parent_location_id)
);

-- Indexes for inv_storage_locations
CREATE INDEX idx_inv_storage_locations_team_id ON inv_storage_locations(team_id);
CREATE INDEX idx_inv_storage_locations_parent_location_id ON inv_storage_locations(parent_location_id) WHERE parent_location_id IS NOT NULL;
CREATE INDEX idx_inv_storage_locations_is_active ON inv_storage_locations(is_active);
CREATE INDEX idx_inv_storage_locations_location_code ON inv_storage_locations(location_code);

-- Table: inv_components
-- Stores inventory component/item information with polymorphic ownership
CREATE TABLE inv_components (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    VARCHAR(200) NOT NULL,
    sku                     VARCHAR(100),
    description             TEXT,
    category                VARCHAR(100),

    -- Polymorphic ownership
    owner_type              inv_owner_type NOT NULL,
    supplier_id             UUID REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    storage_location_id     UUID REFERENCES inv_storage_locations(id) ON DELETE SET NULL,

    -- Inventory tracking
    quantity                INTEGER DEFAULT 0 NOT NULL,
    unit                    VARCHAR(50),
    unit_cost               DECIMAL(10, 2),
    reorder_level           INTEGER DEFAULT 0,

    -- QR Code data
    qr_code_data            TEXT,
    qr_code_image           TEXT,

    team_id                 UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active               BOOLEAN DEFAULT TRUE NOT NULL,

    -- Validate polymorphic ownership
    CONSTRAINT inv_components_owner_supplier_check
        CHECK (
            (owner_type = 'supplier' AND supplier_id IS NOT NULL AND storage_location_id IS NULL)
            OR owner_type = 'storage_location'
        ),
    CONSTRAINT inv_components_owner_location_check
        CHECK (
            (owner_type = 'storage_location' AND storage_location_id IS NOT NULL AND supplier_id IS NULL)
            OR owner_type = 'supplier'
        ),

    -- Validate quantity
    CONSTRAINT inv_components_quantity_check
        CHECK (quantity >= 0),

    -- Validate reorder level
    CONSTRAINT inv_components_reorder_level_check
        CHECK (reorder_level IS NULL OR reorder_level >= 0),

    -- Validate unit cost
    CONSTRAINT inv_components_unit_cost_check
        CHECK (unit_cost IS NULL OR unit_cost >= 0)
);

-- Indexes for inv_components
CREATE INDEX idx_inv_components_team_id ON inv_components(team_id);
CREATE INDEX idx_inv_components_supplier_id ON inv_components(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_inv_components_storage_location_id ON inv_components(storage_location_id) WHERE storage_location_id IS NOT NULL;
CREATE INDEX idx_inv_components_is_active ON inv_components(is_active);
CREATE INDEX idx_inv_components_sku ON inv_components(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_inv_components_category ON inv_components(category) WHERE category IS NOT NULL;
CREATE INDEX idx_inv_components_owner_type ON inv_components(owner_type);

-- Table: inv_transactions
-- Tracks all inventory transactions (IN, OUT, ADJUST)
CREATE TABLE inv_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id        UUID NOT NULL REFERENCES inv_components(id) ON DELETE CASCADE,
    transaction_type    inv_transaction_type NOT NULL,
    quantity            INTEGER NOT NULL,
    quantity_before     INTEGER NOT NULL,
    quantity_after      INTEGER NOT NULL,
    unit_cost           DECIMAL(10, 2),
    reference_number    VARCHAR(100),
    notes               TEXT,
    transaction_date    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,

    -- Validate quantity
    CONSTRAINT inv_transactions_quantity_check
        CHECK (quantity != 0),

    -- Validate unit cost
    CONSTRAINT inv_transactions_unit_cost_check
        CHECK (unit_cost IS NULL OR unit_cost >= 0)
);

-- Indexes for inv_transactions
CREATE INDEX idx_inv_transactions_team_id ON inv_transactions(team_id);
CREATE INDEX idx_inv_transactions_component_id ON inv_transactions(component_id);
CREATE INDEX idx_inv_transactions_transaction_type ON inv_transactions(transaction_type);
CREATE INDEX idx_inv_transactions_transaction_date ON inv_transactions(transaction_date);
CREATE INDEX idx_inv_transactions_is_active ON inv_transactions(is_active);

-- Table: inv_barcode_mappings
-- Stores barcode/QR code mappings for components
CREATE TABLE inv_barcode_mappings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id    UUID NOT NULL REFERENCES inv_components(id) ON DELETE CASCADE,
    barcode_type    inv_barcode_type NOT NULL,
    barcode_data    TEXT NOT NULL,
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,

    -- Ensure unique barcode type per component
    CONSTRAINT inv_barcode_mappings_component_type_unique UNIQUE (component_id, barcode_type)
);

-- Indexes for inv_barcode_mappings
CREATE INDEX idx_inv_barcode_mappings_team_id ON inv_barcode_mappings(team_id);
CREATE INDEX idx_inv_barcode_mappings_component_id ON inv_barcode_mappings(component_id);
CREATE INDEX idx_inv_barcode_mappings_barcode_type ON inv_barcode_mappings(barcode_type);
CREATE INDEX idx_inv_barcode_mappings_is_active ON inv_barcode_mappings(is_active);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create a generic trigger function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION inv_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all inventory tables with updated_at column
CREATE TRIGGER inv_suppliers_updated_at
    BEFORE UPDATE ON inv_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION inv_update_updated_at_column();

CREATE TRIGGER inv_storage_locations_updated_at
    BEFORE UPDATE ON inv_storage_locations
    FOR EACH ROW
    EXECUTE FUNCTION inv_update_updated_at_column();

CREATE TRIGGER inv_components_updated_at
    BEFORE UPDATE ON inv_components
    FOR EACH ROW
    EXECUTE FUNCTION inv_update_updated_at_column();

CREATE TRIGGER inv_barcode_mappings_updated_at
    BEFORE UPDATE ON inv_barcode_mappings
    FOR EACH ROW
    EXECUTE FUNCTION inv_update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE inv_suppliers IS 'Stores supplier information for inventory components';
COMMENT ON TABLE inv_storage_locations IS 'Storage locations with hierarchical structure support';
COMMENT ON TABLE inv_components IS 'Inventory components/items with polymorphic ownership (supplier or location)';
COMMENT ON TABLE inv_transactions IS 'Tracks all inventory transactions (IN, OUT, ADJUST) with audit trail';
COMMENT ON TABLE inv_barcode_mappings IS 'Barcode and QR code mappings for components';

COMMENT ON TYPE inv_transaction_type IS 'Type of inventory transaction: IN (receive), OUT (issue), ADJUST (correction)';
COMMENT ON TYPE inv_owner_type IS 'Ownership type for components: supplier or storage_location';
COMMENT ON TYPE inv_barcode_type IS 'Barcode type: QR_CODE, BARCODE_128, BARCODE_39, EAN_13, UPC_A';
