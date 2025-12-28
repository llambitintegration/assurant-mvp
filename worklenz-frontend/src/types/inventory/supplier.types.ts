/**
 * Supplier Types
 * Type definitions for supplier management in inventory system
 */

export interface ISupplier {
  id: string;
  team_id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ICreateSupplierDto {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface IUpdateSupplierDto extends Partial<ICreateSupplierDto> {
  is_active?: boolean;
}

export interface ISupplierFilters {
  is_active?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

export interface ISupplierListResponse {
  data: ISupplier[];
  total: number;
  page: number;
  totalPages: number;
}
