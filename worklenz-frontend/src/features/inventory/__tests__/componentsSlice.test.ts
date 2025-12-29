/**
 * Unit tests for Components Redux Slice
 */

import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import componentsReducer, {
  fetchComponents,
  fetchLowStockComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  generateQrCode,
  setSearchQuery,
  setIsActiveFilter,
  setOwnerTypeFilter,
  setSupplierIdFilter,
  setStorageLocationIdFilter,
  setCategoryFilter,
  setLowStockFilter,
  setFilters,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  openDetailDrawer,
  closeDetailDrawer,
  resetFilters,
} from '../components/componentsSlice';
import { componentsApiService } from '@/api/inventory/components.api.service';

// Mock the API service
vi.mock('@/api/inventory/components.api.service');

describe('componentsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh store for each test
    store = configureStore({
      reducer: {
        inventoryComponents: componentsReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().inventoryComponents;

      // Data
      expect(state.components).toEqual([]);
      expect(state.lowStockComponents).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Filters
      expect(state.isActiveFilter).toBeUndefined();
      expect(state.ownerTypeFilter).toBeUndefined();
      expect(state.supplierIdFilter).toBeUndefined();
      expect(state.storageLocationIdFilter).toBeUndefined();
      expect(state.categoryFilter).toBeUndefined();
      expect(state.lowStockFilter).toBeUndefined();
      expect(state.searchQuery).toBe('');

      // Pagination
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.totalPages).toBe(1);

      // UI State - Main Drawer
      expect(state.isDrawerOpen).toBe(false);
      expect(state.selectedComponentId).toBeNull();
      expect(state.drawerMode).toBe('view');

      // UI State - Detail Drawer
      expect(state.isDetailDrawerOpen).toBe(false);
      expect(state.detailComponentId).toBeNull();
    });
  });

  describe('Reducers', () => {
    describe('Search and Filter Actions', () => {
      it('should set search query and reset page', () => {
        store.dispatch(setPage(3));
        store.dispatch(setSearchQuery('resistor'));

        const state = store.getState().inventoryComponents;
        expect(state.searchQuery).toBe('resistor');
        expect(state.page).toBe(1);
      });

      it('should set active filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setIsActiveFilter(true));

        const state = store.getState().inventoryComponents;
        expect(state.isActiveFilter).toBe(true);
        expect(state.page).toBe(1);
      });

      it('should set owner type filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setOwnerTypeFilter('storage_location'));

        const state = store.getState().inventoryComponents;
        expect(state.ownerTypeFilter).toBe('storage_location');
        expect(state.page).toBe(1);
      });

      it('should set supplier ID filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setSupplierIdFilter('supplier-123'));

        const state = store.getState().inventoryComponents;
        expect(state.supplierIdFilter).toBe('supplier-123');
        expect(state.page).toBe(1);
      });

      it('should set storage location ID filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setStorageLocationIdFilter('loc-456'));

        const state = store.getState().inventoryComponents;
        expect(state.storageLocationIdFilter).toBe('loc-456');
        expect(state.page).toBe(1);
      });

      it('should set category filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setCategoryFilter('Electronics'));

        const state = store.getState().inventoryComponents;
        expect(state.categoryFilter).toBe('Electronics');
        expect(state.page).toBe(1);
      });

      it('should set low stock filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setLowStockFilter(true));

        const state = store.getState().inventoryComponents;
        expect(state.lowStockFilter).toBe(true);
        expect(state.page).toBe(1);
      });

      it('should set multiple filters at once', () => {
        store.dispatch(setFilters({
          is_active: true,
          owner_type: 'supplier',
          category: 'Hardware',
        }));

        const state = store.getState().inventoryComponents;
        expect(state.isActiveFilter).toBe(true);
        expect(state.ownerTypeFilter).toBe('supplier');
        expect(state.categoryFilter).toBe('Hardware');
        expect(state.page).toBe(1);
      });

      it('should reset all filters to initial state', () => {
        store.dispatch(setSearchQuery('test'));
        store.dispatch(setIsActiveFilter(true));
        store.dispatch(setCategoryFilter('Electronics'));
        store.dispatch(setPage(5));

        store.dispatch(resetFilters());

        const state = store.getState().inventoryComponents;
        expect(state.searchQuery).toBe('');
        expect(state.isActiveFilter).toBeUndefined();
        expect(state.categoryFilter).toBeUndefined();
        expect(state.page).toBe(1);
      });
    });

    describe('Pagination Actions', () => {
      it('should update page number', () => {
        store.dispatch(setPage(5));

        const state = store.getState().inventoryComponents;
        expect(state.page).toBe(5);
      });

      it('should update page size and reset page to 1', () => {
        store.dispatch(setPage(3));
        store.dispatch(setPageSize(50));

        const state = store.getState().inventoryComponents;
        expect(state.pageSize).toBe(50);
        expect(state.page).toBe(1);
      });
    });

    describe('Drawer Actions', () => {
      it('should open drawer in create mode', () => {
        store.dispatch(openDrawer({ mode: 'create' }));

        const state = store.getState().inventoryComponents;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('create');
        expect(state.selectedComponentId).toBeNull();
      });

      it('should open drawer in edit mode with component ID', () => {
        store.dispatch(openDrawer({ mode: 'edit', componentId: 'comp-123' }));

        const state = store.getState().inventoryComponents;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('edit');
        expect(state.selectedComponentId).toBe('comp-123');
      });

      it('should open drawer in view mode', () => {
        store.dispatch(openDrawer({ mode: 'view', componentId: 'comp-456' }));

        const state = store.getState().inventoryComponents;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedComponentId).toBe('comp-456');
      });

      it('should close drawer and reset state', () => {
        store.dispatch(openDrawer({ mode: 'edit', componentId: 'comp-123' }));
        store.dispatch(closeDrawer());

        const state = store.getState().inventoryComponents;
        expect(state.isDrawerOpen).toBe(false);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedComponentId).toBeNull();
      });

      it('should open detail drawer with component ID', () => {
        store.dispatch(openDetailDrawer('comp-789'));

        const state = store.getState().inventoryComponents;
        expect(state.isDetailDrawerOpen).toBe(true);
        expect(state.detailComponentId).toBe('comp-789');
      });

      it('should close detail drawer and reset state', () => {
        store.dispatch(openDetailDrawer('comp-789'));
        store.dispatch(closeDetailDrawer());

        const state = store.getState().inventoryComponents;
        expect(state.isDetailDrawerOpen).toBe(false);
        expect(state.detailComponentId).toBeNull();
      });
    });
  });

  describe('Async Thunks', () => {
    describe('fetchComponents', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchComponents());

        let state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', name: 'Resistor', sku: 'RES-001', quantity: 100 },
            { id: '2', name: 'Capacitor', sku: 'CAP-001', quantity: 200 },
          ],
          total: 2,
          totalPages: 1,
        };
        const mockResponse = { body: mockData };
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchComponents());
        const state = store.getState().inventoryComponents;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.components).toEqual(mockData.data);
        expect(state.total).toBe(2);
        expect(state.totalPages).toBe(1);
      });

      it('should include filters in API call', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setSearchQuery('resistor'));
        store.dispatch(setIsActiveFilter(true));
        store.dispatch(setCategoryFilter('Electronics'));
        await store.dispatch(fetchComponents());

        expect(componentsApiService.getComponents).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          is_active: true,
          category: 'Electronics',
          search: 'resistor',
        });
      });

      it('should handle empty response', async () => {
        const mockResponse = { body: null };
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchComponents());
        const state = store.getState().inventoryComponents;

        expect(state.components).toEqual([]);
        expect(state.total).toBe(0);
        expect(state.error).toBe('No data received from server');
      });

      it('should handle API error', async () => {
        (componentsApiService.getComponents as jest.Mock).mockRejectedValue(
          new Error('Server error')
        );

        await store.dispatch(fetchComponents());
        const state = store.getState().inventoryComponents;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch components');
      });

      it('should handle pagination correctly', async () => {
        const mockResponse = { body: { data: [], total: 100, totalPages: 5 } };
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setPage(3));
        store.dispatch(setPageSize(25));
        await store.dispatch(fetchComponents());

        expect(componentsApiService.getComponents).toHaveBeenCalledWith({
          page: 3,
          size: 25,
        });
      });
    });

    describe('fetchLowStockComponents', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: [] };
        (componentsApiService.getLowStockComponents as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchLowStockComponents());

        let state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = [
          { id: '1', name: 'Low Stock Item', quantity: 2, min_stock_level: 10 },
        ];
        const mockResponse = { body: mockData };
        (componentsApiService.getLowStockComponents as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchLowStockComponents());
        const state = store.getState().inventoryComponents;

        expect(state.isLoading).toBe(false);
        expect(state.lowStockComponents).toEqual(mockData);
      });

      it('should handle empty response', async () => {
        const mockResponse = { body: null };
        (componentsApiService.getLowStockComponents as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchLowStockComponents());
        const state = store.getState().inventoryComponents;

        expect(state.lowStockComponents).toEqual([]);
        expect(state.error).toBe('No data received from server');
      });

      it('should handle API error', async () => {
        (componentsApiService.getLowStockComponents as jest.Mock).mockRejectedValue(
          new Error('Failed to fetch')
        );

        await store.dispatch(fetchLowStockComponents());
        const state = store.getState().inventoryComponents;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch low stock components');
      });
    });

    describe('createComponent', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { id: '1' } };
        (componentsApiService.createComponent as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        const promise = store.dispatch(createComponent({
          name: 'New Component',
          sku: 'NEW-001',
          quantity: 100,
          unit: 'ea',
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
        }));

        let state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful creation', async () => {
        const mockResponse = { body: { id: '1', name: 'New Component' } };
        (componentsApiService.createComponent as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        store.dispatch(openDrawer({ mode: 'create' }));

        await store.dispatch(createComponent({
          name: 'New Component',
          sku: 'NEW-001',
          quantity: 100,
          unit: 'ea',
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
        }));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
        expect(state.selectedComponentId).toBeNull();
        expect(state.drawerMode).toBe('view');
      });

      it('should refresh components list after creation', async () => {
        const mockResponse = { body: { id: '1' } };
        (componentsApiService.createComponent as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(createComponent({
          name: 'Test',
          sku: 'TST-001',
          quantity: 10,
          unit: 'ea',
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
        }));

        expect(componentsApiService.getComponents).toHaveBeenCalled();
      });

      it('should handle validation error', async () => {
        (componentsApiService.createComponent as jest.Mock).mockRejectedValue(
          new Error('Validation failed: SKU already exists')
        );

        await store.dispatch(createComponent({
          name: 'Duplicate',
          sku: 'DUP-001',
          quantity: 10,
          unit: 'ea',
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
        }));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to create component');
      });
    });

    describe('updateComponent', () => {
      it('should handle successful update', async () => {
        const mockResponse = { body: { id: '1', name: 'Updated Component' } };
        (componentsApiService.updateComponent as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        store.dispatch(openDrawer({ mode: 'edit', componentId: '1' }));

        await store.dispatch(updateComponent({
          id: '1',
          data: { name: 'Updated Component' },
        }));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
      });

      it('should handle not found error', async () => {
        (componentsApiService.updateComponent as jest.Mock).mockRejectedValue(
          new Error('Component not found')
        );

        await store.dispatch(updateComponent({
          id: 'non-existent',
          data: { name: 'Test' },
        }));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to update component');
      });

      it('should refresh components list after update', async () => {
        const mockResponse = { body: { id: '1' } };
        (componentsApiService.updateComponent as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(updateComponent({
          id: '1',
          data: { quantity: 150 },
        }));

        expect(componentsApiService.getComponents).toHaveBeenCalled();
      });
    });

    describe('deleteComponent', () => {
      it('should handle successful deletion', async () => {
        (componentsApiService.deleteComponent as jest.Mock).mockResolvedValue({ done: true });
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(deleteComponent('comp-1'));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(componentsApiService.deleteComponent).toHaveBeenCalledWith('comp-1');
      });

      it('should handle cascade delete error', async () => {
        (componentsApiService.deleteComponent as jest.Mock).mockRejectedValue(
          new Error('Cannot delete: component has transactions')
        );

        await store.dispatch(deleteComponent('comp-1'));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to delete component');
      });

      it('should refresh components list after deletion', async () => {
        (componentsApiService.deleteComponent as jest.Mock).mockResolvedValue({ done: true });
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(deleteComponent('comp-1'));

        expect(componentsApiService.getComponents).toHaveBeenCalled();
      });
    });

    describe('generateQrCode', () => {
      it('should handle successful QR code generation', async () => {
        const mockResponse = { body: { qr_code: 'base64string' } };
        (componentsApiService.generateQrCode as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(generateQrCode('comp-1'));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
      });

      it('should handle QR code generation error', async () => {
        (componentsApiService.generateQrCode as jest.Mock).mockRejectedValue(
          new Error('QR generation failed')
        );

        await store.dispatch(generateQrCode('comp-1'));

        const state = store.getState().inventoryComponents;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to generate QR code');
      });

      it('should refresh components list after QR code generation', async () => {
        const mockResponse = { body: { qr_code: 'base64string' } };
        (componentsApiService.generateQrCode as jest.Mock).mockResolvedValue(mockResponse);
        (componentsApiService.getComponents as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(generateQrCode('comp-1'));

        expect(componentsApiService.getComponents).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent fetch requests', async () => {
      const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
      (componentsApiService.getComponents as jest.Mock).mockResolvedValue(mockResponse);

      const promises = [
        store.dispatch(fetchComponents()),
        store.dispatch(fetchComponents()),
        store.dispatch(fetchComponents()),
      ];

      await Promise.all(promises);

      const state = store.getState().inventoryComponents;
      expect(state.isLoading).toBe(false);
    });

    it('should handle rapid filter changes', () => {
      store.dispatch(setSearchQuery('resistor'));
      store.dispatch(setSearchQuery('capacitor'));
      store.dispatch(setSearchQuery('transistor'));

      const state = store.getState().inventoryComponents;
      expect(state.searchQuery).toBe('transistor');
      expect(state.page).toBe(1);
    });

    it('should maintain data consistency after failed update', async () => {
      // First successful fetch
      const mockData = { data: [{ id: '1', name: 'Test' }], total: 1, totalPages: 1 };
      (componentsApiService.getComponents as jest.Mock).mockResolvedValue({ body: mockData });
      await store.dispatch(fetchComponents());

      // Failed update
      (componentsApiService.updateComponent as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );
      await store.dispatch(updateComponent({ id: '1', data: { name: 'Updated' } }));

      const state = store.getState().inventoryComponents;
      expect(state.components).toEqual(mockData.data);
      expect(state.error).toBe('Failed to update component');
    });
  });
});
