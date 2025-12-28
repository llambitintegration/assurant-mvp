/**
 * Component Interfaces
 * TypeScript interfaces for inventory component-related data structures
 */

import { inv_owner_type } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Database model interface (matches Prisma schema)
 */
export interface IComponent {
  id?: string;
  name?: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;

  // Polymorphic ownership
  owner_type?: inv_owner_type;
  supplier_id?: string | null;
  storage_location_id?: string | null;

  // Inventory tracking
  quantity?: number;
  unit?: string | null;
  unit_cost?: Decimal | number | null;
  reorder_level?: number | null;

  // QR Code data
  qr_code_data?: string | null;
  qr_code_image?: string | null; // Base64 encoded image

  team_id?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

/**
 * DTO for creating a new component
 */
export interface ICreateComponentDto {
  name: string;
  sku?: string;
  description?: string;
  category?: string;

  // Polymorphic ownership (one must be provided based on owner_type)
  owner_type: inv_owner_type;
  supplier_id?: string;
  storage_location_id?: string;

  // Inventory tracking
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  reorder_level?: number;
}

/**
 * DTO for updating an existing component
 */
export interface IUpdateComponentDto {
  name?: string;
  sku?: string;
  description?: string;
  category?: string;

  // Polymorphic ownership
  owner_type?: inv_owner_type;
  supplier_id?: string;
  storage_location_id?: string;

  // Inventory tracking
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  reorder_level?: number;

  is_active?: boolean;
}

/**
 * Filters for querying components
 */
export interface IComponentFilters {
  is_active?: boolean;
  owner_type?: inv_owner_type;
  supplier_id?: string;
  storage_location_id?: string;
  category?: string;
  low_stock?: boolean; // Filter components where quantity <= reorder_level
  search?: string; // Search by name, sku, or description
  page?: number;
  size?: number;
}

/**
 * Paginated list response
 */
export interface IComponentListResponse {
  data: IComponent[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Component with low stock alert information
 */
export interface ILowStockComponent extends IComponent {
  stock_percentage?: number; // (quantity / reorder_level) * 100
  quantity_needed?: number; // reorder_level - quantity
  supplier_name?: string | null;
  storage_location_name?: string | null;
}
