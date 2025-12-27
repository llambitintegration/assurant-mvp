/**
 * Departments Service
 * Handles all business logic for department management
 */

import prisma from "../../config/prisma";
import {
  ICreateDepartmentDto,
  IUpdateDepartmentDto,
  IDepartmentFilters,
  IDepartmentListResponse,
  IDepartment,
  IDepartmentWithHierarchy,
  IDepartmentWithResources,
  IAssignResourceDto
} from "../../interfaces/rcm/department.interface";

/**
 * Create a new department
 */
export async function createDepartment(
  data: ICreateDepartmentDto,
  teamId: string,
  userId: string
): Promise<IDepartment> {
  // Validate required fields
  if (!data.name || data.name.trim().length === 0) {
    throw new Error("Department name is required");
  }

  // If parent department is specified, verify it exists and belongs to the same team
  if (data.parent_dept_id) {
    const parentDept = await prisma.rcm_departments.findFirst({
      where: {
        id: data.parent_dept_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!parentDept) {
      throw new Error("Parent department not found or does not belong to your team");
    }
  }

  // Create the department
  const department = await prisma.rcm_departments.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      parent_dept_id: data.parent_dept_id || null,
      team_id: teamId,
      created_by: userId,
      is_active: true
    }
  });

  return department;
}

/**
 * Get a department by ID
 */
export async function getDepartmentById(
  departmentId: string,
  teamId: string,
  includeHierarchy: boolean = false
): Promise<IDepartmentWithHierarchy | null> {
  const department = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId
    },
    include: {
      parent_department: includeHierarchy,
      child_departments: includeHierarchy ? {
        where: {
          is_active: true
        }
      } : false,
      resource_assignments: {
        include: {
          resource: {
            select: {
              id: true,
              resource_type: true,
              first_name: true,
              last_name: true,
              email: true,
              equipment_name: true,
              is_active: true
            }
          }
        }
      }
    }
  });

  return department;
}

/**
 * List departments with filtering and pagination
 */
export async function listDepartments(
  filters: IDepartmentFilters,
  teamId: string
): Promise<IDepartmentListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  const where: any = {
    team_id: teamId,
    is_active: filters.is_active !== undefined ? filters.is_active : true
  };

  // Filter by parent department (null for root departments)
  if (filters.parent_dept_id !== undefined) {
    where.parent_dept_id = filters.parent_dept_id || null;
  }

  // Search by name or description
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  const [departments, total] = await Promise.all([
    prisma.rcm_departments.findMany({
      where,
      skip,
      take: size,
      include: {
        parent_department: {
          select: {
            id: true,
            name: true
          }
        },
        child_departments: {
          where: {
            is_active: true
          },
          select: {
            id: true,
            name: true
          }
        },
        resource_assignments: {
          select: {
            id: true,
            resource_id: true,
            is_primary: true
          }
        }
      },
      orderBy: [
        { name: "asc" }
      ]
    }),
    prisma.rcm_departments.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: departments,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update a department
 */
export async function updateDepartment(
  departmentId: string,
  data: IUpdateDepartmentDto,
  teamId: string
): Promise<IDepartment> {
  // Verify the department exists and belongs to the team
  const existing = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Department not found");
  }

  // Validate name if provided
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error("Department name cannot be empty");
  }

  // If parent department is being changed, verify it exists and prevent circular references
  if (data.parent_dept_id !== undefined && data.parent_dept_id !== null) {
    // Can't set department as its own parent
    if (data.parent_dept_id === departmentId) {
      throw new Error("A department cannot be its own parent");
    }

    // Verify parent exists and belongs to the same team
    const parentDept = await prisma.rcm_departments.findFirst({
      where: {
        id: data.parent_dept_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!parentDept) {
      throw new Error("Parent department not found or does not belong to your team");
    }

    // Prevent circular reference: check if the new parent is a descendant
    const isDescendant = await checkIfDescendant(departmentId, data.parent_dept_id);
    if (isDescendant) {
      throw new Error("Cannot set a descendant department as parent (would create circular reference)");
    }
  }

  // Update the department
  const updateData: any = {
    updated_at: new Date()
  };

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.parent_dept_id !== undefined) updateData.parent_dept_id = data.parent_dept_id || null;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const department = await prisma.rcm_departments.update({
    where: {
      id: departmentId
    },
    data: updateData
  });

  return department;
}

/**
 * Helper function to check if a department is a descendant of another
 */
async function checkIfDescendant(ancestorId: string, potentialDescendantId: string): Promise<boolean> {
  let currentId: string | null = potentialDescendantId;

  while (currentId) {
    if (currentId === ancestorId) {
      return true;
    }

    const dept: { parent_dept_id: string | null } | null = await prisma.rcm_departments.findUnique({
      where: { id: currentId },
      select: { parent_dept_id: true }
    });

    currentId = dept?.parent_dept_id || null;
  }

  return false;
}

/**
 * Delete a department (soft delete)
 */
export async function deleteDepartment(
  departmentId: string,
  teamId: string
): Promise<void> {
  // Verify the department exists and belongs to the team
  const existing = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Department not found");
  }

  // Check if department has active child departments
  const childCount = await prisma.rcm_departments.count({
    where: {
      parent_dept_id: departmentId,
      is_active: true
    }
  });

  if (childCount > 0) {
    throw new Error("Cannot delete a department that has active child departments");
  }

  // Soft delete by setting is_active to false
  await prisma.rcm_departments.update({
    where: {
      id: departmentId
    },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });
}

