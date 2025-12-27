import { rcm_resource_type } from "@prisma/client";

// Database model interface (matches Prisma schema)
export interface IResource {
  id?: string;
  resource_type?: rcm_resource_type;

  // Personnel fields
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  employee_id?: string | null;

  // Equipment fields
  equipment_name?: string | null;
  model?: string | null;
  serial_number?: string | null;

  // Common fields
  team_id?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
  notes?: string | null;
}

// DTO for creating a resource
export interface ICreateResourceDto {
  resource_type: rcm_resource_type;

  // Personnel fields (required if resource_type is 'personnel')
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  employee_id?: string;

  // Equipment fields (required if resource_type is 'equipment')
  equipment_name?: string;
  model?: string;
  serial_number?: string;

  // Common optional fields
  notes?: string;
}

// DTO for updating a resource
export interface IUpdateResourceDto {
  resource_type?: rcm_resource_type;

  // Personnel fields
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  employee_id?: string;

  // Equipment fields
  equipment_name?: string;
  model?: string;
  serial_number?: string;

  // Common optional fields
  is_active?: boolean;
  notes?: string;
}

// Query filters for listing resources
export interface IResourceFilters {
  resource_type?: rcm_resource_type;
  is_active?: boolean;
  department_id?: string;
  skill_id?: string;
  search?: string; // Search by name/email
  page?: number;
  size?: number;
}

// Response with pagination metadata
export interface IResourceListResponse {
  data: IResource[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}
