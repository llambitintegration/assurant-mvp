/**
 * Integration Tests for Transactions API Service
 * Tests API interactions using MSW (Mock Service Worker)
 */

import { http, HttpResponse } from 'msw';
import { server, createMockResponse, createErrorResponse } from './setup';
import { transactionsApiService } from '../transactions.api.service';
import { ITransaction, ITransactionListResponse } from '@/types/inventory/transaction.types';

const BASE_URL = '*/api/v1/inv/transactions';

describe('transactionsApiService', () => {
  describe('getTransactions', () => {
    it('should fetch transactions successfully', async () => {
      const mockData: ITransactionListResponse = {
        items: [
          {
            id: '1',
            component_id: 'comp-1',
            transaction_type: 'receive',
            quantity: 100,
            unit_cost: 10.5,
            total_cost: 1050,
            reference_number: 'REF-001',
            transaction_date: '2024-01-01T00:00:00Z',
            created_at: '2024-01-01T00:00:00Z',
          } as ITransaction,
          {
            id: '2',
            component_id: 'comp-2',
            transaction_type: 'issue',
            quantity: 50,
            reference_number: 'REF-002',
            transaction_date: '2024-01-02T00:00:00Z',
            created_at: '2024-01-02T00:00:00Z',
          } as ITransaction,
        ],
        total: 2,
        page: 1,
        size: 10,
      };

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockData));
        })
      );

      const result = await transactionsApiService.getTransactions({});

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.items[0].transaction_type).toBe('receive');
    });

    it('should handle empty response', async () => {
      const mockData: ITransactionListResponse = {
        items: [],
        total: 0,
        page: 1,
        size: 10,
      };

      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockData));
        })
      );

      const result = await transactionsApiService.getTransactions({});

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(0);
      expect(result.body.total).toBe(0);
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

      const result = await transactionsApiService.getTransactions({});

      expect(result.done).toBe(false);
      expect(result.message).toBe('Internal server error');
    });

    it('should handle network error', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.error();
        })
      );

      await expect(transactionsApiService.getTransactions({})).rejects.toThrow();
    });

    it('should pass query parameters correctly', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(BASE_URL, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      await transactionsApiService.getTransactions({
        page: 2,
        size: 20,
        transaction_type: 'receive',
        component_id: 'comp-123',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

      expect(receivedParams?.get('page')).toBe('2');
      expect(receivedParams?.get('size')).toBe('20');
      expect(receivedParams?.get('transaction_type')).toBe('receive');
      expect(receivedParams?.get('component_id')).toBe('comp-123');
      expect(receivedParams?.get('start_date')).toBe('2024-01-01');
      expect(receivedParams?.get('end_date')).toBe('2024-01-31');
    });
  });

  describe('getTransactionById', () => {
    it('should fetch single transaction successfully', async () => {
      const mockTransaction: ITransaction = {
        id: '1',
        component_id: 'comp-1',
        transaction_type: 'receive',
        quantity: 100,
        unit_cost: 15.75,
        total_cost: 1575,
        reference_number: 'PO-001',
        notes: 'Test transaction',
        transaction_date: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      } as ITransaction;

      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(mockTransaction));
        })
      );

      const result = await transactionsApiService.getTransactionById('1');

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('1');
      expect(result.body.transaction_type).toBe('receive');
      expect(result.body.quantity).toBe(100);
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Transaction not found'),
            { status: 404 }
          );
        })
      );

      const result = await transactionsApiService.getTransactionById('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Transaction not found');
    });
  });

  describe('getComponentHistory', () => {
    it('should fetch component transaction history successfully', async () => {
      const mockHistory: ITransactionListResponse = {
        items: [
          {
            id: '1',
            component_id: 'comp-123',
            transaction_type: 'receive',
            quantity: 100,
            transaction_date: '2024-01-01T00:00:00Z',
            created_at: '2024-01-01T00:00:00Z',
          } as ITransaction,
          {
            id: '2',
            component_id: 'comp-123',
            transaction_type: 'issue',
            quantity: 25,
            transaction_date: '2024-01-05T00:00:00Z',
            created_at: '2024-01-05T00:00:00Z',
          } as ITransaction,
        ],
        total: 2,
        page: 1,
        size: 10,
      };

      server.use(
        http.get(`${BASE_URL}/component/:componentId`, () => {
          return HttpResponse.json(createMockResponse(mockHistory));
        })
      );

      const result = await transactionsApiService.getComponentHistory('comp-123');

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.items[0].component_id).toBe('comp-123');
      expect(result.body.items[1].component_id).toBe('comp-123');
    });

    it('should handle empty component history', async () => {
      const mockHistory: ITransactionListResponse = {
        items: [],
        total: 0,
        page: 1,
        size: 10,
      };

      server.use(
        http.get(`${BASE_URL}/component/:componentId`, () => {
          return HttpResponse.json(createMockResponse(mockHistory));
        })
      );

      const result = await transactionsApiService.getComponentHistory('comp-new');

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(0);
    });

    it('should pass query parameters with filters', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(`${BASE_URL}/component/:componentId`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      await transactionsApiService.getComponentHistory('comp-123', {
        page: 1,
        size: 25,
        transaction_type: 'receive',
      });

      expect(receivedParams?.get('page')).toBe('1');
      expect(receivedParams?.get('size')).toBe('25');
      expect(receivedParams?.get('transaction_type')).toBe('receive');
    });

    it('should work without optional filters', async () => {
      server.use(
        http.get(`${BASE_URL}/component/:componentId`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          // Should not have any query params when filters not provided
          expect(params.toString()).toBe('');
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      const result = await transactionsApiService.getComponentHistory('comp-123');

      expect(result.done).toBe(true);
    });

    it('should handle component not found error (404)', async () => {
      server.use(
        http.get(`${BASE_URL}/component/:componentId`, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await transactionsApiService.getComponentHistory('invalid-id');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });
  });

  describe('createTransaction', () => {
    it('should create receive transaction successfully', async () => {
      const mockTransaction: ITransaction = {
        id: 'new-id',
        component_id: 'comp-1',
        transaction_type: 'receive',
        quantity: 100,
        unit_cost: 12.5,
        total_cost: 1250,
        reference_number: 'PO-NEW',
        notes: 'New purchase order',
        transaction_date: '2024-01-15T00:00:00Z',
        created_at: '2024-01-15T00:00:00Z',
      } as ITransaction;

      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockTransaction));
        })
      );

      const result = await transactionsApiService.createTransaction({
        component_id: 'comp-1',
        transaction_type: 'receive',
        quantity: 100,
        unit_cost: 12.5,
        reference_number: 'PO-NEW',
        transaction_date: '2024-01-15T00:00:00Z',
      });

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('new-id');
      expect(result.body.transaction_type).toBe('receive');
      expect(result.body.quantity).toBe(100);
    });

    it('should create issue transaction successfully', async () => {
      const mockTransaction: ITransaction = {
        id: 'new-id',
        component_id: 'comp-2',
        transaction_type: 'issue',
        quantity: 50,
        reference_number: 'WO-123',
        notes: 'Work order issue',
        transaction_date: '2024-01-15T00:00:00Z',
        created_at: '2024-01-15T00:00:00Z',
      } as ITransaction;

      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockTransaction));
        })
      );

      const result = await transactionsApiService.createTransaction({
        component_id: 'comp-2',
        transaction_type: 'issue',
        quantity: 50,
        reference_number: 'WO-123',
        transaction_date: '2024-01-15T00:00:00Z',
      });

      expect(result.done).toBe(true);
      expect(result.body.transaction_type).toBe('issue');
      expect(result.body.quantity).toBe(50);
    });

    it('should handle validation error (400)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Validation failed: component_id is required'),
            { status: 400 }
          );
        })
      );

      const result = await transactionsApiService.createTransaction({} as any);

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should handle insufficient stock error (409)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Insufficient stock: only 10 units available'),
            { status: 409 }
          );
        })
      );

      const result = await transactionsApiService.createTransaction({
        component_id: 'comp-1',
        transaction_type: 'issue',
        quantity: 100,
        transaction_date: '2024-01-15T00:00:00Z',
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('Insufficient stock');
    });

    it('should handle component not found error (404)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await transactionsApiService.createTransaction({
        component_id: 'invalid-id',
        transaction_type: 'receive',
        quantity: 10,
        transaction_date: '2024-01-15T00:00:00Z',
      });

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });

    it('should send correct request body for receive transaction', async () => {
      let receivedBody: any;

      server.use(
        http.post(BASE_URL, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as ITransaction));
        })
      );

      const testData = {
        component_id: 'comp-1',
        transaction_type: 'receive' as const,
        quantity: 100,
        unit_cost: 25.5,
        reference_number: 'PO-TEST',
        notes: 'Test receive',
        transaction_date: '2024-01-15T00:00:00Z',
      };

      await transactionsApiService.createTransaction(testData);

      expect(receivedBody.component_id).toBe('comp-1');
      expect(receivedBody.transaction_type).toBe('receive');
      expect(receivedBody.quantity).toBe(100);
      expect(receivedBody.unit_cost).toBe(25.5);
      expect(receivedBody.reference_number).toBe('PO-TEST');
    });

    it('should send correct request body for issue transaction', async () => {
      let receivedBody: any;

      server.use(
        http.post(BASE_URL, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as ITransaction));
        })
      );

      const testData = {
        component_id: 'comp-2',
        transaction_type: 'issue' as const,
        quantity: 50,
        reference_number: 'WO-TEST',
        notes: 'Test issue',
        transaction_date: '2024-01-15T00:00:00Z',
      };

      await transactionsApiService.createTransaction(testData);

      expect(receivedBody.component_id).toBe('comp-2');
      expect(receivedBody.transaction_type).toBe('issue');
      expect(receivedBody.quantity).toBe(50);
      expect(receivedBody.unit_cost).toBeUndefined(); // Issue transactions don't have unit_cost
    });
  });
});
