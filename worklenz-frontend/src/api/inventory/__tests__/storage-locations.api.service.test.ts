/**
 * Integration Tests for Storage Locations API Service
 * Tests API interactions using MSW (Mock Service Worker)
 */

import { http, HttpResponse } from 'msw';
import { server, createMockResponse, createErrorResponse } from './setup';
import { storageLocationsApiService } from '../storage-locations.api.service';
import {
  IStorageLocation,
  ILocationHierarchy,
  IStorageLocationListResponse,
} from '@/types/inventory/storage-location.types';

const BASE_URL = '*/api/v1/inv/locations';

describe('storageLocationsApiService', () => {
  describe('getStorageLocations', () => {
    it('should fetch storage locations successfully', async () => {
      const mockData: IStorageLocationListResponse = {
        items: [
          {
            id: '1',
            name: 'Warehouse A',
            code: 'WH-A',
            type: 'warehouse',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as IStorageLocation,
          {
            id: '2',
            name: 'Room B',
            code: 'RM-B',
            type: 'room',
            parent_id: '1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } as IStorageLocation,
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

      const result = await storageLocationsApiService.getStorageLocations({});

      expect(result.done).toBe(true);
      expect(result.body.items).toHaveLength(2);
      expect(result.body.total).toBe(2);
      expect(result.body.items[0].name).toBe('Warehouse A');
    });

    it('should handle empty response', async () => {
      const mockData: IStorageLocationListResponse = {
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

      const result = await storageLocationsApiService.getStorageLocations({});

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

      const result = await storageLocationsApiService.getStorageLocations({});

      expect(result.done).toBe(false);
      expect(result.message).toBe('Internal server error');
    });

    it('should handle network error', async () => {
      server.use(
        http.get(BASE_URL, () => {
          return HttpResponse.error();
        })
      );

      await expect(storageLocationsApiService.getStorageLocations({})).rejects.toThrow();
    });

    it('should pass query parameters correctly', async () => {
      let receivedParams: URLSearchParams | undefined;

      server.use(
        http.get(BASE_URL, ({ request }) => {
          receivedParams = new URL(request.url).searchParams;
          return HttpResponse.json(createMockResponse({ items: [], total: 0, page: 1, size: 10 }));
        })
      );

      await storageLocationsApiService.getStorageLocations({
        page: 2,
        size: 15,
        search: 'warehouse',
        type: 'warehouse',
      });

      expect(receivedParams?.get('page')).toBe('2');
      expect(receivedParams?.get('size')).toBe('15');
      expect(receivedParams?.get('search')).toBe('warehouse');
      expect(receivedParams?.get('type')).toBe('warehouse');
    });
  });

  describe('getStorageLocationById', () => {
    it('should fetch single storage location successfully', async () => {
      const mockLocation: IStorageLocation = {
        id: '1',
        name: 'Test Warehouse',
        code: 'WH-TEST',
        type: 'warehouse',
        address: '123 Storage St',
        city: 'Storage City',
        country: 'Storage Country',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as IStorageLocation;

      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(mockLocation));
        })
      );

      const result = await storageLocationsApiService.getStorageLocationById('1');

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('1');
      expect(result.body.name).toBe('Test Warehouse');
      expect(result.body.type).toBe('warehouse');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.get(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Storage location not found'),
            { status: 404 }
          );
        })
      );

      const result = await storageLocationsApiService.getStorageLocationById('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Storage location not found');
    });
  });

  describe('getLocationHierarchy', () => {
    it('should fetch location hierarchy successfully', async () => {
      const mockHierarchy: ILocationHierarchy[] = [
        {
          id: '1',
          name: 'Warehouse A',
          code: 'WH-A',
          type: 'warehouse',
          children: [
            {
              id: '2',
              name: 'Room 1',
              code: 'RM-1',
              type: 'room',
              parent_id: '1',
              children: [],
            },
          ],
        },
      ];

      server.use(
        http.get(`${BASE_URL}/hierarchy`, () => {
          return HttpResponse.json(createMockResponse(mockHierarchy));
        })
      );

      const result = await storageLocationsApiService.getLocationHierarchy();

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].name).toBe('Warehouse A');
      expect(result.body[0].children).toHaveLength(1);
      expect(result.body[0].children![0].name).toBe('Room 1');
    });

    it('should handle empty hierarchy', async () => {
      server.use(
        http.get(`${BASE_URL}/hierarchy`, () => {
          return HttpResponse.json(createMockResponse([]));
        })
      );

      const result = await storageLocationsApiService.getLocationHierarchy();

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(0);
    });

    it('should handle server error (500)', async () => {
      server.use(
        http.get(`${BASE_URL}/hierarchy`, () => {
          return HttpResponse.json(
            createErrorResponse('Failed to build hierarchy'),
            { status: 500 }
          );
        })
      );

      const result = await storageLocationsApiService.getLocationHierarchy();

      expect(result.done).toBe(false);
      expect(result.message).toContain('Failed to build hierarchy');
    });
  });

  describe('searchStorageLocations', () => {
    it('should search storage locations successfully', async () => {
      const mockLocations: IStorageLocation[] = [
        {
          id: '1',
          name: 'Warehouse Search Result',
          code: 'WH-SEARCH',
          type: 'warehouse',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        } as IStorageLocation,
      ];

      server.use(
        http.get(`${BASE_URL}/search`, () => {
          return HttpResponse.json(createMockResponse(mockLocations));
        })
      );

      const result = await storageLocationsApiService.searchStorageLocations('warehouse');

      expect(result.done).toBe(true);
      expect(result.body).toHaveLength(1);
      expect(result.body[0].name).toBe('Warehouse Search Result');
    });

    it('should return empty array when no matches found', async () => {
      server.use(
        http.get(`${BASE_URL}/search`, () => {
          return HttpResponse.json(createMockResponse([]));
        })
      );

      const result = await storageLocationsApiService.searchStorageLocations('nonexistent');

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

      await storageLocationsApiService.searchStorageLocations('test query');

      expect(receivedParams?.get('search')).toBe('test query');
    });
  });

  describe('createStorageLocation', () => {
    it('should create storage location successfully', async () => {
      const mockLocation: IStorageLocation = {
        id: 'new-id',
        name: 'New Warehouse',
        code: 'WH-NEW',
        type: 'warehouse',
        address: '456 New St',
        city: 'New City',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as IStorageLocation;

      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(createMockResponse(mockLocation));
        })
      );

      const result = await storageLocationsApiService.createStorageLocation({
        name: 'New Warehouse',
        code: 'WH-NEW',
        type: 'warehouse',
      });

      expect(result.done).toBe(true);
      expect(result.body.id).toBe('new-id');
      expect(result.body.name).toBe('New Warehouse');
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

      const result = await storageLocationsApiService.createStorageLocation({} as any);

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should handle duplicate error (409)', async () => {
      server.use(
        http.post(BASE_URL, () => {
          return HttpResponse.json(
            createErrorResponse('Storage location with code already exists'),
            { status: 409 }
          );
        })
      );

      const result = await storageLocationsApiService.createStorageLocation({
        name: 'Duplicate Location',
        code: 'EXISTING-CODE',
        type: 'warehouse',
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.post(BASE_URL, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as IStorageLocation));
        })
      );

      const testData = {
        name: 'Test Warehouse',
        code: 'WH-TEST',
        type: 'warehouse' as const,
        address: '123 Test St',
        parent_id: 'parent-1',
      };

      await storageLocationsApiService.createStorageLocation(testData);

      expect(receivedBody.name).toBe('Test Warehouse');
      expect(receivedBody.code).toBe('WH-TEST');
      expect(receivedBody.type).toBe('warehouse');
      expect(receivedBody.address).toBe('123 Test St');
    });
  });

  describe('updateStorageLocation', () => {
    it('should update storage location successfully', async () => {
      const updatedLocation: IStorageLocation = {
        id: '1',
        name: 'Updated Warehouse',
        code: 'WH-001',
        type: 'warehouse',
        address: '789 Updated St',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      } as IStorageLocation;

      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(updatedLocation));
        })
      );

      const result = await storageLocationsApiService.updateStorageLocation('1', {
        name: 'Updated Warehouse',
        address: '789 Updated St',
      });

      expect(result.done).toBe(true);
      expect(result.body.name).toBe('Updated Warehouse');
      expect(result.body.address).toBe('789 Updated St');
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Storage location not found'),
            { status: 404 }
          );
        })
      );

      const result = await storageLocationsApiService.updateStorageLocation('999', {
        name: 'Non-existent',
      });

      expect(result.done).toBe(false);
      expect(result.message).toBe('Storage location not found');
    });

    it('should handle validation error (400)', async () => {
      server.use(
        http.put(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Validation failed: invalid type'),
            { status: 400 }
          );
        })
      );

      const result = await storageLocationsApiService.updateStorageLocation('1', {
        type: 'invalid' as any,
      });

      expect(result.done).toBe(false);
      expect(result.message).toContain('Validation failed');
    });

    it('should send correct request body', async () => {
      let receivedBody: any;

      server.use(
        http.put(`${BASE_URL}/:id`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json(createMockResponse({ id: '1' } as IStorageLocation));
        })
      );

      await storageLocationsApiService.updateStorageLocation('1', {
        name: 'Updated Name',
        address: '999 New Address',
      });

      expect(receivedBody.name).toBe('Updated Name');
      expect(receivedBody.address).toBe('999 New Address');
    });
  });

  describe('deleteStorageLocation', () => {
    it('should delete storage location successfully', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(createMockResponse(undefined));
        })
      );

      const result = await storageLocationsApiService.deleteStorageLocation('1');

      expect(result.done).toBe(true);
    });

    it('should handle not found error (404)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Storage location not found'),
            { status: 404 }
          );
        })
      );

      const result = await storageLocationsApiService.deleteStorageLocation('999');

      expect(result.done).toBe(false);
      expect(result.message).toBe('Storage location not found');
    });

    it('should handle cascade deletion error (409)', async () => {
      server.use(
        http.delete(`${BASE_URL}/:id`, () => {
          return HttpResponse.json(
            createErrorResponse('Cannot delete: storage location has child locations or components'),
            { status: 409 }
          );
        })
      );

      const result = await storageLocationsApiService.deleteStorageLocation('1');

      expect(result.done).toBe(false);
      expect(result.message).toContain('child locations or components');
    });
  });
});
