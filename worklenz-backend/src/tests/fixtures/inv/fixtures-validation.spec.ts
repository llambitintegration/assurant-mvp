/**
 * Fixture Validation Tests
 * Ensures all inventory fixtures are correctly structured and functional
 */

// Unmock fixture modules to test their actual functionality
jest.unmock('./supplier-fixtures');
jest.unmock('./location-fixtures');
jest.unmock('./component-fixtures');
jest.unmock('./transaction-fixtures');
jest.unmock('./dashboard-fixtures');
jest.unmock('./csv-fixtures');
jest.unmock('@prisma/client');

import {
  createMockSupplier,
  createMockSupplierList,
  createSupplierWithFullContact,
  createMinimalSupplier,
  createInactiveSupplier,
  createDuplicateSuppliers,
} from './supplier-fixtures';

import {
  createMockLocation,
  createRootLocation,
  createChildLocation,
  createLocationHierarchy,
  createSiblingLocations,
  createCircularReferenceLocations,
  createInactiveLocation,
  createComplexLocationTree,
  createDuplicateLocationCodes,
} from './location-fixtures';

import {
  createMockComponentWithSupplier,
  createMockComponentWithLocation,
  createComponentWithQRCode,
  createLowStockComponent,
  createOutOfStockComponent,
  createMockComponentList,
  createComponentsWithVariedStock,
  createInactiveComponent,
  createDuplicateSKUs,
  createInvalidOwnerComponent,
} from './component-fixtures';

import {
  createMockInTransaction,
  createMockOutTransaction,
  createMockAdjustTransaction,
  createComponentTransactionHistory,
  createMultiComponentTransactions,
  createInsufficientStockTransaction,
  createTransactionsWithDifferentReferences,
  createStockDepletionSequence,
} from './transaction-fixtures';

import {
  createMockDashboardStats,
  createMockLowStockAlert,
  createLowStockAlertList,
  createMockDashboardResponse,
  createHealthyInventoryStats,
  createCriticalInventoryStats,
  createEmptyInventoryStats,
  createMixedOwnershipLowStockAlerts,
  createOutOfStockAlert,
} from './dashboard-fixtures';

import {
  createMockCSVRow,
  createValidCSVRows,
  createInvalidCSVRows,
  createMixedCSVRows,
  createMockCSVImportResult,
  createSuccessfulImportResult,
  createFailedImportResult,
  createPartialImportResult,
  createBulkCSVRows,
  createCSVFileContent,
  createVariousImportErrors,
} from './csv-fixtures';

describe('Supplier Fixtures', () => {
  it('should create a mock supplier', () => {
    const supplier = createMockSupplier();

    expect(supplier.id).toBe('supplier-1-uuid');
    expect(supplier.name).toBe('Acme Corporation');
    expect(supplier.email).toBe('john.smith@acmecorp.com');
    expect(supplier.team_id).toBe('team-1-uuid');
    expect(supplier.is_active).toBe(true);
  });

  it('should create a list of suppliers', () => {
    const suppliers = createMockSupplierList(5);

    expect(suppliers).toHaveLength(5);
    expect(suppliers[0].id).toBe('supplier-1-uuid');
    expect(suppliers[4].id).toBe('supplier-5-uuid');
  });

  it('should create supplier with full contact information', () => {
    const supplier = createSupplierWithFullContact();

    expect(supplier.contact_person).toBeTruthy();
    expect(supplier.email).toBeTruthy();
    expect(supplier.phone).toBeTruthy();
    expect(supplier.address).toBeTruthy();
    expect(supplier.notes).toBeTruthy();
  });

  it('should create minimal supplier', () => {
    const supplier = createMinimalSupplier();

    expect(supplier.name).toBeTruthy();
    expect(supplier.contact_person).toBeNull();
    expect(supplier.email).toBeNull();
    expect(supplier.phone).toBeNull();
    expect(supplier.address).toBeNull();
    expect(supplier.notes).toBeNull();
  });

  it('should create inactive supplier', () => {
    const supplier = createInactiveSupplier();

    expect(supplier.is_active).toBe(false);
  });

  it('should create duplicate suppliers for different teams', () => {
    const suppliers = createDuplicateSuppliers();

    expect(suppliers).toHaveLength(2);
    expect(suppliers[0].name).toBe(suppliers[1].name);
    expect(suppliers[0].team_id).not.toBe(suppliers[1].team_id);
  });
});

