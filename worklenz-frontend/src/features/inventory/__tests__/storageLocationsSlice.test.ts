/**
 * Unit tests for Storage Locations Redux Slice
 */

import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import storageLocationsReducer, {
  fetchStorageLocations,
  fetchLocationHierarchy,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
  setIsActiveFilter,
  setParentLocationIdFilter,
  setSearchQuery,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  resetFilters,
} from '../storageLocations/storageLocationsSlice';
import { storageLocationsApiService } from '@/api/inventory/storage-locations.api.service';

// Mock the API service
vi.mock('@/api/inventory/storage-locations.api.service');

describe('storageLocationsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh store for each test
    store = configureStore({
      reducer: {
        inventoryStorageLocations: storageLocationsReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().inventoryStorageLocations;

      // Data
      expect(state.locations).toEqual([]);
      expect(state.hierarchyData).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Filters
      expect(state.isActiveFilter).toBe(true);
      expect(state.parentLocationIdFilter).toBeNull();
      expect(state.searchQuery).toBe('');

      // Pagination
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.totalPages).toBe(0);

      // UI State
      expect(state.isDrawerOpen).toBe(false);
      expect(state.selectedLocationId).toBeNull();
      expect(state.drawerMode).toBe('view');
    });
  });

  describe('Reducers', () => {
    describe('Filter Actions', () => {
      it('should set active filter and reset page', () => {
        store.dispatch(setPage(3));
        store.dispatch(setIsActiveFilter(false));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isActiveFilter).toBe(false);
        expect(state.page).toBe(1);
      });

      it('should set active filter to null', () => {
        store.dispatch(setIsActiveFilter(true));
        store.dispatch(setIsActiveFilter(null));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isActiveFilter).toBeNull();
      });

      it('should set parent location filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setParentLocationIdFilter('parent-123'));

        const state = store.getState().inventoryStorageLocations;
        expect(state.parentLocationIdFilter).toBe('parent-123');
        expect(state.page).toBe(1);
      });

      it('should clear parent location filter', () => {
        store.dispatch(setParentLocationIdFilter('parent-123'));
        store.dispatch(setParentLocationIdFilter(null));

        const state = store.getState().inventoryStorageLocations;
        expect(state.parentLocationIdFilter).toBeNull();
      });

      it('should set search query and reset page', () => {
        store.dispatch(setPage(3));
        store.dispatch(setSearchQuery('warehouse'));

        const state = store.getState().inventoryStorageLocations;
        expect(state.searchQuery).toBe('warehouse');
        expect(state.page).toBe(1);
      });

      it('should reset all filters to initial state', () => {
        store.dispatch(setSearchQuery('test'));
        store.dispatch(setIsActiveFilter(false));
        store.dispatch(setParentLocationIdFilter('parent-1'));
        store.dispatch(setPage(5));

        store.dispatch(resetFilters());

        const state = store.getState().inventoryStorageLocations;
        expect(state.searchQuery).toBe('');
        expect(state.isActiveFilter).toBe(true);
        expect(state.parentLocationIdFilter).toBeNull();
        expect(state.page).toBe(1);
      });
    });

    describe('Pagination Actions', () => {
      it('should update page number', () => {
        store.dispatch(setPage(5));

        const state = store.getState().inventoryStorageLocations;
        expect(state.page).toBe(5);
      });

      it('should update page size and reset page to 1', () => {
        store.dispatch(setPage(3));
        store.dispatch(setPageSize(50));

        const state = store.getState().inventoryStorageLocations;
        expect(state.pageSize).toBe(50);
        expect(state.page).toBe(1);
      });
    });

    describe('Drawer Actions', () => {
      it('should open drawer in create mode', () => {
        store.dispatch(openDrawer({ mode: 'create' }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('create');
        expect(state.selectedLocationId).toBeNull();
      });

      it('should open drawer in edit mode with location ID', () => {
        store.dispatch(openDrawer({ mode: 'edit', locationId: 'loc-123' }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('edit');
        expect(state.selectedLocationId).toBe('loc-123');
      });

      it('should open drawer in view mode', () => {
        store.dispatch(openDrawer({ mode: 'view', locationId: 'loc-456' }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedLocationId).toBe('loc-456');
      });

      it('should close drawer and reset state', () => {
        store.dispatch(openDrawer({ mode: 'edit', locationId: 'loc-123' }));
        store.dispatch(closeDrawer());

        const state = store.getState().inventoryStorageLocations;
        expect(state.isDrawerOpen).toBe(false);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedLocationId).toBeNull();
      });
    });
  });

  describe('Async Thunks', () => {
    describe('fetchStorageLocations', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 0 } };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchStorageLocations());

        let state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', name: 'Warehouse A', path: 'Warehouse A', level: 0 },
            { id: '2', name: 'Warehouse B', path: 'Warehouse B', level: 0 },
          ],
          total: 2,
          totalPages: 1,
        };
        const mockResponse = { body: mockData };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchStorageLocations());
        const state = store.getState().inventoryStorageLocations;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.locations).toEqual(mockData.data);
        expect(state.total).toBe(2);
        expect(state.totalPages).toBe(1);
      });

      it('should include filters in API call', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 0 } };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setSearchQuery('warehouse'));
        store.dispatch(setIsActiveFilter(false));
        store.dispatch(setParentLocationIdFilter('parent-1'));
        await store.dispatch(fetchStorageLocations());

        expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          is_active: false,
          parent_location_id: 'parent-1',
          search: 'warehouse',
        });
      });

      it('should only include search if it has a value', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 0 } };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setIsActiveFilter(true));
        await store.dispatch(fetchStorageLocations());

        expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          is_active: true,
        });
      });

      it('should handle empty response', async () => {
        const mockResponse = { body: null };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchStorageLocations());
        const state = store.getState().inventoryStorageLocations;

        expect(state.locations).toEqual([]);
        expect(state.total).toBe(0);
        expect(state.totalPages).toBe(0);
        expect(state.error).toBe('No data received from server');
      });

      it('should handle API error', async () => {
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockRejectedValue(
          new Error('Server error')
        );

        await store.dispatch(fetchStorageLocations());
        const state = store.getState().inventoryStorageLocations;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch storage locations');
      });

      it('should handle hierarchical data', async () => {
        const mockData = {
          data: [
            { id: '1', name: 'Building A', path: 'Building A', level: 0 },
            { id: '2', name: 'Floor 1', path: 'Building A > Floor 1', level: 1, parent_location_id: '1' },
            { id: '3', name: 'Room 101', path: 'Building A > Floor 1 > Room 101', level: 2, parent_location_id: '2' },
          ],
          total: 3,
          totalPages: 1,
        };
        const mockResponse = { body: mockData };
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchStorageLocations());
        const state = store.getState().inventoryStorageLocations;

        expect(state.locations).toHaveLength(3);
        expect(state.locations[2].level).toBe(2);
      });
    });

    describe('fetchLocationHierarchy', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: [] };
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchLocationHierarchy());

        let state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = [
          {
            id: '1',
            name: 'Warehouse A',
            children: [
              {
                id: '2',
                name: 'Aisle 1',
                children: [],
              },
            ],
          },
        ];
        const mockResponse = { body: mockData };
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchLocationHierarchy());
        const state = store.getState().inventoryStorageLocations;

        expect(state.isLoading).toBe(false);
        expect(state.hierarchyData).toEqual(mockData);
      });

      it('should handle empty hierarchy', async () => {
        const mockResponse = { body: null };
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchLocationHierarchy());
        const state = store.getState().inventoryStorageLocations;

        expect(state.hierarchyData).toEqual([]);
        expect(state.error).toBe('No hierarchy data received from server');
      });

      it('should handle API error', async () => {
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockRejectedValue(
          new Error('Failed to fetch')
        );

        await store.dispatch(fetchLocationHierarchy());
        const state = store.getState().inventoryStorageLocations;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch location hierarchy');
      });
    });

    describe('createStorageLocation', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { id: '1' } };
        (storageLocationsApiService.createStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        const promise = store.dispatch(createStorageLocation({
          name: 'New Location',
          description: 'Test location',
        }));

        let state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful creation', async () => {
        const mockResponse = { body: { id: '1', name: 'New Location' } };
        (storageLocationsApiService.createStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        store.dispatch(openDrawer({ mode: 'create' }));

        await store.dispatch(createStorageLocation({
          name: 'New Location',
          description: 'Test',
        }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
        expect(state.selectedLocationId).toBeNull();
      });

      it('should refresh both locations and hierarchy after creation', async () => {
        const mockResponse = { body: { id: '1' } };
        (storageLocationsApiService.createStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        await store.dispatch(createStorageLocation({
          name: 'Test Location',
        }));

        expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalled();
        expect(storageLocationsApiService.getLocationHierarchy).toHaveBeenCalled();
      });

      it('should handle creation with parent location', async () => {
        const mockResponse = { body: { id: '2' } };
        (storageLocationsApiService.createStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        await store.dispatch(createStorageLocation({
          name: 'Child Location',
          parent_location_id: 'parent-1',
        }));

        expect(storageLocationsApiService.createStorageLocation).toHaveBeenCalledWith({
          name: 'Child Location',
          parent_location_id: 'parent-1',
        });
      });

      it('should handle validation error', async () => {
        (storageLocationsApiService.createStorageLocation as jest.Mock).mockRejectedValue(
          new Error('Validation failed: Name already exists')
        );

        await store.dispatch(createStorageLocation({
          name: 'Duplicate',
        }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to create storage location');
      });
    });

    describe('updateStorageLocation', () => {
      it('should handle successful update', async () => {
        const mockResponse = { body: { id: '1', name: 'Updated Location' } };
        (storageLocationsApiService.updateStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        store.dispatch(openDrawer({ mode: 'edit', locationId: '1' }));

        await store.dispatch(updateStorageLocation({
          id: '1',
          data: { name: 'Updated Location' },
        }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
      });

      it('should handle not found error', async () => {
        (storageLocationsApiService.updateStorageLocation as jest.Mock).mockRejectedValue(
          new Error('Location not found')
        );

        await store.dispatch(updateStorageLocation({
          id: 'non-existent',
          data: { name: 'Test' },
        }));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to update storage location');
      });

      it('should refresh both locations and hierarchy after update', async () => {
        const mockResponse = { body: { id: '1' } };
        (storageLocationsApiService.updateStorageLocation as jest.Mock).mockResolvedValue(mockResponse);
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        await store.dispatch(updateStorageLocation({
          id: '1',
          data: { description: 'Updated description' },
        }));

        expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalled();
        expect(storageLocationsApiService.getLocationHierarchy).toHaveBeenCalled();
      });
    });

    describe('deleteStorageLocation', () => {
      it('should set loading state on pending', async () => {
        (storageLocationsApiService.deleteStorageLocation as jest.Mock).mockResolvedValue({ done: true });
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        const promise = store.dispatch(deleteStorageLocation('loc-1'));

        let state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful deletion', async () => {
        (storageLocationsApiService.deleteStorageLocation as jest.Mock).mockResolvedValue({ done: true });
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        await store.dispatch(deleteStorageLocation('loc-1'));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(storageLocationsApiService.deleteStorageLocation).toHaveBeenCalledWith('loc-1');
      });

      it('should handle cascade delete error (location has children)', async () => {
        (storageLocationsApiService.deleteStorageLocation as jest.Mock).mockRejectedValue(
          new Error('Cannot delete: location has child locations')
        );

        await store.dispatch(deleteStorageLocation('loc-1'));

        const state = store.getState().inventoryStorageLocations;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to delete storage location');
      });

      it('should handle cascade delete error (location has components)', async () => {
        (storageLocationsApiService.deleteStorageLocation as jest.Mock).mockRejectedValue(
          new Error('Cannot delete: location has associated components')
        );

        await store.dispatch(deleteStorageLocation('loc-1'));

        const state = store.getState().inventoryStorageLocations;
        expect(state.error).toBe('Failed to delete storage location');
      });

      it('should refresh both locations and hierarchy after deletion', async () => {
        (storageLocationsApiService.deleteStorageLocation as jest.Mock).mockResolvedValue({ done: true });
        (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 0 }
        });
        (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue({
          body: []
        });

        await store.dispatch(deleteStorageLocation('loc-1'));

        expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalled();
        expect(storageLocationsApiService.getLocationHierarchy).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent fetch requests', async () => {
      const mockResponse = { body: { data: [], total: 0, totalPages: 0 } };
      (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

      const promises = [
        store.dispatch(fetchStorageLocations()),
        store.dispatch(fetchStorageLocations()),
        store.dispatch(fetchStorageLocations()),
      ];

      await Promise.all(promises);

      const state = store.getState().inventoryStorageLocations;
      expect(state.isLoading).toBe(false);
    });

    it('should handle rapid filter changes', () => {
      store.dispatch(setSearchQuery('warehouse'));
      store.dispatch(setSearchQuery('aisle'));
      store.dispatch(setSearchQuery('shelf'));

      const state = store.getState().inventoryStorageLocations;
      expect(state.searchQuery).toBe('shelf');
      expect(state.page).toBe(1);
    });

    it('should maintain data consistency after failed update', async () => {
      // First successful fetch
      const mockData = { data: [{ id: '1', name: 'Warehouse A' }], total: 1, totalPages: 1 };
      (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue({ body: mockData });
      await store.dispatch(fetchStorageLocations());

      // Failed update
      (storageLocationsApiService.updateStorageLocation as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );
      await store.dispatch(updateStorageLocation({ id: '1', data: { name: 'Updated' } }));

      const state = store.getState().inventoryStorageLocations;
      expect(state.locations).toEqual(mockData.data);
      expect(state.error).toBe('Failed to update storage location');
    });

    it('should handle deeply nested hierarchy', async () => {
      const deepHierarchy = [
        {
          id: '1',
          name: 'Building',
          children: [
            {
              id: '2',
              name: 'Floor',
              children: [
                {
                  id: '3',
                  name: 'Room',
                  children: [
                    {
                      id: '4',
                      name: 'Cabinet',
                      children: [
                        {
                          id: '5',
                          name: 'Shelf',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const mockResponse = { body: deepHierarchy };
      (storageLocationsApiService.getLocationHierarchy as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(fetchLocationHierarchy());
      const state = store.getState().inventoryStorageLocations;

      expect(state.hierarchyData).toEqual(deepHierarchy);
    });

    it('should handle empty string search query', async () => {
      const mockResponse = { body: { data: [], total: 0, totalPages: 0 } };
      (storageLocationsApiService.getStorageLocations as jest.Mock).mockResolvedValue(mockResponse);

      store.dispatch(setSearchQuery(''));
      await store.dispatch(fetchStorageLocations());

      // Should not include search in params when empty
      expect(storageLocationsApiService.getStorageLocations).toHaveBeenCalledWith({
        page: 1,
        size: 20,
        is_active: true,
      });
    });

    it('should handle network timeout error', async () => {
      (storageLocationsApiService.getStorageLocations as jest.Mock).mockRejectedValue(
        new Error('Request timeout')
      );

      await store.dispatch(fetchStorageLocations());

      const state = store.getState().inventoryStorageLocations;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch storage locations');
    });
  });
});