/**
 * Get all root departments (departments with no parent)
 */
export async function getRootDepartments(teamId: string): Promise<IDepartment[]> {
  const departments = await prisma.rcm_departments.findMany({
    where: {
      team_id: teamId,
      parent_dept_id: null,
      is_active: true
    },
    include: {
      child_departments: {
        where: {
          is_active: true
        },
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return departments;
}

/**
 * Get department hierarchy tree
 */
export async function getDepartmentHierarchy(
  teamId: string,
  rootDepartmentId?: string
): Promise<IDepartmentWithHierarchy[]> {
  const where: any = {
    team_id: teamId,
    is_active: true
  };

  if (rootDepartmentId) {
    where.id = rootDepartmentId;
  } else {
    where.parent_dept_id = null;
  }

  const departments = await prisma.rcm_departments.findMany({
    where,
    include: {
      child_departments: {
        where: {
          is_active: true
        },
        include: {
          child_departments: {
            where: {
              is_active: true
            }
          }
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return departments;
}

/**
 * Assign a resource to a department
 */
export async function assignResourceToDepartment(
  departmentId: string,
  data: IAssignResourceDto,
  teamId: string,
  userId: string
): Promise<void> {
  // Verify department exists and belongs to team
  const department = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId,
      is_active: true
    }
  });

  if (!department) {
    throw new Error("Department not found");
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
    throw new Error("Resource not found");
  }

  // Check if assignment already exists
  const existingAssignment = await prisma.rcm_resource_department_assignments.findUnique({
    where: {
      resource_id_department_id: {
        resource_id: data.resource_id,
        department_id: departmentId
      }
    }
  });

  if (existingAssignment) {
    throw new Error("Resource is already assigned to this department");
  }

  // If this is a primary assignment, unset other primary assignments for this resource
  if (data.is_primary) {
    await prisma.rcm_resource_department_assignments.updateMany({
      where: {
        resource_id: data.resource_id,
        is_primary: true
      },
      data: {
        is_primary: false
      }
    });
  }

  // Create the assignment
  await prisma.rcm_resource_department_assignments.create({
    data: {
      resource_id: data.resource_id,
      department_id: departmentId,
      is_primary: data.is_primary || false,
      assigned_by: userId
    }
  });
}

/**
 * Unassign a resource from a department
 */
export async function unassignResourceFromDepartment(
  departmentId: string,
  resourceId: string,
  teamId: string
): Promise<void> {
  // Verify department exists and belongs to team
  const department = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId
    }
  });

  if (!department) {
    throw new Error("Department not found");
  }

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

  // Delete the assignment
  const result = await prisma.rcm_resource_department_assignments.deleteMany({
    where: {
      resource_id: resourceId,
      department_id: departmentId
    }
  });

  if (result.count === 0) {
    throw new Error("Resource assignment not found");
  }
}

/**
 * Get all resources assigned to a department
 */
export async function getDepartmentResources(
  departmentId: string,
  teamId: string
): Promise<IDepartmentWithResources | null> {
  const department = await prisma.rcm_departments.findFirst({
    where: {
      id: departmentId,
      team_id: teamId
    },
    include: {
      resource_assignments: {
        include: {
          resource: true
        },
        orderBy: [
          { is_primary: "desc" },
          { assigned_at: "asc" }
        ]
      }
    }
  });

  return department;
}

/**
 * Update resource assignment (e.g., change primary status)
 */
export async function updateResourceAssignment(
  departmentId: string,
  resourceId: string,
  isPrimary: boolean,
  teamId: string
): Promise<void> {
  // Verify the assignment exists
  const assignment = await prisma.rcm_resource_department_assignments.findUnique({
    where: {
      resource_id_department_id: {
        resource_id: resourceId,
        department_id: departmentId
      }
    },
    include: {
      department: true
    }
  });

  if (!assignment || assignment.department.team_id !== teamId) {
    throw new Error("Resource assignment not found");
  }

  // If setting as primary, unset other primary assignments for this resource
  if (isPrimary) {
    await prisma.rcm_resource_department_assignments.updateMany({
      where: {
        resource_id: resourceId,
        is_primary: true
      },
      data: {
        is_primary: false
      }
    });
  }

  // Update the assignment
  await prisma.rcm_resource_department_assignments.update({
    where: {
      resource_id_department_id: {
        resource_id: resourceId,
        department_id: departmentId
      }
    },
    data: {
      is_primary: isPrimary
    }
  });
}
