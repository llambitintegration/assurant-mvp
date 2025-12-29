/**
 * Integration Tests for Suppliers API Service
 * Tests API interactions using MSW (Mock Service Worker)
 */

import { http, HttpResponse } from 'msw';
import { server, createMockResponse, createErrorResponse } from './setup';
import { suppliersApiService } from '../suppliers.api.service';
import { ISupplier, ISupplierListResponse } from '@/types/inventory/supplier.types';

const BASE_URL = '*/api/v1/inv/suppliers';

describe('suppliersApiService', () => {
  describe('getSuppliers', () => {
    it('should fetch suppliers successfully', async () => {
      const mockData: ISupplierListResponse = {
        items: [
          {
            id: '1',
            name: 'Supplier 1',
            code: 'SUP-001',
            email: 'supplier1@example.com',
            phone: '123-456-7890',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as ISupplier,
          {
            id: '2',
            name: 'Supplier 2',
            code: 'SUP-002',
            email: 'supplier2@example.com',
            phone: '098-765-4321',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as ISupplier,
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

      const result = await suppliersApiService.getSuppliers({});

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.items[0].name).toBe('Supplier 1');
    });

    it('should handle empty response', async () => {
      const mockData: ISupplierListResponse = {
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

      const result = await suppliersApiService.getSuppliers({});

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

      const result = await suppliersApiService.getSuppliers({});

      expect(result.done).toBe(false);
      expect(result.message).toBe('Internal server error');
    });

    it('should handle network error', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.error();
        })
      );

      await expect(suppliersApiService.getSuppliers({})).rejects.toThrow();
    });

    it('should pass query parameters correctly', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(BASE_URL, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      await suppliersApiService.getSuppliers({
        page: 3,
        size: 25,
        search: 'test supplier',
      });

      expect(receivedParams?.get('page')).toBe('3');
      expect(receivedParams?.get('size')).toBe('25');
      expect(receivedParams?.get('search')).toBe('test supplier');
    });
  });

  describe('getSupplierById', () => {
    it('should fetch single supplier successfully', async () => {
      const mockSupplier: ISupplier = {
        id: '1',
        name: 'Test Supplier',
        code: 'SUP-TEST',
        email: 'test@supplier.com',
        phone: '555-1234',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as ISupplier;

      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(mockSupplier));
        })
      );

      const result = await suppliersApiService.getSupplierById('1');

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('1');
      expect(result.body.name).toBe('Test Supplier');
      expect(result.body.email).toBe('test@supplier.com');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Supplier not found'),
            { status: 404 }
          );
        })
      );

      const result = await suppliersApiService.getSupplierById('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Supplier not found');
    });
  });

  describe('searchSuppliers', () => {
    it('should search suppliers successfully', async () => {
      const mockSuppliers: ISupplier[] = [
        {
          id: '1',
          name: 'Search Result Supplier',
          code: 'SUP-SEARCH',
          email: 'search@supplier.com',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        } as ISupplier,
      ];

      server.use(
        http.get(`${BASE_URL}/search`, () => {
          return HttpResponse.json(createMockResponse(mockSuppliers));
        })
      );

      const result = await suppliersApiService.searchSuppliers('test');

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].name).toBe('Search Result Supplier');
    });

    it('should return empty array when no matches found', async () => {
      server.use(
        http.get(`${BASE_URL}/search`, () => {
          return HttpResponse.json(createMockResponse([]));
        })
      );

      const result = await suppliersApiService.searchSuppliers('nonexistent');

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(0);
    });

    it('should pass search query parameter', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(`${BASE_URL}/search`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse([]));
        })
      );

      await suppliersApiService.searchSuppliers('test query');

      expect(receivedParams?.get('search')).toBe('test query');
    });
  });

  describe('createSupplier', () => {
    it('should create supplier successfully', async () => {
      const mockSupplier: ISupplier = {
        id: 'new-id',
        name: 'New Supplier',
        code: 'SUP-NEW',
        email: 'new@supplier.com',
        phone: '555-9999',
        address: '456 New St',
        city: 'New City',
        country: 'New Country',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as ISupplier;

      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockSupplier));
        })
      );

      const result = await suppliersApiService.createSupplier({
        name: 'New Supplier',
        code: 'SUP-NEW',
        email: 'new@supplier.com',
        phone: '555-9999',
      });

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('new-id');
      expect(result.body.name).toBe('New Supplier');
    });

    it('should handle validation error (400)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Validation failed: name is required'),
            { status: 400 }
          );
        })
      );

      const result = await suppliersApiService.createSupplier({} as any);

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should handle duplicate error (409)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Supplier with code already exists'),
            { status: 409 }
          );
        })
      );

      const result = await suppliersApiService.createSupplier({
        name: 'Duplicate Supplier',
        code: 'EXISTING-CODE',
        email: 'duplicate@supplier.com',
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.post(BASE_URL, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as ISupplier));
        })
      );

      const testData = {
        name: 'Test Supplier',
        code: 'SUP-TEST',
        email: 'test@supplier.com',
        phone: '555-1234',
        address: '123 Test St',
      };

      await suppliersApiService.createSupplier(testData);

      expect(receivedBody.name).toBe('Test Supplier');
      expect(receivedBody.code).toBe('SUP-TEST');
      expect(receivedBody.email).toBe('test@supplier.com');
      expect(receivedBody.phone).toBe('555-1234');
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      const updatedSupplier: ISupplier = {
        id: '1',
        name: 'Updated Supplier',
        code: 'SUP-001',
        email: 'updated@supplier.com',
        phone: '555-0000',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      } as ISupplier;

      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(updatedSupplier));
        })
      );

      const result = await suppliersApiService.updateSupplier('1', {
        name: 'Updated Supplier',
        email: 'updated@supplier.com',
      });

      expect(result.done).toBe(true);
      expect(result.body.name).toBe('Updated Supplier');
      expect(result.body.email).toBe('updated@supplier.com');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Supplier not found'),
            { status: 404 }
          );
        })
      );

      const result = await suppliersApiService.updateSupplier('999', {
        name: 'Non-existent',
      });

      expect(result.done).toBe(false);
      expect(result.message).toBe('Supplier not found');
    });

    it('should handle validation error (400)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Validation failed: invalid email format'),
            { status: 400 }
          );
        })
      );

      const result = await suppliersApiService.updateSupplier('1', {
        email: 'invalid-email',
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.put(`${BASE_URL}/:id`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as ISupplier));
        })
      );

      await suppliersApiService.updateSupplier('1', {
        name: 'Updated Name',
        phone: '555-9999',
      });

      expect(receivedBody.name).toBe('Updated Name');
      expect(receivedBody.phone).toBe('555-9999');
    });
  });

  describe('deleteSupplier', () => {
    it('should delete supplier successfully', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(undefined));
        })
      );

      const result = await suppliersApiService.deleteSupplier('1');

      expect(result.done).toBe(true);
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Supplier not found'),
            { status: 404 }
          );
        })
      );

      const result = await suppliersApiService.deleteSupplier('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Supplier not found');
    });

    it('should handle cascade deletion error (409)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Cannot delete: supplier has associated components'),
            { status: 409 }
          );
        })
      );

      const result = await suppliersApiService.deleteSupplier('1');

      expect(result.done).toBe(false);
      expect(result.message).toContain('associated components');
    });
  });
});
