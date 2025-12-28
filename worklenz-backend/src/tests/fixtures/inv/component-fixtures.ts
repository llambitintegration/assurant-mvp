/**
 * Component Test Fixtures
 * Provides mock component data for testing with polymorphic ownership
 */

import { Prisma } from '@prisma/client';

/**
 * Base component properties shared by all components
 */
const baseComponentProps = {
  team_id: 'team-1-uuid',
  is_active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock component with supplier ownership
 */
export function createMockComponentWithSupplier(overrides: any = {}): any {
  return {
    id: 'component-1-uuid',
    name: 'Resistor 10K Ohm',
    sku: 'RES-10K-001',
    description: '10K Ohm 1/4W 5% resistor',
    quantity: new Prisma.Decimal(1000),
    unit_price: new Prisma.Decimal(0.05),
    reorder_level: new Prisma.Decimal(200),
    owner_type: 'supplier' as const,
    supplier_id: 'supplier-1-uuid',
    storage_location_id: null,
    qr_code_data: null,
    qr_code_image_url: null,
    notes: null,
    ...baseComponentProps,
    ...overrides,
  };
}

/**
 * Create a mock component with storage location ownership
 */
export function createMockComponentWithLocation(overrides: any = {}): any {
  return {
    id: 'component-2-uuid',
    name: 'Capacitor 100uF',
    sku: 'CAP-100UF-001',
    description: '100uF electrolytic capacitor',
    quantity: new Prisma.Decimal(500),
    unit_price: new Prisma.Decimal(0.15),
    reorder_level: new Prisma.Decimal(100),
    owner_type: 'storage_location' as const,
    supplier_id: null,
    storage_location_id: 'location-1-uuid',
    qr_code_data: null,
    qr_code_image_url: null,
    notes: null,
    ...baseComponentProps,
    ...overrides,
  };
}

/**
 * Create a component with QR code
 */
export function createComponentWithQRCode(overrides: any = {}): any {
  const component = createMockComponentWithSupplier({
    id: 'component-qr-uuid',
    name: 'Microcontroller ATmega328P',
    sku: 'MCU-ATMEGA328-001',
    ...overrides,
  });

  component.qr_code_data = JSON.stringify({
    id: component.id,
    name: component.name,
    sku: component.sku,
    team_id: component.team_id,
    type: 'inventory_component',
  });
  component.qr_code_image_url = `https://api.example.com/qr/${component.id}.png`;

  return component;
}

/**
 * Create a low stock component (quantity <= reorder_level)
 */
export function createLowStockComponent(overrides: any = {}): any {
  return createMockComponentWithSupplier({
    id: 'component-low-stock-uuid',
    name: 'LED Red 5mm',
    sku: 'LED-RED-5MM-001',
    quantity: new Prisma.Decimal(50), // Below reorder level
    reorder_level: new Prisma.Decimal(100),
    ...overrides,
  });
}

/**
 * Create a component with zero stock
 */
export function createOutOfStockComponent(overrides: any = {}): any {
  return createMockComponentWithSupplier({
    id: 'component-out-of-stock-uuid',
    name: 'Diode 1N4148',
    sku: 'DIODE-1N4148-001',
    quantity: new Prisma.Decimal(0),
    reorder_level: new Prisma.Decimal(200),
    ...overrides,
  });
}

/**
 * Create a list of mock components with mixed ownership
 */
export function createMockComponentList(count: number): any[] {
  const components = [];

  for (let i = 0; i < count; i++) {
    const isSupplierOwned = i % 2 === 0;
    const base = isSupplierOwned
      ? createMockComponentWithSupplier()
      : createMockComponentWithLocation();

    components.push({
      ...base,
      id: `component-${i + 1}-uuid`,
      name: `Component ${i + 1}`,
      sku: `SKU-${String(i + 1).padStart(5, '0')}`,
      quantity: new Prisma.Decimal(100 * (i + 1)),
      unit_price: new Prisma.Decimal(0.5 + i * 0.1),
      reorder_level: new Prisma.Decimal(50 * (i + 1)),
    });
  }

  return components;
}

/**
 * Create components with various stock levels
 */
export function createComponentsWithVariedStock(): any[] {
  return [
    createMockComponentWithSupplier({
      id: 'component-high-stock-uuid',
      name: 'Wire 22AWG Red',
      sku: 'WIRE-22AWG-RED',
      quantity: new Prisma.Decimal(5000),
      unit_price: new Prisma.Decimal(0.02),
      reorder_level: new Prisma.Decimal(1000),
    }),
    createMockComponentWithSupplier({
      id: 'component-medium-stock-uuid',
      name: 'Wire 22AWG Black',
      sku: 'WIRE-22AWG-BLK',
      quantity: new Prisma.Decimal(1500),
      unit_price: new Prisma.Decimal(0.02),
      reorder_level: new Prisma.Decimal(1000),
    }),
    createLowStockComponent({
      id: 'component-low-stock-uuid',
      name: 'Wire 22AWG Blue',
      sku: 'WIRE-22AWG-BLU',
      quantity: new Prisma.Decimal(80),
      reorder_level: new Prisma.Decimal(100),
    }),
    createOutOfStockComponent({
      id: 'component-zero-stock-uuid',
      name: 'Wire 22AWG Green',
      sku: 'WIRE-22AWG-GRN',
      quantity: new Prisma.Decimal(0),
      reorder_level: new Prisma.Decimal(100),
    }),
  ];
}

/**
 * Create a component with full details including notes
 */
export function createComponentWithFullDetails(overrides: any = {}): any {
  return createMockComponentWithSupplier({
    id: 'component-full-details-uuid',
    name: 'Arduino Uno R3',
    sku: 'ARD-UNO-R3-001',
    description: 'Arduino Uno R3 microcontroller board with ATmega328P',
    quantity: new Prisma.Decimal(75),
    unit_price: new Prisma.Decimal(22.50),
    reorder_level: new Prisma.Decimal(25),
    notes: 'Popular board for beginners. Keep minimum 25 units in stock.',
    ...overrides,
  });
}

/**
 * Create a component with minimal information
 */
export function createMinimalComponent(overrides: any = {}): any {
  return createMockComponentWithSupplier({
    id: 'component-minimal-uuid',
    name: 'Generic Part',
    sku: 'GEN-PART-001',
    description: null,
    quantity: new Prisma.Decimal(10),
    unit_price: new Prisma.Decimal(1.00),
    reorder_level: new Prisma.Decimal(5),
    notes: null,
    ...overrides,
  });
}

/**
 * Create an inactive component (soft deleted)
 */
export function createInactiveComponent(overrides: any = {}): any {
  return createMockComponentWithSupplier({
    id: 'component-inactive-uuid',
    name: 'Obsolete Part XYZ',
    sku: 'OBS-XYZ-001',
    is_active: false,
    updated_at: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  });
}

/**
 * Create components for different teams (for multi-tenancy testing)
 */
export function createComponentsForMultipleTeams(teamIds: string[]): any[] {
  return teamIds.map((teamId, i) => {
    return createMockComponentWithSupplier({
      id: `component-team-${i + 1}-uuid`,
      team_id: teamId,
      name: `Team ${i + 1} Component`,
      sku: `TEAM${i + 1}-SKU-001`,
      supplier_id: `supplier-team-${i + 1}-uuid`,
    });
  });
}

/**
 * Create components with high monetary value
 */
export function createHighValueComponents(): any[] {
  return [
    createMockComponentWithSupplier({
      id: 'component-expensive-1-uuid',
      name: 'FPGA Xilinx Spartan-7',
      sku: 'FPGA-SPARTAN7-001',
      quantity: new Prisma.Decimal(10),
      unit_price: new Prisma.Decimal(150.00),
      reorder_level: new Prisma.Decimal(3),
    }),
    createMockComponentWithSupplier({
      id: 'component-expensive-2-uuid',
      name: 'Raspberry Pi 4 8GB',
      sku: 'RPI4-8GB-001',
      quantity: new Prisma.Decimal(25),
      unit_price: new Prisma.Decimal(75.00),
      reorder_level: new Prisma.Decimal(10),
    }),
  ];
}

/**
 * Create components with duplicate SKUs (same SKU, different teams) for unique constraint testing
 */
export function createDuplicateSKUs(): any[] {
  return [
    createMockComponentWithSupplier({
      id: 'component-dup-1-uuid',
      team_id: 'team-1-uuid',
      name: 'Component A',
      sku: 'DUP-SKU-001',
    }),
    createMockComponentWithSupplier({
      id: 'component-dup-2-uuid',
      team_id: 'team-2-uuid',
      name: 'Component B',
      sku: 'DUP-SKU-001', // Same SKU, different team - should be allowed
    }),
  ];
}

/**
 * Create a component with invalid owner type configuration (for validation testing)
 */
export function createInvalidOwnerComponent(): any {
  return {
    ...createMockComponentWithSupplier(),
    id: 'component-invalid-owner-uuid',
    owner_type: 'supplier' as const,
    supplier_id: null, // Invalid: supplier owner type but no supplier_id
    storage_location_id: null,
  };
}

/**
 * Create components owned by specific supplier
 */
export function createComponentsForSupplier(supplierId: string, count: number): any[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockComponentWithSupplier({
      id: `component-supplier-${supplierId}-${i + 1}-uuid`,
      name: `Supplier Component ${i + 1}`,
      sku: `SUP-${supplierId.substring(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      supplier_id: supplierId,
    });
  });
}

/**
 * Create components stored at specific location
 */
export function createComponentsForLocation(locationId: string, count: number): any[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockComponentWithLocation({
      id: `component-location-${locationId}-${i + 1}-uuid`,
      name: `Location Component ${i + 1}`,
      sku: `LOC-${locationId.substring(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      storage_location_id: locationId,
    });
  });
}
