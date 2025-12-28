/**
 * Storage Location Types
 * Type definitions for storage location management in inventory system
 */

export interface IStorageLocation {
  id: string;
  team_id: string;
  location_code: string;
  name: string;
  description?: string | null;
  parent_location_id?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Populated relations
  parent_location?: IStorageLocation | null;
  child_locations?: IStorageLocation[];
}

export interface ILocationHierarchy extends IStorageLocation {
  level: number;
  path: string;
  children?: ILocationHierarchy[];
}

export interface ICreateStorageLocationDto {
  location_code: string;
  name: string;
  description?: string;
  parent_location_id?: string;
}

export interface IUpdateStorageLocationDto extends Partial<ICreateStorageLocationDto> {
  is_active?: boolean;
}

export interface IStorageLocationFilters {
  is_active?: boolean;
  search?: string;
  parent_location_id?: string;
  page?: number;
  size?: number;
}

export interface IStorageLocationListResponse {
  data: IStorageLocation[];
  total: number;
  page: number;
  totalPages: number;
}
