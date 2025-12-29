# Cycle Count Importer - Quick Start Guide

## TL;DR

```bash
# Run the importer
cd worklenz-backend
npm run import:cycle-count
```

## Prerequisites Checklist

- [ ] PostgreSQL database is running
- [ ] Prisma client is generated (`npm run prisma:generate`)
- [ ] JSON files exist:
  - [ ] `src/utils/data-migration/output/austin-cycle-count.json`
  - [ ] `src/utils/data-migration/output/sf-cycle-count.json`
- [ ] Database connection string is set in `.env`

## Quick Commands

```bash
# 1. Generate JSON files (if needed)
npx ts-node src/utils/data-migration/extractors/extract-austin-cycle-count.ts
npx ts-node src/utils/data-migration/extractors/extract-sf-cycle-count.ts

# 2. Run the importer
npm run import:cycle-count

# 3. Verify in database
npm run prisma:studio
```

## Expected Output

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

## Troubleshooting

| Error | Solution |
|-------|----------|
| "JSON file not found" | Run extractor scripts first |
| "Database connection failed" | Check PostgreSQL is running and `.env` is correct |
| "Foreign key constraint violation" | Ensure suppliers/locations are imported before components |
| "Transaction timeout" | Check database performance |

## File Locations

| File | Path |
|------|------|
| Importer Script | `/worklenz-backend/src/utils/data-migration/importers/import-cycle-count-data.ts` |
| Austin JSON | `/worklenz-backend/src/utils/data-migration/output/austin-cycle-count.json` |
| SF JSON | `/worklenz-backend/src/utils/data-migration/output/sf-cycle-count.json` |
| Prisma Schema | `/worklenz-backend/prisma/schema.prisma` |
| Package Script | `npm run import:cycle-count` |

## Key Features

- **Idempotent:** Safe to run multiple times
- **Atomic:** All-or-nothing transaction
- **Deduplication:** Automatic by UUID
- **Error Recovery:** Continues on individual failures
- **Progress Tracking:** Real-time console output
- **Summary Report:** Detailed results at end

## What Gets Imported

1. **Suppliers** → `inv_suppliers` table
2. **Storage Locations** → `inv_storage_locations` table
3. **Components** → `inv_components` table

Total: ~125 components, ~20 suppliers, ~25 locations

## Next Steps After Import

1. Verify data in Prisma Studio
2. Generate QR codes for components
3. Set up inventory transactions
4. Configure low-stock alerts

## Full Documentation

- [Usage Guide](./USAGE.md) - Detailed usage instructions
- [Implementation Details](./IMPLEMENTATION.md) - Technical documentation
- [Importer README](./README.md) - General information
