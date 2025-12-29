# Database Importers

This directory contains database import scripts that read JSON output files and import data into the database using Prisma.

## Available Importers

### `import-cycle-count-data.ts`

Imports cycle count data (suppliers, storage locations, and components) from JSON files into the inventory management tables.

**Input Files:**
- `/worklenz-backend/src/utils/data-migration/output/austin-cycle-count.json`
- `/worklenz-backend/src/utils/data-migration/output/sf-cycle-count.json`

**Database Tables:**
- `inv_suppliers`
- `inv_storage_locations`
- `inv_components`

**Features:**
- Idempotent imports using Prisma upsert
- Automatic deduplication by UUID
- Transaction-based import (atomic)
- Error recovery and reporting
- Detailed import summary

**Usage:**

```bash
# Run the importer
npx ts-node src/utils/data-migration/importers/import-cycle-count-data.ts

# Or from the data-migration directory
cd src/utils/data-migration/importers
npx ts-node import-cycle-count-data.ts
```

**Expected Output:**

```
========================================
Cycle Count Data Import - Agent 3
========================================

Step 1: Reading JSON files...
  ✓ Austin data: 65 components
  ✓ SF data: 60 components

Step 2: Combining and deduplicating data...
  ✓ Total unique suppliers: 20
  ✓ Total unique locations: 25
  ✓ Total unique components: 125

Step 3: Importing data to database...

  Importing suppliers...
    ✓ Suppliers: 20 created, 0 updated

  Importing storage locations...
    ✓ Locations: 25 created, 0 updated

  Importing components...
    ✓ Components: 125 created, 0 updated

========================================
  CYCLE COUNT DATA IMPORT SUMMARY
========================================
Suppliers:
  - Created: 20
  - Updated: 0
  - Total:   20

Storage Locations:
  - Created: 25
  - Updated: 0
  - Total:   25

Components:
  - Created: 125
  - Updated: 0
  - Total:   125

Execution Time: 1523ms
Errors: 0
========================================

✓ Import completed successfully!
```

## Import Process

All importers follow this general process:

1. **Read JSON Files**: Load and parse input JSON files
2. **Combine & Deduplicate**: Merge data from multiple sources and remove duplicates
3. **Import with Upsert**: Use Prisma transactions to import data atomically
4. **Report Results**: Display detailed summary of import results

## Error Handling

- Individual record failures are caught and logged
- Transaction ensures atomicity (all-or-nothing)
- Script exits with code 1 if errors occurred
- Error details are included in the summary report

## Idempotency

All importers use Prisma's `upsert` operation:
- If record exists (by UUID): Updates only specified fields
- If record doesn't exist: Creates new record with all fields

Running the same import multiple times produces the same result.

## Prerequisites

- PostgreSQL database running
- Prisma client generated (`npx prisma generate`)
- Database schema migrated (`npx prisma migrate dev`)
- Input JSON files exist in the output directory
- Valid database connection string in `.env`

## Development

To create a new importer:

1. Create a new `.ts` file in this directory
2. Import PrismaClient and required modules
3. Define TypeScript interfaces for your data structure
4. Implement the import logic with upsert operations
5. Use transactions for atomicity
6. Add error handling and summary reporting
7. Export functions for testing
8. Add documentation to this README

## Testing

```bash
# Run tests for importers (if available)
npm test -- importers

# Dry-run mode (validate without importing)
# Add a --dry-run flag to your importer if needed
```

## Troubleshooting

**Error: "JSON file not found"**
- Ensure the extractor scripts (Agents 1 & 2) have been run first
- Check that JSON files exist in the `output` directory

**Error: "Database connection failed"**
- Verify DATABASE_URL in `.env` is correct
- Ensure PostgreSQL is running
- Check database credentials

**Error: "Foreign key constraint violation"**
- Ensure related records are imported first
- Check that supplier_id and storage_location_id references are valid

**Error: "Transaction timeout"**
- Large datasets may require increased timeout
- Consider batch processing for very large imports
- Check database performance and connection pool settings
