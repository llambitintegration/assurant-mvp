/**
 * SF Cycle Count TSV Parser
 *
 * Parses the SF location cycle count TSV file and generates JSON output for database import.
 * This script implements Agent 2 from the cycle count data import plan.
 *
 * Input:  /context/RobCo Inc Cycle Count - 12_19_25 - SF.tsv (19 rows)
 * Output: /worklenz-backend/src/utils/data-migration/output/sf-cycle-count.json
 *
 * @module parse-sf-cycle-count
 */

import * as fs from 'fs';
import * as path from 'path';
import prisma from '../../../config/prisma';
import { parseTsvFile, mapTsvToObjects } from '../tsv-parsing/tsv-parser';
import { generateUuidV5 } from '../uuid-generation/deterministic-uuid';
import {
  validateRequiredFields,
  combineValidationResults,
} from '../validators/data-validator';

/**
 * TSV row structure
 */
interface SFCycleCountRow {
  'RobCo Part Number': string; // SKU
  'Part Number': string; // Manufacturer part number
  'Serial Number': string;
  'Part Description': string; // Name (REQUIRED)
  'Supplier': string;
  'Category': string;
  'Quantity': string;
  'Unit': string;
  'Location': string; // Location code
  'Notes': string;
}

/**
 * Supplier database record
 */
interface SupplierRecord {
  id: string;
  name: string;
  team_id: string;
  created_by: string;
  is_active: boolean;
}

/**
 * Storage location database record
 */
interface StorageLocationRecord {
  id: string;
  location_code: string;
  name: string;
  description: string | null;
  team_id: string;
  created_by: string;
  is_active: boolean;
}

/**
 * Component database record
 */
interface ComponentRecord {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  part_number: string | null;
  quantity: number;
  unit: string | null;
  owner_type: 'supplier' | 'storage_location';
  supplier_id: string | null;
  storage_location_id: string | null;
  team_id: string;
  created_by: string;
  is_active: boolean;
}

/**
 * Output JSON structure
 */
interface OutputData {
  suppliers: SupplierRecord[];
  storage_locations: StorageLocationRecord[];
  components: ComponentRecord[];
  _metadata: {
    source_file: string;
    generated_at: string;
    team_name: string;
    team_id: string;
    created_by: string;
    total_suppliers: number;
    total_locations: number;
    total_components: number;
    validation_status: string;
  };
}

/**
 * Main execution function
 */