describe('Location Fixtures', () => {
  it('should create a mock location', () => {
    const location = createMockLocation();

    expect(location.id).toBe('location-1-uuid');
    expect(location.location_code).toBe('WH-A-01');
    expect(location.location_name).toBe('Warehouse A - Aisle 1');
    expect(location.team_id).toBe('team-1-uuid');
    expect(location.is_active).toBe(true);
  });

  it('should create root location without parent', () => {
    const location = createRootLocation();

    expect(location.parent_location_id).toBeNull();
  });

  it('should create child location with parent', () => {
    const parentId = 'parent-location-uuid';
    const location = createChildLocation(parentId);

    expect(location.parent_location_id).toBe(parentId);
  });

  it('should create location hierarchy', () => {
    const hierarchy = createLocationHierarchy();

    expect(hierarchy).toHaveLength(4);
    expect(hierarchy[0].parent_location_id).toBeNull(); // Warehouse (root)
    expect(hierarchy[1].parent_location_id).toBe(hierarchy[0].id); // Aisle
    expect(hierarchy[2].parent_location_id).toBe(hierarchy[1].id); // Rack
    expect(hierarchy[3].parent_location_id).toBe(hierarchy[2].id); // Shelf
  });

  it('should create sibling locations', () => {
    const parentId = 'parent-uuid';
    const siblings = createSiblingLocations(parentId, 5);

    expect(siblings).toHaveLength(5);
    expect(siblings.every(loc => loc.parent_location_id === parentId)).toBe(true);
  });

  it('should create circular reference locations', () => {
    const locations = createCircularReferenceLocations();

    expect(locations).toHaveLength(3);
    // Verify circular reference structure
    expect(locations[0].parent_location_id).toBe(locations[2].id);
    expect(locations[1].parent_location_id).toBe(locations[0].id);
    expect(locations[2].parent_location_id).toBe(locations[1].id);
  });

  it('should create complex location tree', () => {
    const tree = createComplexLocationTree();

    expect(tree).toHaveLength(6);
    const building = tree.find(l => l.location_code === 'BLDG-001');
    const floors = tree.filter(l => l.parent_location_id === building?.id);
    expect(floors).toHaveLength(2);
  });

  it('should create duplicate location codes for different teams', () => {
    const locations = createDuplicateLocationCodes();

    expect(locations).toHaveLength(2);
    expect(locations[0].location_code).toBe(locations[1].location_code);
    expect(locations[0].team_id).not.toBe(locations[1].team_id);
  });
});

describe('Component Fixtures', () => {
  it('should create component with supplier ownership', () => {
    const component = createMockComponentWithSupplier();

    expect(component.id).toBe('component-1-uuid');
    expect(component.owner_type).toBe('supplier');
    expect(component.supplier_id).toBeTruthy();
    expect(component.storage_location_id).toBeNull();
  });

  it('should create component with location ownership', () => {
    const component = createMockComponentWithLocation();

    expect(component.owner_type).toBe('storage_location');
    expect(component.storage_location_id).toBeTruthy();
    expect(component.supplier_id).toBeNull();
  });

  it('should create component with QR code', () => {
    const component = createComponentWithQRCode();

    expect(component.qr_code_data).toBeTruthy();
    expect(component.qr_code_image_url).toBeTruthy();

    const qrData = JSON.parse(component.qr_code_data);
    expect(qrData.id).toBe(component.id);
    expect(qrData.type).toBe('inventory_component');
  });

  it('should create low stock component', () => {
    const component = createLowStockComponent();

    expect(Number(component.quantity)).toBeLessThanOrEqual(Number(component.reorder_level));
  });

  it('should create out of stock component', () => {
    const component = createOutOfStockComponent();

    expect(Number(component.quantity)).toBe(0);
  });

  it('should create component list with mixed ownership', () => {
    const components = createMockComponentList(10);

    expect(components).toHaveLength(10);
    const supplierOwned = components.filter(c => c.owner_type === 'supplier');
    const locationOwned = components.filter(c => c.owner_type === 'storage_location');
    expect(supplierOwned.length + locationOwned.length).toBe(10);
  });

  it('should create components with varied stock levels', () => {
    const components = createComponentsWithVariedStock();

    expect(components).toHaveLength(4);
    const highStock = components.find(c => c.id === 'component-high-stock-uuid');
    const lowStock = components.find(c => c.id === 'component-low-stock-uuid');
    const zeroStock = components.find(c => c.id === 'component-zero-stock-uuid');

    expect(Number(highStock?.quantity)).toBeGreaterThan(Number(highStock?.reorder_level));
    expect(Number(lowStock?.quantity)).toBeLessThanOrEqual(Number(lowStock?.reorder_level));
    expect(Number(zeroStock?.quantity)).toBe(0);
  });

  it('should create invalid owner component for validation testing', () => {
    const component = createInvalidOwnerComponent();

    expect(component.owner_type).toBe('supplier');
    expect(component.supplier_id).toBeNull();
  });

  it('should create duplicate SKUs for different teams', () => {
    const components = createDuplicateSKUs();

    expect(components).toHaveLength(2);
    expect(components[0].sku).toBe(components[1].sku);
    expect(components[0].team_id).not.toBe(components[1].team_id);
  });
});

