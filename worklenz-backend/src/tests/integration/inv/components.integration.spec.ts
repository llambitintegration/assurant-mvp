/**
 * Integration Tests for Inventory Components API
 * Tests actual HTTP endpoints with real database connection
 */

import {
  setupIntegrationTest,
  teardownIntegrationTest,
  cleanAfterEach
} from './setup';
import {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
  unauthenticatedRequest,
  expectSuccess,
  expectSuccessWithData,
  expectError,
  expectUnauthorized,
  expectBadRequest,
  expectNotFound,
  expectPaginatedList,
  expectListWithItems,
  expectEmptyList,
  validateComponentStructure,
  extractCreatedId,
  TestSession
} from './helpers';
import {
  createSupplier,
  createLocation,
  createComponent,
  createComponents,
  createLowStockComponents
} from './fixtures';

describe('Inventory Components API - Integration Tests', () => {
  let testSession: TestSession;
  let teamId: string;
  let userId: string;
  let supplierId: string;
  let locationId: string;

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

    // Create test supplier and location for component tests
    const supplier = await createSupplier({
      name: 'Test Supplier',
      teamId,
      userId
    });
    supplierId = supplier.id;

    const location = await createLocation({
      location_code: 'TEST-LOC',
      name: 'Test Location',
      teamId,
      userId
    });
    locationId = location.id;
  });

  // Cleanup after each test
  afterEach(async () => {
    await cleanAfterEach(teamId);

    // Recreate supplier and location for next test
    const supplier = await createSupplier({
      name: 'Test Supplier',
      teamId,
      userId
    });
    supplierId = supplier.id;

    const location = await createLocation({
      location_code: 'TEST-LOC',
      name: 'Test Location',
      teamId,
      userId
    });
    locationId = location.id;
  });

  // Teardown after all tests
  afterAll(async () => {
    await teardownIntegrationTest(teamId);
  });

  // ============================================================================
  // POST /api/v1/inv/components - Create Component
  // ============================================================================

  describe('POST /api/v1/inv/components', () => {
    it('should create a component with supplier ownership', async () => {
      const componentData = {
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        description: 'Test component description',
        category: 'Electronics',
        owner_type: 'supplier',
        supplier_id: supplierId,
        quantity: 100,
        unit: 'pcs',
        unit_cost: 9.99,
        reorder_level: 10,
        reorder_quantity: 50
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateComponentStructure(data);
      expect(data.name).toBe(componentData.name);
      expect(data.sku).toBe(componentData.sku);
      expect(data.owner_type).toBe('supplier');
      expect(data.supplier_id).toBe(supplierId);
      expect(data.quantity).toBe(100);
    });

    it('should create a component with storage location ownership', async () => {
      const componentData = {
        name: 'Location Component',
        sku: 'LOC-SKU-001',
        owner_type: 'storage_location',
        storage_location_id: locationId,
        quantity: 50,
        unit: 'pcs'
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.owner_type).toBe('storage_location');
      expect(data.storage_location_id).toBe(locationId);
    });

    it('should fail to create component without authentication', async () => {
      const componentData = {
        name: 'Unauthorized Component',
        owner_type: 'supplier',
        supplier_id: supplierId
      };

      const response = await unauthenticatedRequest('post', '/api/v1/inv/components')
        .send(componentData);

      expectUnauthorized(response);
    });

    it('should fail to create component without required name', async () => {
      const componentData = {
        sku: 'NO-NAME-SKU',
        owner_type: 'supplier',
        supplier_id: supplierId
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectBadRequest(response);
    });

    it('should fail to create component without owner_type', async () => {
      const componentData = {
        name: 'Missing Owner Type',
        sku: 'MISSING-OWNER'
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectBadRequest(response);
    });

    it('should fail to create component with invalid owner reference', async () => {
      const componentData = {
        name: 'Invalid Owner',
        owner_type: 'supplier',
        supplier_id: '00000000-0000-0000-0000-000000000000' // Non-existent supplier
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectError(response, 400);
    });

    it('should handle optional fields correctly', async () => {
      const componentData = {
        name: 'Minimal Component',
        owner_type: 'supplier',
        supplier_id: supplierId
      };

      const response = await postRequest('/api/v1/inv/components', testSession, componentData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.quantity).toBe(0); // Default quantity
    });
  });

  // ============================================================================
  // GET /api/v1/inv/components - List Components
  // ============================================================================

  describe('GET /api/v1/inv/components', () => {
    beforeEach(async () => {
      // Create test components
      await createComponents(5, teamId, userId, supplierId, 'List Test Component');
    });

    it('should list all components for the team', async () => {
      const response = await getRequest('/api/v1/inv/components', testSession);

      const result = expectPaginatedList(response, 5);
      expect(result.data.length).toBeGreaterThanOrEqual(5);
      result.data.forEach(validateComponentStructure);
    });

    it('should support pagination with limit and offset', async () => {
      const response = await getRequest('/api/v1/inv/components?limit=2&offset=0', testSession);

      const result = expectPaginatedList(response);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should filter components by category', async () => {
      await createComponent({
        name: 'Electronics Component',
        category: 'Electronics',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/components?category=Electronics', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((component: any) => {
        expect(component.category).toBe('Electronics');
      });
    });

    it('should filter components by supplier', async () => {
      const response = await getRequest(`/api/v1/inv/components?supplier_id=${supplierId}`, testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((component: any) => {
        expect(component.supplier_id).toBe(supplierId);
      });
    });

    it('should filter components by storage location', async () => {
      await createComponent({
        name: 'Location Component',
        owner_type: 'storage_location',
        storage_location_id: locationId,
        teamId,
        userId
      });

      const response = await getRequest(`/api/v1/inv/components?storage_location_id=${locationId}`, testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((component: any) => {
        expect(component.storage_location_id).toBe(locationId);
      });
    });

    it('should not show components from other teams', async () => {
      // All components belong to current team
      const response = await getRequest('/api/v1/inv/components', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((component: any) => {
        expect(component.team_id).toBe(teamId);
      });
    });
  });

  // ============================================================================
  // GET /api/v1/inv/components/search - Search Components
  // ============================================================================

  describe('GET /api/v1/inv/components/search', () => {
    beforeEach(async () => {
      await createComponent({
        name: 'Arduino Uno',
        sku: 'ARD-UNO-001',
        description: 'Microcontroller board',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });

      await createComponent({
        name: 'Raspberry Pi 4',
        sku: 'RPI-4-001',
        description: 'Single board computer',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
    });

    it('should search components by name', async () => {
      const response = await getRequest('/api/v1/inv/components/search?q=Arduino', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].name).toContain('Arduino');
    });

    it('should search components by SKU', async () => {
      const response = await getRequest('/api/v1/inv/components/search?q=ARD-UNO', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].sku).toContain('ARD-UNO');
    });

    it('should search components by description', async () => {
      const response = await getRequest('/api/v1/inv/components/search?q=Microcontroller', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].description).toContain('Microcontroller');
    });

    it('should return empty results for non-matching search', async () => {
      const response = await getRequest('/api/v1/inv/components/search?q=NonExistentComponent', testSession);

      expectEmptyList(response);
    });
  });

  // ============================================================================
  // GET /api/v1/inv/components/low-stock - Get Low Stock Components
  // ============================================================================

  describe('GET /api/v1/inv/components/low-stock', () => {
    beforeEach(async () => {
      // Create components with low stock
      await createLowStockComponents(teamId, userId, supplierId);

      // Create components with sufficient stock
      await createComponent({
        name: 'Sufficient Stock Component',
        quantity: 100,
        reorder_level: 10,
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
    });

    it('should return only low stock components', async () => {
      const response = await getRequest('/api/v1/inv/components/low-stock', testSession);

      const items = expectListWithItems(response, 2);
      items.forEach((component: any) => {
        expect(component.quantity).toBeLessThanOrEqual(component.reorder_level);
      });
    });

    it('should include components with zero quantity', async () => {
      const response = await getRequest('/api/v1/inv/components/low-stock', testSession);

      const items = expectListWithItems(response);
      const zeroQuantity = items.find((c: any) => c.quantity === 0);
      expect(zeroQuantity).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/v1/inv/components/:id - Get Component by ID
  // ============================================================================

  describe('GET /api/v1/inv/components/:id', () => {
    let componentId: string;

    beforeEach(async () => {
      const component = await createComponent({
        name: 'Get By ID Test',
        sku: 'GET-ID-001',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
      componentId = component.id;
    });

    it('should get component by ID', async () => {
      const response = await getRequest(`/api/v1/inv/components/${componentId}`, testSession);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateComponentStructure(data);
      expect(data.id).toBe(componentId);
      expect(data.name).toBe('Get By ID Test');
    });

    it('should return 404 for non-existent component', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await getRequest(`/api/v1/inv/components/${fakeId}`, testSession);

      expectNotFound(response);
    });

    it('should include supplier information if owner_type is supplier', async () => {
      const response = await getRequest(`/api/v1/inv/components/${componentId}`, testSession);

      const data = expectSuccessWithData(response);
      expect(data.supplier_id).toBe(supplierId);
    });
  });

  // ============================================================================
  // PUT /api/v1/inv/components/:id - Update Component
  // ============================================================================

  describe('PUT /api/v1/inv/components/:id', () => {
    let componentId: string;

    beforeEach(async () => {
      const component = await createComponent({
        name: 'Update Test Component',
        sku: 'UPDATE-001',
        quantity: 50,
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
      componentId = component.id;
    });

    it('should update component details', async () => {
      const updateData = {
        name: 'Updated Component Name',
        description: 'Updated description',
        unit_cost: 15.99
      };

      const response = await putRequest(`/api/v1/inv/components/${componentId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.name).toBe('Updated Component Name');
      expect(data.description).toBe('Updated description');
    });

    it('should update component quantity', async () => {
      const updateData = {
        quantity: 100
      };

      const response = await putRequest(`/api/v1/inv/components/${componentId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.quantity).toBe(100);
    });

    it('should not allow updating team_id', async () => {
      const updateData = {
        team_id: '00000000-0000-0000-0000-000000000000'
      };

      const response = await putRequest(`/api/v1/inv/components/${componentId}`, testSession, updateData);

      // Team ID should not be updatable
      // Either error or ignored
      const data = expectSuccessWithData(response);
      expect(data.team_id).toBe(teamId); // Should remain unchanged
    });

    it('should return 404 when updating non-existent component', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = { name: 'Updated' };

      const response = await putRequest(`/api/v1/inv/components/${fakeId}`, testSession, updateData);

      expectNotFound(response);
    });
  });

  // ============================================================================
  // DELETE /api/v1/inv/components/:id - Delete Component (Soft Delete)
  // ============================================================================

  describe('DELETE /api/v1/inv/components/:id', () => {
    let componentId: string;

    beforeEach(async () => {
      const component = await createComponent({
        name: 'Delete Test Component',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
      componentId = component.id;
    });

    it('should soft delete a component', async () => {
      const response = await deleteRequest(`/api/v1/inv/components/${componentId}`, testSession);

      expectSuccess(response);

      // Verify component is soft deleted (is_active = false)
      const getResponse = await getRequest(`/api/v1/inv/components/${componentId}`, testSession);
      // Should either return 404 or component with is_active = false
      if (getResponse.status === 200) {
        const data = expectSuccessWithData(getResponse);
        expect(data.is_active).toBe(false);
      }
    });

    it('should return 404 when deleting non-existent component', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await deleteRequest(`/api/v1/inv/components/${fakeId}`, testSession);

      expectNotFound(response);
    });
  });

  // ============================================================================
  // POST /api/v1/inv/components/:id/qr - Generate QR Code
  // ============================================================================

  describe('POST /api/v1/inv/components/:id/qr', () => {
    let componentId: string;

    beforeEach(async () => {
      const component = await createComponent({
        name: 'QR Test Component',
        sku: 'QR-TEST-001',
        owner_type: 'supplier',
        supplier_id: supplierId,
        teamId,
        userId
      });
      componentId = component.id;
    });

    it('should generate QR code for component', async () => {
      const qrData = {
        barcode_type: 'QR_CODE'
      };

      const response = await postRequest(`/api/v1/inv/components/${componentId}/qr`, testSession, qrData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data).toHaveProperty('barcode_data');
      expect(data.barcode_type).toBe('QR_CODE');
    });

    it('should return 404 when generating QR for non-existent component', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const qrData = {
        barcode_type: 'QR_CODE'
      };

      const response = await postRequest(`/api/v1/inv/components/${fakeId}/qr`, testSession, qrData);

      expectNotFound(response);
    });
  });
});
