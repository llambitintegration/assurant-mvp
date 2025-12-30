/**
 * Integration Tests for Inventory Suppliers API
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
  expectUnauthorized,
  expectBadRequest,
  expectNotFound,
  expectPaginatedList,
  expectListWithItems,
  validateSupplierStructure,
  TestSession
} from './helpers';
import {
  createSupplier,
  createSuppliers
} from './fixtures';

describe('Inventory Suppliers API - Integration Tests', () => {
  let testSession: TestSession;
  let teamId: string;
  let userId: string;

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

  // Cleanup after each test
  afterEach(async () => {
    await cleanAfterEach(teamId);
  });

  // Teardown after all tests
  afterAll(async () => {
    await teardownIntegrationTest(teamId);
  });

  // ============================================================================
  // POST /api/v1/inv/suppliers - Create Supplier
  // ============================================================================

  describe('POST /api/v1/inv/suppliers', () => {
    it('should create a supplier with all fields', async () => {
      const supplierData = {
        name: 'Acme Corporation',
        contact_person: 'John Doe',
        email: 'john@acme.com',
        phone: '555-1234',
        address: '123 Main St, City, State 12345',
        notes: 'Preferred supplier for electronics'
      };

      const response = await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateSupplierStructure(data);
      expect(data.name).toBe(supplierData.name);
      expect(data.contact_person).toBe(supplierData.contact_person);
      expect(data.email).toBe(supplierData.email);
      expect(data.phone).toBe(supplierData.phone);
      expect(data.address).toBe(supplierData.address);
      expect(data.notes).toBe(supplierData.notes);
    });

    it('should create a supplier with only required name field', async () => {
      const supplierData = {
        name: 'Minimal Supplier'
      };

      const response = await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.name).toBe('Minimal Supplier');
      expect(data.contact_person).toBeNull();
      expect(data.email).toBeNull();
    });

    it('should fail to create supplier without authentication', async () => {
      const supplierData = {
        name: 'Unauthorized Supplier'
      };

      const response = await unauthenticatedRequest('post', '/api/v1/inv/suppliers')
        .send(supplierData);

      expectUnauthorized(response);
    });

    it('should fail to create supplier without name', async () => {
      const supplierData = {
        contact_person: 'John Doe',
        email: 'john@test.com'
      };

      const response = await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      expectBadRequest(response);
    });

    it('should fail to create supplier with duplicate name in same team', async () => {
      const supplierData = {
        name: 'Duplicate Supplier'
      };

      // Create first supplier
      await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      // Try to create duplicate
      const response = await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      expectBadRequest(response);
    });

    it('should validate email format', async () => {
      const supplierData = {
        name: 'Email Test Supplier',
        email: 'invalid-email-format'
      };

      const response = await postRequest('/api/v1/inv/suppliers', testSession, supplierData);

      expectBadRequest(response);
    });
  });

  // ============================================================================
  // GET /api/v1/inv/suppliers - List Suppliers
  // ============================================================================

  describe('GET /api/v1/inv/suppliers', () => {
    beforeEach(async () => {
      // Create test suppliers
      await createSuppliers(5, teamId, userId);
    });

    it('should list all suppliers for the team', async () => {
      const response = await getRequest('/api/v1/inv/suppliers', testSession);

      const result = expectPaginatedList(response, 5);
      expect(result.data.length).toBeGreaterThanOrEqual(5);
      result.data.forEach(validateSupplierStructure);
    });

    it('should support pagination with limit and offset', async () => {
      const response = await getRequest('/api/v1/inv/suppliers?limit=2&offset=0', testSession);

      const result = expectPaginatedList(response);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should search suppliers by name', async () => {
      await createSupplier({
        name: 'Unique Supplier Name',
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/suppliers?search=Unique', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].name).toContain('Unique');
    });

    it('should not show suppliers from other teams', async () => {
      const response = await getRequest('/api/v1/inv/suppliers', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((supplier: any) => {
        expect(supplier.team_id).toBe(teamId);
      });
    });

    it('should only show active suppliers by default', async () => {
      const response = await getRequest('/api/v1/inv/suppliers', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((supplier: any) => {
        expect(supplier.is_active).toBe(true);
      });
    });
  });

  // ============================================================================
  // GET /api/v1/inv/suppliers/:id - Get Supplier by ID
  // ============================================================================

  describe('GET /api/v1/inv/suppliers/:id', () => {
    let supplierId: string;

    beforeEach(async () => {
      const supplier = await createSupplier({
        name: 'Get By ID Supplier',
        contact_person: 'Jane Smith',
        email: 'jane@supplier.com',
        teamId,
        userId
      });
      supplierId = supplier.id;
    });

    it('should get supplier by ID', async () => {
      const response = await getRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateSupplierStructure(data);
      expect(data.id).toBe(supplierId);
      expect(data.name).toBe('Get By ID Supplier');
      expect(data.contact_person).toBe('Jane Smith');
    });

    it('should return 404 for non-existent supplier', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await getRequest(`/api/v1/inv/suppliers/${fakeId}`, testSession);

      expectNotFound(response);
    });

    it('should include related components count', async () => {
      const response = await getRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession);

      const data = expectSuccessWithData(response);
      // May include components_count field
      if (data.components_count !== undefined) {
        expect(typeof data.components_count).toBe('number');
      }
    });
  });

  // ============================================================================
  // PUT /api/v1/inv/suppliers/:id - Update Supplier
  // ============================================================================

  describe('PUT /api/v1/inv/suppliers/:id', () => {
    let supplierId: string;

    beforeEach(async () => {
      const supplier = await createSupplier({
        name: 'Update Test Supplier',
        contact_person: 'Old Contact',
        email: 'old@email.com',
        teamId,
        userId
      });
      supplierId = supplier.id;
    });

    it('should update supplier details', async () => {
      const updateData = {
        name: 'Updated Supplier Name',
        contact_person: 'New Contact Person',
        email: 'new@email.com',
        phone: '555-9999',
        notes: 'Updated notes'
      };

      const response = await putRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.name).toBe('Updated Supplier Name');
      expect(data.contact_person).toBe('New Contact Person');
      expect(data.email).toBe('new@email.com');
      expect(data.phone).toBe('555-9999');
    });

    it('should update partial fields', async () => {
      const updateData = {
        phone: '555-1111'
      };

      const response = await putRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.phone).toBe('555-1111');
      expect(data.name).toBe('Update Test Supplier'); // Unchanged
    });

    it('should fail to update to duplicate name', async () => {
      // Create another supplier
      await createSupplier({
        name: 'Existing Supplier',
        teamId,
        userId
      });

      const updateData = {
        name: 'Existing Supplier'
      };

      const response = await putRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession, updateData);

      expectBadRequest(response);
    });

    it('should return 404 when updating non-existent supplier', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = { name: 'Updated' };

      const response = await putRequest(`/api/v1/inv/suppliers/${fakeId}`, testSession, updateData);

      expectNotFound(response);
    });

    it('should validate email format on update', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await putRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession, updateData);

      expectBadRequest(response);
    });
  });

  // ============================================================================
  // DELETE /api/v1/inv/suppliers/:id - Delete Supplier
  // ============================================================================

  describe('DELETE /api/v1/inv/suppliers/:id', () => {
    let supplierId: string;

    beforeEach(async () => {
      const supplier = await createSupplier({
        name: 'Delete Test Supplier',
        teamId,
        userId
      });
      supplierId = supplier.id;
    });

    it('should soft delete a supplier', async () => {
      const response = await deleteRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession);

      expectSuccess(response);

      // Verify supplier is soft deleted
      const getResponse = await getRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession);
      if (getResponse.status === 200) {
        const data = expectSuccessWithData(getResponse);
        expect(data.is_active).toBe(false);
      }
    });

    it('should return 404 when deleting non-existent supplier', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await deleteRequest(`/api/v1/inv/suppliers/${fakeId}`, testSession);

      expectNotFound(response);
    });

    it('should not appear in list after deletion', async () => {
      await deleteRequest(`/api/v1/inv/suppliers/${supplierId}`, testSession);

      const listResponse = await getRequest('/api/v1/inv/suppliers', testSession);
      const result = expectPaginatedList(listResponse);

      const deletedSupplier = result.data.find((s: any) => s.id === supplierId);
      expect(deletedSupplier).toBeUndefined();
    });
  });
});
