/**
 * Unit tests for Inventory Dashboard Redux Slice
 */

import { vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer, { fetchDashboardData } from '../dashboard/dashboardSlice';
import { dashboardApiService } from '@/api/inventory/dashboard.api.service';

// Mock the API service
vi.mock('@/api/inventory/dashboard.api.service');

// Mock the logger to prevent console output during tests
vi.mock('@/utils/errorLogger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('dashboardSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create fresh store for each test
    store = configureStore({
      reducer: {
        inventoryDashboard: dashboardReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().inventoryDashboard;

      expect(state.stats).toBeNull();
      expect(state.lowStockAlerts).toEqual([]);
      expect(state.inventoryValueByCategory).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Async Thunks', () => {
    describe('fetchDashboardData', () => {
      it('should set loading state on pending', async () => {
        const mockResponse = {
          done: true,
          body: {
            stats: null,
            low_stock_alerts: [],
            inventory_value_by_category: [],
          },
        };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        const promise = store.dispatch(fetchDashboardData());

        // Check loading state before promise resolves
        let state = store.getState().inventoryDashboard;
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();

        await promise;
      });

      it('should handle successful response with complete data', async () => {
        const mockData = {
          stats: {
            total_components: 150,
            total_value: 50000,
            low_stock_count: 12,
            out_of_stock_count: 3,
          },
          low_stock_alerts: [
            {
              id: '1',
              name: 'Component A',
              sku: 'SKU-001',
              quantity: 5,
              min_stock_level: 10,
              storage_location_name: 'Warehouse A',
            },
            {
              id: '2',
              name: 'Component B',
              sku: 'SKU-002',
              quantity: 2,
              min_stock_level: 15,
              storage_location_name: 'Warehouse B',
            },
          ],
          inventory_value_by_category: [
            { category: 'Electronics', total_value: 30000 },
            { category: 'Hardware', total_value: 20000 },
          ],
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.stats).toEqual(mockData.stats);
        expect(state.lowStockAlerts).toEqual(mockData.low_stock_alerts);
        expect(state.inventoryValueByCategory).toEqual(mockData.inventory_value_by_category);
      });

      it('should handle response with null stats', async () => {
        const mockData = {
          stats: null,
          low_stock_alerts: [],
          inventory_value_by_category: [],
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.stats).toBeNull();
        expect(state.lowStockAlerts).toEqual([]);
        expect(state.inventoryValueByCategory).toEqual([]);
      });

      it('should handle response with missing arrays (defaults to empty arrays)', async () => {
        const mockData = {
          stats: {
            total_components: 100,
            total_value: 25000,
            low_stock_count: 5,
            out_of_stock_count: 1,
          },
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.stats).toEqual(mockData.stats);
        expect(state.lowStockAlerts).toEqual([]);
        expect(state.inventoryValueByCategory).toEqual([]);
      });

      it('should handle API error response (done: false)', async () => {
        const mockResponse = { done: false, message: 'Server error occurred' };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Server error occurred');
      });

      it('should handle API error response without message', async () => {
        const mockResponse = { done: false };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to fetch dashboard data');
      });

      it('should handle network error', async () => {
        (dashboardApiService.getDashboardData as jest.Mock).mockRejectedValue(
          new Error('Network connection failed')
        );

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBe('An unknown error has occurred');
      });

      it('should handle API error with response object', async () => {
        const error = {
          response: {
            data: {
              message: 'Unauthorized access',
            },
          },
        };
        (dashboardApiService.getDashboardData as jest.Mock).mockRejectedValue(error);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Unauthorized access');
      });

      it('should handle empty low stock alerts array', async () => {
        const mockData = {
          stats: { total_components: 50, total_value: 10000, low_stock_count: 0, out_of_stock_count: 0 },
          low_stock_alerts: [],
          inventory_value_by_category: [{ category: 'Tools', total_value: 10000 }],
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.lowStockAlerts).toEqual([]);
        expect(state.stats?.low_stock_count).toBe(0);
      });

      it('should handle empty inventory value by category array', async () => {
        const mockData = {
          stats: { total_components: 0, total_value: 0, low_stock_count: 0, out_of_stock_count: 0 },
          low_stock_alerts: [],
          inventory_value_by_category: [],
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.inventoryValueByCategory).toEqual([]);
      });

      it('should clear previous error on successful fetch', async () => {
        // First, create an error state
        (dashboardApiService.getDashboardData as jest.Mock).mockRejectedValue(
          new Error('Initial error')
        );
        await store.dispatch(fetchDashboardData());

        let state = store.getState().inventoryDashboard;
        expect(state.error).toBe('An unknown error has occurred');

        // Then make a successful request
        const mockData = {
          stats: { total_components: 10, total_value: 1000, low_stock_count: 1, out_of_stock_count: 0 },
          low_stock_alerts: [],
          inventory_value_by_category: [],
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);
        await store.dispatch(fetchDashboardData());

        state = store.getState().inventoryDashboard;
        expect(state.error).toBeNull();
        expect(state.stats).toEqual(mockData.stats);
      });

      it('should handle large dataset', async () => {
        const lowStockAlerts = Array.from({ length: 100 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Component ${i + 1}`,
          sku: `SKU-${i + 1}`,
          quantity: i,
          min_stock_level: i + 10,
          storage_location_name: `Location ${i % 5}`,
        }));

        const categoryData = Array.from({ length: 20 }, (_, i) => ({
          category: `Category ${i + 1}`,
          total_value: (i + 1) * 1000,
        }));

        const mockData = {
          stats: {
            total_components: 1000,
            total_value: 500000,
            low_stock_count: 100,
            out_of_stock_count: 10,
          },
          low_stock_alerts: lowStockAlerts,
          inventory_value_by_category: categoryData,
        };
        const mockResponse = { done: true, body: mockData };
        (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

        await store.dispatch(fetchDashboardData());
        const state = store.getState().inventoryDashboard;

        expect(state.lowStockAlerts).toHaveLength(100);
        expect(state.inventoryValueByCategory).toHaveLength(20);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple concurrent fetch requests', async () => {
      const mockData = {
        stats: { total_components: 10, total_value: 1000, low_stock_count: 1, out_of_stock_count: 0 },
        low_stock_alerts: [],
        inventory_value_by_category: [],
      };
      const mockResponse = { done: true, body: mockData };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

      const promises = [
        store.dispatch(fetchDashboardData()),
        store.dispatch(fetchDashboardData()),
        store.dispatch(fetchDashboardData()),
      ];

      await Promise.all(promises);

      const state = store.getState().inventoryDashboard;
      expect(state.loading).toBe(false);
      expect(state.stats).toEqual(mockData.stats);
    });

    it('should maintain state consistency when request fails after success', async () => {
      // First successful fetch
      const mockSuccess = {
        stats: { total_components: 50, total_value: 5000, low_stock_count: 5, out_of_stock_count: 1 },
        low_stock_alerts: [{ id: '1', name: 'Test', sku: 'TST-001', quantity: 1, min_stock_level: 5, storage_location_name: 'Loc' }],
        inventory_value_by_category: [{ category: 'Test', total_value: 5000 }],
      };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue({
        done: true,
        body: mockSuccess,
      });
      await store.dispatch(fetchDashboardData());

      // Then failed fetch
      (dashboardApiService.getDashboardData as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      await store.dispatch(fetchDashboardData());

      const state = store.getState().inventoryDashboard;
      // Should keep old data when new fetch fails
      expect(state.stats).toEqual(mockSuccess.stats);
      expect(state.lowStockAlerts).toEqual(mockSuccess.low_stock_alerts);
      expect(state.error).toBe('An unknown error has occurred');
    });

    it('should handle undefined response body', async () => {
      const mockResponse = { done: true, body: undefined };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(fetchDashboardData());
      const state = store.getState().inventoryDashboard;

      expect(state.loading).toBe(false);
      // Should handle gracefully without crashing
    });

    it('should handle malformed stats object', async () => {
      const mockData = {
        stats: {
          // Missing required fields
          total_components: 10,
        },
        low_stock_alerts: [],
        inventory_value_by_category: [],
      };
      const mockResponse = { done: true, body: mockData };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(fetchDashboardData());
      const state = store.getState().inventoryDashboard;

      expect(state.loading).toBe(false);
      expect(state.stats).toEqual(mockData.stats);
    });

    it('should handle zero values in stats', async () => {
      const mockData = {
        stats: {
          total_components: 0,
          total_value: 0,
          low_stock_count: 0,
          out_of_stock_count: 0,
        },
        low_stock_alerts: [],
        inventory_value_by_category: [],
      };
      const mockResponse = { done: true, body: mockData };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(fetchDashboardData());
      const state = store.getState().inventoryDashboard;

      expect(state.stats).toEqual(mockData.stats);
      expect(state.stats?.total_components).toBe(0);
    });

    it('should handle negative values in stats', async () => {
      const mockData = {
        stats: {
          total_components: -5,
          total_value: -1000,
          low_stock_count: -2,
          out_of_stock_count: -1,
        },
        low_stock_alerts: [],
        inventory_value_by_category: [],
      };
      const mockResponse = { done: true, body: mockData };
      (dashboardApiService.getDashboardData as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(fetchDashboardData());
      const state = store.getState().inventoryDashboard;

      // Should accept the values as-is (backend should handle validation)
      expect(state.stats).toEqual(mockData.stats);
    });
  });
});
