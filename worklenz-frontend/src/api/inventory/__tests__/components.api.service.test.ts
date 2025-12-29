/**
 * Integration Tests for Components API Service
 * Tests API interactions using MSW (Mock Service Worker)
 */

import { http, HttpResponse } from 'msw';
import { server, createMockResponse, createErrorResponse } from './setup';
import { componentsApiService } from '../components.api.service';
import { IComponent, IComponentListResponse, ILowStockComponent } from '@/types/inventory/component.types';

const BASE_URL = '*/api/v1/inv/components';

describe('componentsApiService', () => {
  describe('getComponents', () => {
    it('should fetch components successfully', async () => {
      const mockData: IComponentListResponse = {
        items: [
          {
            id: '1',
            name: 'Component 1',
            sku: 'SKU-001',
            quantity: 100,
            unit: 'ea',
            owner_type: 'storage_location',
            storage_location_id: 'loc-1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as IComponent,
          {
            id: '2',
            name: 'Component 2',
            sku: 'SKU-002',
            quantity: 50,
            unit: 'ea',
            owner_type: 'storage_location',
            storage_location_id: 'loc-2',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as IComponent,
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

      const result = await componentsApiService.getComponents({});

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.items[0].name).toBe('Component 1');
    });

    it('should handle empty response', async () => {
      const mockData: IComponentListResponse = {
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

      const result = await componentsApiService.getComponents({});

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

      const result = await componentsApiService.getComponents({});

      expect(result.done).toBe(false);
      expect(result.message).toBe('Internal server error');
    });

    it('should handle network error', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.error();
        })
      );

      await expect(componentsApiService.getComponents({})).rejects.toThrow();
    });

    it('should pass query parameters correctly', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(BASE_URL, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      await componentsApiService.getComponents({
        page: 2,
        size: 20,
        search: 'test',
        owner_type: 'storage_location',
      });

      expect(receivedParams?.get('page')).toBe('2');
      expect(receivedParams?.get('size')).toBe('20');
      expect(receivedParams?.get('search')).toBe('test');
      expect(receivedParams?.get('owner_type')).toBe('storage_location');
    });
  });

  describe('getComponentById', () => {
    it('should fetch single component successfully', async () => {
      const mockComponent: IComponent = {
        id: '1',
        name: 'Test Component',
        sku: 'SKU-001',
        quantity: 100,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as IComponent;

      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(mockComponent));
        })
      );

      const result = await componentsApiService.getComponentById('1');

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('1');
      expect(result.body.name).toBe('Test Component');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await componentsApiService.getComponentById('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });
  });

  describe('searchComponents', () => {
    it('should search components successfully', async () => {
      const mockComponents: IComponent[] = [
        {
          id: '1',
          name: 'Search Result 1',
          sku: 'SKU-001',
          quantity: 100,
          unit: 'ea',
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        } as IComponent,
      ];

      server.use(
        http.get(`${BASE_URL}/search`, () => {
          return HttpResponse.json(createMockResponse(mockComponents));
        })
      );

      const result = await componentsApiService.searchComponents('test');

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].name).toBe('Search Result 1');
    });

    it('should pass search query parameter', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(`${BASE_URL}/search`, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse([]));
        })
      );

      await componentsApiService.searchComponents('test query');

      expect(receivedParams?.get('search')).toBe('test query');
    });
  });

  describe('getLowStockComponents', () => {
    it('should fetch low stock components successfully', async () => {
      const mockLowStock: ILowStockComponent[] = [
        {
          id: '1',
          name: 'Low Stock Item',
          sku: 'SKU-001',
          quantity: 5,
          unit: 'ea',
          reorder_level: 10,
          owner_type: 'storage_location',
          storage_location_id: 'loc-1',
        } as ILowStockComponent,
      ];

      server.use(
        http.get(`${BASE_URL}/low-stock`, () => {
          return HttpResponse.json(createMockResponse(mockLowStock));
        })
      );

      const result = await componentsApiService.getLowStockComponents();

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].quantity).toBe(5);
      expect(result.body[0].reorder_level).toBe(10);
    });

    it('should handle empty low stock list', async () => {
      server.use(
        http.get(`${BASE_URL}/low-stock`, () => {
          return HttpResponse.json(createMockResponse([]));
        })
      );

      const result = await componentsApiService.getLowStockComponents();

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(0);
    });
  });

  describe('createComponent', () => {
    it('should create component successfully', async () => {
      const mockComponent: IComponent = {
        id: 'new-id',
        name: 'New Component',
        sku: 'SKU-123',
        quantity: 100,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as IComponent;

      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockComponent));
        })
      );

      const result = await componentsApiService.createComponent({
        name: 'New Component',
        sku: 'SKU-123',
        quantity: 100,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
      });

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('new-id');
      expect(result.body.name).toBe('New Component');
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

      const result = await componentsApiService.createComponent({} as any);

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should handle duplicate error (409)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Component with SKU already exists'),
            { status: 409 }
          );
        })
      );

      const result = await componentsApiService.createComponent({
        name: 'Duplicate',
        sku: 'EXISTING-SKU',
        quantity: 10,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.post(BASE_URL, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as IComponent));
        })
      );

      const testData = {
        name: 'Test Component',
        sku: 'SKU-TEST',
        quantity: 50,
        unit: 'ea',
        owner_type: 'storage_location' as const,
        storage_location_id: 'loc-1',
      };

      await componentsApiService.createComponent(testData);

      expect(receivedBody.name).toBe('Test Component');
      expect(receivedBody.sku).toBe('SKU-TEST');
      expect(receivedBody.quantity).toBe(50);
    });
  });

  describe('updateComponent', () => {
    it('should update component successfully', async () => {
      const updatedComponent: IComponent = {
        id: '1',
        name: 'Updated Component',
        sku: 'SKU-001',
        quantity: 150,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      } as IComponent;

      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(updatedComponent));
        })
      );

      const result = await componentsApiService.updateComponent('1', {
        quantity: 150,
      });

      expect(result.done).toBe(true);
      expect(result.body.quantity).toBe(150);
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await componentsApiService.updateComponent('999', {
        quantity: 100,
      });

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });

    it('should handle validation error (400)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Validation failed: quantity must be positive'),
            { status: 400 }
          );
        })
      );

      const result = await componentsApiService.updateComponent('1', {
        quantity: -10,
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.put(`${BASE_URL}/:id`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as IComponent));
        })
      );

      await componentsApiService.updateComponent('1', {
        name: 'Updated Name',
        quantity: 200,
      });

      expect(receivedBody.name).toBe('Updated Name');
      expect(receivedBody.quantity).toBe(200);
    });
  });

  describe('deleteComponent', () => {
    it('should delete component successfully', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(undefined));
        })
      );

      const result = await componentsApiService.deleteComponent('1');

      expect(result.done).toBe(true);
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await componentsApiService.deleteComponent('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });

    it('should handle cascade deletion error (409)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Cannot delete: component has associated transactions'),
            { status: 409 }
          );
        })
      );

      const result = await componentsApiService.deleteComponent('1');

      expect(result.done).toBe(false);
      expect(result.message).toContain('associated transactions');
    });
  });

  describe('generateQrCode', () => {
    it('should generate QR code successfully', async () => {
      const mockComponent: IComponent = {
        id: '1',
        name: 'Component with QR',
        sku: 'SKU-001',
        quantity: 100,
        unit: 'ea',
        owner_type: 'storage_location',
        storage_location_id: 'loc-1',
        qr_code: 'data:image/png;base64,iVBORw0KG...',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as IComponent;

      server.use(
        http.post(`${BASE_URL}/:id/qr`, () => {
          return HttpResponse.json(createMockResponse(mockComponent));
        })
      );

      const result = await componentsApiService.generateQrCode('1');

      expect(result.done).toBe(true);
      expect(result.body.qr_code).toBeDefined();
      expect(result.body.qr_code).toContain('data:image');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.post(`${BASE_URL}/:id/qr`, () => {
          return HttpResponse.json(
            createErrorResponse('Component not found'),
            { status: 404 }
          );
        })
      );

      const result = await componentsApiService.generateQrCode('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Component not found');
    });
  });
});
