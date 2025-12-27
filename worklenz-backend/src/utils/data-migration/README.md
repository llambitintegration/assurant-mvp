# Data Migration Utilities

Reusable TypeScript utilities for extracting, transforming, and migrating data into Worklenz.

## Overview

This directory contains generalized migration utilities extracted from the P0003C pilot project migration. These tools help import data from spreadsheets, TSV files, and other sources into the Worklenz database with proper validation and data quality checks.

## Directory Structure

```
data-migration/
├── README.md                          # This file
├── uuid-generation/
│   └── deterministic-uuid.ts         # UUID v5 generation utilities
├── tsv-parsing/
│   └── tsv-parser.ts                 # TSV/CSV parsing utilities
├── extractors/
│   ├── date-utils.ts                 # Date parsing & formatting
│   └── allocation-calculator.ts      # Allocation merging & calculations
├── validators/
│   └── data-validator.ts             # Validation utilities
└── examples/
    ├── p0003c-migration-guide.md     # Complete P0003C case study
    └── migration-workflow-template.ts # Template for future migrations
```

## Quick Start

### 1. Generate Deterministic UUIDs

```typescript
import { generateUuidV5, generateResourceId } from './uuid-generation/deterministic-uuid';

// Generate UUID from any name
const projectId = generateUuidV5('P0003C');
// => '74be27de-1e4e-593a-8b4e-7869e4a56af4'

// Generate user ID from email
const userId = generateResourceId('john.doe@company.com');
```

### 2. Parse TSV/CSV Files

```typescript
import { parseTsvFile, getTsvColumn, mapTsvToObjects } from './tsv-parsing/tsv-parser';

// Parse TSV file
const rows = parseTsvFile('/path/to/file.tsv');

// Get specific column
const emails = getTsvColumn(rows, 2);  // Column index 2

// Convert to objects using header row
const records = mapTsvToObjects(rows);
// => [{ Name: 'John', Email: 'john@example.com' }, ...]
```

### 3. Parse and Format Dates

```typescript
import { parseDate, getWeekEndDate, formatIsoDate } from './extractors/date-utils';

// Parse M/D/YYYY to YYYY-MM-DD
const isoDate = parseDate('6/17/2025');
// => '2025-06-17'

// Calculate week end date
const endDate = getWeekEndDate('2025-06-17');
// => '2025-06-23' (6 days later)
```

### 4. Calculate Allocations

```typescript
import { hoursToPercent, mergeConsecutivePeriods } from './extractors/allocation-calculator';

// Convert hours to percentage
const percent = hoursToPercent(20);  // 20 hours/week
// => 50 (50% of 40-hour work week)

// Merge consecutive weeks with same allocation
const allocations = [
  { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-23', percentAllocation: 50 },
  { resourceId: 'r1', projectId: 'p1', startDate: '2025-06-24', endDate: '2025-06-30', percentAllocation: 50 },
];

const merged = mergeConsecutivePeriods(allocations);
// => [{ resourceId: 'r1', projectId: 'p1', startDate: '2025-06-17', endDate: '2025-06-30', percentAllocation: 50 }]
// Reduced from 2 records to 1
```

### 5. Validate Data

```typescript
import { validateSum, validateRequiredFields, validateUuidFields } from './validators/data-validator';

// Validate sum matches expected total
const result = validateSum([10, 20, 30], 60, 0.01, 'hours');
// => { isValid: true, errors: [], warnings: [] }

// Validate required fields exist
const users = [{ id: '1', name: 'John', email: 'john@example.com' }];
const validation = validateRequiredFields(users, ['id', 'name', 'email'], 'user');

// Validate UUID format
const uuidValidation = validateUuidFields(users, ['id'], 'user');
```

## Common Migration Workflow

```typescript
import { parseTsvFile } from './tsv-parsing/tsv-parser';
import { generateResourceId } from './uuid-generation/deterministic-uuid';
import { parseDate } from './extractors/date-utils';
import { validateRequiredFields } from './validators/data-validator';

// 1. Load source data
const rows = parseTsvFile('/path/to/resources.tsv');

// 2. Extract & transform entities
const resources = rows.slice(1).map((row) => ({
  id: generateResourceId(row[1]),  // Generate from email
  firstName: row[0],
  lastName: row[1],
  email: row[2],
  startDate: parseDate(row[3]),    // Convert to ISO date
}));

// 3. Validate
const validation = validateRequiredFields(resources, ['id', 'firstName', 'email']);

if (!validation.isValid) {
  console.error('Validation failed:', validation.errors);
  process.exit(1);
}

// 4. Output as JSON for database import
const output = {
  resources,
  _metadata: {
    totalResources: resources.length,
    generatedAt: new Date().toISOString(),
  },
};

fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
```

