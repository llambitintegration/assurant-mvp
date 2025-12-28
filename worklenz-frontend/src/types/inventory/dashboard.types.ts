export interface IDashboardStats {
  total_components: number;
  total_active_components: number;
  total_inventory_value: number;
  low_stock_count: number;
  total_suppliers: number;
  total_active_suppliers: number;
  total_storage_locations: number;
  total_active_storage_locations: number;
  recent_transactions_count: number;
}

export interface ILowStockAlert {
  id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  reorder_level?: number | null;
  stock_percentage: number;
  quantity_needed: number;
  supplier_id?: string | null;
  storage_location_id?: string | null;
}

export interface IInventoryValueByCategory {
  category: string;
  total_value: number;
  component_count: number;
}

export interface IDashboardResponse {
  stats: IDashboardStats;
  low_stock_alerts: ILowStockAlert[];
  inventory_value_by_category: IInventoryValueByCategory[];
  generated_at: string;
}
