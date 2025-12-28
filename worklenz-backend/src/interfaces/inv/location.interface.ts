/**
 * Storage Location Interfaces
 * TypeScript interfaces for storage location-related data structures
 */

/**
 * Database model interface (matches Prisma schema)
 */
export interface IStorageLocation {
  id?: string;
  location_code?: string;
  name?: string;
  description?: string | null;
  parent_location_id?: string | null;
  team_id?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

/**
 * DTO for creating a new storage location
 */
export interface ICreateLocationDto {
  location_code: string;
  name: string;
  description?: string;
  parent_location_id?: string;
}

/**
 * DTO for updating an existing storage location
 */
export interface IUpdateLocationDto {
  location_code?: string;
  name?: string;
  description?: string;
  parent_location_id?: string;
  is_active?: boolean;
}

/**
 * Filters for querying storage locations
 */
export interface ILocationFilters {
  is_active?: boolean;
  parent_location_id?: string;
  search?: string; // Search by location_code or name
  page?: number;
  size?: number;
}

/**
 * Paginated list response
 */
export interface ILocationListResponse {
  data: IStorageLocation[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Storage location with hierarchical information
 */
export interface ILocationHierarchy extends IStorageLocation {
  parent_location?: IStorageLocation | null;
  child_locations?: IStorageLocation[];
  level?: number;
  path?: string; // Full hierarchical path (e.g., "Warehouse A > Aisle 1 > Shelf 3")
}
