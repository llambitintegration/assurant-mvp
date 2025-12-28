/**
 * Component Types
 * Type definitions for component management in inventory system
 */

export enum OwnerType {
  SUPPLIER = 'supplier',
  STORAGE_LOCATION = 'storage_location'
}

export interface IComponent {
  id: string;
  team_id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;

  owner_type: OwnerType;
  supplier_id?: string | null;
  storage_location_id?: string | null;

  quantity: number;
  unit?: string | null;
  unit_cost?: number | null;
  reorder_level?: number | null;

  qr_code?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Populated relations (import types when they exist)
  supplier?: any;
  storage_location?: any;
}

export interface ICreateComponentDto {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  owner_type: OwnerType;
  supplier_id?: string;
  storage_location_id?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  reorder_level?: number;
}

export interface IUpdateComponentDto extends Partial<ICreateComponentDto> {
  is_active?: boolean;
}

export interface IComponentFilters {
  is_active?: boolean;
  owner_type?: OwnerType;
  supplier_id?: string;
  storage_location_id?: string;
  category?: string;
  low_stock?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

export interface IComponentListResponse {
  data: IComponent[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ILowStockComponent extends IComponent {
  stock_percentage: number;
  quantity_needed: number;
}
