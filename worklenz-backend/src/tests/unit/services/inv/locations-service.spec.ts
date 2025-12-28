/**
 * Storage Locations Service Unit Tests
 * Comprehensive tests for location management with hierarchical support
 * Target: 90%+ coverage
 */

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_storage_locations: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  }
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/locations-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/location-fixtures');

import {
  createLocation,
  getLocationById,
  listLocations,
  updateLocation,
  deleteLocation,
  getLocationHierarchy,
  searchLocations
} from '../../../../services/inv/locations-service';
import prisma from '../../../../config/prisma';
import {
  createMockLocation,
  createRootLocation,
  createChildLocation,
  createLocationHierarchy,
  createSiblingLocations,
  createCircularReferenceLocations,
  createInactiveLocation,
  createComplexLocationTree
} from '../../../fixtures/inv/location-fixtures';

// Get reference to the mocked prisma client
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;

describe('Locations Service', () => {
  const mockTeamId = 'team-1-uuid';
  const mockUserId = 'user-1-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLocation', () => {
    it('should create a location successfully', async () => {
      const createData = {
        location_code: 'WH-001',
        name: 'Main Warehouse',
        description: 'Primary warehouse facility'
      };

      const mockLocation = createMockLocation({
        id: 'location-new-uuid',
        ...createData,
        team_id: mockTeamId,
        created_by: mockUserId
      });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);
      mockPrismaClient.inv_storage_locations.create.mockResolvedValue(mockLocation as any);

      const result = await createLocation(createData, mockTeamId, mockUserId);

      expect(result).toEqual(mockLocation);
      expect(mockPrismaClient.inv_storage_locations.create).toHaveBeenCalledWith({
        data: {
          location_code: createData.location_code,
          name: createData.name,
          description: createData.description,
          parent_location_id: null,
          team_id: mockTeamId,
          created_by: mockUserId,
          is_active: true
        }
      });
    });

    it('should create a child location with valid parent', async () => {
      const parentLocation = createRootLocation();
      const createData = {
        location_code: 'WH-001-A1',
        name: 'Aisle 1',
        parent_location_id: parentLocation.id
      };

      const mockLocation = createChildLocation(parentLocation.id, {
        id: 'location-child-uuid',
        ...createData
      });

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(parentLocation as any); // Parent exists
      mockPrismaClient.inv_storage_locations.create.mockResolvedValue(mockLocation as any);

      const result = await createLocation(createData, mockTeamId, mockUserId);

      expect(result).toEqual(mockLocation);
      expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledWith({
        where: {
          id: parentLocation.id,
          team_id: mockTeamId,
          is_active: true
        }
      });
    });

    it('should throw error when location_code is missing', async () => {
      const createData: any = {
        name: 'Test Location'
      };

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Location code is required');
    });

    it('should throw error when location_code is empty', async () => {
      const createData = {
        location_code: '   ',
        name: 'Test Location'
      };

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Location code is required');
    });

    it('should throw error when name is missing', async () => {
      const createData: any = {
        location_code: 'WH-001'
      };

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Location name is required');
    });

    it('should throw error when name is empty', async () => {
      const createData = {
        location_code: 'WH-001',
        name: '   '
      };

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Location name is required');
    });

    it('should throw error when duplicate location_code exists in same team', async () => {
      const createData = {
        location_code: 'WH-001',
        name: 'Main Warehouse'
      };

      const existingLocation = createMockLocation({
        location_code: 'WH-001',
        team_id: mockTeamId
      });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Location with this code already exists');
    });

    it('should throw error when parent location does not exist', async () => {
      const createData = {
        location_code: 'WH-001-A1',
        name: 'Aisle 1',
        parent_location_id: 'non-existent-uuid'
      };

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(null); // Parent not found

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Parent location not found');
    });

    it('should throw error when parent location belongs to different team', async () => {
      const createData = {
        location_code: 'WH-001-A1',
        name: 'Aisle 1',
        parent_location_id: 'parent-uuid'
      };

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(null); // Parent not in same team

      await expect(createLocation(createData, mockTeamId, mockUserId))
        .rejects.toThrow('Parent location not found');
    });
  });

  describe('getLocationById', () => {
    it('should return location by ID with parent and children', async () => {
      const mockLocation = createMockLocation({
        id: 'location-1-uuid',
        team_id: mockTeamId
      });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(mockLocation as any);

      const result = await getLocationById('location-1-uuid', mockTeamId);

      expect(result).toEqual(mockLocation);
      expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'location-1-uuid',
          team_id: mockTeamId
        },
        include: {
          parent_location: true,
          child_locations: {
            where: {
              is_active: true
            }
          }
        }
      });
    });

    it('should return null when location not found', async () => {
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

      const result = await getLocationById('non-existent-uuid', mockTeamId);

      expect(result).toBeNull();
    });

    it('should return null when location belongs to wrong team', async () => {
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

      const result = await getLocationById('location-1-uuid', 'wrong-team-uuid');

      expect(result).toBeNull();
      expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'location-1-uuid',
          team_id: 'wrong-team-uuid'
        },
        include: {
          parent_location: true,
          child_locations: {
            where: {
              is_active: true
            }
          }
        }
      });
    });
  });

  describe('listLocations', () => {
    it('should list locations with default pagination', async () => {
      const mockLocations = createSiblingLocations(null, 3);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(3);

      const result = await listLocations({}, mockTeamId);

      expect(result.data).toEqual(mockLocations);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by parent_location_id', async () => {
      const parentId = 'parent-uuid';
      const childLocations = createSiblingLocations(parentId, 2);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(childLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(2);

      const result = await listLocations({ parent_location_id: parentId }, mockTeamId);

      expect(result.data).toEqual(childLocations);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parent_location_id: parentId
          })
        })
      );
    });

    it('should filter by parent_location_id = null (root locations)', async () => {
      const rootLocations = createSiblingLocations(null, 2);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(rootLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(2);

      const result = await listLocations({ parent_location_id: null }, mockTeamId);

      expect(result.data).toEqual(rootLocations);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parent_location_id: null
          })
        })
      );
    });

    it('should search by location_code', async () => {
      const mockLocations = [createMockLocation({ location_code: 'WH-001' })];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(1);

      const result = await listLocations({ search: 'WH-001' }, mockTeamId);

      expect(result.data).toEqual(mockLocations);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { location_code: { contains: 'WH-001', mode: 'insensitive' } },
              { name: { contains: 'WH-001', mode: 'insensitive' } }
            ]
          })
        })
      );
    });

    it('should search by name', async () => {
      const mockLocations = [createMockLocation({ name: 'Main Warehouse' })];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(1);

      const result = await listLocations({ search: 'warehouse' }, mockTeamId);

      expect(result.data).toEqual(mockLocations);
    });

    it('should paginate results correctly', async () => {
      const mockLocations = createSiblingLocations(null, 5);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations.slice(5, 10) as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(25);

      const result = await listLocations({ page: 2, size: 5 }, mockTeamId);

      expect(result.page).toBe(2);
      expect(result.size).toBe(5);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(5);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });

    it('should filter by is_active', async () => {
      const inactiveLocations = [createInactiveLocation()];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(inactiveLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(1);

      const result = await listLocations({ is_active: false }, mockTeamId);

      expect(result.data).toEqual(inactiveLocations);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: false
          })
        })
      );
    });

    it('should default to active locations only', async () => {
      const activeLocations = createSiblingLocations(null, 2);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(activeLocations as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(2);

      await listLocations({}, mockTeamId);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
    });

    it('should return empty list when no locations found', async () => {
      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue([]);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(0);

      const result = await listLocations({}, mockTeamId);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });
      const updateData = {
        name: 'Updated Warehouse',
        description: 'Updated description'
      };

      const updatedLocation = { ...existingLocation, ...updateData };

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.update.mockResolvedValue(updatedLocation as any);

      const result = await updateLocation('location-1-uuid', updateData, mockTeamId, mockUserId);

      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
    });

    it('should throw error when location not found', async () => {
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

      await expect(updateLocation('non-existent-uuid', { name: 'Test' }, mockTeamId, mockUserId))
        .rejects.toThrow('Location not found');
    });

    it('should throw error when updating to duplicate location_code', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid', location_code: 'WH-001' });
      const duplicateLocation = createMockLocation({ id: 'location-2-uuid', location_code: 'WH-002' });

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(existingLocation as any) // Existing location
        .mockResolvedValueOnce(duplicateLocation as any); // Duplicate check

      await expect(updateLocation('location-1-uuid', { location_code: 'WH-002' }, mockTeamId, mockUserId))
        .rejects.toThrow('Location with this code already exists');
    });

    it('should allow updating to same location_code', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid', location_code: 'WH-001' });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.update.mockResolvedValue(existingLocation as any);

      await updateLocation('location-1-uuid', { location_code: 'WH-001', name: 'Updated' }, mockTeamId, mockUserId);

      // Should not check for duplicates when code hasn't changed
      expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should throw error when circular reference detected', async () => {
      const locations = createCircularReferenceLocations();
      const location1 = locations[0];
      const location2 = locations[1];

      // Mock the circular chain: location-1 -> location-2 -> location-1
      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(location1 as any) // Existing location
        .mockResolvedValueOnce(location2 as any) // Parent exists
        .mockResolvedValueOnce({ parent_location_id: location1.id } as any); // Walk up chain

      await expect(
        updateLocation(location1.id, { parent_location_id: location2.id }, mockTeamId, mockUserId)
      ).rejects.toThrow('Circular reference detected in location hierarchy');
    });

    it('should prevent setting location as its own parent', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);

      await expect(
        updateLocation('location-1-uuid', { parent_location_id: 'location-1-uuid' }, mockTeamId, mockUserId)
      ).rejects.toThrow('Circular reference detected in location hierarchy');
    });

    it('should throw error when new parent location not found', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(existingLocation as any) // Existing location
        .mockResolvedValueOnce(null); // Parent not found

      await expect(
        updateLocation('location-1-uuid', { parent_location_id: 'non-existent-uuid' }, mockTeamId, mockUserId)
      ).rejects.toThrow('Parent location not found');
    });

    it('should allow updating parent to null (make root location)', async () => {
      const existingLocation = createChildLocation('parent-uuid', { id: 'location-1-uuid' });
      const updatedLocation = { ...existingLocation, parent_location_id: null };

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.update.mockResolvedValue(updatedLocation as any);

      const result = await updateLocation('location-1-uuid', { parent_location_id: null }, mockTeamId, mockUserId);

      expect(result.parent_location_id).toBeNull();
    });

    it('should detect circular reference in deep hierarchy', async () => {
      const hierarchy = createLocationHierarchy();
      const warehouse = hierarchy[0];
      const aisle = hierarchy[1];
      const rack = hierarchy[2];
      const shelf = hierarchy[3];

      // Try to set warehouse parent to shelf (4 levels deep circular reference)
      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouse as any) // Existing location
        .mockResolvedValueOnce(shelf as any) // Parent exists
        .mockResolvedValueOnce({ parent_location_id: rack.id } as any) // Walk up: shelf -> rack
        .mockResolvedValueOnce({ parent_location_id: aisle.id } as any) // Walk up: rack -> aisle
        .mockResolvedValueOnce({ parent_location_id: warehouse.id } as any); // Walk up: aisle -> warehouse (circular!)

      await expect(
        updateLocation(warehouse.id, { parent_location_id: shelf.id }, mockTeamId, mockUserId)
      ).rejects.toThrow('Circular reference detected in location hierarchy');
    });
  });

  describe('deleteLocation', () => {
    it('should soft delete location successfully', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(0); // No active children
      mockPrismaClient.inv_storage_locations.update.mockResolvedValue({ ...existingLocation, is_active: false } as any);

      await deleteLocation('location-1-uuid', mockTeamId, mockUserId);

      expect(mockPrismaClient.inv_storage_locations.update).toHaveBeenCalledWith({
        where: { id: 'location-1-uuid' },
        data: {
          is_active: false,
          updated_at: expect.any(Date)
        }
      });
    });

    it('should throw error when location not found', async () => {
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

      await expect(deleteLocation('non-existent-uuid', mockTeamId, mockUserId))
        .rejects.toThrow('Location not found');
    });

    it('should throw error when location has active children', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(3); // Has 3 active children

      await expect(deleteLocation('location-1-uuid', mockTeamId, mockUserId))
        .rejects.toThrow('Cannot delete location with active child locations');
    });

    it('should allow deleting location with inactive children', async () => {
      const existingLocation = createMockLocation({ id: 'location-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(existingLocation as any);
      mockPrismaClient.inv_storage_locations.count.mockResolvedValue(0); // No active children
      mockPrismaClient.inv_storage_locations.update.mockResolvedValue({ ...existingLocation, is_active: false } as any);

      await deleteLocation('location-1-uuid', mockTeamId, mockUserId);

      expect(mockPrismaClient.inv_storage_locations.count).toHaveBeenCalledWith({
        where: {
          parent_location_id: 'location-1-uuid',
          team_id: mockTeamId,
          is_active: true
        }
      });
    });
  });

  describe('getLocationHierarchy', () => {
    it('should build hierarchical tree from root location', async () => {
      const hierarchy = createLocationHierarchy();
      const warehouse = hierarchy[0];
      const aisle = hierarchy[1];
      const rack = hierarchy[2];
      const shelf = hierarchy[3];

      // Mock the recursive calls - add 'name' field for service compatibility
      const warehouseWithName = { ...warehouse, name: warehouse.location_name };
      const aisleWithName = { ...aisle, name: aisle.location_name };
      const rackWithName = { ...rack, name: rack.location_name };
      const shelfWithName = { ...shelf, name: shelf.location_name };

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouseWithName as any) // Root validation
        .mockResolvedValueOnce(warehouseWithName as any) // Build tree for warehouse
        .mockResolvedValueOnce(aisleWithName as any) // Build tree for aisle
        .mockResolvedValueOnce(rackWithName as any) // Build tree for rack
        .mockResolvedValueOnce(shelfWithName as any); // Build tree for shelf

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce([aisleWithName] as any) // Warehouse children
        .mockResolvedValueOnce([rackWithName] as any) // Aisle children
        .mockResolvedValueOnce([shelfWithName] as any) // Rack children
        .mockResolvedValueOnce([] as any); // Shelf children (leaf node)

      const result = await getLocationHierarchy(warehouse.id, mockTeamId);

      expect(result.id).toBe(warehouse.id);
      expect(result.level).toBe(0);
      expect(result.path).toBe(warehouse.location_name);
      expect(result.child_locations).toHaveLength(1);
    });

    it('should throw error when root location not found', async () => {
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

      await expect(getLocationHierarchy('non-existent-uuid', mockTeamId))
        .rejects.toThrow('Root location not found');
    });

    it('should calculate correct depth levels', async () => {
      const hierarchy = createLocationHierarchy();
      const warehouse = hierarchy[0];
      const aisle = hierarchy[1];

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouse as any) // Root validation
        .mockResolvedValueOnce(warehouse as any) // Level 0
        .mockResolvedValueOnce(aisle as any); // Level 1

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce([aisle] as any)
        .mockResolvedValueOnce([] as any);

      const result = await getLocationHierarchy(warehouse.id, mockTeamId);

      expect(result.level).toBe(0);
      expect(result.child_locations![0].level).toBe(1);
    });

    it('should build correct hierarchical path', async () => {
      const hierarchy = createLocationHierarchy();
      const warehouse = { ...hierarchy[0], name: hierarchy[0].location_name };
      const aisle = { ...hierarchy[1], name: hierarchy[1].location_name };
      const rack = { ...hierarchy[2], name: hierarchy[2].location_name };

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(aisle as any)
        .mockResolvedValueOnce(rack as any);

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce([aisle] as any)
        .mockResolvedValueOnce([rack] as any)
        .mockResolvedValueOnce([] as any);

      const result = await getLocationHierarchy(warehouse.id, mockTeamId);

      expect(result.path).toBe(warehouse.location_name);
      expect(result.child_locations![0].path).toBe(`${warehouse.location_name} > ${aisle.location_name}`);
      expect(result.child_locations![0].child_locations![0].path).toBe(
        `${warehouse.location_name} > ${aisle.location_name} > ${rack.location_name}`
      );
    });

    it('should exclude soft-deleted locations from hierarchy', async () => {
      const warehouse = createRootLocation({ id: 'warehouse-uuid' });
      const activeAisle = createChildLocation(warehouse.id, { id: 'aisle-1-uuid' });

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(activeAisle as any);

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce([activeAisle] as any)
        .mockResolvedValueOnce([] as any);

      const result = await getLocationHierarchy(warehouse.id, mockTeamId);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
      expect(result.child_locations).toHaveLength(1);
    });

    it('should handle sibling locations correctly', async () => {
      const warehouse = createRootLocation({ id: 'warehouse-uuid' });
      const siblings = createSiblingLocations(warehouse.id, 3);

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(warehouse as any)
        .mockResolvedValueOnce(siblings[0] as any)
        .mockResolvedValueOnce(siblings[1] as any)
        .mockResolvedValueOnce(siblings[2] as any);

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce(siblings as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      const result = await getLocationHierarchy(warehouse.id, mockTeamId);

      expect(result.child_locations).toHaveLength(3);
      expect(result.child_locations![0].level).toBe(1);
      expect(result.child_locations![1].level).toBe(1);
      expect(result.child_locations![2].level).toBe(1);
    });

    it('should handle complex multi-level tree', async () => {
      const tree = createComplexLocationTree();
      const building = tree[0];
      const floor1 = tree[1];
      const floor2 = tree[2];
      const room101 = tree[3];

      mockPrismaClient.inv_storage_locations.findFirst
        .mockResolvedValueOnce(building as any)
        .mockResolvedValueOnce(building as any)
        .mockResolvedValueOnce(floor1 as any)
        .mockResolvedValueOnce(floor2 as any)
        .mockResolvedValueOnce(room101 as any);

      mockPrismaClient.inv_storage_locations.findMany
        .mockResolvedValueOnce([floor1, floor2] as any) // Building children
        .mockResolvedValueOnce([room101] as any) // Floor1 children
        .mockResolvedValueOnce([] as any) // Floor2 children
        .mockResolvedValueOnce([] as any); // Room101 children

      const result = await getLocationHierarchy(building.id, mockTeamId);

      expect(result.child_locations).toHaveLength(2);
      expect(result.child_locations![0].child_locations).toBeDefined();
    });
  });

  describe('searchLocations', () => {
    it('should search locations by location_code', async () => {
      const mockLocations = [createMockLocation({ location_code: 'WH-001' })];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      const result = await searchLocations('WH-001', mockTeamId, 10);

      expect(result).toEqual(mockLocations);
      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { location_code: { contains: 'WH-001', mode: 'insensitive' } },
              { name: { contains: 'WH-001', mode: 'insensitive' } }
            ]
          })
        })
      );
    });

    it('should search locations by name', async () => {
      const mockLocations = [createMockLocation({ name: 'Main Warehouse' })];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      const result = await searchLocations('warehouse', mockTeamId, 10);

      expect(result).toEqual(mockLocations);
    });

    it('should limit search results', async () => {
      const mockLocations = createSiblingLocations(null, 5);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations.slice(0, 3) as any);

      await searchLocations('LOC', mockTeamId, 3);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3
        })
      );
    });

    it('should return empty array for empty query', async () => {
      const result = await searchLocations('', mockTeamId, 10);

      expect(result).toEqual([]);
      expect(mockPrismaClient.inv_storage_locations.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace query', async () => {
      const result = await searchLocations('   ', mockTeamId, 10);

      expect(result).toEqual([]);
      expect(mockPrismaClient.inv_storage_locations.findMany).not.toHaveBeenCalled();
    });

    it('should only return active locations', async () => {
      const mockLocations = [createMockLocation()];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      await searchLocations('test', mockTeamId, 10);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
    });

    it('should respect team scoping', async () => {
      const mockLocations = [createMockLocation({ team_id: mockTeamId })];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      await searchLocations('test', mockTeamId, 10);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            team_id: mockTeamId
          })
        })
      );
    });

    it('should use default limit of 10', async () => {
      const mockLocations = createSiblingLocations(null, 10);

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      await searchLocations('test', mockTeamId);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });

    it('should include parent_location in results', async () => {
      const parentLocation = createRootLocation();
      const childLocation = createChildLocation(parentLocation.id);
      const mockLocations = [{ ...childLocation, parent_location: parentLocation }];

      mockPrismaClient.inv_storage_locations.findMany.mockResolvedValue(mockLocations as any);

      const result = await searchLocations('test', mockTeamId, 10);

      expect(mockPrismaClient.inv_storage_locations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            parent_location: true
          }
        })
      );
      expect(result[0]).toHaveProperty('parent_location');
    });
  });
});
