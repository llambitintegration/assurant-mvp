/**
 * Dashboard Interfaces
 * TypeScript interfaces for inventory dashboard-related data structures
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Overall dashboard statistics
 */
export interface IDashboardStats {
  total_components: number;
  total_active_components: number;
  total_inventory_value: number;
  low_stock_count: number;
  total_suppliers: number;
  total_active_suppliers: number;
  total_storage_locations: number;
  total_active_storage_locations: number;
  recent_transactions_count: number; // Last 30 days
}

/**
 * Low stock alert for a component
 */
export interface ILowStockAlert {
  component_id: string;
  component_name: string;
  sku?: string | null;
  category?: string | null;
  current_quantity: number;
  reorder_level: number;
  unit?: string | null;
  stock_percentage: number; // (current_quantity / reorder_level) * 100
  quantity_needed: number; // reorder_level - current_quantity
  supplier_id?: string | null;
  supplier_name?: string | null;
  storage_location_id?: string | null;
  storage_location_name?: string | null;
  unit_cost?: Decimal | number | null;
  estimated_reorder_cost?: number; // quantity_needed * unit_cost
}

/**
 * Inventory value breakdown by category
 */
export interface IInventoryValue {
  category: string | null;
  total_quantity: number;
  total_value: number;
  component_count: number;
  average_unit_cost?: number;
}

/**
 * Complete dashboard response
 */
export interface IDashboardResponse {
  stats: IDashboardStats;
  low_stock_alerts: ILowStockAlert[];
  inventory_value_by_category: IInventoryValue[];
  generated_at: Date;
}
