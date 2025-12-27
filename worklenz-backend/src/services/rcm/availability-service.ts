/**
 * Availability Service
 * Handles all business logic for availability and unavailability management
 */

import prisma from "../../config/prisma";
import {
  IAvailability,
  ICreateAvailabilityDto,
  IUpdateAvailabilityDto,
  IAvailabilityFilters,
  IAvailabilityListResponse,
  IUnavailabilityPeriod,
  ICreateUnavailabilityDto,
  IUpdateUnavailabilityDto,
  IUnavailabilityFilters,
  IUnavailabilityListResponse,
  INetAvailableHours,
  IResourceAvailabilitySummary,
  IAvailabilityWithResource,
  IUnavailabilityWithResource
} from "../../interfaces/rcm/availability.interface";
import { Decimal } from "@prisma/client/runtime/library";

// =============================================================================
// AVAILABILITY CRUD
// =============================================================================

/**
 * Create a new availability record
 */
export async function createAvailability(
  data: ICreateAvailabilityDto,
  teamId: string,
  userId: string
): Promise<IAvailability> {
  // Validate required fields
  if (!data.resource_id) {
    throw new Error("Resource ID is required");
  }

  if (!data.effective_from) {
    throw new Error("Effective from date is required");
  }

  if (data.hours_per_day <= 0 || data.days_per_week <= 0 || data.total_hours_per_week <= 0) {
    throw new Error("Hours per day, days per week, and total hours per week must be positive");
  }

  // Parse dates
  const effectiveFrom = new Date(data.effective_from);
  const effectiveTo = data.effective_to ? new Date(data.effective_to) : null;

  // Validate date range
  if (effectiveTo && effectiveFrom >= effectiveTo) {
    throw new Error("Effective to date must be after effective from date");
  }

  // Verify resource exists and belongs to team
  const resource = await prisma.rcm_resources.findFirst({
    where: {
      id: data.resource_id,
      team_id: teamId,
      is_active: true
    }
  });

  if (!resource) {
    throw new Error("Resource not found or does not belong to your team");
  }

  // Create the availability record
  const availability = await prisma.rcm_availability.create({
    data: {
      resource_id: data.resource_id,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      hours_per_day: new Decimal(data.hours_per_day),
      days_per_week: new Decimal(data.days_per_week),
      total_hours_per_week: new Decimal(data.total_hours_per_week),
      created_by: userId
    }
  });

  return availability;
}

/**
 * Get an availability record by ID
 */
export async function getAvailabilityById(
  availabilityId: string,
  teamId: string,
  includeResource: boolean = false
): Promise<IAvailabilityWithResource | null> {
  const availability = await prisma.rcm_availability.findFirst({
    where: {
      id: availabilityId
    },
    include: {
      resource: includeResource ? {
        select: {
          id: true,
          resource_type: true,
          first_name: true,
          last_name: true,
          email: true,
          equipment_name: true,
          team_id: true
        }
      } : false
    }
  });

  // Verify the availability's resource belongs to the team
  if (availability && availability.resource && availability.resource.team_id !== teamId) {
    return null;
  }

  return availability;
}

/**
 * List availability records with filtering and pagination
 */
