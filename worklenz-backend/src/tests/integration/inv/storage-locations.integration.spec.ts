/**
 * Integration Tests for Inventory Storage Locations API
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
  validateLocationStructure,
  TestSession
} from './helpers';
import {
  createLocation,
  createLocations,
  createLocationHierarchy
} from './fixtures';

describe('Inventory Storage Locations API - Integration Tests', () => {
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
  // POST /api/v1/inv/locations - Create Storage Location
  // ============================================================================

  describe('POST /api/v1/inv/locations', () => {
    it('should create a storage location with all fields', async () => {
      const locationData = {
        location_code: 'WAREHOUSE-A',
        name: 'Warehouse A',
        description: 'Main warehouse facility'
      };

      const response = await postRequest('/api/v1/inv/locations', testSession, locationData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateLocationStructure(data);
      expect(data.location_code).toBe(locationData.location_code);
      expect(data.name).toBe(locationData.name);
      expect(data.description).toBe(locationData.description);
    });

    it('should create a location with only required fields', async () => {
      const locationData = {
        location_code: 'MIN-LOC',
        name: 'Minimal Location'
      };

      const response = await postRequest('/api/v1/inv/locations', testSession, locationData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.location_code).toBe('MIN-LOC');
      expect(data.name).toBe('Minimal Location');
    });

    it('should create a child location with parent reference', async () => {
      // Create parent first
      const parent = await createLocation({
        location_code: 'PARENT',
        name: 'Parent Location',
        teamId,
        userId
      });

      const childData = {
        location_code: 'PARENT-CHILD',
        name: 'Child Location',
        parent_location_id: parent.id
      };

      const response = await postRequest('/api/v1/inv/locations', testSession, childData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.parent_location_id).toBe(parent.id);
    });

    it('should fail to create location without authentication', async () => {
      const locationData = {
        location_code: 'UNAUTH',
        name: 'Unauthorized Location'
      };

      const response = await unauthenticatedRequest('post', '/api/v1/inv/locations')
        .send(locationData);

      expectUnauthorized(response);
    });

    it('should fail to create location without location_code', async () => {
      const locationData = {
        name: 'No Code Location'
      };

      const response = await postRequest('/api/v1/inv/locations', testSession, locationData);

      expectBadRequest(response);
    });

    it('should fail to create location without name', async () => {
      const locationData = {
        location_code: 'NO-NAME'
      };

      const response = await postRequest('/api/v1/inv/locations', testSession, locationData);

      expectBadRequest(response);
    });

    it('should fail to create location with duplicate location_code in same team', async () => {
      const locationData = {
        location_code: 'DUPLICATE',
        name: 'Duplicate Location'
      };

      await postRequest('/api/v1/inv/locations', testSession, locationData);
      const response = await postRequest('/api/v1/inv/locations', testSession, locationData);

      expectBadRequest(response);
    });

    it('should prevent circular parent references', async () => {
      // Create parent
      const parent = await createLocation({
        location_code: 'PARENT-CIRC',
        name: 'Parent',
        teamId,
        userId
      });

      // Create child
      const child = await createLocation({
        location_code: 'CHILD-CIRC',
        name: 'Child',
        parent_location_id: parent.id,
        teamId,
        userId
      });

      // Try to update parent to be child of child (circular reference)
      const updateData = {
        parent_location_id: child.id
      };

      const response = await putRequest(`/api/v1/inv/locations/${parent.id}`, testSession, updateData);

      expectBadRequest(response);
    });
  });

  // ============================================================================
  // GET /api/v1/inv/locations - List Storage Locations
  // ============================================================================

  describe('GET /api/v1/inv/locations', () => {
    beforeEach(async () => {
      await createLocations(5, teamId, userId);
    });

    it('should list all locations for the team', async () => {
      const response = await getRequest('/api/v1/inv/locations', testSession);

      const result = expectPaginatedList(response, 5);
      expect(result.data.length).toBeGreaterThanOrEqual(5);
      result.data.forEach(validateLocationStructure);
    });

    it('should support pagination', async () => {
      const response = await getRequest('/api/v1/inv/locations?limit=2&offset=0', testSession);

      const result = expectPaginatedList(response);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should search locations by name', async () => {
      await createLocation({
        location_code: 'UNIQUE-SEARCH',
        name: 'Unique Location Name',
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/locations?search=Unique', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].name).toContain('Unique');
    });

    it('should search locations by location_code', async () => {
      await createLocation({
        location_code: 'SEARCH-CODE',
        name: 'Searchable Location',
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/locations?search=SEARCH-CODE', testSession);

      const items = expectListWithItems(response, 1);
      expect(items[0].location_code).toBe('SEARCH-CODE');
    });

    it('should not show locations from other teams', async () => {
      const response = await getRequest('/api/v1/inv/locations', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((location: any) => {
        expect(location.team_id).toBe(teamId);
      });
    });

    it('should handle hierarchical locations', async () => {
      await createLocationHierarchy(teamId, userId);

      const response = await getRequest('/api/v1/inv/locations', testSession);

      const result = expectPaginatedList(response);
      const parentLocation = result.data.find((l: any) => l.parent_location_id === null);
      const childLocations = result.data.filter((l: any) => l.parent_location_id !== null);

      expect(parentLocation).toBeDefined();
      expect(childLocations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // GET /api/v1/inv/locations/:id - Get Location by ID
  // ============================================================================

  describe('GET /api/v1/inv/locations/:id', () => {
    let locationId: string;

    beforeEach(async () => {
      const location = await createLocation({
        location_code: 'GET-ID',
        name: 'Get By ID Location',
        description: 'Test location for get by ID',
        teamId,
        userId
      });
      locationId = location.id;
    });

    it('should get location by ID', async () => {
      const response = await getRequest(`/api/v1/inv/locations/${locationId}`, testSession);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateLocationStructure(data);
      expect(data.id).toBe(locationId);
      expect(data.location_code).toBe('GET-ID');
    });

    it('should return 404 for non-existent location', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await getRequest(`/api/v1/inv/locations/${fakeId}`, testSession);

      expectNotFound(response);
    });

    it('should include parent location information if exists', async () => {
      const { parent, children } = await createLocationHierarchy(teamId, userId);

      const response = await getRequest(`/api/v1/inv/locations/${children[0].id}`, testSession);

      const data = expectSuccessWithData(response);
      expect(data.parent_location_id).toBe(parent.id);
    });

    it('should include child locations count if applicable', async () => {
      const { parent } = await createLocationHierarchy(teamId, userId);

      const response = await getRequest(`/api/v1/inv/locations/${parent.id}`, testSession);

      const data = expectSuccessWithData(response);
      // May include child_count or child_locations
      if (data.child_count !== undefined) {
        expect(data.child_count).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // PUT /api/v1/inv/locations/:id - Update Location
  // ============================================================================

  describe('PUT /api/v1/inv/locations/:id', () => {
    let locationId: string;

    beforeEach(async () => {
      const location = await createLocation({
        location_code: 'UPDATE',
        name: 'Update Test Location',
        description: 'Original description',
        teamId,
        userId
      });
      locationId = location.id;
    });

    it('should update location details', async () => {
      const updateData = {
        name: 'Updated Location Name',
        description: 'Updated description'
      };

      const response = await putRequest(`/api/v1/inv/locations/${locationId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.name).toBe('Updated Location Name');
      expect(data.description).toBe('Updated description');
    });

    it('should update location_code', async () => {
      const updateData = {
        location_code: 'NEW-CODE'
      };

      const response = await putRequest(`/api/v1/inv/locations/${locationId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.location_code).toBe('NEW-CODE');
    });

    it('should update parent location', async () => {
      const newParent = await createLocation({
        location_code: 'NEW-PARENT',
        name: 'New Parent',
        teamId,
        userId
      });

      const updateData = {
        parent_location_id: newParent.id
      };

      const response = await putRequest(`/api/v1/inv/locations/${locationId}`, testSession, updateData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.parent_location_id).toBe(newParent.id);
    });

    it('should fail to update to duplicate location_code', async () => {
      await createLocation({
        location_code: 'EXISTING',
        name: 'Existing Location',
        teamId,
        userId
      });

      const updateData = {
        location_code: 'EXISTING'
      };

      const response = await putRequest(`/api/v1/inv/locations/${locationId}`, testSession, updateData);

      expectBadRequest(response);
    });

    it('should return 404 when updating non-existent location', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = { name: 'Updated' };

      const response = await putRequest(`/api/v1/inv/locations/${fakeId}`, testSession, updateData);

      expectNotFound(response);
    });

    it('should prevent creating circular parent reference on update', async () => {
      const { parent, children } = await createLocationHierarchy(teamId, userId);

      // Try to make parent a child of its own child
      const updateData = {
        parent_location_id: children[0].id
      };

      const response = await putRequest(`/api/v1/inv/locations/${parent.id}`, testSession, updateData);

      expectBadRequest(response);
    });
  });

  // ============================================================================
  // DELETE /api/v1/inv/locations/:id - Delete Location
  // ============================================================================

  describe('DELETE /api/v1/inv/locations/:id', () => {
    let locationId: string;

    beforeEach(async () => {
      const location = await createLocation({
        location_code: 'DELETE',
        name: 'Delete Test Location',
        teamId,
        userId
      });
      locationId = location.id;
    });

    it('should soft delete a location', async () => {
      const response = await deleteRequest(`/api/v1/inv/locations/${locationId}`, testSession);

      expectSuccess(response);

      // Verify location is soft deleted
      const getResponse = await getRequest(`/api/v1/inv/locations/${locationId}`, testSession);
      if (getResponse.status === 200) {
        const data = expectSuccessWithData(getResponse);
        expect(data.is_active).toBe(false);
      }
    });

    it('should return 404 when deleting non-existent location', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await deleteRequest(`/api/v1/inv/locations/${fakeId}`, testSession);

      expectNotFound(response);
    });

    it('should cascade delete child locations', async () => {
      const { parent, children } = await createLocationHierarchy(teamId, userId);

      // Delete parent
      await deleteRequest(`/api/v1/inv/locations/${parent.id}`, testSession);

      // Check child locations are also deleted
      for (const child of children) {
        const childResponse = await getRequest(`/api/v1/inv/locations/${child.id}`, testSession);
        // Should be deleted (404) or inactive
        if (childResponse.status === 200) {
          const data = expectSuccessWithData(childResponse);
          expect(data.is_active).toBe(false);
        }
      }
    });

    it('should not appear in list after deletion', async () => {
      await deleteRequest(`/api/v1/inv/locations/${locationId}`, testSession);

      const listResponse = await getRequest('/api/v1/inv/locations', testSession);
      const result = expectPaginatedList(listResponse);

      const deletedLocation = result.data.find((l: any) => l.id === locationId);
      expect(deletedLocation).toBeUndefined();
    });
  });
});