describe('Transaction Fixtures', () => {
  it('should create IN transaction', () => {
    const transaction = createMockInTransaction();

    expect(transaction.transaction_type).toBe('IN');
    expect(Number(transaction.quantity_after)).toBeGreaterThan(Number(transaction.quantity_before));
  });

  it('should create OUT transaction', () => {
    const transaction = createMockOutTransaction();

    expect(transaction.transaction_type).toBe('OUT');
    expect(Number(transaction.quantity_after)).toBeLessThan(Number(transaction.quantity_before));
  });

  it('should create ADJUST transaction', () => {
    const transaction = createMockAdjustTransaction();

    expect(transaction.transaction_type).toBe('ADJUST');
    expect(transaction.quantity_before).toBeTruthy();
    expect(transaction.quantity_after).toBeTruthy();
  });

  it('should create component transaction history', () => {
    const history = createComponentTransactionHistory('component-test-uuid');

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].created_at.getTime()).toBeLessThan(history[history.length - 1].created_at.getTime());
  });

  it('should create multi-component transactions', () => {
    const transactions = createMultiComponentTransactions();

    expect(transactions.length).toBeGreaterThan(0);
    const uniqueComponents = new Set(transactions.map(t => t.component_id));
    expect(uniqueComponents.size).toBeGreaterThan(1);
  });

  it('should create insufficient stock transaction for validation', () => {
    const transaction = createInsufficientStockTransaction();

    expect(Number(transaction.quantity_after)).toBeLessThan(0);
  });

  it('should create transactions with different references', () => {
    const transactions = createTransactionsWithDifferentReferences();

    expect(transactions.length).toBeGreaterThan(0);
    const uniqueRefs = new Set(transactions.map(t => t.reference_number));
    expect(uniqueRefs.size).toBe(transactions.length);
  });

  it('should create stock depletion sequence', () => {
    const sequence = createStockDepletionSequence('component-test-uuid', 1000);

    expect(sequence.length).toBeGreaterThan(0);
    expect(sequence.every(t => t.transaction_type === 'OUT')).toBe(true);
    const finalQty = Number(sequence[sequence.length - 1].quantity_after);
    expect(finalQty).toBeLessThan(1000);
  });
});

