/**
 * CSV Import Service
 * Handles bulk component imports from CSV files with comprehensive error handling
 */

import { parse } from 'csv-parse/sync';
import prisma from "../../config/prisma";
import { createComponent } from "./components-service";
import {
  ICSVImportRow,
  ICSVImportResult,
  ICSVValidationResult
} from "../../interfaces/inv/csv-import.interface";
import { inv_owner_type } from "@prisma/client";

/**
 * Parse CSV file buffer to array of rows
 * Handles special characters, quotes, multiline values
 */
export function parseCSV(fileBuffer: Buffer): ICSVImportRow[] {
  try {
    const records = parse(fileBuffer, {
      columns: true, // Use first row as headers
      skip_empty_lines: true, // Skip empty rows
      trim: true, // Trim whitespace from values
      relax_quotes: true, // Handle malformed quotes
      relax_column_count: true, // Handle rows with different column counts
      bom: true, // Handle UTF-8 BOM
      cast: false, // Keep all values as strings for now
      on_record: (record: any) => {
        // Trim all string values in each record
        const trimmedRecord: any = {};
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === 'string') {
            trimmedRecord[key] = value.trim();
          } else {
            trimmedRecord[key] = value;
          }
        }
        return trimmedRecord;
      }
    });

    // Convert to ICSVImportRow format with row numbers
    return records.map((record: any, index: number) => ({
      row_number: index + 2, // +2 because index is 0-based and we skip header row
      name: record.name || '',
      sku: record.sku,
      description: record.description,
      category: record.category,
      owner_type: record.owner_type || '',
      supplier_name: record.supplier_name,
      location_code: record.location_code,
      quantity: record.quantity,
      unit: record.unit,
      unit_cost: record.unit_cost,
      reorder_level: record.reorder_level
    }));
  } catch (error: any) {
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Validate a single CSV row
 * Returns validation result with errors and warnings
 */
export async function validateCSVRow(
  row: ICSVImportRow,
  teamId: string
): Promise<ICSVValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required field: name
  if (!row.name || row.name.trim() === '') {
    errors.push('Component name is required');
  }

  // Validate owner_type
  if (!row.owner_type || row.owner_type.trim() === '') {
    errors.push('Owner type is required');
  } else if (row.owner_type !== 'supplier' && row.owner_type !== 'storage_location') {
    errors.push(`Invalid owner_type '${row.owner_type}'. Must be 'supplier' or 'storage_location'`);
  }

  // Validate owner identifier based on owner_type
  if (row.owner_type === 'supplier') {
    if (!row.supplier_name || row.supplier_name.trim() === '') {
      errors.push('Supplier name is required when owner_type is supplier');
    }
  } else if (row.owner_type === 'storage_location') {
    if (!row.location_code || row.location_code.trim() === '') {
      errors.push('Location code is required when owner_type is storage_location');
    }
  }

  // Validate numeric fields
  let quantity = 0;
  let unit_cost: number | null = null;
  let reorder_level = 0;

  // Parse and validate quantity
  if (row.quantity !== undefined && row.quantity !== null && row.quantity !== '') {
    const parsedQty = typeof row.quantity === 'string' ? parseFloat(row.quantity) : row.quantity;
    if (isNaN(parsedQty)) {
      errors.push(`Invalid quantity '${row.quantity}'. Must be a number`);
    } else if (parsedQty < 0) {
      errors.push('Quantity cannot be negative');
    } else {
      quantity = parsedQty;
    }
  }

  // Parse and validate unit_cost (optional)
  if (row.unit_cost !== undefined && row.unit_cost !== null && row.unit_cost !== '') {
    const parsedCost = typeof row.unit_cost === 'string' ? parseFloat(row.unit_cost) : row.unit_cost;
    if (isNaN(parsedCost)) {
      errors.push(`Invalid unit_cost '${row.unit_cost}'. Must be a number`);
    } else if (parsedCost < 0) {
      errors.push('Unit cost cannot be negative');
    } else {
      unit_cost = parsedCost;
    }
  }

  // Parse and validate reorder_level (optional)
  if (row.reorder_level !== undefined && row.reorder_level !== null && row.reorder_level !== '') {
    const parsedLevel = typeof row.reorder_level === 'string' ? parseFloat(row.reorder_level) : row.reorder_level;
    if (isNaN(parsedLevel)) {
      errors.push(`Invalid reorder_level '${row.reorder_level}'. Must be a number`);
    } else if (parsedLevel < 0) {
      errors.push('Reorder level cannot be negative');
    } else {
      reorder_level = parsedLevel;
    }
  }

  // Check for duplicate SKU within the team (if SKU provided)
  if (row.sku && row.sku.trim() !== '') {
    const existingComponent = await prisma.inv_components.findFirst({
      where: {
        sku: row.sku,
        team_id: teamId,
        is_active: true
      }
    });

    if (existingComponent) {
      errors.push(`Component with SKU '${row.sku}' already exists`);
    }
  } else {
    warnings.push('SKU not provided - component will be created without SKU');
  }

  // If there are errors, return invalid result
  if (errors.length > 0) {
    return {
      is_valid: false,
      errors,
      warnings
    };
  }

  // Return valid result with validated data
  return {
    is_valid: true,
    errors: [],
    warnings,
    validated_data: {
      name: row.name.trim(),
      sku: row.sku?.trim() || undefined,
      description: row.description?.trim() || undefined,
      category: row.category?.trim() || undefined,
      owner_type: row.owner_type as inv_owner_type,
      supplier_id: undefined, // Will be filled by lookupOwner
      storage_location_id: undefined, // Will be filled by lookupOwner
      quantity,
      unit: row.unit?.trim() || undefined,
      unit_cost: unit_cost !== null ? unit_cost : undefined,
      reorder_level: reorder_level !== 0 ? reorder_level : undefined
    }
  };
}

