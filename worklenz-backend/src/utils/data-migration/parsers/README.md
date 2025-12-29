# Cycle Count TSV Parsers

This directory contains parser scripts for cycle count data import.

## Available Parsers

### 1. SF Cycle Count Parser (`parse-sf-cycle-count.ts`)

**Agent 2 Implementation**

Parses the San Francisco location cycle count TSV file.

**Input:**
- File: `/context/RobCo Inc Cycle Count - 12_19_25 - SF.tsv`
- Rows: 19 components

**Output:**
- File: `/worklenz-backend/src/utils/data-migration/output/sf-cycle-count.json`
- Contains: suppliers, storage_locations, components, metadata

**Usage:**

```bash
# From worklenz-backend directory
npx ts-node src/utils/data-migration/parsers/parse-sf-cycle-count.ts
```

**Expected Output:**
- ~5 suppliers
- ~10 storage locations (including "Unassigned")
- ~19 components

## Data Flow

```
TSV File → Parse → Extract Entities → Generate UUIDs → Validate → JSON Output
```

## Features

- **Deterministic UUIDs**: Uses UUID v5 for consistent entity IDs
- **Ownership Priority**: Location > Supplier > Unassigned
- **Serial Tracking**: Serial numbers stored in component descriptions
- **Validation**: Required field validation for all entity types
- **Metadata**: Tracks source file, generation timestamp, and counts

## Requirements

- Prisma client configured
- Database with team "Assurant P0003C"
- User "admin@llambit.io" in database
- TSV file in `/context` directory