export async function listAvailability(
  filters: IAvailabilityFilters,
  teamId: string
): Promise<IAvailabilityListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  const where: any = {
    resource: {
      team_id: teamId
    }
  };

  // Filter by resource
  if (filters.resource_id) {
    where.resource_id = filters.resource_id;
  }

  // Filter by effective date
  if (filters.effective_date) {
    const effectiveDate = new Date(filters.effective_date);
    where.effective_from = {
      lte: effectiveDate
    };
    where.OR = [
      { effective_to: null },
      { effective_to: { gte: effectiveDate } }
    ];
  }

  const [availabilityRecords, total] = await Promise.all([
    prisma.rcm_availability.findMany({
      where,
      skip,
      take: size,
      include: {
        resource: {
          select: {
            id: true,
            resource_type: true,
            first_name: true,
            last_name: true,
            email: true,
            equipment_name: true
          }
        }
      },
      orderBy: [
        { effective_from: "desc" }
      ]
    }),
    prisma.rcm_availability.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: availabilityRecords,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update an availability record
 */
export async function updateAvailability(
  availabilityId: string,
  data: IUpdateAvailabilityDto,
  teamId: string
): Promise<IAvailability> {
  // Verify the availability exists and resource belongs to team
  const existing = await getAvailabilityById(availabilityId, teamId, true);

  if (!existing) {
    throw new Error("Availability record not found");
  }

  // Validate values if provided
  if (data.hours_per_day !== undefined && data.hours_per_day <= 0) {
    throw new Error("Hours per day must be positive");
  }

  if (data.days_per_week !== undefined && data.days_per_week <= 0) {
    throw new Error("Days per week must be positive");
  }

  if (data.total_hours_per_week !== undefined && data.total_hours_per_week <= 0) {
    throw new Error("Total hours per week must be positive");
  }

  // Parse dates if provided
  let effectiveFrom = existing.effective_from;
  let effectiveTo = existing.effective_to;

  if (data.effective_from) {
    effectiveFrom = new Date(data.effective_from);
  }

  if (data.effective_to !== undefined) {
    effectiveTo = data.effective_to ? new Date(data.effective_to) : null;
  }

  // Validate date range
  if (effectiveTo && effectiveFrom && effectiveFrom >= effectiveTo) {
    throw new Error("Effective to date must be after effective from date");
  }

  // Update the availability record
  const updateData: any = {
    updated_at: new Date()
  };

  if (data.effective_from !== undefined) updateData.effective_from = effectiveFrom;
  if (data.effective_to !== undefined) updateData.effective_to = effectiveTo;
  if (data.hours_per_day !== undefined) updateData.hours_per_day = new Decimal(data.hours_per_day);
  if (data.days_per_week !== undefined) updateData.days_per_week = new Decimal(data.days_per_week);
  if (data.total_hours_per_week !== undefined) {
    updateData.total_hours_per_week = new Decimal(data.total_hours_per_week);
  }

  const availability = await prisma.rcm_availability.update({
    where: {
      id: availabilityId
    },
    data: updateData
  });

  return availability;
}

/**
 * Delete an availability record
 */
export async function deleteAvailability(
  availabilityId: string,
  teamId: string
): Promise<void> {
  // Verify the availability exists and resource belongs to team
  const existing = await getAvailabilityById(availabilityId, teamId, true);

  if (!existing) {
    throw new Error("Availability record not found");
  }

  // Hard delete since there's no is_active field
  await prisma.rcm_availability.delete({
    where: {
      id: availabilityId
    }
  });
}

/**
 * Get all availability records for a specific resource
 */
export async function getResourceAvailability(
  resourceId: string,
  teamId: string
): Promise<IAvailability[]> {
  // Verify resource exists and belongs to team
  const resource = await prisma.rcm_resources.findFirst({
    where: {
      id: resourceId,
      team_id: teamId
    }
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  const availability = await prisma.rcm_availability.findMany({
    where: {
      resource_id: resourceId
    },
    orderBy: [
      { effective_from: "desc" }
    ]
  });

  return availability;
}

// =============================================================================
// UNAVAILABILITY PERIOD CRUD
// =============================================================================

/**
 * Create a new unavailability period
 */
export async function createUnavailabilityPeriod(
  data: ICreateUnavailabilityDto,
  teamId: string,
  userId: string
): Promise<IUnavailabilityPeriod> {
  // Validate required fields
  if (!data.resource_id) {
    throw new Error("Resource ID is required");
  }

  if (!data.unavailability_type) {
    throw new Error("Unavailability type is required");
  }

  if (!data.start_date || !data.end_date) {
    throw new Error("Start date and end date are required");
  }

  // Parse dates
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);

  // Validate date range
  if (startDate >= endDate) {
    throw new Error("End date must be after start date");
  }

  // Verify resource exists and belongs to team
  const resource = await prisma.rcm_resources.findFirst({
    where: {
      id: data.resource_id,
      team_id: teamId,
      is_active: true
    }
  });

  if (!resource) {
    throw new Error("Resource not found or does not belong to your team");
  }

  // Create the unavailability period
  const unavailability = await prisma.rcm_unavailability_periods.create({
    data: {
      resource_id: data.resource_id,
      unavailability_type: data.unavailability_type as any,
      start_date: startDate,
      end_date: endDate,
      description: data.description?.trim() || null,
      created_by: userId
    }
  });

  return unavailability;
}

/**
 * Get an unavailability period by ID
 */
export async function getUnavailabilityById(
  unavailabilityId: string,
  teamId: string,
  includeResource: boolean = false
): Promise<IUnavailabilityWithResource | null> {
  const unavailability = await prisma.rcm_unavailability_periods.findFirst({
    where: {
      id: unavailabilityId
    },
    include: {
      resource: includeResource ? {
        select: {
          id: true,
          resource_type: true,
          first_name: true,
          last_name: true,
          email: true,
          equipment_name: true,
          team_id: true
        }
      } : false
    }
  });

  // Verify the unavailability's resource belongs to the team
  if (unavailability && unavailability.resource && unavailability.resource.team_id !== teamId) {
    return null;
  }

  return unavailability;
}

/**
 * List unavailability periods with filtering and pagination
 */
export async function listUnavailability(
  filters: IUnavailabilityFilters,
  teamId: string
): Promise<IUnavailabilityListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  const where: any = {
    resource: {
      team_id: teamId
    }
  };

  // Filter by resource
  if (filters.resource_id) {
    where.resource_id = filters.resource_id;
  }

  // Filter by unavailability type
  if (filters.unavailability_type) {
    where.unavailability_type = filters.unavailability_type;
  }

  // Filter by date range
  if (filters.start_date || filters.end_date) {
    where.AND = [];

    if (filters.start_date) {
      where.AND.push({
        end_date: {
          gte: new Date(filters.start_date)
        }
      });
    }

    if (filters.end_date) {
      where.AND.push({
        start_date: {
          lte: new Date(filters.end_date)
        }
      });
    }
  }

  const [unavailabilityPeriods, total] = await Promise.all([
    prisma.rcm_unavailability_periods.findMany({
      where,
      skip,
      take: size,
      include: {
        resource: {
          select: {
            id: true,
            resource_type: true,
            first_name: true,
            last_name: true,
            email: true,
            equipment_name: true
          }
        }
      },
      orderBy: [
        { start_date: "desc" }
      ]
    }),
    prisma.rcm_unavailability_periods.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: unavailabilityPeriods,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update an unavailability period
 */
export async function updateUnavailabilityPeriod(
  unavailabilityId: string,
  data: IUpdateUnavailabilityDto,
  teamId: string
): Promise<IUnavailabilityPeriod> {
  // Verify the unavailability exists and resource belongs to team
  const existing = await getUnavailabilityById(unavailabilityId, teamId, true);

  if (!existing) {
    throw new Error("Unavailability period not found");
  }

  // Parse dates if provided
  let startDate = existing.start_date;
  let endDate = existing.end_date;

  if (data.start_date) {
    startDate = new Date(data.start_date);
  }

  if (data.end_date) {
    endDate = new Date(data.end_date);
  }

  // Validate date range
  if (startDate && endDate && startDate >= endDate) {
    throw new Error("End date must be after start date");
  }

  // Update the unavailability period
  const updateData: any = {
    updated_at: new Date()
  };

  if (data.unavailability_type !== undefined) updateData.unavailability_type = data.unavailability_type as any;
  if (data.start_date !== undefined) updateData.start_date = startDate;
  if (data.end_date !== undefined) updateData.end_date = endDate;
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;

  const unavailability = await prisma.rcm_unavailability_periods.update({
    where: {
      id: unavailabilityId
    },
    data: updateData
  });

  return unavailability;
}

/**
 * Delete an unavailability period
 */
export async function deleteUnavailabilityPeriod(
  unavailabilityId: string,
  teamId: string
): Promise<void> {
  // Verify the unavailability exists and resource belongs to team
  const existing = await getUnavailabilityById(unavailabilityId, teamId, true);

  if (!existing) {
    throw new Error("Unavailability period not found");
  }

  // Hard delete since there's no is_active field
  await prisma.rcm_unavailability_periods.delete({
    where: {
      id: unavailabilityId
    }
  });
}

/**
 * Get all unavailability periods for a specific resource
 */
export async function getResourceUnavailability(
  resourceId: string,
  teamId: string,
  startDate?: Date | string,
  endDate?: Date | string
): Promise<IUnavailabilityPeriod[]> {
  // Verify resource exists and belongs to team
  const resource = await prisma.rcm_resources.findFirst({
    where: {
      id: resourceId,
      team_id: teamId
    }
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  const where: any = {
    resource_id: resourceId
  };

  // Filter by date range if provided
  if (startDate || endDate) {
    where.AND = [];

    if (startDate) {
      where.AND.push({
        end_date: {
          gte: new Date(startDate)
        }
      });
    }

    if (endDate) {
      where.AND.push({
        start_date: {
          lte: new Date(endDate)
        }
      });
    }
  }

  const unavailability = await prisma.rcm_unavailability_periods.findMany({
    where,
    orderBy: [
      { start_date: "asc" }
    ]
  });

  return unavailability;
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Calculate net available hours for a resource in a date range
 */
export async function calculateNetAvailableHours(
  resourceId: string,
  teamId: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<INetAvailableHours> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new Error("End date must be after start date");
  }

  // Get availability records for this period
  const availabilityRecords = await prisma.rcm_availability.findMany({
    where: {
      resource_id: resourceId,
      effective_from: {
        lte: end
      },
      OR: [
        { effective_to: null },
        { effective_to: { gte: start } }
      ]
    },
    orderBy: [
      { effective_from: "asc" }
    ]
  });

  // Get unavailability periods for this date range
  const unavailabilityPeriods = await getResourceUnavailability(resourceId, teamId, start, end);

  // Calculate base total hours from availability
  // Simplified calculation: use the most recent availability record's total_hours_per_week
  let baseTotalHours = 0;
  if (availabilityRecords.length > 0) {
    const currentAvailability = availabilityRecords[availabilityRecords.length - 1];
    const weeksBetween = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    baseTotalHours = Number(currentAvailability.total_hours_per_week) * weeksBetween;
  }

  // Calculate unavailable hours
  // Simplified: sum of all unavailability periods (assuming full days)
  let unavailableHours = 0;
  for (const period of unavailabilityPeriods) {
    const periodStart = period.start_date! > start ? period.start_date! : start;
    const periodEnd = period.end_date! < end ? period.end_date! : end;
    const daysBetween = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));

    if (availabilityRecords.length > 0) {
      const currentAvailability = availabilityRecords[availabilityRecords.length - 1];
      unavailableHours += daysBetween * Number(currentAvailability.hours_per_day);
    }
  }

  const netAvailableHours = Math.max(0, baseTotalHours - unavailableHours);

  return {
    resource_id: resourceId,
    start_date: start,
    end_date: end,
    base_total_hours: baseTotalHours,
    unavailable_hours: unavailableHours,
    net_available_hours: netAvailableHours,
    availability_records: availabilityRecords,
    unavailability_periods: unavailabilityPeriods
  };
}

/**
 * Get resource availability summary
 */
export async function getResourceAvailabilitySummary(
  resourceId: string,
  teamId: string
): Promise<IResourceAvailabilitySummary> {
  const today = new Date();

  // Get current availability (effective on today)
  const currentAvailability = await prisma.rcm_availability.findFirst({
    where: {
      resource_id: resourceId,
      effective_from: {
        lte: today
      },
      OR: [
        { effective_to: null },
        { effective_to: { gte: today } }
      ]
    },
    orderBy: {
      effective_from: "desc"
    }
  });

  // Get upcoming unavailability (next 30 days)
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcomingUnavailability = await prisma.rcm_unavailability_periods.findMany({
    where: {
      resource_id: resourceId,
      start_date: {
        lte: thirtyDaysFromNow
      },
      end_date: {
        gte: today
      }
    },
    orderBy: [
      { start_date: "asc" }
    ]
  });

  // Calculate net available hours for this week
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const thisWeekNet = await calculateNetAvailableHours(resourceId, teamId, startOfWeek, endOfWeek);

  // Calculate net available hours for this month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const thisMonthNet = await calculateNetAvailableHours(resourceId, teamId, startOfMonth, endOfMonth);

  return {
    resource_id: resourceId,
    current_availability: currentAvailability || undefined,
    upcoming_unavailability: upcomingUnavailability,
    net_available_hours_this_week: thisWeekNet.net_available_hours,
    net_available_hours_this_month: thisMonthNet.net_available_hours
  };
}
