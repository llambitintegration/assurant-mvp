/**
 * Components Service
 * Handles business logic for inventory component management with polymorphic ownership
 */

import prisma from "../../config/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  IComponent,
  ICreateComponentDto,
  IUpdateComponentDto,
  IComponentFilters,
  IComponentListResponse,
  ILowStockComponent
} from "../../interfaces/inv/component.interface";
import { generateQRCodeForComponent as generateQR } from "./qr-service";

/**
 * Validate polymorphic ownership
 * Ensures owner_type consistency with supplier_id/storage_location_id
 */
async function validateOwnership(
  owner_type: string,
  supplier_id: string | null | undefined,
  storage_location_id: string | null | undefined,
  teamId: string
): Promise<void> {
  // Validate owner_type is valid
  if (owner_type !== 'supplier' && owner_type !== 'storage_location') {
    throw new Error("Invalid owner_type. Must be 'supplier' or 'storage_location'");
  }

  // Check that both IDs are not provided
  if (supplier_id && storage_location_id) {
    throw new Error("Cannot specify both supplier_id and storage_location_id");
  }

  // Validate supplier ownership
  if (owner_type === 'supplier') {
    if (!supplier_id) {
      throw new Error("supplier_id is required when owner_type is 'supplier'");
    }

    // Verify supplier exists and belongs to team
    const supplier = await prisma.inv_suppliers.findFirst({
      where: {
        id: supplier_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!supplier) {
      throw new Error("Supplier not found or does not belong to this team");
    }

    // Ensure storage_location_id is not set
    if (storage_location_id) {
      throw new Error("storage_location_id must be null when owner_type is 'supplier'");
    }
  }

  // Validate storage location ownership
  if (owner_type === 'storage_location') {
    if (!storage_location_id) {
      throw new Error("storage_location_id is required when owner_type is 'storage_location'");
    }

    // Verify storage location exists and belongs to team
    const location = await prisma.inv_storage_locations.findFirst({
      where: {
        id: storage_location_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!location) {
      throw new Error("Storage location not found or does not belong to this team");
    }

    // Ensure supplier_id is not set
    if (supplier_id) {
      throw new Error("supplier_id must be null when owner_type is 'storage_location'");
    }
  }
}

/**
 * Create a new component
 */
export async function createComponent(
  data: ICreateComponentDto,
  teamId: string,
  userId: string
): Promise<IComponent> {
  // Validate required fields
  if (!data.name || data.name.trim() === "") {
    throw new Error("Component name is required");
  }

  // Validate numeric fields
  const quantity = data.quantity ?? 0;
  const unit_cost = data.unit_cost ?? null;
  const reorder_level = data.reorder_level ?? 0;

  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }

  if (unit_cost !== null && unit_cost < 0) {
    throw new Error("Unit cost cannot be negative");
  }

  if (reorder_level !== null && reorder_level < 0) {
    throw new Error("Reorder level cannot be negative");
  }

  // Check for duplicate SKU within the team (if SKU provided)
  if (data.sku && data.sku.trim() !== "") {
    const existingComponent = await prisma.inv_components.findFirst({
      where: {
        sku: data.sku,
        team_id: teamId,
        is_active: true
      }
    });

    if (existingComponent) {
      throw new Error("Component with this SKU already exists");
    }
  }

  // Validate polymorphic ownership
  await validateOwnership(
    data.owner_type,
    data.supplier_id,
    data.storage_location_id,
    teamId
  );

  // Create the component first (without QR code)
  const component = await prisma.inv_components.create({
    data: {
      name: data.name,
      sku: data.sku || null,
      description: data.description || null,
      category: data.category || null,
      owner_type: data.owner_type as any,
      supplier_id: data.owner_type === 'supplier' ? data.supplier_id : null,
      storage_location_id: data.owner_type === 'storage_location' ? data.storage_location_id : null,
      quantity,
      unit: data.unit || null,
      unit_cost: unit_cost !== null ? new Decimal(unit_cost) : null,
      reorder_level: reorder_level,
      qr_code_data: null,
      qr_code_image: null,
      team_id: teamId,
      created_by: userId,
      is_active: true
    }
  });

  // Generate QR code for the component
  try {
    const qrCodeResult = await generateQR(component.id, teamId);

    // Update component with QR code data
    const updatedComponent = await prisma.inv_components.update({
      where: { id: component.id },
      data: {
        qr_code_data: qrCodeResult.qr_code_data,
        qr_code_image: qrCodeResult.qr_code_image
      }
    });

    return updatedComponent;
  } catch (qrError) {
    // QR generation failed, but component was created
    // Log error but return component without QR code
    console.error(`QR code generation failed for component ${component.id}:`, qrError);
    return component;
  }
}

/**
 * Get a component by ID with relations
 */
export async function getComponentById(
  id: string,
  teamId: string
): Promise<IComponent | null> {
  const component = await prisma.inv_components.findFirst({
    where: {
      id,
      team_id: teamId
    },
    include: {
      supplier: true,
      storage_location: true
    }
  });

  if (!component) {
    return null;
  }

  return component;
}

/**
 * List components with filters and pagination
 */
export async function listComponents(
  filters: IComponentFilters,
  teamId: string
): Promise<IComponentListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
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

  // Filter by owner_type
  if (filters.owner_type) {
    where.owner_type = filters.owner_type;
  }

  // Filter by supplier_id
  if (filters.supplier_id) {
    where.supplier_id = filters.supplier_id;
  }

  // Filter by storage_location_id
  if (filters.storage_location_id) {
    where.storage_location_id = filters.storage_location_id;
  }

  // Filter by category
  if (filters.category) {
    where.category = filters.category;
  }

  // Filter by low stock (quantity <= reorder_level)
  if (filters.low_stock === true) {
    where.AND = [
      {
        reorder_level: {
          not: null
        }
      },
      prisma.$queryRaw`quantity <= reorder_level` as any
    ];
  }

  // Search by name, SKU, or description
  if (filters.search && filters.search.trim() !== "") {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  // Execute queries in parallel
  const [components, total] = await Promise.all([
    prisma.inv_components.findMany({
      where,
      skip,
      take: size,
      include: {
        supplier: true,
        storage_location: true
      },
      orderBy: [
        { name: "asc" }
      ]
    }),
    prisma.inv_components.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: components,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Update a component
 */
export async function updateComponent(
  id: string,
  data: IUpdateComponentDto,
  teamId: string,
  _userId: string
): Promise<IComponent> {
  // Verify component exists and belongs to team
  const existing = await prisma.inv_components.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Component not found");
  }

  // Determine the new owner_type (use existing if not provided)
  const newOwnerType = data.owner_type ?? existing.owner_type;
  const newSupplierId = data.supplier_id !== undefined ? data.supplier_id : existing.supplier_id;
  const newStorageLocationId = data.storage_location_id !== undefined ? data.storage_location_id : existing.storage_location_id;

  // Validate ownership if any ownership field is being changed
  if (data.owner_type !== undefined || data.supplier_id !== undefined || data.storage_location_id !== undefined) {
    await validateOwnership(
      newOwnerType,
      newSupplierId,
      newStorageLocationId,
      teamId
    );
  }

  // Validate numeric fields
  if (data.quantity !== undefined && data.quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }

  if (data.unit_cost !== undefined && data.unit_cost !== null && data.unit_cost < 0) {
    throw new Error("Unit cost cannot be negative");
  }

  if (data.reorder_level !== undefined && data.reorder_level !== null && data.reorder_level < 0) {
    throw new Error("Reorder level cannot be negative");
  }

  // Check for duplicate SKU if SKU is being updated
  if (data.sku !== undefined && data.sku !== existing.sku) {
    if (data.sku && data.sku.trim() !== "") {
      const duplicateComponent = await prisma.inv_components.findFirst({
        where: {
          sku: data.sku,
          team_id: teamId,
          is_active: true,
          id: { not: id }
        }
      });

      if (duplicateComponent) {
        throw new Error("Component with this SKU already exists");
      }
    }
  }

  // Build update data
  const updateData: any = {
    updated_at: new Date()
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku || null;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.category !== undefined) updateData.category = data.category || null;
  if (data.owner_type !== undefined) updateData.owner_type = data.owner_type;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.unit !== undefined) updateData.unit = data.unit || null;
  if (data.unit_cost !== undefined) {
    updateData.unit_cost = data.unit_cost !== null ? new Decimal(data.unit_cost) : null;
  }
  if (data.reorder_level !== undefined) updateData.reorder_level = data.reorder_level;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  // Set owner IDs based on owner_type
  if (data.owner_type !== undefined || data.supplier_id !== undefined || data.storage_location_id !== undefined) {
    if (newOwnerType === 'supplier') {
      updateData.supplier_id = newSupplierId;
      updateData.storage_location_id = null;
    } else {
      updateData.supplier_id = null;
      updateData.storage_location_id = newStorageLocationId;
    }
  }

  // Update the component
  const component = await prisma.inv_components.update({
    where: { id },
    data: updateData
  });

  return component;
}

/**
 * Delete a component (soft delete)
 */
export async function deleteComponent(
  id: string,
  teamId: string,
  _userId: string
): Promise<void> {
  // Verify component exists and belongs to team
  const existing = await prisma.inv_components.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Component not found");
  }

  // Soft delete by setting is_active to false
  await prisma.inv_components.update({
    where: { id },
    data: {
      is_active: false,
      updated_at: new Date()
    }
  });
}

/**
 * Generate/regenerate QR code for a component
 */
export async function generateQRCodeForComponent(
  id: string,
  teamId: string
): Promise<{ qr_code_data: string; qr_code_image: string }> {
  // Verify component exists and belongs to team
  const existing = await prisma.inv_components.findFirst({
    where: {
      id,
      team_id: teamId
    }
  });

  if (!existing) {
    throw new Error("Component not found");
  }

  // Generate QR code
  const qrCodeResult = await generateQR(id, teamId);

  // Update component with new QR code
  await prisma.inv_components.update({
    where: { id },
    data: {
      qr_code_data: qrCodeResult.qr_code_data,
      qr_code_image: qrCodeResult.qr_code_image,
      updated_at: new Date()
    }
  });

  return qrCodeResult;
}

/**
 * Get low stock components (quantity <= reorder_level)
 */
export async function getLowStockComponents(
  teamId: string,
  limit: number = 50
): Promise<ILowStockComponent[]> {
  // Find components where quantity <= reorder_level
  const components = await prisma.$queryRaw<any[]>`
    SELECT
      c.*,
      s.name as supplier_name,
      l.name as storage_location_name,
      CASE
        WHEN c.reorder_level > 0 THEN ROUND((c.quantity::numeric / c.reorder_level::numeric) * 100, 2)
        ELSE 0
      END as stock_percentage,
      CASE
        WHEN c.reorder_level > c.quantity THEN c.reorder_level - c.quantity
        ELSE 0
      END as quantity_needed
    FROM inv_components c
    LEFT JOIN inv_suppliers s ON c.supplier_id = s.id
    LEFT JOIN inv_storage_locations l ON c.storage_location_id = l.id
    WHERE c.team_id = ${teamId}::uuid
      AND c.is_active = true
      AND c.reorder_level IS NOT NULL
      AND c.quantity <= c.reorder_level
    ORDER BY
      (c.quantity::numeric / NULLIF(c.reorder_level, 0)::numeric) ASC,
      c.quantity ASC
    LIMIT ${limit}
  `;

  return components.map(comp => ({
    ...comp,
    stock_percentage: parseFloat(comp.stock_percentage || 0),
    quantity_needed: parseInt(comp.quantity_needed || 0)
  }));
}

/**
 * Search components by name or SKU
 */
export async function searchComponents(
  query: string,
  teamId: string,
  limit: number = 10
): Promise<IComponent[]> {
  if (!query || query.trim() === "") {
    return [];
  }

  const components = await prisma.inv_components.findMany({
    where: {
      team_id: teamId,
      is_active: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } }
      ]
    },
    include: {
      supplier: true,
      storage_location: true
    },
    take: limit,
    orderBy: [
      { name: "asc" }
    ]
  });

  return components;
}
