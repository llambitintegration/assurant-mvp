/**
 * Unit tests for Inventory Transactions Redux Slice
 */

import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import transactionsReducer, {
  fetchTransactions,
  fetchRecentTransactions,
  fetchComponentHistory,
  createTransaction,
  setFilters,
  setComponentFilter,
  setTransactionTypeFilter,
  setSearchQuery,
  setDateRange,
  setPage,
  setPageSize,
  openModal,
  closeModal,
  setSelectedTransaction,
  resetFilters,
  clearComponentHistory,
} from '../transactions/transactionsSlice';
import { transactionsApiService } from '@/api/inventory/transactions.api.service';

// Mock the API service
vi.mock('@/api/inventory/transactions.api.service');

describe('transactionsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh store for each test
    store = configureStore({
      reducer: {
        inventoryTransactions: transactionsReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().inventoryTransactions;

      // Data
      expect(state.transactions).toEqual([]);
      expect(state.componentHistory).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Recent transactions
      expect(state.recentTransactions).toEqual([]);
      expect(state.recentTransactionsLoading).toBe(false);
      expect(state.recentTransactionsError).toBeNull();

      // Filters
      expect(state.filters).toEqual({});
      expect(state.dateRange).toBeNull();

      // Pagination
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(20);
      expect(state.totalPages).toBe(0);

      // UI State
      expect(state.isModalOpen).toBe(false);
      expect(state.selectedTransactionId).toBeNull();
    });
  });

  describe('Reducers', () => {
    describe('setFilters', () => {
      it('should set filters and reset page to 1', () => {
        // First set page to something other than 1
        store.dispatch(setPage(3));

        // Then apply filters
        store.dispatch(setFilters({ component_id: 'comp-1' }));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.component_id).toBe('comp-1');
        expect(state.page).toBe(1);
      });

      it('should merge filters with existing filters', () => {
        store.dispatch(setFilters({ component_id: 'comp-1' }));
        store.dispatch(setFilters({ transaction_type: 'IN' }));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.component_id).toBe('comp-1');
        expect(state.filters.transaction_type).toBe('IN');
      });
    });

    describe('setComponentFilter', () => {
      it('should set component filter and reset page to 1', () => {
        store.dispatch(setPage(2));
        store.dispatch(setComponentFilter('comp-123'));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.component_id).toBe('comp-123');
        expect(state.page).toBe(1);
      });

      it('should clear component filter when undefined', () => {
        store.dispatch(setComponentFilter('comp-123'));
        store.dispatch(setComponentFilter(undefined));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.component_id).toBeUndefined();
      });
    });

    describe('setTransactionTypeFilter', () => {
      it('should set transaction type filter and reset page to 1', () => {
        store.dispatch(setPage(2));
        store.dispatch(setTransactionTypeFilter('OUT'));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.transaction_type).toBe('OUT');
        expect(state.page).toBe(1);
      });
    });

    describe('setSearchQuery', () => {
      it('should set search query and reset page to 1', () => {
        store.dispatch(setPage(2));
        store.dispatch(setSearchQuery('test search'));

        const state = store.getState().inventoryTransactions;
        expect(state.filters.search).toBe('test search');
        expect(state.page).toBe(1);
      });
    });

    describe('setDateRange', () => {
      it('should set date range and reset page to 1', () => {
        store.dispatch(setPage(2));
        store.dispatch(setDateRange(['2024-01-01', '2024-12-31']));

        const state = store.getState().inventoryTransactions;
        expect(state.dateRange).toEqual(['2024-01-01', '2024-12-31']);
        expect(state.page).toBe(1);
      });

      it('should clear date range when null', () => {
        store.dispatch(setDateRange(['2024-01-01', '2024-12-31']));
        store.dispatch(setDateRange(null));

        const state = store.getState().inventoryTransactions;
        expect(state.dateRange).toBeNull();
      });
    });

    describe('setPage', () => {
      it('should update page number', () => {
        store.dispatch(setPage(5));

        const state = store.getState().inventoryTransactions;
        expect(state.page).toBe(5);
      });
    });

    describe('setPageSize', () => {
      it('should update page size and reset page to 1', () => {
        store.dispatch(setPage(3));
        store.dispatch(setPageSize(50));

        const state = store.getState().inventoryTransactions;
        expect(state.pageSize).toBe(50);
        expect(state.page).toBe(1);
      });
    });

    describe('Modal actions', () => {
      it('should open modal', () => {
        store.dispatch(openModal());

        const state = store.getState().inventoryTransactions;
        expect(state.isModalOpen).toBe(true);
      });

      it('should close modal', () => {
        store.dispatch(openModal());
        store.dispatch(closeModal());

        const state = store.getState().inventoryTransactions;
        expect(state.isModalOpen).toBe(false);
      });

      it('should set selected transaction', () => {
        store.dispatch(setSelectedTransaction('trans-123'));

        const state = store.getState().inventoryTransactions;
        expect(state.selectedTransactionId).toBe('trans-123');
      });

      it('should clear selected transaction', () => {
        store.dispatch(setSelectedTransaction('trans-123'));
        store.dispatch(setSelectedTransaction(null));

        const state = store.getState().inventoryTransactions;
        expect(state.selectedTransactionId).toBeNull();
      });
    });

    describe('resetFilters', () => {
      it('should reset all filters to initial state', () => {
        // Set various filters
        store.dispatch(setFilters({ component_id: 'comp-1' }));
        store.dispatch(setDateRange(['2024-01-01', '2024-12-31']));
        store.dispatch(setPage(5));

        // Reset filters
        store.dispatch(resetFilters());

        const state = store.getState().inventoryTransactions;
        expect(state.filters).toEqual({});
        expect(state.dateRange).toBeNull();
        expect(state.page).toBe(1);
      });
    });

    describe('clearComponentHistory', () => {
      it('should clear component history', () => {
        // Manually set some history (would normally come from fetchComponentHistory)
        store.dispatch(clearComponentHistory());

        const state = store.getState().inventoryTransactions;
        expect(state.componentHistory).toEqual([]);
      });
    });
  });

  describe('Async Thunks', () => {
    describe('fetchTransactions', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { done: true, body: { data: [], total: 0 } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchTransactions());

        // Check loading state before promise resolves
        let state = store.getState().inventoryTransactions;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', component_id: 'comp1', transaction_type: 'IN', quantity: 10 },
            { id: '2', component_id: 'comp2', transaction_type: 'OUT', quantity: 5 },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
        };
        const mockResponse = { done: true, body: mockData };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.transactions).toEqual(mockData.data);
        expect(state.total).toBe(2);
        expect(state.page).toBe(1);
        expect(state.totalPages).toBe(1);
      });

      it('should handle invalid response structure (done: false)', async () => {
        const mockResponse = { done: false, message: 'Server error' };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Invalid response from server');
      });

      it('should handle invalid data format', async () => {
        const mockResponse = { done: true, body: { data: 'not-an-array', total: 0 } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Invalid data format received from server');
      });

      it('should handle invalid total count', async () => {
        const mockResponse = { done: true, body: { data: [], total: 'not-a-number' } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Invalid total count received from server');
      });

      it('should handle network error', async () => {
        (transactionsApiService.getTransactions as jest.Mock).mockRejectedValue(
          new Error('Network error')
        );

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Network error');
      });

      it('should include filters in API call', async () => {
        const mockResponse = { done: true, body: { data: [], total: 0 } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setFilters({ component_id: 'comp-1', transaction_type: 'IN' }));
        store.dispatch(setDateRange(['2024-01-01', '2024-12-31']));
        await store.dispatch(fetchTransactions());

        expect(transactionsApiService.getTransactions).toHaveBeenCalledWith({
          component_id: 'comp-1',
          transaction_type: 'IN',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          page: 1,
          size: 20,
        });
      });

      it('should handle empty response body', async () => {
        const mockResponse = { done: true, body: null };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchTransactions());
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Invalid response from server');
      });
    });

    describe('fetchRecentTransactions', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { done: true, body: { data: [] } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchRecentTransactions(10));

        let state = store.getState().inventoryTransactions;
        expect(state.recentTransactionsLoading).toBe(true);
        expect(state.recentTransactionsError).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', component_id: 'comp1', transaction_type: 'IN', quantity: 10 },
          ],
        };
        const mockResponse = { done: true, body: mockData };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchRecentTransactions(10));
        const state = store.getState().inventoryTransactions;

        expect(state.recentTransactionsLoading).toBe(false);
        expect(state.recentTransactionsError).toBeNull();
        expect(state.recentTransactions).toEqual(mockData.data);
      });

      it('should handle API error response', async () => {
        const mockResponse = { done: false, message: 'Server error' };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchRecentTransactions(10));
        const state = store.getState().inventoryTransactions;

        expect(state.recentTransactionsLoading).toBe(false);
        expect(state.recentTransactionsError).toBe('Server error');
      });

      it('should handle network error', async () => {
        (transactionsApiService.getTransactions as jest.Mock).mockRejectedValue(
          new Error('Network failure')
        );

        await store.dispatch(fetchRecentTransactions(10));
        const state = store.getState().inventoryTransactions;

        expect(state.recentTransactionsLoading).toBe(false);
        expect(state.recentTransactionsError).toBe('Network failure');
      });

      it('should call API with correct limit parameter', async () => {
        const mockResponse = { done: true, body: { data: [] } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchRecentTransactions(5));

        expect(transactionsApiService.getTransactions).toHaveBeenCalledWith({
          page: 1,
          size: 5,
        });
      });

      it('should handle empty data array', async () => {
        const mockResponse = { done: true, body: { data: [] } };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchRecentTransactions(10));
        const state = store.getState().inventoryTransactions;

        expect(state.recentTransactions).toEqual([]);
      });

      it('should handle missing data in response', async () => {
        const mockResponse = { done: true, body: {} };
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchRecentTransactions(10));
        const state = store.getState().inventoryTransactions;

        expect(state.recentTransactions).toEqual([]);
        expect(state.recentTransactionsError).toBe('No data received from server');
      });
    });

    describe('fetchComponentHistory', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { data: [], total: 0 } };
        (transactionsApiService.getComponentHistory as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchComponentHistory('comp-1'));

        let state = store.getState().inventoryTransactions;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response', async () => {
        const mockData = {
          data: [
            { id: '1', component_id: 'comp-1', transaction_type: 'IN', quantity: 10 },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        };
        const mockResponse = { body: mockData };
        (transactionsApiService.getComponentHistory as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchComponentHistory('comp-1'));
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.componentHistory).toEqual(mockData.data);
        expect(state.total).toBe(1);
      });

      it('should handle API error', async () => {
        (transactionsApiService.getComponentHistory as jest.Mock).mockRejectedValue(
          new Error('Failed to fetch')
        );

        await store.dispatch(fetchComponentHistory('comp-1'));
        const state = store.getState().inventoryTransactions;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch component history');
      });

      it('should include date range in API call', async () => {
        const mockResponse = { body: { data: [], total: 0 } };
        (transactionsApiService.getComponentHistory as jest.Mock).mockResolvedValue(mockResponse);

        store.dispatch(setDateRange(['2024-01-01', '2024-12-31']));
        await store.dispatch(fetchComponentHistory('comp-1'));

        expect(transactionsApiService.getComponentHistory).toHaveBeenCalledWith('comp-1', {
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          page: 1,
          size: 20,
        });
      });

      it('should handle empty response body', async () => {
        const mockResponse = { body: null };
        (transactionsApiService.getComponentHistory as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchComponentHistory('comp-1'));
        const state = store.getState().inventoryTransactions;

        expect(state.componentHistory).toEqual([]);
        expect(state.error).toBe('No data received from server');
      });
    });

    describe('createTransaction', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = { body: { id: '1' } };
        (transactionsApiService.createTransaction as jest.Mock).mockResolvedValue(mockResponse);
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue({
          done: true,
          body: { data: [], total: 0 }
        });

        const promise = store.dispatch(createTransaction({
          component_id: 'comp-1',
          transaction_type: 'IN',
          quantity: 10,
        }));

        let state = store.getState().inventoryTransactions;
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful creation', async () => {
        const mockResponse = { body: { id: '1' } };
        (transactionsApiService.createTransaction as jest.Mock).mockResolvedValue(mockResponse);
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue({
          done: true,
          body: { data: [], total: 0 }
        });

        // Open modal first
        store.dispatch(openModal());

        await store.dispatch(createTransaction({
          component_id: 'comp-1',
          transaction_type: 'IN',
          quantity: 10,
        }));

        const state = store.getState().inventoryTransactions;
        expect(state.isLoading).toBe(false);
        expect(state.isModalOpen).toBe(false); // Should close modal on success
        expect(transactionsApiService.createTransaction).toHaveBeenCalledWith({
          component_id: 'comp-1',
          transaction_type: 'IN',
          quantity: 10,
        });
      });

      it('should refresh transactions list after creation', async () => {
        const mockResponse = { body: { id: '1' } };
        (transactionsApiService.createTransaction as jest.Mock).mockResolvedValue(mockResponse);
        (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue({
          done: true,
          body: { data: [], total: 0 }
        });

        await store.dispatch(createTransaction({
          component_id: 'comp-1',
          transaction_type: 'IN',
          quantity: 10,
        }));

        // Should call fetchTransactions as part of the thunk
        expect(transactionsApiService.getTransactions).toHaveBeenCalled();
      });

      it('should handle API error', async () => {
        (transactionsApiService.createTransaction as jest.Mock).mockRejectedValue(
          new Error('Validation failed')
        );

        await store.dispatch(createTransaction({
          component_id: 'comp-1',
          transaction_type: 'IN',
          quantity: 10,
        }));

        const state = store.getState().inventoryTransactions;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to create transaction');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent fetch requests', async () => {
      const mockResponse = { done: true, body: { data: [], total: 0 } };
      (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockResponse);

      const promises = [
        store.dispatch(fetchTransactions()),
        store.dispatch(fetchTransactions()),
        store.dispatch(fetchTransactions()),
      ];

      await Promise.all(promises);

      const state = store.getState().inventoryTransactions;
      expect(state.isLoading).toBe(false);
    });

    it('should handle rapid filter changes', () => {
      store.dispatch(setFilters({ component_id: 'comp-1' }));
      store.dispatch(setFilters({ component_id: 'comp-2' }));
      store.dispatch(setFilters({ component_id: 'comp-3' }));

      const state = store.getState().inventoryTransactions;
      expect(state.filters.component_id).toBe('comp-3');
      expect(state.page).toBe(1);
    });

    it('should maintain state consistency after error', async () => {
      // First successful fetch
      const mockSuccess = { done: true, body: { data: [{ id: '1' }], total: 1 } };
      (transactionsApiService.getTransactions as jest.Mock).mockResolvedValue(mockSuccess);
      await store.dispatch(fetchTransactions());

      // Then failed fetch
      (transactionsApiService.getTransactions as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      await store.dispatch(fetchTransactions());

      const state = store.getState().inventoryTransactions;
      // Should keep old data when new fetch fails
      expect(state.transactions).toEqual([{ id: '1' }]);
      expect(state.error).toBe('Network error');
    });
  });
});
