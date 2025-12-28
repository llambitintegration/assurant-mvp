export interface ICsvImportRow {
  row_number: number;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  owner_type: string;
  supplier_name?: string;
  location_code?: string;
  quantity?: string | number;
  unit?: string;
  unit_cost?: string | number;
  reorder_level?: string | number;
}

export interface ICsvImportError {
  row_number: number;
  row_data: Partial<ICsvImportRow>;
  error_message: string;
  error_field?: string;
}

export interface ICsvImportResult {
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  errors: ICsvImportError[];
  imported_component_ids: string[];
  duration_ms: number;
}
