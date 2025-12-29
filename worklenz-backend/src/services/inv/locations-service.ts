/**
 * Storage Locations Service
 * Handles business logic for storage location management with hierarchical support
 */

import prisma from "../../config/prisma";
import {
  IStorageLocation,
  ICreateLocationDto,
  IUpdateLocationDto,
  ILocationFilters,
  ILocationListResponse,
  ILocationHierarchy
} from "../../interfaces/inv/location.interface";

/**
 * Check for circular reference in location hierarchy
 * Walks up the parent chain to detect if locationId appears
 */
async function hasCircularReference(
  locationId: string,
  parentId: string | null,
  teamId: string
): Promise<boolean> {
  if (!parentId) {
    return false;
  }

  // If the parent is the same as the location being updated, it's circular
  if (parentId === locationId) {
    return true;
  }

  // Walk up the parent chain
  let currentParentId: string | null = parentId;
  const visitedIds = new Set<string>([locationId]);

  while (currentParentId) {
    // If we've already visited this ID, we have a circular reference
    if (visitedIds.has(currentParentId)) {
      return true;
    }

    visitedIds.add(currentParentId);

    // Get the parent location
    const parent: { parent_location_id: string | null } | null = await prisma.inv_storage_locations.findFirst({
      where: {
        id: currentParentId,
        team_id: teamId,
        is_active: true
      },
      select: {
        parent_location_id: true
      }
    });

    if (!parent) {
      // Parent not found or not active - no circular reference
      return false;
    }

    currentParentId = parent.parent_location_id;
  }

  return false;
}

/**
 * Create a new storage location
 */
