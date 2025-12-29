/**
 * Cycle Count Data Importer (Agent 3)
 *
 * Reads JSON output files from Agents 1 & 2 and imports the data into the database
 * using Prisma with upsert logic for idempotent imports.
 *
 * Input Files:
 * - austin-cycle-count.json (from Agent 1)
 * - sf-cycle-count.json (from Agent 2)
 *
 * Database Tables:
 * - inv_suppliers
 * - inv_storage_locations
 * - inv_components
 *
 * @module import-cycle-count-data
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Supplier {
  id: string;
  name: string;
  team_id: string;
  created_by: string;
  is_active: boolean;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface StorageLocation {
  id: string;
  location_code: string;
  name: string;
  description: string | null;
  team_id: string;
  created_by: string;
  is_active: boolean;
  parent_location_id?: string | null;
}

interface Component {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  owner_type: 'supplier' | 'storage_location';
  supplier_id: string | null;
  storage_location_id: string | null;
  quantity: number;
  unit: string;
  team_id: string;
  created_by: string;
  is_active: boolean;
  unit_cost?: number | null;
  reorder_level?: number | null;
  qr_code_data?: string | null;
  qr_code_image?: string | null;
}

interface CycleCountData {
  suppliers: Supplier[];
  storage_locations: StorageLocation[];
  components: Component[];
  _metadata: {
    source_file: string;
    extraction_date: string;
    total_suppliers: number;
    total_storage_locations: number;
    total_components: number;
    total_rows_processed: number;
  };
}

interface ImportStats {
  suppliersImported: number;
  locationsImported: number;
  componentsImported: number;
  suppliersUpdated: number;
  locationsUpdated: number;
  componentsUpdated: number;
  errors: string[];
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

async function importCycleCountData(): Promise<void> {
  const startTime = Date.now();
  const prisma = new PrismaClient();

  console.log('========================================');
  console.log('Cycle Count Data Import - Agent 3');
  console.log('========================================\n');

  const stats: ImportStats = {
    suppliersImported: 0,
    locationsImported: 0,
    componentsImported: 0,
    suppliersUpdated: 0,
    locationsUpdated: 0,
    componentsUpdated: 0,
    errors: [],
  };

  try {
    // Step 1: Read JSON files
    console.log('Step 1: Reading JSON files...');
    const { austinData, sfData } = readJsonFiles();
    console.log(`  ✓ Austin data: ${austinData.components.length} components`);
    console.log(`  ✓ SF data: ${sfData.components.length} components\n`);

    // Step 2: Combine and deduplicate data
    console.log('Step 2: Combining and deduplicating data...');
    const { suppliers, locations, components } = combineData(austinData, sfData);
    console.log(`  ✓ Total unique suppliers: ${suppliers.length}`);
    console.log(`  ✓ Total unique locations: ${locations.length}`);
    console.log(`  ✓ Total unique components: ${components.length}\n`);

    // Step 3: Import data with upsert logic (inside transaction)
    console.log('Step 3: Importing data to database...\n');

    await prisma.$transaction(async (tx) => {
      // Import suppliers
      console.log('  Importing suppliers...');
      for (const supplier of suppliers) {
        try {
          const existing = await tx.inv_suppliers.findUnique({
            where: { id: supplier.id },
          });

          await tx.inv_suppliers.upsert({
            where: { id: supplier.id },
            update: {
              name: supplier.name,
              is_active: supplier.is_active,
              contact_person: supplier.contact_person,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              notes: supplier.notes,
            },
            create: {
              id: supplier.id,
              name: supplier.name,
              team_id: supplier.team_id,
              created_by: supplier.created_by,
              is_active: supplier.is_active,
              contact_person: supplier.contact_person,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              notes: supplier.notes,
            },
          });

          if (existing) {
            stats.suppliersUpdated++;
          } else {
            stats.suppliersImported++;
          }
        } catch (error) {
          const errorMsg = `Failed to import supplier ${supplier.name} (${supplier.id}): ${error}`;
          console.error(`    ✗ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
      console.log(`    ✓ Suppliers: ${stats.suppliersImported} created, ${stats.suppliersUpdated} updated\n`);

      // Import storage locations
      console.log('  Importing storage locations...');
      for (const location of locations) {
        try {
          const existing = await tx.inv_storage_locations.findUnique({
            where: { id: location.id },
          });

          await tx.inv_storage_locations.upsert({
            where: { id: location.id },
            update: {
              location_code: location.location_code,
              name: location.name,
              description: location.description,
              is_active: location.is_active,
              parent_location_id: location.parent_location_id,
            },
            create: {
              id: location.id,
              location_code: location.location_code,
              name: location.name,
              description: location.description,
              team_id: location.team_id,
              created_by: location.created_by,
              is_active: location.is_active,
              parent_location_id: location.parent_location_id,
            },
          });

          if (existing) {
            stats.locationsUpdated++;
          } else {
            stats.locationsImported++;
          }
        } catch (error) {
          const errorMsg = `Failed to import location ${location.name} (${location.id}): ${error}`;
          console.error(`    ✗ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
      console.log(`    ✓ Locations: ${stats.locationsImported} created, ${stats.locationsUpdated} updated\n`);

      // Import components
      console.log('  Importing components...');
      for (const component of components) {
        try {
          const existing = await tx.inv_components.findUnique({
            where: { id: component.id },
          });

          await tx.inv_components.upsert({
            where: { id: component.id },
            update: {
              name: component.name,
              sku: component.sku,
              description: component.description,
              category: component.category,
              owner_type: component.owner_type,
              supplier_id: component.supplier_id,
              storage_location_id: component.storage_location_id,
              quantity: component.quantity,
              unit: component.unit,
              is_active: component.is_active,
              unit_cost: component.unit_cost,
              reorder_level: component.reorder_level,
              qr_code_data: component.qr_code_data,
              qr_code_image: component.qr_code_image,
            },
            create: {
              id: component.id,
              name: component.name,
              sku: component.sku,
              description: component.description,
              category: component.category,
              owner_type: component.owner_type,
              supplier_id: component.supplier_id,
              storage_location_id: component.storage_location_id,
              quantity: component.quantity,
              unit: component.unit || 'units',
              team_id: component.team_id,
              created_by: component.created_by,
              is_active: component.is_active,
              unit_cost: component.unit_cost,
              reorder_level: component.reorder_level,
              qr_code_data: component.qr_code_data,
              qr_code_image: component.qr_code_image,
            },
          });

          if (existing) {
            stats.componentsUpdated++;
          } else {
            stats.componentsImported++;
          }
        } catch (error) {
          const errorMsg = `Failed to import component ${component.name} (${component.id}): ${error}`;
          console.error(`    ✗ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
      console.log(`    ✓ Components: ${stats.componentsImported} created, ${stats.componentsUpdated} updated\n`);
    }, {
      maxWait: 60000, // Wait up to 60s to start transaction
      timeout: 60000, // Transaction can run for up to 60s
    });

    // Step 4: Print summary report
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    printSummaryReport(stats, executionTime);

    // Exit with appropriate code
    if (stats.errors.length > 0) {
      console.error('\n⚠ Import completed with errors. See above for details.');
      process.exit(1);
    } else {
      console.log('\n✓ Import completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n✗ Fatal error during import:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read and parse JSON files from the output directory
 */
