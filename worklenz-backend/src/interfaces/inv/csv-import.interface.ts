/**
 * CSV Import Interfaces
 * TypeScript interfaces for CSV import-related data structures
 */

import { inv_owner_type } from "@prisma/client";

/**
 * Represents a single row from the CSV file
 */
export interface ICSVImportRow {
  row_number: number;
  name: string;
  sku?: string;
  description?: string;
  category?: string;

  // Ownership (either supplier_name OR location_code must be provided)
  owner_type: string; // Will be converted to inv_owner_type
  supplier_name?: string; // Lookup by name
  location_code?: string; // Lookup by location_code

  // Inventory fields
  quantity?: string | number;
  unit?: string;
  unit_cost?: string | number;
  reorder_level?: string | number;
}

/**
 * Result of a single row import attempt
 */
export interface ICSVImportError {
  row_number: number;
  row_data: Partial<ICSVImportRow>;
  error_message: string;
  error_field?: string; // Which field caused the error
}

/**
 * Overall CSV import result
 */
export interface ICSVImportResult {
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  errors: ICSVImportError[];
  imported_component_ids: string[];
  duration_ms: number;
}

/**
 * Validation result for a CSV row
 */
export interface ICSVValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings?: string[];
  validated_data?: {
    name: string;
    sku?: string;
    description?: string;
    category?: string;
    owner_type: inv_owner_type;
    supplier_id?: string;
    storage_location_id?: string;
    quantity: number;
    unit?: string;
    unit_cost?: number;
    reorder_level?: number;
  };
}
