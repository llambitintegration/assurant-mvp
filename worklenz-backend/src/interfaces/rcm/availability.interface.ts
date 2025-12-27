/**
 * Availability Interfaces
 * TypeScript interfaces for availability and unavailability-related data structures
 */

import { Decimal } from "@prisma/client/runtime/library";

/**
 * Availability database model interface (matches Prisma schema)
 */
export interface IAvailability {
  id?: string;
  resource_id?: string;
  effective_from?: Date;
  effective_to?: Date | null;
  hours_per_day?: Decimal | number;
  days_per_week?: Decimal | number;
  total_hours_per_week?: Decimal | number;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * DTO for creating availability
 */
export interface ICreateAvailabilityDto {
  resource_id: string;
  effective_from: Date | string;
  effective_to?: Date | string;
  hours_per_day: number;
  days_per_week: number;
  total_hours_per_week: number;
}

/**
 * DTO for updating availability
 */
export interface IUpdateAvailabilityDto {
  effective_from?: Date | string;
  effective_to?: Date | string;
  hours_per_day?: number;
  days_per_week?: number;
  total_hours_per_week?: number;
}

/**
 * Filters for querying availability
 */
export interface IAvailabilityFilters {
  resource_id?: string;
  effective_date?: Date | string; // Check if effective on this date
  page?: number;
  size?: number;
}

/**
 * Paginated list response for availability
 */
export interface IAvailabilityListResponse {
  data: IAvailability[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Unavailability type enum (matches Prisma enum)
 */
export enum UnavailabilityType {
  PTO = "pto",
  HOLIDAY = "holiday",
  SICK_LEAVE = "sick_leave",
  TRAINING = "training",
  MAINTENANCE = "maintenance",
  OTHER = "other"
}

/**
 * Unavailability period database model interface (matches Prisma schema)
 */
export interface IUnavailabilityPeriod {
  id?: string;
  resource_id?: string;
  unavailability_type?: UnavailabilityType | string;
  start_date?: Date;
  end_date?: Date;
  description?: string | null;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * DTO for creating unavailability period
 */
export interface ICreateUnavailabilityDto {
  resource_id: string;
  unavailability_type: UnavailabilityType | string;
  start_date: Date | string;
  end_date: Date | string;
  description?: string;
}

/**
 * DTO for updating unavailability period
 */
export interface IUpdateUnavailabilityDto {
  unavailability_type?: UnavailabilityType | string;
  start_date?: Date | string;
  end_date?: Date | string;
  description?: string;
}

/**
 * Filters for querying unavailability periods
 */
export interface IUnavailabilityFilters {
  resource_id?: string;
  unavailability_type?: UnavailabilityType | string;
  start_date?: Date | string;
  end_date?: Date | string;
  page?: number;
  size?: number;
}

/**
 * Paginated list response for unavailability periods
 */
export interface IUnavailabilityListResponse {
  data: IUnavailabilityPeriod[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Availability with resource information
 */
export interface IAvailabilityWithResource extends IAvailability {
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
 * Unavailability period with resource information
 */
export interface IUnavailabilityWithResource extends IUnavailabilityPeriod {
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
 * Net available hours calculation result
 */
export interface INetAvailableHours {
  resource_id: string;
  start_date: Date;
  end_date: Date;
  base_total_hours: number;
  unavailable_hours: number;
  net_available_hours: number;
  availability_records: IAvailability[];
  unavailability_periods: IUnavailabilityPeriod[];
}

/**
 * Resource availability summary
 */
export interface IResourceAvailabilitySummary {
  resource_id: string;
  current_availability?: IAvailability;
  upcoming_unavailability: IUnavailabilityPeriod[];
  net_available_hours_this_week: number;
  net_available_hours_this_month: number;
}
