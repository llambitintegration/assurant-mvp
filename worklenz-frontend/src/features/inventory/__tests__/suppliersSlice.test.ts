/**
 * Unit tests for Suppliers Redux Slice
 */

import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import suppliersReducer, {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  setSearchQuery,
  setIsActiveFilter,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  resetFilters,
} from '../suppliers/suppliersSlice';
import { suppliersApiService } from '@/api/inventory/suppliers.api.service';

// Mock the API service
vi.mock('@/api/inventory/suppliers.api.service');

describe('suppliersSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh store for each test
    store = configureStore({
      reducer: {
        inventorySuppliers: suppliersReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().inventorySuppliers;

      // Data
      expect(state.suppliers).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Filters
      expect(state.isActiveFilter).toBeUndefined();
      expect(state.searchQuery).toBe('');

      // Pagination
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.totalPages).toBe(1);

      // UI State
      expect(state.isDrawerOpen).toBe(false);
      expect(state.selectedSupplierId).toBeNull();
      expect(state.drawerMode).toBe('view');
    });
  });

  describe('Reducers', () => {
    describe('Search and Filter Actions', () => {
      it('should set search query and reset page', () => {
        store.dispatch(setPage(3));
        store.dispatch(setSearchQuery('acme'));

        const state = store.getState().inventorySuppliers;
        expect(state.searchQuery).toBe('acme');
        expect(state.page).toBe(1);
      });

      it('should clear search query', () => {
        store.dispatch(setSearchQuery('test'));
        store.dispatch(setSearchQuery(''));

        const state = store.getState().inventorySuppliers;
        expect(state.searchQuery).toBe('');
      });

      it('should set active filter and reset page', () => {
        store.dispatch(setPage(2));
        store.dispatch(setIsActiveFilter(true));

        const state = store.getState().inventorySuppliers;
        expect(state.isActiveFilter).toBe(true);
        expect(state.page).toBe(1);
      });

      it('should set active filter to false', () => {
        store.dispatch(setIsActiveFilter(true));
        store.dispatch(setIsActiveFilter(false));

        const state = store.getState().inventorySuppliers;
        expect(state.isActiveFilter).toBe(false);
      });

      it('should clear active filter with undefined', () => {
        store.dispatch(setIsActiveFilter(true));
        store.dispatch(setIsActiveFilter(undefined));

        const state = store.getState().inventorySuppliers;
        expect(state.isActiveFilter).toBeUndefined();
      });

      it('should reset all filters to initial state', () => {
        store.dispatch(setSearchQuery('test'));
        store.dispatch(setIsActiveFilter(false));
        store.dispatch(setPage(5));

        store.dispatch(resetFilters());

        const state = store.getState().inventorySuppliers;
        expect(state.searchQuery).toBe('');
        expect(state.isActiveFilter).toBeUndefined();
        expect(state.page).toBe(1);
      });
    });

    describe('Pagination Actions', () => {
      it('should update page number', () => {
        store.dispatch(setPage(5));

        const state = store.getState().inventorySuppliers;
        expect(state.page).toBe(5);
      });

      it('should update page size and reset page to 1', () => {
        store.dispatch(setPage(3));
        store.dispatch(setPageSize(50));

        const state = store.getState().inventorySuppliers;
        expect(state.pageSize).toBe(50);
        expect(state.page).toBe(1);
      });
    });

    describe('Drawer Actions', () => {
      it('should open drawer in create mode', () => {
        store.dispatch(openDrawer({ mode: 'create' }));

        const state = store.getState().inventorySuppliers;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('create');
        expect(state.selectedSupplierId).toBeNull();
      });

      it('should open drawer in edit mode with supplier ID', () => {
        store.dispatch(openDrawer({ mode: 'edit', supplierId: 'sup-123' }));

        const state = store.getState().inventorySuppliers;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('edit');
        expect(state.selectedSupplierId).toBe('sup-123');
      });

      it('should open drawer in view mode', () => {
        store.dispatch(openDrawer({ mode: 'view', supplierId: 'sup-456' }));

        const state = store.getState().inventorySuppliers;
        expect(state.isDrawerOpen).toBe(true);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedSupplierId).toBe('sup-456');
      });

      it('should close drawer and reset state', () => {
        store.dispatch(openDrawer({ mode: 'edit', supplierId: 'sup-123' }));
        store.dispatch(closeDrawer());

        const state = store.getState().inventorySuppliers;
        expect(state.isDrawerOpen).toBe(false);
        expect(state.drawerMode).toBe('view');
        expect(state.selectedSupplierId).toBeNull();
      });
    });
  });

  describe('Async Thunks', () => {
    describe('fetchSuppliers', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchSuppliers());

        let state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', name: 'ACME Corp', email: 'contact@acme.com', is_active: true },
            { id: '2', name: 'Tech Supply', email: 'info@techsupply.com', is_active: true },
          ],
          total: 2,
          totalPages: 1,
        };
        const mockResponse = { body: mockData };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchSuppliers());
        const state = store.getState().inventorySuppliers;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.suppliers).toEqual(mockData.data);
        expect(state.total).toBe(2);
        expect(state.totalPages).toBe(1);
      });

      it('should include filters in API call', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setSearchQuery('acme'));
        store.dispatch(setIsActiveFilter(true));
        await store.dispatch(fetchSuppliers());

        expect(suppliersApiService.getSuppliers).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          is_active: true,
          search: 'acme',
        });
      });

      it('should only include search if it has a value', async () => {
        const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setIsActiveFilter(false));
        await store.dispatch(fetchSuppliers());

        expect(suppliersApiService.getSuppliers).toHaveBeenCalledWith({
          page: 1,
          size: 20,
          is_active: false,
        });
      });

      it('should handle empty response', async () => {
        const mockResponse = { body: null };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchSuppliers());
        const state = store.getState().inventorySuppliers;

        expect(state.suppliers).toEqual([]);
        expect(state.total).toBe(0);
        expect(state.totalPages).toBe(1);
        expect(state.error).toBe('No data received from server');
      });

      it('should handle API error', async () => {
        (suppliersApiService.getSuppliers as jest.Mock).mockRejectedValue(
          new Error('Server error')
        );

        await store.dispatch(fetchSuppliers());
        const state = store.getState().inventorySuppliers;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch suppliers');
      });

      it('should handle pagination correctly', async () => {
        const mockResponse = { body: { data: [], total: 100, totalPages: 5 } };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setPage(3));
        store.dispatch(setPageSize(25));
        await store.dispatch(fetchSuppliers());

        expect(suppliersApiService.getSuppliers).toHaveBeenCalledWith({
          page: 3,
          size: 25,
        });
      });

      it('should handle large dataset', async () => {
        const suppliers = Array.from({ length: 1000 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Supplier ${i + 1}`,
          email: `supplier${i + 1}@example.com`,
          is_active: true,
        }));

        const mockResponse = { body: { data: suppliers, total: 1000, totalPages: 50 } };
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchSuppliers());
        const state = store.getState().inventorySuppliers;

        expect(state.suppliers).toHaveLength(1000);
        expect(state.total).toBe(1000);
      });
    });

    describe('createSupplier', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { id: '1' } };
        (suppliersApiService.createSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        const promise = store.dispatch(createSupplier({
          name: 'New Supplier',
          email: 'new@supplier.com',
        }));

        let state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful creation', async () => {
        const mockResponse = { body: { id: '1', name: 'New Supplier' } };
        (suppliersApiService.createSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        store.dispatch(openDrawer({ mode: 'create' }));

        await store.dispatch(createSupplier({
          name: 'New Supplier',
          email: 'new@supplier.com',
        }));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
        expect(state.selectedSupplierId).toBeNull();
        expect(state.drawerMode).toBe('view');
      });

      it('should refresh suppliers list after creation', async () => {
        const mockResponse = { body: { id: '1' } };
        (suppliersApiService.createSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(createSupplier({
          name: 'Test Supplier',
          email: 'test@test.com',
        }));

        expect(suppliersApiService.getSuppliers).toHaveBeenCalled();
      });

      it('should handle validation error', async () => {
        (suppliersApiService.createSupplier as jest.Mock).mockRejectedValue(
          new Error('Validation failed: Email already exists')
        );

        await store.dispatch(createSupplier({
          name: 'Duplicate',
          email: 'duplicate@test.com',
        }));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to create supplier');
      });

      it('should handle creation with optional fields', async () => {
        const mockResponse = { body: { id: '1' } };
        (suppliersApiService.createSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(createSupplier({
          name: 'Full Supplier',
          email: 'full@supplier.com',
          phone: '123-456-7890',
          address: '123 Main St',
          contact_person: 'John Doe',
        }));

        expect(suppliersApiService.createSupplier).toHaveBeenCalledWith({
          name: 'Full Supplier',
          email: 'full@supplier.com',
          phone: '123-456-7890',
          address: '123 Main St',
          contact_person: 'John Doe',
        });
      });
    });

    describe('updateSupplier', () => {
      it('should handle successful update', async () => {
        const mockResponse = { body: { id: '1', name: 'Updated Supplier' } };
        (suppliersApiService.updateSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        store.dispatch(openDrawer({ mode: 'edit', supplierId: '1' }));

        await store.dispatch(updateSupplier({
          id: '1',
          data: { name: 'Updated Supplier' },
        }));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(state.isDrawerOpen).toBe(false);
      });

      it('should handle not found error', async () => {
        (suppliersApiService.updateSupplier as jest.Mock).mockRejectedValue(
          new Error('Supplier not found')
        );

        await store.dispatch(updateSupplier({
          id: 'non-existent',
          data: { name: 'Test' },
        }));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to update supplier');
      });

      it('should refresh suppliers list after update', async () => {
        const mockResponse = { body: { id: '1' } };
        (suppliersApiService.updateSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(updateSupplier({
          id: '1',
          data: { email: 'updated@email.com' },
        }));

        expect(suppliersApiService.getSuppliers).toHaveBeenCalled();
      });

      it('should handle partial update', async () => {
        const mockResponse = { body: { id: '1' } };
        (suppliersApiService.updateSupplier as jest.Mock).mockResolvedValue(mockResponse);
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(updateSupplier({
          id: '1',
          data: { is_active: false },
        }));

        expect(suppliersApiService.updateSupplier).toHaveBeenCalledWith('1', {
          is_active: false,
        });
      });
    });

    describe('deleteSupplier', () => {
      it('should set loading state on pending', async () => {
        (suppliersApiService.deleteSupplier as jest.Mock).mockResolvedValue({ done: true });
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        const promise = store.dispatch(deleteSupplier('sup-1'));

        let state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(true);

        await promise;
      });

      it('should handle successful deletion', async () => {
        (suppliersApiService.deleteSupplier as jest.Mock).mockResolvedValue({ done: true });
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(deleteSupplier('sup-1'));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(suppliersApiService.deleteSupplier).toHaveBeenCalledWith('sup-1');
      });

      it('should handle cascade delete error (supplier has components)', async () => {
        (suppliersApiService.deleteSupplier as jest.Mock).mockRejectedValue(
          new Error('Cannot delete: supplier has associated components')
        );

        await store.dispatch(deleteSupplier('sup-1'));

        const state = store.getState().inventorySuppliers;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to delete supplier');
      });

      it('should refresh suppliers list after deletion', async () => {
        (suppliersApiService.deleteSupplier as jest.Mock).mockResolvedValue({ done: true });
        (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({
          body: { data: [], total: 0, totalPages: 1 }
        });

        await store.dispatch(deleteSupplier('sup-1'));

        expect(suppliersApiService.getSuppliers).toHaveBeenCalled();
      });

      it('should handle not found error', async () => {
        (suppliersApiService.deleteSupplier as jest.Mock).mockRejectedValue(
          new Error('Supplier not found')
        );

        await store.dispatch(deleteSupplier('non-existent'));

        const state = store.getState().inventorySuppliers;
        expect(state.error).toBe('Failed to delete supplier');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent fetch requests', async () => {
      const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
      (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

      const promises = [
        store.dispatch(fetchSuppliers()),
        store.dispatch(fetchSuppliers()),
        store.dispatch(fetchSuppliers()),
      ];

      await Promise.all(promises);

      const state = store.getState().inventorySuppliers;
      expect(state.isLoading).toBe(false);
    });

    it('should handle rapid filter changes', () => {
      store.dispatch(setSearchQuery('acme'));
      store.dispatch(setSearchQuery('tech'));
      store.dispatch(setSearchQuery('global'));

      const state = store.getState().inventorySuppliers;
      expect(state.searchQuery).toBe('global');
      expect(state.page).toBe(1);
    });

    it('should maintain data consistency after failed update', async () => {
      // First successful fetch
      const mockData = { data: [{ id: '1', name: 'ACME Corp' }], total: 1, totalPages: 1 };
      (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue({ body: mockData });
      await store.dispatch(fetchSuppliers());

      // Failed update
      (suppliersApiService.updateSupplier as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );
      await store.dispatch(updateSupplier({ id: '1', data: { name: 'Updated' } }));

      const state = store.getState().inventorySuppliers;
      expect(state.suppliers).toEqual(mockData.data);
      expect(state.error).toBe('Failed to update supplier');
    });

    it('should handle empty string search query', async () => {
      const mockResponse = { body: { data: [], total: 0, totalPages: 1 } };
      (suppliersApiService.getSuppliers as jest.Mock).mockResolvedValue(mockResponse);

      store.dispatch(setSearchQuery(''));
      await store.dispatch(fetchSuppliers());

      // Should not include search in params when empty
      expect(suppliersApiService.getSuppliers).toHaveBeenCalledWith({
        page: 1,
        size: 20,
      });
    });

    it('should handle opening and closing drawer multiple times', () => {
      store.dispatch(openDrawer({ mode: 'create' }));
      store.dispatch(closeDrawer());
      store.dispatch(openDrawer({ mode: 'edit', supplierId: '1' }));
      store.dispatch(closeDrawer());
      store.dispatch(openDrawer({ mode: 'view', supplierId: '2' }));

      const state = store.getState().inventorySuppliers;
      expect(state.isDrawerOpen).toBe(true);
      expect(state.drawerMode).toBe('view');
      expect(state.selectedSupplierId).toBe('2');
    });

    it('should handle network timeout error', async () => {
      (suppliersApiService.getSuppliers as jest.Mock).mockRejectedValue(
        new Error('Request timeout')
      );

      await store.dispatch(fetchSuppliers());

      const state = store.getState().inventorySuppliers;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch suppliers');
    });
  });
});
