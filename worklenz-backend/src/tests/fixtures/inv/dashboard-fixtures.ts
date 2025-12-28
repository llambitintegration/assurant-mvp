/**
 * Dashboard Test Fixtures
 * Provides mock dashboard statistics and aggregation data for testing
 */

import { Prisma } from '@prisma/client';

/**
 * Create mock dashboard statistics
 */
export function createMockDashboardStats(overrides: any = {}): any {
  return {
    total_components: 150,
    total_inventory_value: new Prisma.Decimal(25750.50),
    low_stock_count: 12,
    total_suppliers: 8,
    total_storage_locations: 25,
    last_updated: new Date('2024-01-20T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock low stock alert
 */
export function createMockLowStockAlert(overrides: any = {}): any {
  return {
    component_id: 'component-low-1-uuid',
    name: 'Resistor 10K Ohm',
    sku: 'RES-10K-001',
    current_quantity: new Prisma.Decimal(50),
    reorder_level: new Prisma.Decimal(100),
    unit_price: new Prisma.Decimal(0.05),
    owner_type: 'supplier' as const,
    supplier_id: 'supplier-1-uuid',
    supplier_name: 'Acme Corporation',
    storage_location_id: null,
    location_name: null,
    ...overrides,
  };
}

/**
 * Create a list of low stock alerts
 */
export function createLowStockAlertList(count: number): any[] {
  const components = [
    { name: 'Resistor 10K Ohm', sku: 'RES-10K-001', qty: 50, reorder: 100, price: 0.05 },
    { name: 'Capacitor 100uF', sku: 'CAP-100UF-001', qty: 30, reorder: 80, price: 0.15 },
    { name: 'LED Red 5mm', sku: 'LED-RED-5MM-001', qty: 45, reorder: 100, price: 0.10 },
    { name: 'Diode 1N4148', sku: 'DIODE-1N4148-001', qty: 10, reorder: 50, price: 0.03 },
    { name: 'Transistor BC547', sku: 'TRANS-BC547-001', qty: 25, reorder: 75, price: 0.08 },
  ];

  return Array.from({ length: count }, (_, i) => {
    const component = components[i % components.length];
    return createMockLowStockAlert({
      component_id: `component-low-${i + 1}-uuid`,
      name: component.name,
      sku: component.sku,
      current_quantity: new Prisma.Decimal(component.qty),
      reorder_level: new Prisma.Decimal(component.reorder),
      unit_price: new Prisma.Decimal(component.price),
      supplier_id: `supplier-${(i % 3) + 1}-uuid`,
      supplier_name: `Supplier ${(i % 3) + 1}`,
    });
  });
}

/**
 * Create dashboard response with stats and alerts
 */
export function createMockDashboardResponse(overrides: any = {}): any {
  return {
    stats: createMockDashboardStats(),
    low_stock_alerts: createLowStockAlertList(5),
    ...overrides,
  };
}

/**
 * Create dashboard stats showing healthy inventory
 */
export function createHealthyInventoryStats(overrides: any = {}): any {
  return createMockDashboardStats({
    total_components: 200,
    total_inventory_value: new Prisma.Decimal(50000.00),
    low_stock_count: 2, // Very few low stock items
    total_suppliers: 10,
    total_storage_locations: 30,
    ...overrides,
  });
}

/**
 * Create dashboard stats showing critical inventory
 */
export function createCriticalInventoryStats(overrides: any = {}): any {
  return createMockDashboardStats({
    total_components: 100,
    total_inventory_value: new Prisma.Decimal(15000.00),
    low_stock_count: 45, // Almost half items are low stock
    total_suppliers: 5,
    total_storage_locations: 15,
    ...overrides,
  });
}

/**
 * Create dashboard stats for empty inventory
 */
export function createEmptyInventoryStats(overrides: any = {}): any {
  return createMockDashboardStats({
    total_components: 0,
    total_inventory_value: new Prisma.Decimal(0),
    low_stock_count: 0,
    total_suppliers: 0,
    total_storage_locations: 0,
    ...overrides,
  });
}

/**
 * Create dashboard stats with high value inventory
 */
export function createHighValueInventoryStats(overrides: any = {}): any {
  return createMockDashboardStats({
    total_components: 75,
    total_inventory_value: new Prisma.Decimal(250000.00), // High value
    low_stock_count: 8,
    total_suppliers: 12,
    total_storage_locations: 20,
    ...overrides,
  });
}

/**
 * Create low stock alert with storage location ownership
 */
export function createLowStockAlertWithLocation(overrides: any = {}): any {
  return createMockLowStockAlert({
    component_id: 'component-low-location-uuid',
    name: 'Wire Spool 22AWG',
    sku: 'WIRE-22AWG-001',
    owner_type: 'storage_location' as const,
    supplier_id: null,
    supplier_name: null,
    storage_location_id: 'location-1-uuid',
    location_name: 'Warehouse A - Aisle 1',
    ...overrides,
  });
}

/**
 * Create low stock alerts with mixed ownership types
 */
export function createMixedOwnershipLowStockAlerts(): any[] {
  return [
    createMockLowStockAlert({
      component_id: 'component-low-supplier-1-uuid',
      name: 'Resistor Pack',
      sku: 'RES-PACK-001',
      owner_type: 'supplier' as const,
      supplier_id: 'supplier-1-uuid',
      supplier_name: 'Acme Corporation',
      storage_location_id: null,
      location_name: null,
    }),
    createLowStockAlertWithLocation({
      component_id: 'component-low-location-1-uuid',
      name: 'Cable Ties',
      sku: 'CABLE-TIE-001',
      storage_location_id: 'location-2-uuid',
      location_name: 'Warehouse B - Bin 5',
    }),
    createMockLowStockAlert({
      component_id: 'component-low-supplier-2-uuid',
      name: 'Heat Shrink Tubing',
      sku: 'SHRINK-001',
      owner_type: 'supplier' as const,
      supplier_id: 'supplier-2-uuid',
      supplier_name: 'Global Supplies Inc',
      storage_location_id: null,
      location_name: null,
    }),
  ];
}

/**
 * Create low stock alert for out of stock component
 */
export function createOutOfStockAlert(overrides: any = {}): any {
  return createMockLowStockAlert({
    component_id: 'component-out-of-stock-uuid',
    name: 'Critical Component',
    sku: 'CRIT-001',
    current_quantity: new Prisma.Decimal(0), // Completely out of stock
    reorder_level: new Prisma.Decimal(50),
    unit_price: new Prisma.Decimal(5.00),
    ...overrides,
  });
}

/**
 * Create low stock alerts sorted by urgency (quantity vs reorder level)
 */
export function createUrgencySortedLowStockAlerts(): any[] {
  return [
    createMockLowStockAlert({
      component_id: 'component-critical-uuid',
      name: 'Critical Part A',
      sku: 'CRIT-A-001',
      current_quantity: new Prisma.Decimal(5), // Only 5% of reorder level
      reorder_level: new Prisma.Decimal(100),
    }),
    createMockLowStockAlert({
      component_id: 'component-urgent-uuid',
      name: 'Urgent Part B',
      sku: 'URG-B-001',
      current_quantity: new Prisma.Decimal(20), // 25% of reorder level
      reorder_level: new Prisma.Decimal(80),
    }),
    createMockLowStockAlert({
      component_id: 'component-warning-uuid',
      name: 'Warning Part C',
      sku: 'WARN-C-001',
      current_quantity: new Prisma.Decimal(45), // 60% of reorder level
      reorder_level: new Prisma.Decimal(75),
    }),
  ];
}

/**
 * Create low stock alerts with high monetary impact
 */
export function createHighValueLowStockAlerts(): any[] {
  return [
    createMockLowStockAlert({
      component_id: 'component-expensive-low-1-uuid',
      name: 'FPGA Board',
      sku: 'FPGA-BOARD-001',
      current_quantity: new Prisma.Decimal(3),
      reorder_level: new Prisma.Decimal(10),
      unit_price: new Prisma.Decimal(150.00), // High value
      supplier_name: 'Premium Components Inc',
    }),
    createMockLowStockAlert({
      component_id: 'component-expensive-low-2-uuid',
      name: 'Precision Sensor',
      sku: 'SENSOR-PREC-001',
      current_quantity: new Prisma.Decimal(8),
      reorder_level: new Prisma.Decimal(20),
      unit_price: new Prisma.Decimal(75.00), // High value
      supplier_name: 'TechParts Ltd',
    }),
  ];
}

/**
 * Create comprehensive dashboard data for testing complete response
 */
export function createCompleteDashboardData(): any {
  return {
    stats: createMockDashboardStats({
      total_components: 250,
      total_inventory_value: new Prisma.Decimal(75500.00),
      low_stock_count: 18,
      total_suppliers: 12,
      total_storage_locations: 35,
    }),
    low_stock_alerts: [
      ...createUrgencySortedLowStockAlerts(),
      ...createMixedOwnershipLowStockAlerts(),
      ...createHighValueLowStockAlerts(),
    ],
  };
}

/**
 * Create minimal dashboard stats (new inventory system)
 */
export function createMinimalDashboardStats(overrides: any = {}): any {
  return createMockDashboardStats({
    total_components: 10,
    total_inventory_value: new Prisma.Decimal(500.00),
    low_stock_count: 0,
    total_suppliers: 2,
    total_storage_locations: 3,
    ...overrides,
  });
}

/**
 * Create dashboard stats for different teams (multi-tenancy testing)
 */
export function createDashboardStatsForMultipleTeams(teamIds: string[]): any[] {
  return teamIds.map((teamId, i) => {
    return createMockDashboardStats({
      team_id: teamId,
      total_components: 50 * (i + 1),
      total_inventory_value: new Prisma.Decimal(10000 * (i + 1)),
      low_stock_count: 5 * (i + 1),
      total_suppliers: 3 * (i + 1),
      total_storage_locations: 10 * (i + 1),
    });
  });
}
