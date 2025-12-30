/**
 * Integration Test Fixtures for Inventory Management
 * Provides factory functions to create test data in the database
 */

import { getPrismaClient } from './setup';

// ============================================================================
// Supplier Fixtures
// ============================================================================

export interface CreateSupplierData {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  teamId: string;
  userId: string;
}

/**
 * Create a supplier in the database
 */
export async function createSupplier(data: CreateSupplierData) {
  const prisma = getPrismaClient();

  return await prisma.inv_suppliers.create({
    data: {
      name: data.name,
      contact_person: data.contact_person,
      email: data.email,
      phone: data.phone,
      address: data.address,
      notes: data.notes,
      team_id: data.teamId,
      created_by: data.userId
    }
  });
}

/**
 * Create multiple suppliers in the database
 */
export async function createSuppliers(
  count: number,
  teamId: string,
  userId: string,
  namePrefix: string = 'Test Supplier'
) {
  const suppliers = [];

  for (let i = 1; i <= count; i++) {
    const supplier = await createSupplier({
      name: `${namePrefix} ${i}`,
      contact_person: `Contact ${i}`,
      email: `supplier${i}@test.com`,
      phone: `555-000${i}`,
      teamId,
      userId
    });
    suppliers.push(supplier);
  }

  return suppliers;
}

// ============================================================================
// Storage Location Fixtures
// ============================================================================

export interface CreateLocationData {
  location_code: string;
  name: string;
  description?: string;
  parent_location_id?: string;
  teamId: string;
  userId: string;
}

/**
 * Create a storage location in the database
 */
export async function createLocation(data: CreateLocationData) {
  const prisma = getPrismaClient();

  return await prisma.inv_storage_locations.create({
    data: {
      location_code: data.location_code,
      name: data.name,
      description: data.description,
      parent_location_id: data.parent_location_id,
      team_id: data.teamId,
      created_by: data.userId
    }
  });
}

/**
 * Create multiple storage locations in the database
 */
export async function createLocations(
  count: number,
  teamId: string,
  userId: string,
  codePrefix: string = 'LOC',
  namePrefix: string = 'Test Location'
) {
  const locations = [];

  for (let i = 1; i <= count; i++) {
    const location = await createLocation({
      location_code: `${codePrefix}-${i.toString().padStart(3, '0')}`,
      name: `${namePrefix} ${i}`,
      description: `Test location ${i}`,
      teamId,
      userId
    });
    locations.push(location);
  }

  return locations;
}

/**
 * Create a hierarchical location structure (parent and children)
 */
export async function createLocationHierarchy(teamId: string, userId: string) {
  const parent = await createLocation({
    location_code: 'WAREHOUSE-A',
    name: 'Warehouse A',
    description: 'Main warehouse',
    teamId,
    userId
  });

  const child1 = await createLocation({
    location_code: 'WAREHOUSE-A-SHELF-1',
    name: 'Shelf 1',
    description: 'First shelf in Warehouse A',
    parent_location_id: parent.id,
    teamId,
    userId
  });

  const child2 = await createLocation({
    location_code: 'WAREHOUSE-A-SHELF-2',
    name: 'Shelf 2',
    description: 'Second shelf in Warehouse A',
    parent_location_id: parent.id,
    teamId,
    userId
  });

  return { parent, children: [child1, child2] };
}

// ============================================================================
// Component Fixtures
// ============================================================================

export interface CreateComponentData {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  owner_type: 'supplier' | 'storage_location';
  supplier_id?: string;
  storage_location_id?: string;
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  teamId: string;
  userId: string;
}

/**
 * Create a component in the database
 */
export async function createComponent(data: CreateComponentData) {
  const prisma = getPrismaClient();

  return await prisma.inv_components.create({
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description,
      category: data.category,
      owner_type: data.owner_type,
      supplier_id: data.supplier_id,
      storage_location_id: data.storage_location_id,
      quantity: data.quantity || 0,
      unit: data.unit,
      unit_cost: data.unit_cost,
      reorder_level: data.reorder_level,
      reorder_quantity: data.reorder_quantity,
      team_id: data.teamId,
      created_by: data.userId
    }
  });
}

/**
 * Create multiple components in the database
 */
export async function createComponents(
  count: number,
  teamId: string,
  userId: string,
  supplierId: string,
  namePrefix: string = 'Test Component'
) {
  const components = [];

  for (let i = 1; i <= count; i++) {
    const component = await createComponent({
      name: `${namePrefix} ${i}`,
      sku: `SKU-${i.toString().padStart(5, '0')}`,
      description: `Test component ${i}`,
      category: 'Electronics',
      owner_type: 'supplier',
      supplier_id: supplierId,
      quantity: i * 10,
      unit: 'pcs',
      unit_cost: 9.99 + i,
      reorder_level: 5,
      reorder_quantity: 20,
      teamId,
      userId
    });
    components.push(component);
  }

  return components;
}

/**
 * Create components with low stock levels
 */
