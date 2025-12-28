/**
 * Supplier Interfaces
 * TypeScript interfaces for supplier-related data structures
 */

/**
 * Database model interface (matches Prisma schema)
 */
export interface ISupplier {
  id?: string;
  name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  team_id?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

/**
 * DTO for creating a new supplier
 */
export interface ICreateSupplierDto {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * DTO for updating an existing supplier
 */
export interface IUpdateSupplierDto {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Filters for querying suppliers
 */
export interface ISupplierFilters {
  is_active?: boolean;
  search?: string; // Search by name, email, or contact person
  page?: number;
  size?: number;
}

/**
 * Paginated list response
 */
export interface ISupplierListResponse {
  data: ISupplier[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}
