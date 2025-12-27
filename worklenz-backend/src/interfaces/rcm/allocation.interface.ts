/**
 * Allocation Interfaces
 * TypeScript interfaces for allocation-related data structures
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Database model interface (matches Prisma schema)
 */
export interface IAllocation {
  id?: string;
  resource_id?: string;
  project_id?: string;
  start_date?: Date;
  end_date?: Date;
  allocation_percent?: Decimal | number;
  notes?: string | null;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}

/**
 * DTO for creating a new allocation
 */
export interface ICreateAllocationDto {
  resource_id: string;
  project_id: string;
  start_date: Date | string;
  end_date: Date | string;
  allocation_percent: number;
  notes?: string;
}

/**
 * DTO for updating an existing allocation
 */
export interface IUpdateAllocationDto {
  start_date?: Date | string;
  end_date?: Date | string;
  allocation_percent?: number;
  notes?: string;
  is_active?: boolean;
}

/**
 * Filters for querying allocations
 */
export interface IAllocationFilters {
  resource_id?: string;
  project_id?: string;
  start_date?: Date | string;
  end_date?: Date | string;
  is_active?: boolean;
  page?: number;
  size?: number;
}

/**
 * Paginated list response
 */
export interface IAllocationListResponse {
  data: IAllocation[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Allocation with resource information
 */
export interface IAllocationWithResource extends IAllocation {
  resource?: {
    id?: string;
    resource_type?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    equipment_name?: string | null;
  };
}

/**
 * Allocation overlap check result
 */
export interface IAllocationOverlap {
  hasOverlap: boolean;
  totalAllocationPercent: number;
  overlappingAllocations?: IAllocation[];
}

/**
 * Resource allocation summary
 */
export interface IResourceAllocationSummary {
  resource_id: string;
  total_allocation_percent: number;
  allocations: IAllocation[];
}
