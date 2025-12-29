# Cycle Count Data Importer - Usage Guide

## Quick Start

### Prerequisites

1. Ensure JSON output files exist:
   ```bash
   ls -l src/utils/data-migration/output/austin-cycle-count.json
   ls -l src/utils/data-migration/output/sf-cycle-count.json
   ```

2. Ensure database is running and Prisma client is generated:
   ```bash
   npm run prisma:generate
   ```

3. Verify database connection:
   ```bash
   npm run prisma:studio
   # This will open Prisma Studio in your browser
   ```

### Running the Importer

**Option 1: Using npm script (recommended)**
```bash
cd worklenz-backend
npm run import:cycle-count
```

**Option 2: Direct execution**
```bash
cd worklenz-backend
npx ts-node src/utils/data-migration/importers/import-cycle-count-data.ts
```

**Option 3: From the importers directory**
```bash
cd worklenz-backend/src/utils/data-migration/importers
npx ts-node import-cycle-count-data.ts
```

## Expected Workflow

### Step 1: Run Extractor Scripts (Agents 1 & 2)

First, generate the JSON output files using the extractor scripts:

```bash
# Agent 1: Extract Austin cycle count data
npx ts-node src/utils/data-migration/extractors/extract-austin-cycle-count.ts

# Agent 2: Extract SF cycle count data
npx ts-node src/utils/data-migration/extractors/extract-sf-cycle-count.ts
```

### Step 2: Verify JSON Output

Check that the JSON files were created successfully:

```bash
ls -lh src/utils/data-migration/output/
# Should show:
# austin-cycle-count.json
# sf-cycle-count.json
```

### Step 3: Run the Importer

```bash
npm run import:cycle-count
```

### Step 4: Verify Import Results

Check the import summary in the console output:

```
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

### Step 5: Verify in Database

Use Prisma Studio to verify the data:

```bash
npm run prisma:studio
```

Or query directly:

```sql
-- Count records
SELECT COUNT(*) FROM inv_suppliers;
SELECT COUNT(*) FROM inv_storage_locations;
SELECT COUNT(*) FROM inv_components;

-- Sample records
SELECT * FROM inv_suppliers LIMIT 10;
SELECT * FROM inv_storage_locations LIMIT 10;
SELECT * FROM inv_components LIMIT 10;
```

## Understanding the Output

### Successful Import

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
[Summary details...]
========================================

✓ Import completed successfully!
```

**Exit Code:** 0

### Import with Errors

```
Step 3: Importing data to database...

  Importing suppliers...
    ✗ Failed to import supplier Acme Corp (123-456): Unique constraint violation

  Importing storage locations...
    ✓ Locations: 24 created, 1 updated

  Importing components...
    ✗ Failed to import component Widget A (789-012): Foreign key constraint violation
    ✓ Components: 123 created, 1 updated

========================================
  CYCLE COUNT DATA IMPORT SUMMARY
========================================
[Summary with errors section...]
Errors: 2
========================================

Error Details:
  1. Failed to import supplier Acme Corp (123-456): Unique constraint violation
  2. Failed to import component Widget A (789-012): Foreign key constraint violation

⚠ Import completed with errors. See above for details.
```

**Exit Code:** 1

## Re-running the Import (Idempotency)

The importer uses Prisma's `upsert` operation, making it safe to run multiple times:

**First Run:**
- Creates all new records
- Output: "X created, 0 updated"

**Second Run (same data):**
- Updates existing records
- Output: "0 created, X updated"

**Subsequent Runs:**
- Updates existing records
- Output: "0 created, X updated"

## Common Use Cases

### 1. Initial Data Load

Run once after setting up the database:

```bash
npm run import:cycle-count
```

### 2. Data Refresh

Re-run after extractors have been updated with new data:

```bash
# Re-extract data
npx ts-node src/utils/data-migration/extractors/extract-austin-cycle-count.ts
npx ts-node src/utils/data-migration/extractors/extract-sf-cycle-count.ts

# Re-import
npm run import:cycle-count
```

### 3. Fix Errors and Re-import

If the import fails, fix the issues and re-run:

```bash
# Fix data in TSV files or extractor logic
# Re-extract
# Re-import (only failed records will be processed)
npm run import:cycle-count
```

### 4. Add New Records

Add new data to TSV files, re-extract, and re-import:

```bash
# Add rows to austin-cycle-count.tsv or sf-cycle-count.tsv
# Re-extract
npx ts-node src/utils/data-migration/extractors/extract-austin-cycle-count.ts

# Re-import (new records created, existing records updated)
npm run import:cycle-count
```

## Troubleshooting

### Issue: "JSON file not found"

**Cause:** Extractor scripts haven't been run yet.

**Solution:**
```bash
npx ts-node src/utils/data-migration/extractors/extract-austin-cycle-count.ts
npx ts-node src/utils/data-migration/extractors/extract-sf-cycle-count.ts
```

### Issue: "Database connection failed"

**Cause:** PostgreSQL not running or incorrect connection string.

**Solution:**
1. Check PostgreSQL is running:
   ```bash
   pg_isready
   ```
2. Verify `.env` file has correct `DATABASE_URL`
3. Test connection:
   ```bash
   npm run prisma:studio
   ```

### Issue: "Foreign key constraint violation"

**Cause:** Referenced supplier or location doesn't exist.

**Solution:**
1. Check that suppliers are imported before components
2. Verify supplier_id and storage_location_id in JSON files
3. Check extractor logic for correct UUID generation

### Issue: "Transaction timeout"

**Cause:** Very large dataset or slow database.

**Solution:**
1. Check database performance
2. Consider batch processing (not implemented yet)
3. Increase Prisma connection pool size in schema

### Issue: "Unique constraint violation"

**Cause:** Duplicate records with same UUID.

**Solution:**
1. Check extractor logic for deterministic UUID generation
2. Verify no duplicate rows in source TSV files
3. The importer should handle this automatically with upsert

## Performance Considerations

### Import Speed

Typical performance (on local development machine):
- 125 components: ~1.5 seconds
- 500 components: ~5 seconds
- 1000 components: ~10 seconds

### Optimization Tips

1. **Use transactions:** Already implemented (all imports in single transaction)
2. **Batch processing:** For very large datasets (>10,000 records), consider implementing batch processing
3. **Index optimization:** Ensure database indexes are created (Prisma migration handles this)
4. **Connection pooling:** Configure Prisma connection pool in schema.prisma

## Data Validation

The importer performs basic validation:

1. **File existence:** Checks JSON files exist
2. **JSON parsing:** Validates JSON structure
3. **Required fields:** Prisma enforces required fields
4. **Foreign keys:** Database enforces referential integrity
5. **UUID format:** Prisma validates UUID format

For more thorough validation, use the data-validator module before importing:

```typescript
import { validateCycleCountData } from '../validators/data-validator';

const errors = validateCycleCountData(data);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  process.exit(1);
}
```

## Next Steps

After successful import:

1. **Verify data quality:** Use Prisma Studio or SQL queries
2. **Run QR code generation:** Generate QR codes for components
3. **Set up inventory transactions:** Begin tracking inventory changes
4. **Configure alerts:** Set up low-stock alerts based on reorder_level

## Integration with Other Scripts

This importer is part of the complete data migration pipeline:

```
TSV Files → Extractors → JSON Files → Importers → Database
           (Agents 1&2)              (Agent 3)
```

**Complete Workflow:**
1. Place TSV files in `input` directory
2. Run Agent 1: Extract Austin data
3. Run Agent 2: Extract SF data
4. Run Agent 3: Import combined data (this script)
5. Verify data in database
6. Generate QR codes (future script)
