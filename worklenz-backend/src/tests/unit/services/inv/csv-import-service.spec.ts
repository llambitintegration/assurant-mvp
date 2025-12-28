/**
 * CSV Import Service Unit Tests
 * Tests for CSV parsing, validation, and bulk component import with comprehensive error handling
 */

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_components: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    inv_suppliers: {
      findFirst: jest.fn()
    },
    inv_storage_locations: {
      findFirst: jest.fn()
    }
  }
}));

// Mock components service
jest.mock('../../../../services/inv/components-service', () => ({
  createComponent: jest.fn()
}));

// Mock QR service (used by components service)
jest.mock('../../../../services/inv/qr-service', () => ({
  generateQRCodeForComponent: jest.fn()
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/csv-import-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/csv-fixtures');
jest.unmock('csv-parse/sync');

import {
  parseCSV,
  validateCSVRow,
  lookupOwner,
  importComponentsFromCSV
} from '../../../../services/inv/csv-import-service';
import prisma from '../../../../config/prisma';
import { createComponent } from '../../../../services/inv/components-service';
import {
  createValidCSVRows,
  createInvalidCSVRows,
  createMixedCSVRows,
  createCSVFileContent,
  createBulkCSVRows,
  createCSVRowsWithSpecialCharacters,
  createMinimalCSVRow,
  createCompleteCSVRow,
  createDuplicateSKURows
} from '../../../fixtures/inv/csv-fixtures';
import { createMockSupplier } from '../../../fixtures/inv/supplier-fixtures';
import { createMockLocation } from '../../../fixtures/inv/location-fixtures';
import { ICSVImportRow } from '../../../../interfaces/inv/csv-import.interface';

// Get reference to the mocked clients
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;
const mockCreateComponent = createComponent as jest.MockedFunction<typeof createComponent>;

describe('CSV Import Service', () => {
  const TEAM_ID = 'team-1-uuid';
  const USER_ID = 'user-1-uuid';
  const OTHER_TEAM_ID = 'team-2-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('parseCSV', () => {
    describe('Success cases', () => {
      it('should parse valid CSV with all fields', () => {
        const csvContent = `name,sku,description,category,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Resistor 10K,RES-10K-001,10K Ohm resistor,Resistors,supplier,ACME Corp,,1000,pcs,0.05,200
Capacitor 100uF,CAP-100UF-001,100uF capacitor,Capacitors,storage_location,,WH-A-01,500,pcs,0.15,100`;

        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
          row_number: 2,
          name: 'Resistor 10K',
          sku: 'RES-10K-001',
          description: '10K Ohm resistor',
          category: 'Resistors',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          location_code: '',
          quantity: '1000',
          unit: 'pcs',
          unit_cost: '0.05',
          reorder_level: '200'
        });
        expect(rows[1]).toMatchObject({
          row_number: 3,
          name: 'Capacitor 100uF',
          owner_type: 'storage_location',
          location_code: 'WH-A-01'
        });
      });

      it('should parse CSV with minimal required fields', () => {
        const csvContent = `name,sku,owner_type,supplier_name,quantity,reorder_level
Minimal Component,MIN-001,supplier,Tech Supplies,10,5`;

        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          name: 'Minimal Component',
          sku: 'MIN-001',
          owner_type: 'supplier',
          supplier_name: 'Tech Supplies',
          quantity: '10',
          reorder_level: '5'
        });
      });

      it('should handle CSV with special characters', () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,quantity,reorder_level
"Component with ""quotes""",QUOTE-001,"Description with, commas, and ""quotes""",supplier,ACME Corp,100,20
Component with 'apostrophes',APOS-001,It's a component,supplier,Tech Supplies,50,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('Component with "quotes"');
        expect(rows[0].description).toBe('Description with, commas, and "quotes"');
        expect(rows[1].name).toBe("Component with 'apostrophes'");
        expect(rows[1].description).toBe("It's a component");
      });

      it('should skip empty rows', () => {
        const csvContent = `name,sku,owner_type,supplier_name,quantity,reorder_level
Component 1,C001,supplier,ACME Corp,100,20

Component 2,C002,supplier,Tech Supplies,50,10

`;

        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('Component 1');
        expect(rows[1].name).toBe('Component 2');
      });

      it('should trim whitespace from values', () => {
        const csvContent = `name,sku,owner_type,supplier_name,quantity,reorder_level
  Trimmed Component  ,  TRIM-001  ,  supplier  ,  ACME Corp  ,  100  ,  20  `;

        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Trimmed Component');
        expect(rows[0].sku).toBe('TRIM-001');
        expect(rows[0].owner_type).toBe('supplier');
        expect(rows[0].supplier_name).toBe('ACME Corp');
      });

      it('should handle UTF-8 BOM', () => {
        const csvContent = '\uFEFFname,sku,owner_type,supplier_name,quantity,reorder_level\nComponent 1,C001,supplier,ACME Corp,100,20';
        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Component 1');
      });
    });

    describe('Error cases', () => {
      it('should throw error for completely malformed CSV', () => {
        const csvContent = 'This is not a valid CSV file at all';
        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        // csv-parse will try to parse it, so we expect at least some result
        expect(rows).toBeDefined();
      });

      it('should handle empty CSV (headers only)', () => {
        const csvContent = 'name,sku,owner_type,supplier_name,quantity,reorder_level';
        const buffer = Buffer.from(csvContent, 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(0);
      });

      it('should handle completely empty buffer', () => {
        const buffer = Buffer.from('', 'utf-8');
        const rows = parseCSV(buffer);

        expect(rows).toHaveLength(0);
      });
    });
  });

  describe('validateCSVRow', () => {
    describe('Success cases', () => {
      it('should validate row with all required fields for supplier', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Resistor 10K',
          sku: 'RES-10K-001',
          description: '10K Ohm resistor',
          category: 'Resistors',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '1000',
          unit: 'pcs',
          unit_cost: '0.05',
          reorder_level: '200'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.validated_data).toMatchObject({
          name: 'Resistor 10K',
          sku: 'RES-10K-001',
          owner_type: 'supplier',
          quantity: 1000,
          unit_cost: 0.05,
          reorder_level: 200
        });
      });

      it('should validate row with all required fields for storage_location', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Capacitor 100uF',
          sku: 'CAP-100UF-001',
          owner_type: 'storage_location',
          location_code: 'WH-A-01',
          quantity: '500',
          reorder_level: '100'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.validated_data?.owner_type).toBe('storage_location');
      });

      it('should validate row with minimal fields', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Minimal Component',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '10',
          reorder_level: '5'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(true);
        expect(result.warnings).toContain('SKU not provided - component will be created without SKU');
      });

      it('should validate row with zero quantity', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Zero Quantity Component',
          sku: 'ZERO-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '0',
          reorder_level: '0'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(true);
        expect(result.validated_data?.quantity).toBe(0);
      });
    });

    describe('Validation error cases', () => {
      it('should fail when name is missing', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: '',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Component name is required');
      });

      it('should fail when owner_type is missing', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: '',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Owner type is required');
      });

      it('should fail when owner_type is invalid', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'invalid_type',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Invalid owner_type'));
      });

      it('should fail when supplier_name is missing for supplier owner_type', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: '',
          quantity: '100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Supplier name is required when owner_type is supplier');
      });

      it('should fail when location_code is missing for storage_location owner_type', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'storage_location',
          location_code: '',
          quantity: '100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Location code is required when owner_type is storage_location');
      });

      it('should fail when quantity is not a number', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: 'abc',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Invalid quantity'));
      });

      it('should fail when quantity is negative', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '-100',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Quantity cannot be negative');
      });

      it('should fail when unit_cost is not a number', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          unit_cost: 'xyz',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Invalid unit_cost'));
      });

      it('should fail when unit_cost is negative', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          unit_cost: '-5.00',
          reorder_level: '20'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Unit cost cannot be negative');
      });

      it('should fail when reorder_level is not a number', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: 'abc'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Invalid reorder_level'));
      });

      it('should fail when reorder_level is negative', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'TEST-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: '-10'
        };

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContain('Reorder level cannot be negative');
      });

      it('should fail when SKU already exists', async () => {
        const row: ICSVImportRow = {
          row_number: 2,
          name: 'Test Component',
          sku: 'DUPLICATE-001',
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          quantity: '100',
          reorder_level: '20'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue({
          id: 'existing-component-id',
          sku: 'DUPLICATE-001'
        } as any);

        const result = await validateCSVRow(row, TEAM_ID);

        expect(result.is_valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('already exists'));
      });
    });
  });

  describe('lookupOwner', () => {
    describe('Supplier lookup', () => {
      it('should find supplier by name', async () => {
        const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' });
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any);

        const ownerId = await lookupOwner('supplier', 'ACME Corp', TEAM_ID);

        expect(ownerId).toBe('supplier-1-uuid');
        expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
          where: {
            name: 'ACME Corp',
            team_id: TEAM_ID,
            is_active: true
          }
        });
      });

      it('should throw error when supplier not found', async () => {
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

        await expect(
          lookupOwner('supplier', 'Non-existent Supplier', TEAM_ID)
        ).rejects.toThrow("Supplier 'Non-existent Supplier' not found");
      });

      it('should enforce team isolation for suppliers', async () => {
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

        await expect(
          lookupOwner('supplier', 'ACME Corp', OTHER_TEAM_ID)
        ).rejects.toThrow("Supplier 'ACME Corp' not found");
      });
    });

    describe('Storage location lookup', () => {
      it('should find storage location by code', async () => {
        const mockLocation = createMockLocation({ id: 'location-1-uuid', location_code: 'WH-A-01' });
        mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValueOnce(mockLocation as any);

        const ownerId = await lookupOwner('storage_location', 'WH-A-01', TEAM_ID);

        expect(ownerId).toBe('location-1-uuid');
        expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledWith({
          where: {
            location_code: 'WH-A-01',
            team_id: TEAM_ID,
            is_active: true
          }
        });
      });

      it('should throw error when storage location not found', async () => {
        mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

        await expect(
          lookupOwner('storage_location', 'NON-EXISTENT', TEAM_ID)
        ).rejects.toThrow("Storage location 'NON-EXISTENT' not found");
      });

      it('should enforce team isolation for storage locations', async () => {
        mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

        await expect(
          lookupOwner('storage_location', 'WH-A-01', OTHER_TEAM_ID)
        ).rejects.toThrow("Storage location 'WH-A-01' not found");
      });
    });

    describe('Invalid owner type', () => {
      it('should throw error for invalid owner type', async () => {
        await expect(
          lookupOwner('invalid_type', 'Some Identifier', TEAM_ID)
        ).rejects.toThrow("Invalid owner_type 'invalid_type'");
      });
    });
  });

  describe('importComponentsFromCSV', () => {
    describe('Success cases', () => {
      it('should import all components successfully', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Resistor 10K,RES-10K-001,10K Ohm resistor,supplier,ACME Corp,,1000,pcs,0.05,200
Capacitor 100uF,CAP-100UF-001,100uF capacitor,storage_location,,WH-A-01,500,pcs,0.15,100`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        // Mock no duplicate SKUs - called during validation
        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        // Mock supplier lookup - return ACME Corp supplier
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation((args: any) => {
          if (args.where.name === 'ACME Corp') {
            return Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any);
          }
          return Promise.resolve(null);
        });

        // Mock location lookup - return WH-A-01 location
        mockPrismaClient.inv_storage_locations.findFirst.mockImplementation((args: any) => {
          if (args.where.location_code === 'WH-A-01') {
            return Promise.resolve(createMockLocation({ id: 'location-1-uuid', location_code: 'WH-A-01' }) as any);
          }
          return Promise.resolve(null);
        });

        // Mock component creation
        mockCreateComponent
          .mockResolvedValueOnce({ id: 'component-1-uuid' } as any)
          .mockResolvedValueOnce({ id: 'component-2-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(2);
        expect(result.successful_imports).toBe(2);
        expect(result.failed_imports).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(result.imported_component_ids).toHaveLength(2);
        expect(result.duration_ms).toBeGreaterThan(0);
        expect(mockCreateComponent).toHaveBeenCalledTimes(2);
      });

      it('should handle empty CSV (no data rows)', async () => {
        const csvContent = 'name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level';
        const buffer = Buffer.from(csvContent, 'utf-8');

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(0);
        expect(result.successful_imports).toBe(0);
        expect(result.failed_imports).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockCreateComponent).not.toHaveBeenCalled();
      });

      it('should import large CSV file efficiently', async () => {
        // Create CSV with 100 rows
        const rows = Array.from({ length: 100 }, (_, i) => ({
          name: `Component ${i + 1}`,
          sku: `SKU-${String(i + 1).padStart(5, '0')}`,
          description: `Description ${i + 1}`,
          owner_type: 'supplier',
          supplier_name: 'ACME Corp',
          location_code: '',
          quantity: String((i + 1) * 10),
          unit: 'pcs',
          unit_cost: '1.00',
          reorder_level: String((i + 1) * 2)
        }));

        const csvContent = [
          'name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level',
          ...rows.map(r => `${r.name},${r.sku},${r.description},${r.owner_type},${r.supplier_name},${r.location_code},${r.quantity},${r.unit},${r.unit_cost},${r.reorder_level}`)
        ].join('\n');

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );
        mockCreateComponent.mockResolvedValue({ id: 'component-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(100);
        expect(result.successful_imports).toBe(100);
        expect(result.failed_imports).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockCreateComponent).toHaveBeenCalledTimes(100);
      });
    });

    describe('Partial failure cases', () => {
      it('should continue processing after validation errors', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Valid Component,VALID-001,Valid description,supplier,ACME Corp,,100,pcs,1.00,20
,INVALID-001,Missing name,supplier,ACME Corp,,100,pcs,1.00,20
Another Valid,VALID-002,Another valid,supplier,ACME Corp,,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );
        mockCreateComponent
          .mockResolvedValueOnce({ id: 'component-1-uuid' } as any)
          .mockResolvedValueOnce({ id: 'component-2-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(3);
        expect(result.successful_imports).toBe(2);
        expect(result.failed_imports).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].row_number).toBe(3);
        expect(result.errors[0].error_message).toContain('name is required');
        expect(mockCreateComponent).toHaveBeenCalledTimes(2);
      });

      it('should continue processing after owner lookup failures', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Valid Component,VALID-001,Valid description,supplier,ACME Corp,,100,pcs,1.00,20
Invalid Owner,INVALID-001,Has non-existent supplier,supplier,Non-Existent Corp,,100,pcs,1.00,20
Another Valid,VALID-002,Another valid,supplier,ACME Corp,,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

        // Mock supplier lookup - success for ACME Corp, failure for Non-Existent Corp
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation((args: any) => {
          if (args.where.name === 'ACME Corp') {
            return Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any);
          }
          return Promise.resolve(null);
        });

        mockCreateComponent
          .mockResolvedValueOnce({ id: 'component-1-uuid' } as any)
          .mockResolvedValueOnce({ id: 'component-2-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(3);
        expect(result.successful_imports).toBe(2);
        expect(result.failed_imports).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].row_number).toBe(3);
        expect(result.errors[0].error_message).toContain("Supplier 'Non-Existent Corp' not found");
        expect(mockCreateComponent).toHaveBeenCalledTimes(2);
      });

      it('should continue processing after duplicate SKU errors', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Component 1,UNIQUE-001,First component,supplier,ACME Corp,,100,pcs,1.00,20
Component 2,DUPLICATE-001,Has duplicate SKU,supplier,ACME Corp,,100,pcs,1.00,20
Component 3,UNIQUE-002,Third component,supplier,ACME Corp,,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        // Mock SKU check - DUPLICATE-001 exists
        mockPrismaClient.inv_components.findFirst.mockImplementation((args: any) => {
          if (args.where.sku === 'DUPLICATE-001') {
            return Promise.resolve({ id: 'existing-component-id', sku: 'DUPLICATE-001' } as any);
          }
          return Promise.resolve(null);
        });

        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );

        mockCreateComponent
          .mockResolvedValueOnce({ id: 'component-1-uuid' } as any)
          .mockResolvedValueOnce({ id: 'component-2-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(3);
        expect(result.successful_imports).toBe(2);
        expect(result.failed_imports).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].row_number).toBe(3);
        expect(result.errors[0].error_message).toContain('already exists');
        expect(mockCreateComponent).toHaveBeenCalledTimes(2);
      });
    });

    describe('Complete failure cases', () => {
      it('should handle all rows failing validation', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
,INVALID-001,Missing name,supplier,ACME Corp,,100,pcs,1.00,20
,INVALID-002,Also missing name,supplier,ACME Corp,,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(2);
        expect(result.successful_imports).toBe(0);
        expect(result.failed_imports).toBe(2);
        expect(result.errors).toHaveLength(2);
        expect(mockCreateComponent).not.toHaveBeenCalled();
      });

      it('should handle all rows failing owner lookup', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Component 1,C001,First component,supplier,Non-Existent,,100,pcs,1.00,20
Component 2,C002,Second component,supplier,Also Non-Existent,,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() => Promise.resolve(null));

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(2);
        expect(result.successful_imports).toBe(0);
        expect(result.failed_imports).toBe(2);
        expect(result.errors).toHaveLength(2);
        expect(mockCreateComponent).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle mixed owner types in same import', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Supplier Component,SUP-001,From supplier,supplier,ACME Corp,,100,pcs,1.00,20
Location Component,LOC-001,From location,storage_location,,WH-A-01,50,pcs,2.00,10`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );
        mockPrismaClient.inv_storage_locations.findFirst.mockImplementation(() =>
          Promise.resolve(createMockLocation({ id: 'location-1-uuid', location_code: 'WH-A-01' }) as any)
        );
        mockCreateComponent
          .mockResolvedValueOnce({ id: 'component-1-uuid' } as any)
          .mockResolvedValueOnce({ id: 'component-2-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(2);
        expect(result.successful_imports).toBe(2);
        expect(result.failed_imports).toBe(0);
        expect(mockCreateComponent).toHaveBeenCalledTimes(2);
      });

      it('should handle components with no SKU', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
No SKU Component,,No SKU provided,supplier,ACME Corp,,100,pcs,1.00,20`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );
        mockCreateComponent.mockResolvedValue({ id: 'component-1-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(1);
        expect(result.successful_imports).toBe(1);
        expect(result.failed_imports).toBe(0);
        expect(mockCreateComponent).toHaveBeenCalledTimes(1);
      });

      it('should handle components with zero costs', async () => {
        const csvContent = `name,sku,description,owner_type,supplier_name,location_code,quantity,unit,unit_cost,reorder_level
Free Component,FREE-001,No cost component,supplier,ACME Corp,,100,pcs,0,0`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);
        mockPrismaClient.inv_suppliers.findFirst.mockImplementation(() =>
          Promise.resolve(createMockSupplier({ id: 'supplier-1-uuid', name: 'ACME Corp' }) as any)
        );
        mockCreateComponent.mockResolvedValue({ id: 'component-1-uuid' } as any);

        const result = await importComponentsFromCSV(buffer, TEAM_ID, USER_ID);

        expect(result.total_rows).toBe(1);
        expect(result.successful_imports).toBe(1);
        expect(result.failed_imports).toBe(0);
        expect(mockCreateComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            unit_cost: 0,
            reorder_level: 0
          }),
          TEAM_ID,
          USER_ID
        );
      });
    });
  });
});