export async function createLocation(
  data: ICreateLocationDto,
  teamId: string,
  userId: string
): Promise<IStorageLocation> {
  // Validate required fields
  if (!data.location_code || data.location_code.trim() === "") {
    throw new Error("Location code is required");
  }

  if (!data.name || data.name.trim() === "") {
    throw new Error("Location name is required");
  }

  // Check for duplicate location_code within the team
  const existingLocation = await prisma.inv_storage_locations.findFirst({
    where: {
      location_code: data.location_code,
      team_id: teamId,
      is_active: true
    }
  });

  if (existingLocation) {
    throw new Error("Location with this code already exists");
  }

  // Validate parent location if provided
  if (data.parent_location_id) {
    const parentLocation = await prisma.inv_storage_locations.findFirst({
      where: {
        id: data.parent_location_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!parentLocation) {
      throw new Error("Parent location not found");
    }
  }

  // Create the location
  const location = await prisma.inv_storage_locations.create({
    data: {
      location_code: data.location_code,
      name: data.name,
      description: data.description || null,
      parent_location_id: data.parent_location_id || null,
      team_id: teamId,
      created_by: userId,
      is_active: true
    }
  });

  return location;
}

/**
 * Get a storage location by ID
 */
export async function getLocationById(
  id: string,
  teamId: string
): Promise<IStorageLocation | null> {
  const location = await prisma.inv_storage_locations.findFirst({
    where: {
      id,
      team_id: teamId
    },
    include: {
      parent_location: true,
      child_locations: {
        where: {
          is_active: true
        }
      }
    }
  });

  if (!location) {
    return null;
  }

  return location;
}

/**
 * List storage locations with filters and pagination
 */
export async function listLocations(
  filters: ILocationFilters,
  teamId: string
): Promise<ILocationListResponse> {
  const page = typeof filters.page === 'string' ? parseInt(filters.page, 10) : (filters.page || 1);
  const size = typeof filters.size === 'string' ? parseInt(filters.size, 10) : (filters.size || 20);
  const skip = (page - 1) * size;

  // Build where clause
  const where: any = {
    team_id: teamId
  };

  // Filter by is_active (default to true) - handle string "true"/"false" from query params
  if (filters.is_active !== undefined) {
    const isActiveValue = filters.is_active as unknown;
    where.is_active = isActiveValue === 'true' || isActiveValue === true;
  } else {
    where.is_active = true;
  }

  // Filter by parent_location_id
  if (filters.parent_location_id !== undefined) {
    where.parent_location_id = filters.parent_location_id;
  }

  // Search by location_code or name
  if (filters.search && filters.search.trim() !== "") {
    where.OR = [
      { location_code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  // Execute queries in parallel
  const [locations, total] = await Promise.all([
    prisma.inv_storage_locations.findMany({
      where,
      skip,
      take: size,
      include: {
        parent_location: true,
        child_locations: {
          where: {
            is_active: true
          }
        }
      },
      orderBy: [
        { location_code: "asc" }
      ]
    }),
    prisma.inv_storage_locations.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: locations,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update a storage location
 */
export async function updateLocation(
  id: string,
  data: IUpdateLocationDto,
  teamId: string,
  _userId: string
): Promise<IStorageLocation> {
  // Verify location exists and belongs to team
  const existing = await prisma.inv_storage_locations.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Location not found");
  }

  // If location_code is being updated, check for duplicates
  if (data.location_code && data.location_code !== existing.location_code) {
    const duplicateLocation = await prisma.inv_storage_locations.findFirst({
      where: {
        location_code: data.location_code,
        team_id: teamId,
        is_active: true,
        id: { not: id }
      }
    });

    if (duplicateLocation) {
      throw new Error("Location with this code already exists");
    }
  }

  // If parent_location_id is being updated, validate and check for circular references
  const newParentId = data.parent_location_id !== undefined
    ? data.parent_location_id
    : existing.parent_location_id;

  if (newParentId) {
    // Validate parent location exists
    const parentLocation = await prisma.inv_storage_locations.findFirst({
      where: {
        id: newParentId,
        team_id: teamId,
        is_active: true
      }
    });

    if (!parentLocation) {
      throw new Error("Parent location not found");
    }

    // Check for circular reference
    const isCircular = await hasCircularReference(id, newParentId, teamId);
    if (isCircular) {
      throw new Error("Circular reference detected in location hierarchy");
    }
  }

  // Update the location
  const location = await prisma.inv_storage_locations.update({
    where: {
      id
    },
    data: {
      location_code: data.location_code !== undefined ? data.location_code : existing.location_code,
      name: data.name !== undefined ? data.name : existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      parent_location_id: data.parent_location_id !== undefined ? data.parent_location_id : existing.parent_location_id,
      is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
      updated_at: new Date()
    }
  });

  return location;
}

/**
 * Delete a storage location (soft delete)
 */
export async function deleteLocation(
  id: string,
  teamId: string,
  _userId: string
): Promise<void> {
  // Verify location exists and belongs to team
  const existing = await prisma.inv_storage_locations.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Location not found");
  }

  // Check if location has active children
  const activeChildrenCount = await prisma.inv_storage_locations.count({
    where: {
      parent_location_id: id,
      team_id: teamId,
      is_active: true
    }
  });

  if (activeChildrenCount > 0) {
    throw new Error("Cannot delete location with active child locations");
  }

  // Soft delete by setting is_active to false
  await prisma.inv_storage_locations.update({
    where: {
      id
    },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });
}

/**
 * Build hierarchical tree structure recursively
 */
async function buildLocationTree(
  locationId: string,
  teamId: string,
  currentLevel: number = 0,
  parentPath: string = ""
): Promise<ILocationHierarchy> {
  const location = await prisma.inv_storage_locations.findFirst({
    where: {
      id: locationId,
      team_id: teamId,
      is_active: true
    },
    include: {
      parent_location: true
    }
  });

  if (!location) {
    throw new Error("Location not found");
  }

  // Build the path
  const currentPath = parentPath
    ? `${parentPath} > ${location.name}`
    : location.name;

  // Get child locations
  const children = await prisma.inv_storage_locations.findMany({
    where: {
      parent_location_id: locationId,
      team_id: teamId,
      is_active: true
    },
    orderBy: {
      location_code: "asc"
    }
  });

  // Recursively build child trees
  const childTrees = await Promise.all(
    children.map(child =>
      buildLocationTree(child.id, teamId, currentLevel + 1, currentPath)
    )
  );

  return {
    ...location,
    level: currentLevel,
    path: currentPath,
    child_locations: childTrees
  };
}

/**
 * Get location hierarchy starting from a root location
 */
export async function getLocationHierarchy(
  rootId: string,
  teamId: string
): Promise<ILocationHierarchy> {
  // Validate root location exists and belongs to team
  const rootLocation = await prisma.inv_storage_locations.findFirst({
    where: {
      id: rootId,
      team_id: teamId,
      is_active: true
    }
  });

  if (!rootLocation) {
    throw new Error("Root location not found");
  }

  return buildLocationTree(rootId, teamId);
}

/**
 * Search locations by location_code or name
 */
export async function searchLocations(
  query: string,
  teamId: string,
  limit: number = 10
): Promise<IStorageLocation[]> {
  if (!query || query.trim() === "") {
    return [];
  }

  const locations = await prisma.inv_storage_locations.findMany({
    where: {
      team_id: teamId,
      is_active: true,
      OR: [
        { location_code: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } }
      ]
    },
    include: {
      parent_location: true
    },
    take: limit,
    orderBy: [
      { location_code: "asc" }
    ]
  });

  return locations;
}