function readJsonFiles(): { austinData: CycleCountData; sfData: CycleCountData } {
  const outputDir = path.join(__dirname, '../output');
  const austinPath = path.join(outputDir, 'austin-cycle-count.json');
  const sfPath = path.join(outputDir, 'sf-cycle-count.json');

  // Check if files exist
  if (!fs.existsSync(austinPath)) {
    throw new Error(`Austin data file not found: ${austinPath}`);
  }
  if (!fs.existsSync(sfPath)) {
    throw new Error(`SF data file not found: ${sfPath}`);
  }

  // Read and parse files
  const austinData: CycleCountData = JSON.parse(fs.readFileSync(austinPath, 'utf-8'));
  const sfData: CycleCountData = JSON.parse(fs.readFileSync(sfPath, 'utf-8'));

  return { austinData, sfData };
}

/**
 * Combine data from both files and deduplicate by UUID
 */
function combineData(
  austinData: CycleCountData,
  sfData: CycleCountData
): {
  suppliers: Supplier[];
  locations: StorageLocation[];
  components: Component[];
} {
  // Use Maps for deduplication (UUID as key)
  const suppliersMap = new Map<string, Supplier>();
  const locationsMap = new Map<string, StorageLocation>();
  const componentsMap = new Map<string, Component>();

  // Add Austin data
  austinData.suppliers.forEach((s) => suppliersMap.set(s.id, s));
  austinData.storage_locations.forEach((l) => locationsMap.set(l.id, l));
  austinData.components.forEach((c) => componentsMap.set(c.id, c));

  // Add SF data (will overwrite if same UUID exists)
  sfData.suppliers.forEach((s) => suppliersMap.set(s.id, s));
  sfData.storage_locations.forEach((l) => locationsMap.set(l.id, l));
  sfData.components.forEach((c) => componentsMap.set(c.id, c));

  return {
    suppliers: Array.from(suppliersMap.values()),
    locations: Array.from(locationsMap.values()),
    components: Array.from(componentsMap.values()),
  };
}

/**
 * Print summary report of import results
 */
function printSummaryReport(stats: ImportStats, executionTime: number): void {
  console.log('========================================');
  console.log('  CYCLE COUNT DATA IMPORT SUMMARY');
  console.log('========================================');
  console.log(`Suppliers:`);
  console.log(`  - Created: ${stats.suppliersImported}`);
  console.log(`  - Updated: ${stats.suppliersUpdated}`);
  console.log(`  - Total:   ${stats.suppliersImported + stats.suppliersUpdated}`);
  console.log();
  console.log(`Storage Locations:`);
  console.log(`  - Created: ${stats.locationsImported}`);
  console.log(`  - Updated: ${stats.locationsUpdated}`);
  console.log(`  - Total:   ${stats.locationsImported + stats.locationsUpdated}`);
  console.log();
  console.log(`Components:`);
  console.log(`  - Created: ${stats.componentsImported}`);
  console.log(`  - Updated: ${stats.componentsUpdated}`);
  console.log(`  - Total:   ${stats.componentsImported + stats.componentsUpdated}`);
  console.log();
  console.log(`Execution Time: ${executionTime}ms`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log('========================================');

  if (stats.errors.length > 0) {
    console.log('\nError Details:');
    stats.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

// Only run if executed directly (not imported as module)
if (require.main === module) {
  importCycleCountData().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export for testing
export { importCycleCountData, combineData, readJsonFiles };
