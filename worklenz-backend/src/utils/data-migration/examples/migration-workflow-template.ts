/**
 * Data Migration Workflow Template
 *
 * Use this template as a starting point for migrating new projects into Worklenz.
 * Adapt the logic based on your specific data source and requirements.
 *
 * @example
 * ```bash
 * # Copy this template to your migration script
 * cp src/utils/data-migration/examples/migration-workflow-template.ts scripts/migrate-project-xyz.ts
 *
 * # Customize the script for your project
 * # Run the migration
 * npx ts-node scripts/migrate-project-xyz.ts
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Import migration utilities
import { generateUuidV5, generateResourceId, generateTeamId, generateProjectId } from '../uuid-generation/deterministic-uuid';
import { parseTsvFile } from '../tsv-parsing/tsv-parser';
import { parseDate, getWeekEndDate, formatIsoDateTime } from '../extractors/date-utils';
import { hoursToPercent, mergeConsecutivePeriods } from '../extractors/allocation-calculator';
import {
  validateRequiredFields,
  validateUuidFields,
  validateCount,
  combineValidationResults,
} from '../validators/data-validator';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Source data file
  sourceFile: '/path/to/your/data-file.tsv',

  // Output directory for JSON files
  outputDir: '/path/to/output',

  // Project details
  project: {
    name: 'Project XYZ',
    teamName: 'Your Team Name',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  },

  // Database connection (uses Prisma configuration)
  database: {
    // Connection string from environment or direct
    connectionString: process.env.DATABASE_URL,
  },
};

// ============================================================================
// STEP 1: LOAD SOURCE DATA
// ============================================================================

async function loadSourceData(): Promise<any> {
  console.log('Step 1: Loading source data...');

  // Example: Load TSV file
  const rows = parseTsvFile(CONFIG.sourceFile);

  console.log(`  ✓ Loaded ${rows.length} rows`);

  // TODO: Parse your source data structure
  // - Extract headers
  // - Identify data rows
  // - Extract metadata

  return {
    rows,
    headers: rows[0],
    dataRows: rows.slice(1),
  };
}

// ============================================================================
// STEP 2: EXTRACT & TRANSFORM ENTITIES
// ============================================================================

interface Resource {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId?: string;
}

async function extractResources(sourceData: any): Promise<Resource[]> {
  console.log('Step 2: Extracting resources...');

  const resources: Resource[] = [];

  // TODO: Customize extraction logic for your data source
  // Example: Extract from TSV columns
  for (let i = 0; i < sourceData.dataRows.length; i++) {
    const row = sourceData.dataRows[i];

    // Skip empty rows
    if (!row[0] || !row[1]) continue;

    const resource: Resource = {
      id: generateResourceId(row[1]), // Generate from email
      firstName: row[0],
      lastName: row[2],
      email: row[1],
      employeeId: row[3] || undefined,
    };

    resources.push(resource);
  }

  console.log(`  ✓ Extracted ${resources.length} resources`);

  return resources;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

async function extractDepartments(_sourceData: any): Promise<Department[]> {
  console.log('Step 3: Extracting departments...');

  const departments: Department[] = [];

  // TODO: Customize extraction logic for your data source
  // Example: Hardcoded departments
  const departmentNames = [
    'Engineering',
    'Product Management',
    'Design',
    'Quality Assurance',
    'Operations',
  ];

  departmentNames.forEach((name) => {
    departments.push({
      id: generateUuidV5(name),
      name,
      description: `${name} department`,
    });
  });

  console.log(`  ✓ Extracted ${departments.length} departments`);

  return departments;
}

interface Allocation {
  id: string;
  resourceId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  percentAllocation: number;
  hoursPerWeek?: number;
  notes?: string;
}

async function extractAllocations(
  sourceData: any,
  resources: Resource[],
  projectId: string
): Promise<Allocation[]> {
  console.log('Step 4: Extracting allocations...');

  const allocations: Allocation[] = [];

  // TODO: Customize extraction logic for your data source
  // Example: Extract weekly hours and convert to allocations

  // Build resource map for lookup
  const resourceByEmail = new Map(resources.map((r) => [r.email, r.id]));

  // Extract week dates from source
  const weekDates = sourceData.headers
    .slice(4)
    .filter((cell: string) => cell.includes('/'))
    .map(parseDate);

  // Extract hours for each resource-week combination
  sourceData.dataRows.forEach((row: string[]) => {
    const email = row[1];
    const resourceId = resourceByEmail.get(email);

    if (!resourceId) return;

    // Extract weekly hours (columns 4+)
    const weeklyHours = row.slice(4).map((cell) => parseFloat(cell) || 0);

    weeklyHours.forEach((hours, weekIndex) => {
      if (hours === 0) return;

      const startDate = weekDates[weekIndex];
      const endDate = getWeekEndDate(startDate);

      allocations.push({
        id: generateUuidV5(`${resourceId}-${projectId}-${startDate}`),
        resourceId,
        projectId,
        startDate,
        endDate,
        percentAllocation: hoursToPercent(hours),
        hoursPerWeek: hours,
        notes: `${hours} hours/week`,
      });
    });
  });

  console.log(`  ✓ Extracted ${allocations.length} raw allocations`);

  // Merge consecutive periods with same allocation
  const merged = mergeConsecutivePeriods(allocations);
  console.log(`  ✓ Merged to ${merged.length} allocations (${Math.round((1 - merged.length / allocations.length) * 100)}% reduction)`);

  // Add IDs to merged allocations for database import
  return merged.map((alloc, index) => ({
    ...alloc,
    id: alloc.id || generateUuidV5(`${alloc.resourceId}-${alloc.projectId}-${alloc.startDate}-${index}`),
  }));
}

// ============================================================================
// STEP 3: GENERATE DETERMINISTIC UUIDS
// ============================================================================

interface FoundationData {
  systemUserId: string;
  teamId: string;
  projectId: string;
}

async function generateFoundationIds(): Promise<FoundationData> {
  console.log('Step 5: Generating foundation UUIDs...');

  const foundation: FoundationData = {
    systemUserId: generateResourceId('system@yourcompany.com'),
    teamId: generateTeamId(CONFIG.project.teamName),
    projectId: generateProjectId(CONFIG.project.name),
  };

  console.log(`  ✓ System User ID: ${foundation.systemUserId}`);
  console.log(`  ✓ Team ID: ${foundation.teamId}`);
  console.log(`  ✓ Project ID: ${foundation.projectId}`);

  return foundation;
}

// ============================================================================
// STEP 4: VALIDATE DATA QUALITY
// ============================================================================

async function validateMigrationData(
  resources: Resource[],
  departments: Department[],
  allocations: Allocation[]
): Promise<void> {
  console.log('Step 6: Validating migration data...');

  const validations = [];

  // Validate resource count
  validations.push(
    validateCount(resources.length, resources.length, 'resources')
  );

  // Validate required fields
  validations.push(
    validateRequiredFields(resources, ['id', 'firstName', 'email'], 'resource')
  );

  // Validate UUIDs
  validations.push(validateUuidFields(resources, ['id'], 'resource'));
  validations.push(validateUuidFields(departments, ['id'], 'department'));
  validations.push(
    validateUuidFields(allocations, ['id', 'resourceId', 'projectId'], 'allocation')
  );

  // Validate allocation totals (if you have expected totals)
  const totalHours = allocations.reduce((sum, a) => sum + (a.hoursPerWeek || 0), 0);
  console.log(`  ℹ Total allocated hours: ${totalHours}`);

  // Combine all validations
  const overall = combineValidationResults(validations);

  if (!overall.isValid) {
    console.error('  ✗ Validation failed:');
    overall.errors.forEach((error) => console.error(`    - ${error}`));
    throw new Error('Migration validation failed');
  }

  if (overall.warnings.length > 0) {
    console.warn('  ⚠ Warnings:');
    overall.warnings.forEach((warning) => console.warn(`    - ${warning}`));
  }

  console.log('  ✓ All validations passed');
}

// ============================================================================
// STEP 5: OUTPUT PRISMA-COMPATIBLE JSON
// ============================================================================

async function outputJSON(
  foundation: FoundationData,
  resources: Resource[],
  departments: Department[],
  allocations: Allocation[]
): Promise<void> {
  console.log('Step 7: Outputting JSON files...');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Output foundation data
  const foundationOutput = {
    ...foundation,
    _metadata: {
      generatedAt: formatIsoDateTime(new Date()),
      projectName: CONFIG.project.name,
      teamName: CONFIG.project.teamName,
    },
  };

  fs.writeFileSync(
    path.join(CONFIG.outputDir, '01-foundation.json'),
    JSON.stringify(foundationOutput, null, 2)
  );

  // Output resources
  const resourcesOutput = {
    resources,
    _metadata: {
      totalResources: resources.length,
      generatedAt: formatIsoDateTime(new Date()),
    },
  };

  fs.writeFileSync(
    path.join(CONFIG.outputDir, '02-resources.json'),
    JSON.stringify(resourcesOutput, null, 2)
  );

  // Output departments
  const departmentsOutput = {
    departments,
    _metadata: {
      totalDepartments: departments.length,
      generatedAt: formatIsoDateTime(new Date()),
    },
  };

  fs.writeFileSync(
    path.join(CONFIG.outputDir, '03-departments.json'),
    JSON.stringify(departmentsOutput, null, 2)
  );

  // Output allocations
  const allocationsOutput = {
    allocations,
    _metadata: {
      totalAllocations: allocations.length,
      totalHours: allocations.reduce((sum, a) => sum + (a.hoursPerWeek || 0), 0),
      generatedAt: formatIsoDateTime(new Date()),
    },
  };

  fs.writeFileSync(
    path.join(CONFIG.outputDir, '04-allocations.json'),
    JSON.stringify(allocationsOutput, null, 2)
  );

  console.log(`  ✓ JSON files written to ${CONFIG.outputDir}`);
}

// ============================================================================
// STEP 6: IMPORT TO DATABASE
// ============================================================================

async function importToDatabase(
  _foundation: FoundationData,
  resources: Resource[],
  departments: Department[],
  allocations: Allocation[]
): Promise<void> {
  console.log('Step 8: Importing to database...');

  const prisma = new PrismaClient();

  try {
    // TODO: Customize database import logic for your schema
    // Note: This example assumes using raw SQL for tables marked with @@ignore

    // Example: Import resources
    console.log('  - Importing resources...');
    for (const resource of resources) {
      await prisma.$executeRaw`
        INSERT INTO rcm_resources (id, first_name, last_name, email, employee_id)
        VALUES (
          ${resource.id}::uuid,
          ${resource.firstName},
          ${resource.lastName},
          ${resource.email},
          ${resource.employeeId}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log(`    ✓ Imported ${resources.length} resources`);

    // Example: Import departments
    console.log('  - Importing departments...');
    for (const dept of departments) {
      await prisma.$executeRaw`
        INSERT INTO rcm_departments (id, name, description)
        VALUES (
          ${dept.id}::uuid,
          ${dept.name},
          ${dept.description}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log(`    ✓ Imported ${departments.length} departments`);

    // Example: Import allocations
    console.log('  - Importing allocations...');
    for (const alloc of allocations) {
      await prisma.$executeRaw`
        INSERT INTO rcm_allocations (
          id, resource_id, project_id, start_date, end_date, allocation_percent, notes
        )
        VALUES (
          ${alloc.id}::uuid,
          ${alloc.resourceId}::uuid,
          ${alloc.projectId}::uuid,
          ${alloc.startDate}::date,
          ${alloc.endDate}::date,
          ${alloc.percentAllocation},
          ${alloc.notes}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log(`    ✓ Imported ${allocations.length} allocations`);

    console.log('  ✓ Database import complete');
  } catch (error) {
    console.error('  ✗ Database import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// MAIN MIGRATION WORKFLOW
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('DATA MIGRATION - Project XYZ');
  console.log('='.repeat(70));

  try {
    // Step 1: Load source data
    const sourceData = await loadSourceData();

    // Step 2: Extract & transform entities
    const resources = await extractResources(sourceData);
    const departments = await extractDepartments(sourceData);

    // Step 3: Generate deterministic UUIDs
    const foundation = await generateFoundationIds();

    // Extract allocations (requires foundation.projectId)
    const allocations = await extractAllocations(sourceData, resources, foundation.projectId);

    // Step 4: Validate data quality
    await validateMigrationData(resources, departments, allocations);

    // Step 5: Output Prisma-compatible JSON
    await outputJSON(foundation, resources, departments, allocations);

    // Step 6: Import to database (optional - can run separately)
    const shouldImportToDb = process.env.IMPORT_TO_DB === 'true';

    if (shouldImportToDb) {
      await importToDatabase(foundation, resources, departments, allocations);
    } else {
      console.log('\n⏸ Database import skipped (set IMPORT_TO_DB=true to import)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✓ MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`\nSummary:`);
    console.log(`  - Resources:    ${resources.length}`);
    console.log(`  - Departments:  ${departments.length}`);
    console.log(`  - Allocations:  ${allocations.length}`);
    console.log(`\nJSON files written to: ${CONFIG.outputDir}`);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
