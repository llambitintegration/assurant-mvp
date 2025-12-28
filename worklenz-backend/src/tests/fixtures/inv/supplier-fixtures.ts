/**
 * Supplier Test Fixtures
 * Provides mock supplier data for testing
 */

/**
 * Base supplier properties shared by all suppliers
 */
const baseSupplierProps = {
  team_id: 'team-1-uuid',
  is_active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock supplier
 */
export function createMockSupplier(overrides: any = {}): any {
  return {
    id: 'supplier-1-uuid',
    name: 'Acme Corporation',
    contact_person: 'John Smith',
    email: 'john.smith@acmecorp.com',
    phone: '+1-555-0100',
    address: '123 Main Street, Suite 100, New York, NY 10001',
    notes: null,
    ...baseSupplierProps,
    ...overrides,
  };
}

/**
 * Create a list of mock suppliers
 */
export function createMockSupplierList(count: number): any[] {
  const suppliers = [
    'Acme Corporation',
    'Global Supplies Inc',
    'TechParts Ltd',
    'Industrial Components Co',
    'Premier Distributors',
  ];

  return Array.from({ length: count }, (_, i) => {
    const supplierName = suppliers[i % suppliers.length];
    return createMockSupplier({
      id: `supplier-${i + 1}-uuid`,
      name: count === suppliers.length ? supplierName : `${supplierName} ${i + 1}`,
      contact_person: `Contact Person ${i + 1}`,
      email: `contact${i + 1}@${supplierName.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: `+1-555-${String(i + 100).padStart(4, '0')}`,
      address: `${100 + i * 10} Business Ave, Suite ${i + 1}, City ${i + 1}, ST ${10000 + i}`,
    });
  });
}

/**
 * Create a supplier with complete contact information
 */
export function createSupplierWithFullContact(overrides: any = {}): any {
  return createMockSupplier({
    id: 'supplier-full-contact-uuid',
    name: 'Premium Components Inc',
    contact_person: 'Jane Doe',
    email: 'jane.doe@premiumcomponents.com',
    phone: '+1-555-0200',
    address: '456 Enterprise Blvd, Tower 3, Floor 12, Los Angeles, CA 90001',
    notes: 'Preferred supplier for premium components. 30-day payment terms.',
    ...overrides,
  });
}

/**
 * Create a supplier with minimal information
 */
export function createMinimalSupplier(overrides: any = {}): any {
  return createMockSupplier({
    id: 'supplier-minimal-uuid',
    name: 'Basic Supplies',
    contact_person: null,
    email: null,
    phone: null,
    address: null,
    notes: null,
    ...overrides,
  });
}

/**
 * Create an inactive supplier (soft deleted)
 */
export function createInactiveSupplier(overrides: any = {}): any {
  return createMockSupplier({
    id: 'supplier-inactive-uuid',
    name: 'Defunct Supplier Inc',
    is_active: false,
    updated_at: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  });
}

/**
 * Create suppliers for different teams (for multi-tenancy testing)
 */
export function createSuppliersForMultipleTeams(teamIds: string[]): any[] {
  return teamIds.map((teamId, i) => {
    return createMockSupplier({
      id: `supplier-team-${i + 1}-uuid`,
      team_id: teamId,
      name: `Team ${i + 1} Supplier`,
      email: `supplier@team${i + 1}.com`,
    });
  });
}

/**
 * Create a supplier with specific notes for testing
 */
export function createSupplierWithNotes(notes: string, overrides: any = {}): any {
  return createMockSupplier({
    notes,
    ...overrides,
  });
}

/**
 * Create duplicate suppliers (same name, different teams) for unique constraint testing
 */
export function createDuplicateSuppliers(): any[] {
  return [
    createMockSupplier({
      id: 'supplier-dup-1-uuid',
      team_id: 'team-1-uuid',
      name: 'Duplicate Supplier Name',
    }),
    createMockSupplier({
      id: 'supplier-dup-2-uuid',
      team_id: 'team-2-uuid',
      name: 'Duplicate Supplier Name', // Same name, different team - should be allowed
    }),
  ];
}