/**
 * Lookup owner (supplier or location) by name/code
 * Returns the owner ID if found
 */
export async function lookupOwner(
  ownerType: string,
  identifier: string,
  teamId: string
): Promise<string> {
  if (ownerType === 'supplier') {
    // Lookup supplier by name
    const supplier = await prisma.inv_suppliers.findFirst({
      where: {
        name: identifier,
        team_id: teamId,
        is_active: true
      }
    });

    if (!supplier) {
      throw new Error(`Supplier '${identifier}' not found`);
    }

    return supplier.id;
  } else if (ownerType === 'storage_location') {
    // Lookup storage location by location_code
    const location = await prisma.inv_storage_locations.findFirst({
      where: {
        location_code: identifier,
        team_id: teamId,
        is_active: true
      }
    });

    if (!location) {
      throw new Error(`Storage location '${identifier}' not found`);
    }

    return location.id;
  } else {
    throw new Error(`Invalid owner_type '${ownerType}'`);
  }
}

/**
 * Import components from CSV file
 * Main orchestrator that handles parsing, validation, and creation
 */
export async function importComponentsFromCSV(
  fileBuffer: Buffer,
  teamId: string,
  userId: string
): Promise<ICSVImportResult> {
  const startTime = Date.now();

  // Parse CSV file
  const rows = parseCSV(fileBuffer);

  // Initialize results
  const results: ICSVImportResult = {
    total_rows: rows.length,
    successful_imports: 0,
    failed_imports: 0,
    errors: [],
    imported_component_ids: [],
    duration_ms: 0
  };

  // If no rows to import, return early
  if (rows.length === 0) {
    results.duration_ms = Date.now() - startTime;
    return results;
  }

  // Process each row
  for (const row of rows) {
    try {
      // 1. Validate row
      const validationResult = await validateCSVRow(row, teamId);

      if (!validationResult.is_valid) {
        throw new Error(validationResult.errors.join('; '));
      }

      if (!validationResult.validated_data) {
        throw new Error('Validation succeeded but no validated data returned');
      }

      // 2. Lookup owner (supplier or location)
      const ownerIdentifier = row.owner_type === 'supplier'
        ? row.supplier_name
        : row.location_code;

      if (!ownerIdentifier) {
        throw new Error(`Missing owner identifier for ${row.owner_type}`);
      }

      const ownerId = await lookupOwner(row.owner_type, ownerIdentifier, teamId);

      // 3. Prepare component data
      const componentData: any = {
        name: validationResult.validated_data.name,
        sku: validationResult.validated_data.sku,
        description: validationResult.validated_data.description,
        category: validationResult.validated_data.category,
        owner_type: validationResult.validated_data.owner_type,
        quantity: validationResult.validated_data.quantity,
        unit: validationResult.validated_data.unit,
        unit_cost: validationResult.validated_data.unit_cost,
        reorder_level: validationResult.validated_data.reorder_level
      };

      // Set owner ID based on owner_type
      if (row.owner_type === 'supplier') {
        componentData.supplier_id = ownerId;
        componentData.storage_location_id = null;
      } else {
        componentData.supplier_id = null;
        componentData.storage_location_id = ownerId;
      }

      // 4. Create component
      const component = await createComponent(componentData, teamId, userId);

      // Track success
      results.successful_imports++;
      if (component.id) {
        results.imported_component_ids.push(component.id);
      }

    } catch (error: any) {
      // Track failure but continue processing
      results.failed_imports++;
      results.errors.push({
        row_number: row.row_number,
        row_data: {
          name: row.name,
          sku: row.sku,
          owner_type: row.owner_type,
          supplier_name: row.supplier_name,
          location_code: row.location_code
        },
        error_message: error.message,
        error_field: undefined // Could be enhanced to identify specific field
      });
    }
  }

  // Calculate duration
  results.duration_ms = Date.now() - startTime;

  return results;
}