## Module Reference

### uuid-generation/deterministic-uuid.ts

Generate deterministic UUIDs using UUID v5 (RFC 4122).

**Key Functions:**
- `generateUuidV5(name, namespace?)` - Generate UUID v5 from name
- `generateResourceId(email)` - Generate user ID from email
- `generateTeamId(teamName)` - Generate team ID
- `generateProjectId(projectName)` - Generate project ID
- `isValidUuid(uuid)` - Validate UUID format

**Why Deterministic?** Same input always produces the same UUID, enabling:
- Reproducible migrations
- Idempotent imports (re-running won't create duplicates)
- Cross-reference between different data sources

### tsv-parsing/tsv-parser.ts

Parse tab-separated value (TSV) and comma-separated value (CSV) files.

**Key Functions:**
- `parseTsvFile(filePath, options?)` - Parse entire TSV file
- `getTsvColumn(rows, columnIndex)` - Extract specific column
- `getTsvHeaders(rows)` - Get header row
- `getTsvCell(rows, rowIndex, columnIndex)` - Get specific cell
- `mapTsvToObjects(rows)` - Convert rows to objects using headers
- `extractColumnRange(rows, startCol, endCol)` - Extract column range

**Options:**
- `delimiter` - Field separator (default: `'\t'`)
- `encoding` - File encoding (default: `'utf-8'`)
- `skipEmptyLines` - Skip empty lines (default: `true`)
- `trimCells` - Trim whitespace (default: `false`)

### extractors/date-utils.ts

Parse and format dates for migration.

**Key Functions:**
- `parseDate(dateStr)` - Parse M/D/YYYY to YYYY-MM-DD
- `getWeekEndDate(startDate, weekLength?)` - Calculate week end date
- `formatIsoDate(date)` - Format Date to YYYY-MM-DD
- `formatIsoDateTime(date)` - Format Date to ISO 8601 DateTime
- `getWeekIdentifier(dateStr)` - Get ISO week (e.g., '2025-W25')
- `addDays(dateStr, days)` - Add days to date
- `daysBetween(startDate, endDate)` - Calculate days between dates
- `isValidIsoDate(dateStr)` - Validate YYYY-MM-DD format

**Common Use Cases:**
- Converting US date formats (M/D/YYYY) to ISO (YYYY-MM-DD)
- Calculating week ranges for allocations
- Validating date inputs

### extractors/allocation-calculator.ts

Calculate resource allocations and merge consecutive periods.

**Key Functions:**
- `hoursToPercent(hours, standardWeek?)` - Convert hours to allocation %
- `percentToHours(percent, standardWeek?)` - Convert % to hours
- `mergeConsecutivePeriods(allocations)` - Merge consecutive weeks
- `aggregateMultiRoleAllocations(allocations)` - Sum multi-role allocations
- `splitIntoWeeklyPeriods(allocation)` - Split long period into weeks
- `calculateTotalHours(allocations)` - Sum total allocated hours
- `divideHoursEqually(totalHours, resourceIds)` - Distribute hours equally

**Performance Impact:**
- P0003C migration: Reduced 1,712 allocation records to 677 (60% reduction)
- Enables efficient database storage and queries

### validators/data-validator.ts

Generic data validation utilities.

**Key Functions:**
- `validateSum(values, expectedTotal, tolerance?)` - Validate sum matches
- `validateRequiredFields(records, requiredFields)` - Check required fields
- `validateUuidFields(records, uuidFields)` - Validate UUID format
- `validateRange(value, min, max)` - Validate numeric range
- `validateUnique(values)` - Check for duplicates
- `validateForeignKeys(foreignKeys, validIds)` - Validate FK references
- `validateCount(actualCount, expectedCount)` - Validate count matches
- `combineValidationResults(results)` - Merge multiple validations

**Validation Result Format:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];     // Validation failures
  warnings: string[];   // Potential issues
  metadata?: Record<string, any>;  // Additional data
}
```

## Examples

### Example 1: Import Resources from TSV

```typescript
import { parseTsvFile } from './tsv-parsing/tsv-parser';
import { generateResourceId } from './uuid-generation/deterministic-uuid';