async function main() {
  console.log('=== SF Cycle Count Parser ===\n');

  try {
    // ========================================
    // STEP 1: Database Context Lookup
    // ========================================
    console.log('Step 1: Looking up database context...');

    const teamResult = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name FROM teams WHERE name LIKE '%Assurant%' LIMIT 1
    `;

    if (!teamResult || teamResult.length === 0) {
      throw new Error('Team "Assurant" not found in database');
    }

    const team = teamResult[0];

    const userResult = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email FROM users WHERE email = 'admin@llambit.io' LIMIT 1
    `;

    if (!userResult || userResult.length === 0) {
      throw new Error('User "admin@llambit.io" not found in database');
    }

    const user = userResult[0];

    console.log(`  Team ID: ${team.id}`);
    console.log(`  Created By: ${user.id}\n`);

    // ========================================
    // STEP 2: TSV Parsing
    // ========================================
    console.log('Step 2: Parsing TSV file...');

    const inputFilePath = path.resolve(
      __dirname,
      '../../../../../context/RobCo Inc Cycle Count - 12_19_25 - SF.tsv'
    );

    const rows = parseTsvFile(inputFilePath);
    const records = mapTsvToObjects(rows) as unknown as SFCycleCountRow[];

    // Filter out rows where Part Description is empty
    const validRecords = records.filter(
      (record) => record['Part Description'] && record['Part Description'].trim() !== ''
    );

    console.log(`  Total rows parsed: ${records.length}`);
    console.log(`  Valid records (with Part Description): ${validRecords.length}\n`);

    // ========================================
    // STEP 3: Extract Unique Entities
    // ========================================
    console.log('Step 3: Extracting unique entities...');

    const uniqueSuppliers = new Set<string>();
    const uniqueLocations = new Set<string>();

    for (const record of validRecords) {
      // Collect unique suppliers (non-empty only)
      const supplier = record['Supplier']?.trim();
      if (supplier) {
        uniqueSuppliers.add(supplier);
      }

      // Collect unique location codes (non-empty only)
      const location = record['Location']?.trim();
      if (location) {
        uniqueLocations.add(location);
      }
    }

    // Add "Unassigned" to the locations set
    uniqueLocations.add('Unassigned');

    console.log(`  Unique suppliers: ${uniqueSuppliers.size}`);
    console.log(`  Unique locations: ${uniqueLocations.size} (including Unassigned)\n`);

    // ========================================
    // STEP 4: Generate Suppliers
    // ========================================
    console.log('Step 4: Generating suppliers...');

    const suppliers: SupplierRecord[] = Array.from(uniqueSuppliers).map((name) => ({
      id: generateUuidV5(`supplier:${team.id}:${name}`),
      name: name,
      team_id: team.id,
      created_by: user.id,
      is_active: true,
    }));

    console.log(`  Generated ${suppliers.length} suppliers\n`);

    // ========================================
    // STEP 5: Generate Storage Locations
    // ========================================
    console.log('Step 5: Generating storage locations...');

    const storageLocations: StorageLocationRecord[] = Array.from(uniqueLocations).map(
      (code) => ({
        id: generateUuidV5(`location:${team.id}:${code}`),
        location_code: code,
        name: code === 'Unassigned' ? 'Unassigned Location' : code,
        description:
          code === 'Unassigned'
            ? 'Default location for components without assigned storage'
            : null,
        team_id: team.id,
        created_by: user.id,
        is_active: true,
      })
    );

    console.log(`  Generated ${storageLocations.length} storage locations\n`);

    // ========================================
    // STEP 6: Transform Components
    // ========================================
    console.log('Step 6: Transforming components...');

    const components: ComponentRecord[] = validRecords.map((record) => {
      const sku = record['RobCo Part Number']?.trim() || null;
      const partNumber = record['Part Number']?.trim() || null;
      const serial = record['Serial Number']?.trim() || null;
      const name = record['Part Description'].trim();
      const supplier = record['Supplier']?.trim() || null;
      const location = record['Location']?.trim() || null;
      const quantity = parseInt(record['Quantity']) || 1;
      const unit = record['Unit']?.trim() || null;

      // Determine ownership (Priority: Location > Supplier > Default "Unassigned")
      let ownerType: 'supplier' | 'storage_location';
      let supplierId: string | null = null;
      let storageLocationId: string | null = null;

      if (location) {
        // Location present
        ownerType = 'storage_location';
        storageLocationId = generateUuidV5(`location:${team.id}:${location}`);
      } else if (supplier) {
        // Supplier present, no location
        ownerType = 'supplier';
        supplierId = generateUuidV5(`supplier:${team.id}:${supplier}`);
      } else {
        // No location, no supplier - default to Unassigned
        ownerType = 'storage_location';
        storageLocationId = generateUuidV5(`location:${team.id}:Unassigned`);
      }

      // Generate component UUID (includes serial for uniqueness)
      const componentId = generateUuidV5(`${team.id}:${sku || name}:${serial || ''}`);

      // Serial numbers go in description
      const description = serial ? `Serial: ${serial}` : null;

      return {
        id: componentId,
        name,
        description,
        sku,
        part_number: partNumber,
        quantity,
        unit,
        owner_type: ownerType,
        supplier_id: supplierId,
        storage_location_id: storageLocationId,
        team_id: team.id,
        created_by: user.id,
        is_active: true,
      };
    });

    console.log(`  Transformed ${components.length} components\n`);

    // ========================================
    // STEP 7: Validation
    // ========================================
    console.log('Step 7: Validating data...');

    const supplierValidation = validateRequiredFields(
      suppliers,
      ['name', 'team_id', 'created_by'],
      'supplier'
    );

    const locationValidation = validateRequiredFields(
      storageLocations,
      ['location_code', 'name', 'team_id', 'created_by'],
      'storage_location'
    );

    const componentValidation = validateRequiredFields(
      components,
      ['name', 'owner_type', 'team_id', 'created_by'],
      'component'
    );

    const combinedValidation = combineValidationResults([
      supplierValidation,
      locationValidation,
      componentValidation,
    ]);

    if (!combinedValidation.isValid) {
      console.error('\n❌ Validation failed:');
      combinedValidation.errors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }

    console.log('  ✓ All validations passed\n');

    // ========================================
    // STEP 8: JSON Output
    // ========================================
    console.log('Step 8: Writing JSON output...');

    const outputData: OutputData = {
      suppliers,
      storage_locations: storageLocations,
      components,
      _metadata: {
        source_file: 'RobCo Inc Cycle Count - 12_19_25 - SF.tsv',
        generated_at: new Date().toISOString(),
        team_name: 'Assurant P0003C',
        team_id: team.id,
        created_by: user.id,
        total_suppliers: suppliers.length,
        total_locations: storageLocations.length,
        total_components: components.length,
        validation_status: 'passed',
      },
    };

    const outputFilePath = path.resolve(
      __dirname,
      '../output/sf-cycle-count.json'
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf-8');

    console.log(`  Output written to: ${outputFilePath}\n`);

    // ========================================
    // STEP 9: Print Summary
    // ========================================
    console.log('=== Summary ===');
    console.log(`Total suppliers: ${suppliers.length}`);
    console.log(`Total locations: ${storageLocations.length}`);
    console.log(`Total components: ${components.length}`);
    console.log(`Validation status: ${combinedValidation.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`Output file: ${outputFilePath}`);
    console.log('\n✓ SF cycle count parsing completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    // Disconnect Prisma
    await prisma.$disconnect();
  }
}

// Execute main function
main();
