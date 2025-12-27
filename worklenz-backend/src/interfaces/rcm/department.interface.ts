/**
 * Department-related interfaces for RCM
 */

// Database model interface (matches Prisma schema)
export interface IDepartment {
  id?: string;
  name?: string;
  description?: string | null;
  parent_dept_id?: string | null;
  team_id?: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

// DTO for creating a new department
export interface ICreateDepartmentDto {
  name: string;
  description?: string;
  parent_dept_id?: string;
}

// DTO for updating an existing department
export interface IUpdateDepartmentDto {
  name?: string;
  description?: string;
  parent_dept_id?: string;
  is_active?: boolean;
}

// Filters for listing departments
export interface IDepartmentFilters {
  parent_dept_id?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

// Paginated list response
export interface IDepartmentListResponse {
  data: IDepartment[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

// Department with hierarchy information
export interface IDepartmentWithHierarchy extends IDepartment {
  parent_department?: IDepartment | null;
  child_departments?: IDepartment[];
}

// Department with resource assignments
export interface IDepartmentWithResources extends IDepartment {
  resource_assignments?: IResourceAssignment[];
}

// Resource assignment interface
export interface IResourceAssignment {
  id?: string;
  resource_id?: string;
  department_id?: string;
  is_primary?: boolean;
  assigned_at?: Date;
  assigned_by?: string;
}

// DTO for assigning a resource to a department
export interface IAssignResourceDto {
  resource_id: string;
  is_primary?: boolean;
}
