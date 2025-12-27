/**
 * Allocations Service
 * Handles all business logic for allocation management
 */

import prisma from "../../config/prisma";
import {
  IAllocation,
  ICreateAllocationDto,
  IUpdateAllocationDto,
  IAllocationFilters,
  IAllocationListResponse,
  IAllocationOverlap,
  IResourceAllocationSummary,
  IAllocationWithResource
} from "../../interfaces/rcm/allocation.interface";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Create a new allocation
 */
export async function createAllocation(
  data: ICreateAllocationDto,
  teamId: string,
  userId: string
): Promise<IAllocation> {
  // Validate required fields
  if (!data.resource_id || !data.project_id) {
    throw new Error("Resource ID and Project ID are required");
  }

  if (!data.start_date || !data.end_date) {
    throw new Error("Start date and end date are required");
  }

  if (data.allocation_percent <= 0 || data.allocation_percent > 100) {
    throw new Error("Allocation percent must be between 0 and 100");
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

  // Check for allocation overlap (would exceed 100%)
  const overlapCheck = await checkAllocationOverlap(
    data.resource_id,
    startDate,
    endDate,
    data.allocation_percent
  );

  if (overlapCheck.hasOverlap && overlapCheck.totalAllocationPercent > 100) {
    throw new Error(
      `Allocation would exceed 100%. Current total: ${overlapCheck.totalAllocationPercent}%`
    );
  }

  // Create the allocation
  const allocation = await prisma.rcm_allocations.create({
    data: {
      resource_id: data.resource_id,
      project_id: data.project_id,
      start_date: startDate,
      end_date: endDate,
      allocation_percent: new Decimal(data.allocation_percent),
      notes: data.notes?.trim() || null,
      created_by: userId,
      is_active: true
    }
  });

  return allocation;
}

/**
 * Get an allocation by ID
 */
export async function getAllocationById(
  allocationId: string,
  teamId: string,
  includeResource: boolean = false
): Promise<IAllocationWithResource | null> {
  const allocation = await prisma.rcm_allocations.findFirst({
    where: {
      id: allocationId
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

  // Verify the allocation's resource belongs to the team
  if (allocation && allocation.resource && allocation.resource.team_id !== teamId) {
    return null;
  }

  return allocation;
}

/**
 * List allocations with filtering and pagination
 */
export async function listAllocations(
  filters: IAllocationFilters,
  teamId: string
): Promise<IAllocationListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  const where: any = {
    is_active: filters.is_active !== undefined ? filters.is_active : true,
    resource: {
      team_id: teamId
    }
  };

  // Filter by resource
  if (filters.resource_id) {
    where.resource_id = filters.resource_id;
  }

  // Filter by project
  if (filters.project_id) {
    where.project_id = filters.project_id;
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

  const [allocations, total] = await Promise.all([
    prisma.rcm_allocations.findMany({
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
    prisma.rcm_allocations.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: allocations,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update an allocation
 */
export async function updateAllocation(
  allocationId: string,
  data: IUpdateAllocationDto,
  teamId: string
): Promise<IAllocation> {
  // Verify the allocation exists and resource belongs to team
  const existing = await getAllocationById(allocationId, teamId, true);

  if (!existing) {
    throw new Error("Allocation not found");
  }

  // Validate allocation percent if provided
  if (data.allocation_percent !== undefined) {
    if (data.allocation_percent <= 0 || data.allocation_percent > 100) {
      throw new Error("Allocation percent must be between 0 and 100");
    }
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

  // Check for allocation overlap if dates or percent changed
  if (data.start_date || data.end_date || data.allocation_percent !== undefined) {
    const allocationPercent = data.allocation_percent ?? Number(existing.allocation_percent);

    const overlapCheck = await checkAllocationOverlap(
      existing.resource_id!,
      startDate!,
      endDate!,
      allocationPercent,
      allocationId // Exclude current allocation from check
    );

    if (overlapCheck.hasOverlap && overlapCheck.totalAllocationPercent > 100) {
      throw new Error(
        `Allocation would exceed 100%. Current total: ${overlapCheck.totalAllocationPercent}%`
      );
    }
  }

  // Update the allocation
  const updateData: any = {
    updated_at: new Date()
  };

  if (data.start_date !== undefined) updateData.start_date = startDate;
  if (data.end_date !== undefined) updateData.end_date = endDate;
  if (data.allocation_percent !== undefined) {
    updateData.allocation_percent = new Decimal(data.allocation_percent);
  }
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const allocation = await prisma.rcm_allocations.update({
    where: {
      id: allocationId
    },
    data: updateData
  });

  return allocation;
}

/**
 * Delete an allocation (soft delete)
 */
export async function deleteAllocation(
  allocationId: string,
  teamId: string
): Promise<void> {
  // Verify the allocation exists and resource belongs to team
  const existing = await getAllocationById(allocationId, teamId, true);

  if (!existing) {
    throw new Error("Allocation not found");
  }

  // Soft delete by setting is_active to false
  await prisma.rcm_allocations.update({
    where: {
      id: allocationId
    },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });
}

/**
 * Check if an allocation would cause overlap (exceed 100%)
 */
export async function checkAllocationOverlap(
  resourceId: string,
  startDate: Date,
  endDate: Date,
  allocationPercent: number,
  excludeAllocationId?: string
): Promise<IAllocationOverlap> {
  // Find all overlapping allocations for this resource
  const where: any = {
    resource_id: resourceId,
    is_active: true,
    AND: [
      {
        start_date: {
          lt: endDate
        }
      },
      {
        end_date: {
          gt: startDate
        }
      }
    ]
  };

  // Exclude current allocation if updating
  if (excludeAllocationId) {
    where.id = {
      not: excludeAllocationId
    };
  }

  const overlappingAllocations = await prisma.rcm_allocations.findMany({
    where
  });

  // Calculate total allocation percent
  const totalExisting = overlappingAllocations.reduce((sum, alloc) => {
    return sum + Number(alloc.allocation_percent);
  }, 0);

  const totalWithNew = totalExisting + allocationPercent;

  return {
    hasOverlap: overlappingAllocations.length > 0 || totalWithNew > 100,
    totalAllocationPercent: totalWithNew,
    overlappingAllocations: overlappingAllocations.length > 0 ? overlappingAllocations : undefined
  };
}

/**
 * Get all allocations for a specific resource
 */
export async function getResourceAllocations(
  resourceId: string,
  teamId: string,
  startDate?: Date | string,
  endDate?: Date | string
): Promise<IAllocation[]> {
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
    resource_id: resourceId,
    is_active: true
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

  const allocations = await prisma.rcm_allocations.findMany({
    where,
    orderBy: [
      { start_date: "asc" }
    ]
  });

  return allocations;
}

/**
 * Calculate total allocation percentage for a resource in a date range
 */
export async function calculateTotalAllocation(
  resourceId: string,
  teamId: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<IResourceAllocationSummary> {
  const allocations = await getResourceAllocations(resourceId, teamId, startDate, endDate);

  const totalAllocationPercent = allocations.reduce((sum, alloc) => {
    return sum + Number(alloc.allocation_percent);
  }, 0);

  return {
    resource_id: resourceId,
    total_allocation_percent: totalAllocationPercent,
    allocations
  };
}

/**
 * Get allocations by project
 */
export async function getProjectAllocations(
  projectId: string,
  teamId: string
): Promise<IAllocationWithResource[]> {
  const allocations = await prisma.rcm_allocations.findMany({
    where: {
      project_id: projectId,
      is_active: true,
      resource: {
        team_id: teamId
      }
    },
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
      { start_date: "asc" }
    ]
  });

  return allocations;
}