describe('Dashboard Fixtures', () => {
  it('should create mock dashboard stats', () => {
    const stats = createMockDashboardStats();

    expect(stats.total_components).toBeGreaterThan(0);
    expect(stats.total_inventory_value).toBeTruthy();
    expect(stats.low_stock_count).toBeGreaterThanOrEqual(0);
    expect(stats.total_suppliers).toBeGreaterThan(0);
    expect(stats.total_storage_locations).toBeGreaterThan(0);
  });

  it('should create low stock alert', () => {
    const alert = createMockLowStockAlert();

    expect(alert.component_id).toBeTruthy();
    expect(alert.name).toBeTruthy();
    expect(alert.sku).toBeTruthy();
    expect(Number(alert.current_quantity)).toBeLessThanOrEqual(Number(alert.reorder_level));
  });

  it('should create low stock alert list', () => {
    const alerts = createLowStockAlertList(5);

    expect(alerts).toHaveLength(5);
    expect(alerts.every(a => Number(a.current_quantity) <= Number(a.reorder_level))).toBe(true);
  });

  it('should create dashboard response with stats and alerts', () => {
    const response = createMockDashboardResponse();

    expect(response.stats).toBeTruthy();
    expect(response.low_stock_alerts).toBeTruthy();
    expect(Array.isArray(response.low_stock_alerts)).toBe(true);
  });

  it('should create healthy inventory stats', () => {
    const stats = createHealthyInventoryStats();

    expect(stats.low_stock_count).toBeLessThan(stats.total_components * 0.1); // Less than 10%
  });

  it('should create critical inventory stats', () => {
    const stats = createCriticalInventoryStats();

    expect(stats.low_stock_count).toBeGreaterThan(stats.total_components * 0.3); // More than 30%
  });

  it('should create empty inventory stats', () => {
    const stats = createEmptyInventoryStats();

    expect(stats.total_components).toBe(0);
    expect(Number(stats.total_inventory_value)).toBe(0);
    expect(stats.low_stock_count).toBe(0);
  });

  it('should create mixed ownership low stock alerts', () => {
    const alerts = createMixedOwnershipLowStockAlerts();

    const supplierOwned = alerts.filter(a => a.owner_type === 'supplier');
    const locationOwned = alerts.filter(a => a.owner_type === 'storage_location');

    expect(supplierOwned.length).toBeGreaterThan(0);
    expect(locationOwned.length).toBeGreaterThan(0);
  });

  it('should create out of stock alert', () => {
    const alert = createOutOfStockAlert();

    expect(Number(alert.current_quantity)).toBe(0);
  });
});

describe('CSV Fixtures', () => {
  it('should create mock CSV row', () => {
    const row = createMockCSVRow();

    expect(row.name).toBeTruthy();
    expect(row.sku).toBeTruthy();
    expect(row.quantity).toBeTruthy();
    expect(row.unit_price).toBeTruthy();
    expect(row.owner_type).toBeTruthy();
  });

  it('should create valid CSV rows', () => {
    const rows = createValidCSVRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.name && r.sku)).toBe(true);
  });

  it('should create invalid CSV rows', () => {
    const rows = createInvalidCSVRows();

    expect(rows.length).toBeGreaterThan(0);
    // At least one row should have validation issues
    expect(rows.some(r => !r.name || !r.sku || isNaN(Number(r.quantity)))).toBe(true);
  });

  it('should create mixed CSV rows', () => {
    const rows = createMixedCSVRows();

    expect(rows.length).toBeGreaterThan(0);
  });

  it('should create mock CSV import result', () => {
    const result = createMockCSVImportResult();

    expect(result.total_rows).toBeGreaterThan(0);
    expect(result.imported_count).toBeGreaterThanOrEqual(0);
    expect(result.error_count).toBeGreaterThanOrEqual(0);
    expect(result.imported_count + result.error_count).toBe(result.total_rows);
  });

  it('should create successful import result', () => {
    const result = createSuccessfulImportResult(10);

    expect(result.total_rows).toBe(10);
    expect(result.imported_count).toBe(10);
    expect(result.error_count).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should create failed import result', () => {
    const result = createFailedImportResult(10);

    expect(result.total_rows).toBe(10);
    expect(result.imported_count).toBe(0);
    expect(result.error_count).toBe(10);
    expect(result.errors).toHaveLength(10);
  });

  it('should create partial import result', () => {
    const result = createPartialImportResult();

    expect(result.imported_count).toBeGreaterThan(0);
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.imported_count + result.error_count).toBe(result.total_rows);
  });

  it('should create bulk CSV rows', () => {
    const rows = createBulkCSVRows(100);

    expect(rows).toHaveLength(100);
    expect(rows.every(r => r.name && r.sku)).toBe(true);
  });

  it('should create CSV file content', () => {
    const rows = createValidCSVRows();
    const content = createCSVFileContent(rows);

    expect(content).toContain('name,sku,description');
    expect(content.split('\n').length).toBe(rows.length + 1); // +1 for header
  });

  it('should create various import errors', () => {
    const errors = createVariousImportErrors();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(e => e.row && e.error)).toBe(true);
  });
});