export async function createLowStockComponents(
  teamId: string,
  userId: string,
  supplierId: string
) {
  const lowStock1 = await createComponent({
    name: 'Low Stock Component 1',
    sku: 'LOW-001',
    owner_type: 'supplier',
    supplier_id: supplierId,
    quantity: 3,
    reorder_level: 10,
    reorder_quantity: 50,
    unit: 'pcs',
    unit_cost: 15.99,
    teamId,
    userId
  });

  const lowStock2 = await createComponent({
    name: 'Low Stock Component 2',
    sku: 'LOW-002',
    owner_type: 'supplier',
    supplier_id: supplierId,
    quantity: 0,
    reorder_level: 5,
    reorder_quantity: 25,
    unit: 'pcs',
    unit_cost: 12.50,
    teamId,
    userId
  });

  return [lowStock1, lowStock2];
}

// ============================================================================
// Transaction Fixtures
// ============================================================================

export interface CreateTransactionData {
  component_id: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
  teamId: string;
  userId: string;
}

/**
 * Create a transaction in the database
 * This also updates the component quantity
 */
export async function createTransaction(data: CreateTransactionData) {
  const prisma = getPrismaClient();

  // Get current component quantity
  const component = await prisma.inv_components.findUnique({
    where: { id: data.component_id }
  });

  if (!component) {
    throw new Error(`Component ${data.component_id} not found`);
  }

  const quantity_before = component.quantity;
  let quantity_after = quantity_before;

  // Calculate new quantity based on transaction type
  switch (data.transaction_type) {
    case 'IN':
      quantity_after = quantity_before + data.quantity;
      break;
    case 'OUT':
      quantity_after = quantity_before - data.quantity;
      if (quantity_after < 0) {
        throw new Error('Insufficient stock for OUT transaction');
      }
      break;
    case 'ADJUST':
      quantity_after = data.quantity; // ADJUST sets absolute quantity
      break;
  }

  // Create transaction and update component in a transaction
  const transaction = await prisma.inv_transactions.create({
    data: {
      component_id: data.component_id,
      transaction_type: data.transaction_type,
      quantity: data.quantity,
      quantity_before,
      quantity_after,
      unit_cost: data.unit_cost,
      reference_number: data.reference_number,
      notes: data.notes,
      team_id: data.teamId,
      created_by: data.userId
    }
  });

  // Update component quantity
  await prisma.inv_components.update({
    where: { id: data.component_id },
    data: { quantity: quantity_after }
  });

  return transaction;
}

/**
 * Create multiple transactions for a component
 */
export async function createTransactions(
  componentId: string,
  teamId: string,
  userId: string,
  count: number = 3
) {
  const transactions = [];

  // Add IN transactions
  for (let i = 0; i < count; i++) {
    const transaction = await createTransaction({
      component_id: componentId,
      transaction_type: 'IN',
      quantity: 10 + i,
      unit_cost: 10.00 + i,
      reference_number: `REF-IN-${i + 1}`,
      notes: `Test IN transaction ${i + 1}`,
      teamId,
      userId
    });
    transactions.push(transaction);
  }

  return transactions;
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Delete a specific supplier and all related data
 */
export async function deleteSupplier(supplierId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.inv_suppliers.delete({
    where: { id: supplierId }
  });
}

/**
 * Delete a specific location and all related data
 */
export async function deleteLocation(locationId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.inv_storage_locations.delete({
    where: { id: locationId }
  });
}

/**
 * Delete a specific component and all related data
 */
export async function deleteComponent(componentId: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.inv_components.delete({
    where: { id: componentId }
  });
}

// ============================================================================
// CSV Test Data
// ============================================================================

/**
 * Generate CSV content for testing CSV import
 */
export function generateValidCSV(): string {
  const header = 'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity';
  const rows = [
    'Component A,SKU-001,Description A,Electronics,100,pcs,9.99,10,50',
    'Component B,SKU-002,Description B,Mechanical,50,pcs,15.50,5,25',
    'Component C,SKU-003,Description C,Electronics,75,pcs,12.00,8,40'
  ];

  return [header, ...rows].join('\n');
}

/**
 * Generate CSV with invalid data for testing error handling
 */
export function generateInvalidCSV(): string {
  const header = 'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity';
  const rows = [
    'Valid Component,SKU-001,Description,Electronics,100,pcs,9.99,10,50',
    ',SKU-002,Missing Name,Electronics,50,pcs,15.50,5,25', // Missing name
    'Component C,SKU-003,Description,-999,pcs,12.00,8,40' // Invalid quantity (non-numeric in category)
  ];

  return [header, ...rows].join('\n');
}

/**
 * Generate CSV with missing required fields
 */
export function generateCSVWithMissingFields(): string {
  const header = 'name,sku,description';
  const rows = [
    'Component A,SKU-001,Description A',
    'Component B,SKU-002,Description B'
  ];

  return [header, ...rows].join('\n');
}