const rows = parseTsvFile('./resources.tsv');
const resources = rows.slice(1).map((row) => ({
  id: generateResourceId(row[1]),  // Email in column 1
  firstName: row[0],
  lastName: row[2],
  email: row[1],
  employeeId: row[3],
}));

console.log(`Imported ${resources.length} resources`);
```

### Example 2: Merge Weekly Allocations

```typescript
import { mergeConsecutivePeriods } from './extractors/allocation-calculator';

// 71 weeks of allocations
const weeklyAllocations = [...];  // From TSV

// Merge consecutive weeks with same %
const merged = mergeConsecutivePeriods(weeklyAllocations);

console.log(`Reduced from ${weeklyAllocations.length} to ${merged.length} records`);
// P0003C: Reduced from 1,712 to 677 (60% reduction)
```

### Example 3: Validate Migration Data

```typescript
import { validateSum, validateUuidFields, combineValidationResults } from './validators/data-validator';

// Validate total hours
const hoursValidation = validateSum(weeklyHours, 16864, 0.01, 'hours');

// Validate all UUIDs
const uuidValidation = validateUuidFields(resources, ['id']);

// Combine results
const overallValidation = combineValidationResults([hoursValidation, uuidValidation]);

if (!overallValidation.isValid) {
  console.error('Migration validation failed:');
  overallValidation.errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}
```

## P0003C Case Study

See [examples/p0003c-migration-guide.md](./examples/p0003c-migration-guide.md) for a complete case study of migrating the P0003C pilot project, including:

- 7-agent migration workflow
- Special cases handled (multi-role resources, service dept, build team)
- Data volume (27 resources, 677 allocations, 14 departments)
- Validation results and lessons learned

## Migration Workflow Template

See [examples/migration-workflow-template.ts](./examples/migration-workflow-template.ts) for a complete migration template you can use as a starting point for future projects.

## Testing

Run unit tests for migration utilities:

```bash
npm test -- data-migration
```

## Best Practices

### 1. Use Deterministic UUIDs
Always generate UUIDs from natural keys (email, name, etc.) to enable idempotent imports.

```typescript
// ✅ Good - deterministic
const userId = generateResourceId('user@example.com');

// ❌ Bad - random UUID (creates duplicates on re-import)
const userId = crypto.randomUUID();
```

### 2. Validate Early and Often
Validate data at each step of the migration pipeline.

```typescript
// After extraction
const validation1 = validateRequiredFields(resources, ['id', 'email']);

// After transformation
const validation2 = validateSum(weeklyHours, expectedTotal);

// Before database import
const finalValidation = combineValidationResults([validation1, validation2]);
```

### 3. Merge Consecutive Periods
Always merge consecutive allocation periods to reduce database size.

```typescript
// Without merging: 1,712 records
const weekly = weeklyAllocations;

// With merging: 677 records (60% reduction)
const merged = mergeConsecutivePeriods(weeklyAllocations);
```

### 4. Handle Special Cases Explicitly
Document and test special cases (multi-role users, aggregations, etc.).

```typescript
// Special case: Multi-role resource (Tabitha Brown)
if (isTabhitaBrown(resource)) {
  // Aggregate hours from 3 departments
  const totalHours = purchasingHours + quotingHours + buyingHours;
  // ...
}
```

### 5. Use Type Safety
Leverage TypeScript interfaces for data structures.

```typescript
interface AllocationPeriod {
  resourceId: string;
  projectId: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  percentAllocation: number;
}
```

## TypeScript Configuration

These utilities are written in TypeScript and can be imported into your migration scripts:

```typescript
import { generateUuidV5 } from './utils/data-migration/uuid-generation/deterministic-uuid';
import { parseTsvFile } from './utils/data-migration/tsv-parsing/tsv-parser';
// ... etc
```

For JavaScript usage, compile TypeScript first:

```bash
npx tsc
```

## Contributing

When adding new utilities:

1. Follow existing module structure
2. Add comprehensive JSDoc comments
3. Include usage examples
4. Write unit tests
5. Update this README

## License

Part of the Worklenz backend codebase.

---

**Need Help?** See the [P0003C Migration Guide](./examples/p0003c-migration-guide.md) for a complete real-world example.
