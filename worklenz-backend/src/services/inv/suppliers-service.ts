/**
 * Suppliers Service
 * Handles business logic for supplier management
 */

import prisma from "../../config/prisma";
import {
  ISupplier,
  ICreateSupplierDto,
  IUpdateSupplierDto,
  ISupplierFilters,
  ISupplierListResponse
} from "../../interfaces/inv/supplier.interface";

/**
 * Create a new supplier
 */
export async function createSupplier(
  data: ICreateSupplierDto,
  teamId: string,
  userId: string
): Promise<ISupplier> {
  // Validate required fields
  if (!data.name || data.name.trim() === "") {
    throw new Error("Supplier name is required");
  }

  // Check for duplicate name within the team
  const existingSupplier = await prisma.inv_suppliers.findFirst({
    where: {
      name: data.name,
      team_id: teamId,
      is_active: true
    }
  });

  if (existingSupplier) {
    throw new Error("Supplier with this name already exists");
  }

  // Create the supplier
  const supplier = await prisma.inv_suppliers.create({
    data: {
      name: data.name,
      contact_person: data.contact_person || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      team_id: teamId,
      created_by: userId,
      is_active: true
    }
  });

  return supplier;
}

/**
 * Get a supplier by ID
 */
export async function getSupplierById(
  id: string,
  teamId: string
): Promise<ISupplier | null> {
  const supplier = await prisma.inv_suppliers.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!supplier) {
    return null;
  }

  return supplier;
}

/**
 * List suppliers with filters and pagination
 */
export async function listSuppliers(
  filters: ISupplierFilters,
  teamId: string
): Promise<ISupplierListResponse> {
  const page = typeof filters.page === 'string' ? parseInt(filters.page, 10) : (filters.page || 1);
  const size = typeof filters.size === 'string' ? parseInt(filters.size, 10) : (filters.size || 20);
  const skip = (page - 1) * size;

  // Build where clause
  const where: any = {
    team_id: teamId
  };

  // Filter by is_active (default to true)
  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  } else {
    where.is_active = true;
  }

  // Search by name, email, or contact person
  if (filters.search && filters.search.trim() !== "") {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { contact_person: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  // Execute queries in parallel
  const [suppliers, total] = await Promise.all([
    prisma.inv_suppliers.findMany({
      where,
      skip,
      take: size,
      orderBy: [
        { name: "asc" }
      ]
    }),
    prisma.inv_suppliers.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: suppliers,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update a supplier
 */
export async function updateSupplier(
  id: string,
  data: IUpdateSupplierDto,
  teamId: string,
  _userId: string
): Promise<ISupplier> {
  // Verify supplier exists and belongs to team
  const existing = await prisma.inv_suppliers.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Supplier not found");
  }

  // If name is being updated, check for duplicates
  if (data.name && data.name !== existing.name) {
    const duplicateSupplier = await prisma.inv_suppliers.findFirst({
      where: {
        name: data.name,
        team_id: teamId,
        is_active: true,
        id: { not: id }
      }
    });

    if (duplicateSupplier) {
      throw new Error("Supplier with this name already exists");
    }
  }

  // Update the supplier
  const supplier = await prisma.inv_suppliers.update({
    where: {
      id
    },
    data: {
      name: data.name !== undefined ? data.name : existing.name,
      contact_person: data.contact_person !== undefined ? data.contact_person : existing.contact_person,
      email: data.email !== undefined ? data.email : existing.email,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      address: data.address !== undefined ? data.address : existing.address,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
      updated_at: new Date()
    }
  });

  return supplier;
}

/**
 * Delete a supplier (soft delete)
 */
export async function deleteSupplier(
  id: string,
  teamId: string,
  _userId: string
): Promise<void> {
  // Verify supplier exists and belongs to team
  const existing = await prisma.inv_suppliers.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Supplier not found");
  }

  // Soft delete by setting is_active to false
  await prisma.inv_suppliers.update({
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
 * Search suppliers by name, email, or contact person
 */
export async function searchSuppliers(
  query: string,
  teamId: string,
  limit: number = 10
): Promise<ISupplier[]> {
  if (!query || query.trim() === "") {
    return [];
  }

  const suppliers = await prisma.inv_suppliers.findMany({
    where: {
      team_id: teamId,
      is_active: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { contact_person: { contains: query, mode: "insensitive" } }
      ]
    },
    take: limit,
    orderBy: [
      { name: "asc" }
    ]
  });

  return suppliers;
}
