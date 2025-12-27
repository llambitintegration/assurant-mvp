import prisma from "../../config/prisma";
import {
  ICreateResourceDto,
  IUpdateResourceDto,
  IResourceFilters,
  IResourceListResponse,
  IResource
} from "../../interfaces/rcm/resource.interface";
import { rcm_resource_type } from "@prisma/client";

/**
 * Create a new resource (personnel or equipment)
 */
export async function createResource(
  data: ICreateResourceDto,
  teamId: string,
  userId: string
): Promise<IResource> {
  // Validate personnel fields
  if (data.resource_type === "personnel") {
    if (!data.first_name || !data.last_name) {
      throw new Error("First name and last name are required for personnel resources");
    }
  }

  // Validate equipment fields
  if (data.resource_type === "equipment") {
    if (!data.equipment_name) {
      throw new Error("Equipment name is required for equipment resources");
    }
  }

  // Create the resource
  const resource = await prisma.rcm_resources.create({
    data: {
      resource_type: data.resource_type,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      employee_id: data.employee_id,
      equipment_name: data.equipment_name,
      model: data.model,
      serial_number: data.serial_number,
      team_id: teamId,
      created_by: userId,
      notes: data.notes,
      is_active: true
    }
  });

  return resource;
}

/**
 * Get a resource by ID
 */
export async function getResourceById(
  resourceId: string,
  teamId: string
): Promise<IResource | null> {
  const resource = await prisma.rcm_resources.findFirst({
    where: {
      id: resourceId,
      team_id: teamId
    },
    include: {
      resource_skills: {
        include: {
          skill: true
        }
      },
      department_assignments: {
        include: {
          department: true
        }
      }
    }
  });

  return resource;
}

/**
 * List resources with filters and pagination
 */
export async function listResources(
  filters: IResourceFilters,
  teamId: string
): Promise<IResourceListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  // Build where clause
  const where: any = {
    team_id: teamId,
    is_active: filters.is_active !== undefined ? filters.is_active : true
  };

  if (filters.resource_type) {
    where.resource_type = filters.resource_type;
  }

  // Search by name or email
  if (filters.search) {
    where.OR = [
      { first_name: { contains: filters.search, mode: "insensitive" } },
      { last_name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { equipment_name: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  // Filter by department
  if (filters.department_id) {
    where.department_assignments = {
      some: {
        department_id: filters.department_id
      }
    };
  }

  // Filter by skill
  if (filters.skill_id) {
    where.resource_skills = {
      some: {
        skill_id: filters.skill_id
      }
    };
  }

  // Execute queries in parallel
  const [resources, total] = await Promise.all([
    prisma.rcm_resources.findMany({
      where,
      skip,
      take: size,
      include: {
        resource_skills: {
          include: {
            skill: true
          }
        },
        department_assignments: {
          include: {
            department: true
          }
        }
      },
      orderBy: [
        { resource_type: "asc" },
        { first_name: "asc" },
        { equipment_name: "asc" }
      ]
    }),
    prisma.rcm_resources.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: resources,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update a resource
 */
export async function updateResource(
  resourceId: string,
  data: IUpdateResourceDto,
  teamId: string
): Promise<IResource> {
  // Verify resource exists and belongs to team
  const existing = await prisma.rcm_resources.findFirst({
    where: {
      id: resourceId,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Resource not found");
  }

  // Validate if changing resource type
  const resourceType = data.resource_type || existing.resource_type;

  if (resourceType === "personnel") {
    if (data.first_name === "" || data.last_name === "") {
      throw new Error("First name and last name are required for personnel resources");
    }
  }

  if (resourceType === "equipment") {
    if (data.equipment_name === "") {
      throw new Error("Equipment name is required for equipment resources");
    }
  }

  // Update the resource
  const resource = await prisma.rcm_resources.update({
    where: {
      id: resourceId
    },
    data: {
      resource_type: data.resource_type,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      employee_id: data.employee_id,
      equipment_name: data.equipment_name,
      model: data.model,
      serial_number: data.serial_number,
      is_active: data.is_active,
      notes: data.notes,
      updated_at: new Date()
    }
  });

  return resource;
}

/**
 * Delete a resource (soft delete)
 */
export async function deleteResource(
  resourceId: string,
  teamId: string
): Promise<void> {
  // Verify resource exists and belongs to team
  const existing = await prisma.rcm_resources.findFirst({
    where: {
      id: resourceId,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Resource not found");
  }

  // Soft delete by setting is_active to false
  await prisma.rcm_resources.update({
    where: {
      id: resourceId
    },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });
}

/**
 * Search resources by name or email
 */
export async function searchResources(
  query: string,
  teamId: string,
  limit: number = 10
): Promise<IResource[]> {
  const resources = await prisma.rcm_resources.findMany({
    where: {
      team_id: teamId,
      is_active: true,
      OR: [
        { first_name: { contains: query, mode: "insensitive" } },
        { last_name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { equipment_name: { contains: query, mode: "insensitive" } }
      ]
    },
    take: limit,
    orderBy: [
      { resource_type: "asc" },
      { first_name: "asc" },
      { equipment_name: "asc" }
    ]
  });

  return resources;
}

/**
 * Get resources by type
 */
export async function getResourcesByType(
  resourceType: rcm_resource_type,
  teamId: string
): Promise<IResource[]> {
  const resources = await prisma.rcm_resources.findMany({
    where: {
      team_id: teamId,
      resource_type: resourceType,
      is_active: true
    },
    orderBy: [
      { first_name: "asc" },
      { equipment_name: "asc" }
    ]
  });

  return resources;
}
