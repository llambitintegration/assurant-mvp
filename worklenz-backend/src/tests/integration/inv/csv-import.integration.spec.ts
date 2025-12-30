/**
 * Integration Tests for Inventory CSV Import API
 * Tests actual HTTP endpoints with real database connection
 */

import {
  setupIntegrationTest,
  teardownIntegrationTest,
  cleanAfterEach,
  getPrismaClient
} from './setup';
import {
  uploadRequest,
  unauthenticatedRequest,
  expectSuccess,
  expectSuccessWithData,
  expectUnauthorized,
  expectBadRequest,
  TestSession
} from './helpers';
import {
  createSupplier,
  generateValidCSV,
  generateInvalidCSV,
  generateCSVWithMissingFields
} from './fixtures';

describe('Inventory CSV Import API - Integration Tests', () => {
  let testSession: TestSession;
  let teamId: string;
  let userId: string;
  let supplierId: string;

  // Setup before all tests
  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    teamId = setup.teamId;
    userId = setup.userId;

    testSession = {
      teamId,
      userId,
      email: 'test@example.com',
      teamName: 'Test Team'
    };
  });

  // Setup before each test
  beforeEach(async () => {
    // Create test supplier for CSV imports
    const supplier = await createSupplier({
      name: 'CSV Import Supplier',
      teamId,
      userId
    });
    supplierId = supplier.id;
  });

  // Cleanup after each test
  afterEach(async () => {
    await cleanAfterEach(teamId);
  });

  // Teardown after all tests
  afterAll(async () => {
    await teardownIntegrationTest(teamId);
  });

  // ============================================================================
  // POST /api/v1/inv/csv/import - CSV Import
  // ============================================================================

  describe('POST /api/v1/inv/csv/import', () => {
    it('should import valid CSV file successfully', async () => {
      const csvContent = generateValidCSV();

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      expectSuccess(response);
      const data = expectSuccessWithData(response);

      expect(data).toHaveProperty('imported_count');
      expect(data.imported_count).toBeGreaterThan(0);
      expect(data).toHaveProperty('failed_count');
      expect(data.failed_count).toBe(0);

      // Verify components were created in database
      const prisma = getPrismaClient();
      const components = await prisma.inv_components.findMany({
        where: {
          team_id: teamId,
          supplier_id: supplierId
        }
      });

      expect(components.length).toBe(3); // 3 rows in valid CSV
    });

    it('should import components with correct data', async () => {
      const csvContent = generateValidCSV();

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      expectSuccess(response);

      // Verify component details
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findFirst({
        where: {
          team_id: teamId,
          sku: 'SKU-001'
        }
      });

      expect(component).toBeDefined();
      expect(component?.name).toBe('Component A');
      expect(component?.description).toBe('Description A');
      expect(component?.category).toBe('Electronics');
      expect(component?.quantity).toBe(100);
      expect(component?.unit).toBe('pcs');
      expect(parseFloat(component!.unit_cost as any)).toBe(9.99);
      expect(component?.reorder_level).toBe(10);
      expect(component?.reorder_quantity).toBe(50);
    });

    it('should handle CSV with partial failures', async () => {
      const csvContent = generateInvalidCSV();

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'invalid.csv',
          contentType: 'text/csv'
        });

      // Should still return success but with errors
      const data = expectSuccessWithData(response);

      expect(data).toHaveProperty('imported_count');
      expect(data).toHaveProperty('failed_count');
      expect(data).toHaveProperty('errors');

      // Some rows should succeed, some should fail
      expect(data.imported_count).toBeGreaterThan(0);
      expect(data.failed_count).toBeGreaterThan(0);

      // Errors should be reported
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.errors.length).toBeGreaterThan(0);

      data.errors.forEach((error: any) => {
        expect(error).toHaveProperty('row');
        expect(error).toHaveProperty('message');
      });
    });

    it('should fail without authentication', async () => {
      const csvContent = generateValidCSV();

      const response = await unauthenticatedRequest('post', '/api/v1/inv/csv/import')
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      expectUnauthorized(response);
    });

    it('should fail without file attachment', async () => {
      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId);

      expectBadRequest(response);
    });

    it('should fail without supplier_id', async () => {
      const csvContent = generateValidCSV();

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      expectBadRequest(response);
    });

    it('should fail with invalid supplier_id', async () => {
      const csvContent = generateValidCSV();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', fakeId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      expectBadRequest(response);
    });

    it('should fail with empty CSV file', async () => {
      const emptyCSV = '';

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(emptyCSV), {
          filename: 'empty.csv',
          contentType: 'text/csv'
        });

      expectBadRequest(response);
    });

    it('should fail with CSV header only', async () => {
      const headerOnlyCSV = 'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity';

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(headerOnlyCSV), {
          filename: 'header-only.csv',
          contentType: 'text/csv'
        });

      expectBadRequest(response);
    });

    it('should fail with missing required fields in CSV', async () => {
      const csvContent = generateCSVWithMissingFields();

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'missing-fields.csv',
          contentType: 'text/csv'
        });

      expectBadRequest(response);
    });

    it('should validate data types during import', async () => {
      const invalidTypesCSV = [
        'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity',
        'Component,SKU-001,Description,Electronics,invalid,pcs,9.99,10,50' // Invalid quantity
      ].join('\n');

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(invalidTypesCSV), {
          filename: 'invalid-types.csv',
          contentType: 'text/csv'
        });

      const data = expectSuccessWithData(response);
      expect(data.failed_count).toBeGreaterThan(0);
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it('should handle duplicate SKUs in CSV', async () => {
      const duplicateCSV = [
        'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity',
        'Component A,DUPLICATE,Description A,Electronics,100,pcs,9.99,10,50',
        'Component B,DUPLICATE,Description B,Electronics,50,pcs,15.50,5,25' // Same SKU
      ].join('\n');

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(duplicateCSV), {
          filename: 'duplicate.csv',
          contentType: 'text/csv'
        });

      const data = expectSuccessWithData(response);

      // Either first one succeeds and second fails, or both fail
      expect(data.failed_count).toBeGreaterThan(0);
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it('should handle large CSV files', async () => {
      // Generate CSV with 100 rows
      const header = 'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity';
      const rows = [];

      for (let i = 1; i <= 100; i++) {
        rows.push(`Component ${i},SKU-${i.toString().padStart(3, '0')},Description ${i},Electronics,${i * 10},pcs,${9.99 + i},10,50`);
      }

      const largeCSV = [header, ...rows].join('\n');

      const startTime = Date.now();
      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(largeCSV), {
          filename: 'large.csv',
          contentType: 'text/csv'
        });
      const endTime = Date.now();

      expectSuccess(response);
      const data = expectSuccessWithData(response);

      expect(data.imported_count).toBe(100);
      expect(data.failed_count).toBe(0);

      // Should complete in reasonable time (< 10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should preserve data integrity on partial import failure', async () => {
      const mixedCSV = [
        'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity',
        'Valid Component,VALID-001,Description,Electronics,100,pcs,9.99,10,50',
        ',INVALID-001,Missing Name,Electronics,50,pcs,15.50,5,25' // Invalid - missing name
      ].join('\n');

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(mixedCSV), {
          filename: 'mixed.csv',
          contentType: 'text/csv'
        });

      const data = expectSuccessWithData(response);

      // Valid component should be imported
      expect(data.imported_count).toBe(1);

      // Verify valid component exists
      const prisma = getPrismaClient();
      const validComponent = await prisma.inv_components.findFirst({
        where: {
          team_id: teamId,
          sku: 'VALID-001'
        }
      });
      expect(validComponent).toBeDefined();

      // Invalid component should not exist
      const invalidComponent = await prisma.inv_components.findFirst({
        where: {
          team_id: teamId,
          sku: 'INVALID-001'
        }
      });
      expect(invalidComponent).toBeNull();
    });

    it('should handle CSV with special characters', async () => {
      const specialCharsCSV = [
        'name,sku,description,category,quantity,unit,unit_cost,reorder_level,reorder_quantity',
        '"Component, with comma",SKU-001,"Description with ""quotes""",Electronics,100,pcs,9.99,10,50'
      ].join('\n');

      const response = await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(specialCharsCSV), {
          filename: 'special.csv',
          contentType: 'text/csv'
        });

      expectSuccess(response);
      const data = expectSuccessWithData(response);

      expect(data.imported_count).toBe(1);

      // Verify component was created correctly
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findFirst({
        where: {
          team_id: teamId,
          sku: 'SKU-001'
        }
      });

      expect(component?.name).toBe('Component, with comma');
      expect(component?.description).toContain('quotes');
    });

    it('should assign components to correct team and supplier', async () => {
      const csvContent = generateValidCSV();

      await uploadRequest('/api/v1/inv/csv/import', testSession)
        .field('supplier_id', supplierId)
        .attach('file', Buffer.from(csvContent), {
          filename: 'components.csv',
          contentType: 'text/csv'
        });

      // Verify all components belong to correct team and supplier
      const prisma = getPrismaClient();
      const components = await prisma.inv_components.findMany({
        where: { team_id: teamId }
      });

      components.forEach(component => {
        expect(component.team_id).toBe(teamId);
        expect(component.supplier_id).toBe(supplierId);
        expect(component.owner_type).toBe('supplier');
        expect(component.created_by).toBe(userId);
      });
    });
  });
});
