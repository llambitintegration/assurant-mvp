/**
 * Integration Tests for Dashboard API Service
 * Tests API interactions using MSW (Mock Service Worker)
 */

import { http, HttpResponse } from 'msw';
import { server, createMockResponse, createErrorResponse } from './setup';
import { dashboardApiService } from '../dashboard.api.service';
import { IDashboardResponse } from '@/types/inventory/dashboard.types';

const BASE_URL = '*/api/v1/inv/dashboard';

describe('dashboardApiService', () => {
  describe('getDashboardData', () => {
    it('should fetch dashboard data successfully', async () => {
      const mockDashboard: IDashboardResponse = {
        total_components: 150,
        total_value: 25000.50,
        low_stock_count: 12,
        recent_transactions_count: 45,
        top_components: [
          {
            id: '1',
            name: 'Component A',
            sku: 'SKU-001',
            quantity: 500,
            unit: 'ea',
            value: 5000,
          },
          {
            id: '2',
            name: 'Component B',
            sku: 'SKU-002',
            quantity: 300,
            unit: 'ea',
            value: 3000,
          },
        ],
        transaction_summary: {
          receives: 120,
          issues: 80,
          adjustments: 10,
          total: 210,
        },
        storage_summary: [
          {
            location_id: 'loc-1',
            location_name: 'Warehouse A',
            component_count: 75,
            total_value: 15000,
          },
          {
            location_id: 'loc-2',
            location_name: 'Warehouse B',
            component_count: 50,
            total_value: 10000.50,
          },
        ],
      } as IDashboardResponse;

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockDashboard));
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(true);
      expect(result.body.total_components).toBe(150);
      expect(result.body.total_value).toBe(25000.50);
      expect(result.body.low_stock_count).toBe(12);
      expect(result.body.recent_transactions_count).toBe(45);
    });

    it('should fetch dashboard with top components', async () => {
      const mockDashboard: IDashboardResponse = {
        total_components: 100,
        total_value: 20000,
        low_stock_count: 5,
        recent_transactions_count: 30,
        top_components: [
          {
            id: '1',
            name: 'Top Component',
            sku: 'SKU-TOP',
            quantity: 1000,
            unit: 'ea',
            value: 10000,
          },
        ],
        transaction_summary: {
          receives: 50,
          issues: 40,
          adjustments: 5,
          total: 95,
        },
        storage_summary: [],
      } as IDashboardResponse;

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockDashboard));
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(true);
      expect(result.body.top_components).toHaveLength(1);
      expect(result.body.top_components[0].name).toBe('Top Component');
      expect(result.body.top_components[0].value).toBe(10000);
    });

    it('should fetch dashboard with transaction summary', async () => {
      const mockDashboard: IDashboardResponse = {
        total_components: 50,
        total_value: 10000,
        low_stock_count: 3,
        recent_transactions_count: 20,
        top_components: [],
        transaction_summary: {
          receives: 100,
          issues: 75,
          adjustments: 15,
          total: 190,
        },
        storage_summary: [],
      } as IDashboardResponse;

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockDashboard));
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(true);
      expect(result.body.transaction_summary.receives).toBe(100);
      expect(result.body.transaction_summary.issues).toBe(75);
      expect(result.body.transaction_summary.adjustments).toBe(15);
      expect(result.body.transaction_summary.total).toBe(190);
    });

    it('should fetch dashboard with storage summary', async () => {
      const mockDashboard: IDashboardResponse = {
        total_components: 200,
        total_value: 50000,
        low_stock_count: 20,
        recent_transactions_count: 100,
        top_components: [],
        transaction_summary: {
          receives: 200,
          issues: 150,
          adjustments: 25,
          total: 375,
        },
        storage_summary: [
          {
            location_id: 'wh-1',
            location_name: 'Main Warehouse',
            component_count: 120,
            total_value: 30000,
          },
          {
            location_id: 'wh-2',
            location_name: 'Secondary Warehouse',
            component_count: 80,
            total_value: 20000,
          },
        ],
      } as IDashboardResponse;

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockDashboard));
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(true);
      expect(result.body.storage_summary).toHaveLength(2);
      expect(result.body.storage_summary[0].location_name).toBe('Main Warehouse');
      expect(result.body.storage_summary[0].component_count).toBe(120);
      expect(result.body.storage_summary[1].location_name).toBe('Secondary Warehouse');
    });

    it('should handle empty dashboard data', async () => {
      const mockDashboard: IDashboardResponse = {
        total_components: 0,
        total_value: 0,
        low_stock_count: 0,
        recent_transactions_count: 0,
        top_components: [],
        transaction_summary: {
          receives: 0,
          issues: 0,
          adjustments: 0,
          total: 0,
        },
        storage_summary: [],
      } as IDashboardResponse;

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockDashboard));
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(true);
      expect(result.body.total_components).toBe(0);
      expect(result.body.total_value).toBe(0);
      expect(result.body.top_components).toHaveLength(0);
      expect(result.body.storage_summary).toHaveLength(0);
    });

    it('should handle server error (500)', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Internal server error'),
            { status: 500 }
          );
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(false);
      expect(result.message).toBe('Internal server error');
    });

    it('should handle network error', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.error();
        })
      );

      await expect(dashboardApiService.getDashboardData()).rejects.toThrow();
    });

    it('should handle database connection error (503)', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Service unavailable: database connection error'),
            { status: 503 }
          );
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(false);
      expect(result.message).toContain('Service unavailable');
    });

    it('should handle authentication error (401)', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Unauthorized: invalid or expired token'),
            { status: 401 }
          );
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(false);
      expect(result.message).toContain('Unauthorized');
    });

    it('should handle permission error (403)', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Forbidden: insufficient permissions to view dashboard'),
            { status: 403 }
          );
        })
      );

      const result = await dashboardApiService.getDashboardData();

      expect(result.done).toBe(false);
      expect(result.message).toContain('Forbidden');
    });

    it('should verify no query parameters are sent', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(BASE_URL, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({
            total_components: 0,
            total_value: 0,
            low_stock_count: 0,
            recent_transactions_count: 0,
            top_components: [],
            transaction_summary: { receives: 0, issues: 0, adjustments: 0, total: 0 },
            storage_summary: [],
          } as IDashboardResponse));
        })
      );

      await dashboardApiService.getDashboardData();

      // Dashboard endpoint should not have any query parameters
      expect(receivedParams?.toString()).toBe('');
    });

    it('should verify correct HTTP method is used', async () => {
      let requestMethod: string = '';

      server.use(
        http.get(BASE_URL, ({ request }) => {
          requestMethod = request.method;
          return HttpResponse.json(createMockResponse({
            total_components: 0,
            total_value: 0,
            low_stock_count: 0,
            recent_transactions_count: 0,
            top_components: [],
            transaction_summary: { receives: 0, issues: 0, adjustments: 0, total: 0 },
            storage_summary: [],
          } as IDashboardResponse));
        })
      );

      await dashboardApiService.getDashboardData();

      expect(requestMethod).toBe('GET');
    });
  });
});
