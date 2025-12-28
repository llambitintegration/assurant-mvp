/**
 * Components Service Unit Tests
 * Tests for component CRUD operations with polymorphic ownership and comprehensive validation
 */

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_components: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    inv_suppliers: {
      findFirst: jest.fn()
    },
    inv_storage_locations: {
      findFirst: jest.fn()
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn()
  }
}));

// Mock QR service
jest.mock('../../../../services/inv/qr-service', () => ({
  generateQRCodeForComponent: jest.fn()
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/components-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/component-fixtures');

import {
  createComponent,
  getComponentById,
  listComponents,
  updateComponent,
  deleteComponent,
  generateQRCodeForComponent,
  getLowStockComponents,
  searchComponents
} from '../../../../services/inv/components-service';
import prisma from '../../../../config/prisma';
import { generateQRCodeForComponent as mockGenerateQR } from '../../../../services/inv/qr-service';
import {
  createMockComponentWithSupplier,
  createMockComponentWithLocation,
  createComponentWithQRCode,
  createLowStockComponent,
  createOutOfStockComponent,
  createMockComponentList,
  createComponentsWithVariedStock,
  createInvalidOwnerComponent,
  createComponentsForSupplier,
  createComponentsForLocation
} from '../../../fixtures/inv/component-fixtures';
import { createMockSupplier } from '../../../fixtures/inv/supplier-fixtures';
import { createMockLocation } from '../../../fixtures/inv/location-fixtures';
import {
  ICreateComponentDto,
  IUpdateComponentDto,
  IComponentFilters
} from '../../../../interfaces/inv/component.interface';
import { Prisma } from '@prisma/client';

// Get reference to the mocked clients
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;
const mockQRService = mockGenerateQR as jest.MockedFunction<typeof mockGenerateQR>;

describe('Components Service', () => {
  const TEAM_ID = 'team-1-uuid';
  const USER_ID = 'user-1-uuid';
  const OTHER_TEAM_ID = 'team-2-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createComponent', () => {
    describe('Success cases', () => {
      it('should create a component with supplier ownership', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Resistor 10K Ohm',
          sku: 'RES-10K-001',
          description: '10K Ohm resistor',
          category: 'Resistors',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          quantity: 1000,
          unit: 'pcs',
          unit_cost: 0.05,
          reorder_level: 200
        };

        const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', team_id: TEAM_ID });
        const mockComponent = createMockComponentWithSupplier({
          id: 'component-1-uuid',
          ...createDto,
          team_id: TEAM_ID,
          created_by: USER_ID
        });

        const qrCodeResult = {
          qr_code_data: JSON.stringify({ id: 'component-1-uuid', name: createDto.name }),
          qr_code_image: 'data:image/png;base64,abc123'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null); // No duplicate SKU
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any);
        mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
        mockQRService.mockResolvedValueOnce(qrCodeResult);
        mockPrismaClient.inv_components.update.mockResolvedValueOnce({
          ...mockComponent,
          qr_code_data: qrCodeResult.qr_code_data,
          qr_code_image: qrCodeResult.qr_code_image
        } as any);

        const result = await createComponent(createDto, TEAM_ID, USER_ID);

        expect(result.name).toBe(createDto.name);
        expect(result.supplier_id).toBe(createDto.supplier_id);
        expect(result.storage_location_id).toBeNull();
        expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
          where: {
            id: 'supplier-1-uuid',
            team_id: TEAM_ID,
            is_active: true
          }
        });
        expect(mockQRService).toHaveBeenCalledWith('component-1-uuid', TEAM_ID);
      });

      it('should create a component with storage location ownership', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Capacitor 100uF',
          sku: 'CAP-100UF-001',
          owner_type: 'storage_location' as any,
          storage_location_id: 'location-1-uuid',
          quantity: 500,
          reorder_level: 100
        };

        const mockLocation = createMockLocation({ id: 'location-1-uuid', team_id: TEAM_ID });
        const mockComponent = createMockComponentWithLocation({
          id: 'component-2-uuid',
          ...createDto,
          team_id: TEAM_ID,
          created_by: USER_ID
        });

        const qrCodeResult = {
          qr_code_data: JSON.stringify({ id: 'component-2-uuid' }),
          qr_code_image: 'data:image/png;base64,xyz789'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null);
        mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValueOnce(mockLocation as any);
        mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
        mockQRService.mockResolvedValueOnce(qrCodeResult);
        mockPrismaClient.inv_components.update.mockResolvedValueOnce({
          ...mockComponent,
          ...qrCodeResult
        } as any);

        const result = await createComponent(createDto, TEAM_ID, USER_ID);

        expect(result.storage_location_id).toBe(createDto.storage_location_id);
        expect(result.supplier_id).toBeNull();
        expect(mockPrismaClient.inv_storage_locations.findFirst).toHaveBeenCalledWith({
          where: {
            id: 'location-1-uuid',
            team_id: TEAM_ID,
            is_active: true
          }
        });
      });

      it('should create component with minimal data', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Basic Part',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', team_id: TEAM_ID });
        const mockComponent = createMockComponentWithSupplier({
          id: 'component-minimal-uuid',
          name: createDto.name,
          sku: null,
          quantity: new Prisma.Decimal(0),
          team_id: TEAM_ID
        });

        mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null); // No duplicate SKU
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any);
        mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
        mockQRService.mockResolvedValueOnce({
          qr_code_data: '{}',
          qr_code_image: 'data:image/png;base64,min'
        });
        mockPrismaClient.inv_components.update.mockResolvedValueOnce(mockComponent as any);

        const result = await createComponent(createDto, TEAM_ID, USER_ID);

        expect(result.name).toBe(createDto.name);
        expect(result.quantity).toBeDefined();
      });

      it('should handle QR generation failure gracefully', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Component with QR Fail',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', team_id: TEAM_ID });
        const mockComponent = createMockComponentWithSupplier({
          id: 'component-qr-fail-uuid',
          name: createDto.name,
          team_id: TEAM_ID
        });

        mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null); // No duplicate SKU
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any);
        mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
        mockQRService.mockRejectedValueOnce(new Error('QR generation failed'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const result = await createComponent(createDto, TEAM_ID, USER_ID);

        expect(result).toEqual(mockComponent);
        expect(result.qr_code_data).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('Validation errors', () => {
      it('should throw error when name is empty', async () => {
        const createDto: ICreateComponentDto = {
          name: '',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Component name is required');

        expect(mockPrismaClient.inv_components.create).not.toHaveBeenCalled();
      });

      it('should throw error when name is only whitespace', async () => {
        const createDto: ICreateComponentDto = {
          name: '   ',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Component name is required');
      });

      it('should throw error for invalid owner_type', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'invalid_type' as any,
          supplier_id: 'supplier-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow("Invalid owner_type. Must be 'supplier' or 'storage_location'");
      });

      it('should throw error when supplier_id missing for supplier owner_type', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow("supplier_id is required when owner_type is 'supplier'");
      });

      it('should throw error when storage_location_id missing for storage_location owner_type', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'storage_location' as any
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow("storage_location_id is required when owner_type is 'storage_location'");
      });

      it('should throw error when supplier_id provided with storage_location owner_type', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'storage_location' as any,
          supplier_id: 'supplier-1-uuid',
          storage_location_id: 'location-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Cannot specify both supplier_id and storage_location_id');
      });

      it('should throw error when storage_location_id provided with supplier owner_type', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          storage_location_id: 'location-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Cannot specify both supplier_id and storage_location_id');
      });

      it('should throw error when both supplier_id and storage_location_id provided', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          storage_location_id: 'location-1-uuid'
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Cannot specify both supplier_id and storage_location_id');
      });

      it('should throw error when supplier not found', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'non-existent-supplier'
        };

        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Supplier not found or does not belong to this team');
      });

      it('should throw error when supplier belongs to different team', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-other-team'
        };

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(null); // No duplicate SKU
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Supplier not found or does not belong to this team');
      });

      it('should throw error when storage location not found', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'storage_location' as any,
          storage_location_id: 'non-existent-location'
        };

        mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValue(null);

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Storage location not found or does not belong to this team');
      });

      it('should throw error when quantity is negative', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          quantity: -10
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Quantity cannot be negative');
      });

      it('should throw error when unit_cost is negative', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          unit_cost: -5.0
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Unit cost cannot be negative');
      });

      it('should throw error when reorder_level is negative', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Test Component',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid',
          reorder_level: -50
        };

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Reorder level cannot be negative');
      });

      it('should throw error when SKU already exists in team', async () => {
        const createDto: ICreateComponentDto = {
          name: 'New Component',
          sku: 'EXISTING-SKU',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        const existingComponent = createMockComponentWithSupplier({
          id: 'existing-component',
          sku: 'EXISTING-SKU',
          team_id: TEAM_ID
        });

        mockPrismaClient.inv_components.findFirst.mockResolvedValue(existingComponent as any); // Duplicate SKU found

        await expect(createComponent(createDto, TEAM_ID, USER_ID))
          .rejects.toThrow('Component with this SKU already exists');
      });

      it('should allow same SKU across different teams', async () => {
        const createDto: ICreateComponentDto = {
          name: 'Component Team 1',
          sku: 'SHARED-SKU',
          owner_type: 'supplier' as any,
          supplier_id: 'supplier-1-uuid'
        };

        const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', team_id: TEAM_ID });
        const mockComponent = createMockComponentWithSupplier({
          id: 'component-team1',
          sku: 'SHARED-SKU',
          team_id: TEAM_ID
        });

        mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null); // No duplicate SKU in TEAM_ID
        mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any);
        mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
        mockQRService.mockResolvedValueOnce({ qr_code_data: '{}', qr_code_image: 'data:image/png;base64,abc' });
        mockPrismaClient.inv_components.update.mockResolvedValueOnce(mockComponent as any);

        const result = await createComponent(createDto, TEAM_ID, USER_ID);
        expect(result.sku).toBe('SHARED-SKU');
      });
    });
  });

  describe('getComponentById', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return component with supplier relation', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(mockComponent as any);

      const result = await getComponentById('component-1-uuid', TEAM_ID);

      expect(result).toEqual(mockComponent);
      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'component-1-uuid',
          team_id: TEAM_ID
        },
        include: {
          supplier: true,
          storage_location: true
        }
      });
    });

    it('should return component with storage location relation', async () => {
      const mockComponent = createMockComponentWithLocation({
        id: 'component-2-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(mockComponent as any);

      const result = await getComponentById('component-2-uuid', TEAM_ID);

      expect(result).toEqual(mockComponent);
    });

    it('should return null when component not found', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null);

      const result = await getComponentById('non-existent-uuid', TEAM_ID);

      expect(result).toBeNull();
    });

    it('should return null when component belongs to different team', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null);

      const result = await getComponentById('component-1-uuid', OTHER_TEAM_ID);

      expect(result).toBeNull();
    });
  });

  describe('listComponents', () => {
    it('should list components with default pagination', async () => {
      const mockComponents = createMockComponentList(5);
      const filters: IComponentFilters = {};

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(5);

      const result = await listComponents(filters, TEAM_ID);

      expect(result.data).toEqual(mockComponents);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should list components with custom pagination', async () => {
      const mockComponents = createMockComponentList(10);
      const filters: IComponentFilters = {
        page: 2,
        size: 10
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(25);

      const result = await listComponents(filters, TEAM_ID);

      expect(result.page).toBe(2);
      expect(result.size).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10
        })
      );
    });

    it('should filter by owner_type supplier', async () => {
      const mockComponents = createComponentsForSupplier('supplier-1-uuid', 3);
      const filters: IComponentFilters = {
        owner_type: 'supplier' as any
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(3);

      const result = await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner_type: 'supplier'
          })
        })
      );
    });

    it('should filter by owner_type storage_location', async () => {
      const mockComponents = createComponentsForLocation('location-1-uuid', 2);
      const filters: IComponentFilters = {
        owner_type: 'storage_location' as any
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(2);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner_type: 'storage_location'
          })
        })
      );
    });

    it('should filter by supplier_id', async () => {
      const mockComponents = createComponentsForSupplier('supplier-1-uuid', 5);
      const filters: IComponentFilters = {
        supplier_id: 'supplier-1-uuid'
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(5);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplier_id: 'supplier-1-uuid'
          })
        })
      );
    });

    it('should filter by storage_location_id', async () => {
      const mockComponents = createComponentsForLocation('location-1-uuid', 3);
      const filters: IComponentFilters = {
        storage_location_id: 'location-1-uuid'
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(3);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storage_location_id: 'location-1-uuid'
          })
        })
      );
    });

    it('should filter by category', async () => {
      const mockComponents = createMockComponentList(3).map(c => ({ ...c, category: 'Resistors' }));
      const filters: IComponentFilters = {
        category: 'Resistors'
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(3);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Resistors'
          })
        })
      );
    });

    it('should search by name, SKU, or description', async () => {
      const mockComponents = [createMockComponentWithSupplier({ name: 'Resistor 10K' })];
      const filters: IComponentFilters = {
        search: 'resistor'
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(1);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'resistor', mode: 'insensitive' } },
              { sku: { contains: 'resistor', mode: 'insensitive' } },
              { description: { contains: 'resistor', mode: 'insensitive' } }
            ]
          })
        })
      );
    });

    it('should filter by is_active=true', async () => {
      const mockComponents = createMockComponentList(3);
      const filters: IComponentFilters = {
        is_active: true
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(3);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
    });

    it('should filter by is_active=false', async () => {
      const mockComponents = [createMockComponentWithSupplier({ is_active: false })];
      const filters: IComponentFilters = {
        is_active: false
      };

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);
      mockPrismaClient.inv_components.count.mockResolvedValue(1);

      await listComponents(filters, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: false
          })
        })
      );
    });
  });

  describe('updateComponent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update component successfully', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        name: 'Old Name',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        name: 'New Name',
        description: 'Updated description'
      };

      const updatedComponent = {
        ...existingComponent,
        name: 'New Name',
        description: 'Updated description',
        updated_at: new Date()
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(existingComponent as any);
      mockPrismaClient.inv_components.update.mockResolvedValueOnce(updatedComponent as any);

      const result = await updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.name).toBe('New Name');
      expect(mockPrismaClient.inv_components.update).toHaveBeenCalled();
    });

    it('should update owner from supplier to storage location', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        supplier_id: 'supplier-1-uuid',
        storage_location_id: null,
        owner_type: 'supplier' as const,
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        owner_type: 'storage_location' as any,
        supplier_id: null,  // Explicitly clear supplier_id
        storage_location_id: 'location-1-uuid'
      };

      const mockLocation = createMockLocation({ id: 'location-1-uuid', team_id: TEAM_ID });

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(existingComponent as any);
      mockPrismaClient.inv_storage_locations.findFirst.mockResolvedValueOnce(mockLocation as any);
      mockPrismaClient.inv_components.update.mockResolvedValueOnce({
        ...existingComponent,
        owner_type: 'storage_location',
        supplier_id: null,
        storage_location_id: 'location-1-uuid'
      } as any);

      const result = await updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.owner_type).toBe('storage_location');
      expect(result.storage_location_id).toBe('location-1-uuid');
      expect(result.supplier_id).toBeNull();
    });

    it('should throw error when component not found', async () => {
      const updateDto: IUpdateComponentDto = {
        name: 'New Name'
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await expect(updateComponent('non-existent-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Component not found');
    });

    it('should throw error when updating to duplicate SKU', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        sku: 'OLD-SKU',
        team_id: TEAM_ID
      });

      const duplicateComponent = createMockComponentWithSupplier({
        id: 'component-2-uuid',
        sku: 'EXISTING-SKU',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        sku: 'EXISTING-SKU'
      };

      mockPrismaClient.inv_components.findFirst
        .mockResolvedValueOnce(existingComponent as any)
        .mockResolvedValueOnce(duplicateComponent as any);

      await expect(updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Component with this SKU already exists');
    });

    it('should throw error when quantity is negative', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        quantity: -10
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(existingComponent as any);

      await expect(updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Quantity cannot be negative');
    });

    it('should throw error when unit_cost is negative', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        unit_cost: -5.0
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(existingComponent as any);

      await expect(updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Unit cost cannot be negative');
    });

    it('should throw error when reorder_level is negative', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateComponentDto = {
        reorder_level: -50
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(existingComponent as any);

      await expect(updateComponent('component-1-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Reorder level cannot be negative');
    });
  });

  describe('deleteComponent', () => {
    it('should soft delete component successfully', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        is_active: true,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(existingComponent as any);
      mockPrismaClient.inv_components.update.mockResolvedValue({
        ...existingComponent,
        is_active: false
      } as any);

      await deleteComponent('component-1-uuid', TEAM_ID, USER_ID);

      expect(mockPrismaClient.inv_components.update).toHaveBeenCalledWith({
        where: { id: 'component-1-uuid' },
        data: {
          is_active: false,
          updated_at: expect.any(Date)
        }
      });
    });

    it('should throw error when component not found', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await expect(deleteComponent('non-existent-uuid', TEAM_ID, USER_ID))
        .rejects.toThrow('Component not found');
    });

    it('should enforce team scoping on delete', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await expect(deleteComponent('component-1-uuid', OTHER_TEAM_ID, USER_ID))
        .rejects.toThrow('Component not found');

      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'component-1-uuid',
          team_id: OTHER_TEAM_ID
        }
      });
    });
  });

  describe('generateQRCodeForComponent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate QR code successfully', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      const qrCodeResult = {
        qr_code_data: JSON.stringify({ id: 'component-1-uuid' }),
        qr_code_image: 'data:image/png;base64,regenerated'
      };

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(existingComponent as any);
      mockQRService.mockResolvedValueOnce(qrCodeResult);
      mockPrismaClient.inv_components.update.mockResolvedValueOnce({
        ...existingComponent,
        ...qrCodeResult
      } as any);

      const result = await generateQRCodeForComponent('component-1-uuid', TEAM_ID);

      expect(result).toEqual(qrCodeResult);
      expect(mockQRService).toHaveBeenCalledWith('component-1-uuid', TEAM_ID);
      expect(mockPrismaClient.inv_components.update).toHaveBeenCalledWith({
        where: { id: 'component-1-uuid' },
        data: {
          qr_code_data: qrCodeResult.qr_code_data,
          qr_code_image: qrCodeResult.qr_code_image,
          updated_at: expect.any(Date)
        }
      });
    });

    it('should throw error when component not found', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null);

      await expect(generateQRCodeForComponent('non-existent-uuid', TEAM_ID))
        .rejects.toThrow('Component not found');
    });

    it('should propagate QR generation errors', async () => {
      const existingComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(existingComponent as any);
      mockQRService.mockRejectedValueOnce(new Error('QR generation failed'));

      await expect(generateQRCodeForComponent('component-1-uuid', TEAM_ID))
        .rejects.toThrow('QR generation failed');
    });
  });

  describe('getLowStockComponents', () => {
    it('should return low stock components', async () => {
      const lowStockComponents = [
        {
          id: 'component-low-1',
          name: 'Low Stock Item 1',
          quantity: 50,
          reorder_level: 100,
          stock_percentage: '50.00',
          quantity_needed: '50',
          supplier_name: 'Supplier A',
          storage_location_name: null
        },
        {
          id: 'component-low-2',
          name: 'Low Stock Item 2',
          quantity: 0,
          reorder_level: 100,
          stock_percentage: '0.00',
          quantity_needed: '100',
          supplier_name: null,
          storage_location_name: 'Location B'
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(lowStockComponents as any);

      const result = await getLowStockComponents(TEAM_ID, 50);

      expect(result).toHaveLength(2);
      expect(result[0].stock_percentage).toBe(50.00);
      expect(result[0].quantity_needed).toBe(50);
      expect(result[1].stock_percentage).toBe(0.00);
      expect(result[1].quantity_needed).toBe(100);
    });

    it('should respect limit parameter', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await getLowStockComponents(TEAM_ID, 10);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it('should use default limit of 50', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await getLowStockComponents(TEAM_ID);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('searchComponents', () => {
    it('should search components by name', async () => {
      const mockComponents = [
        createMockComponentWithSupplier({ name: 'Resistor 10K' }),
        createMockComponentWithSupplier({ name: 'Resistor 100K' })
      ];

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);

      const result = await searchComponents('resistor', TEAM_ID, 10);

      expect(result).toEqual(mockComponents);
      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true,
          OR: [
            { name: { contains: 'resistor', mode: 'insensitive' } },
            { sku: { contains: 'resistor', mode: 'insensitive' } }
          ]
        },
        include: {
          supplier: true,
          storage_location: true
        },
        take: 10,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should search components by SKU', async () => {
      const mockComponents = [
        createMockComponentWithSupplier({ sku: 'RES-10K-001' })
      ];

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);

      const result = await searchComponents('RES-10K', TEAM_ID);

      expect(result).toEqual(mockComponents);
    });

    it('should return empty array for empty query', async () => {
      const result = await searchComponents('', TEAM_ID);

      expect(result).toEqual([]);
      expect(mockPrismaClient.inv_components.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace query', async () => {
      const result = await searchComponents('   ', TEAM_ID);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockComponents = createMockComponentList(5);

      mockPrismaClient.inv_components.findMany.mockResolvedValue(mockComponents as any);

      await searchComponents('component', TEAM_ID, 5);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5
        })
      );
    });

    it('should use default limit of 10', async () => {
      mockPrismaClient.inv_components.findMany.mockResolvedValue([]);

      await searchComponents('test', TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });
  });

  describe('Team Isolation Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should enforce team scoping on all operations', async () => {
      const mockSupplier = createMockSupplier({ id: 'supplier-1-uuid', team_id: TEAM_ID });
      const mockComponent = createMockComponentWithSupplier({
        id: 'component-1-uuid',
        team_id: TEAM_ID,
        sku: 'TEST-SKU'
      });

      // Create operation
      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(null); // No duplicate SKU check
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(mockSupplier as any); // Supplier lookup
      mockPrismaClient.inv_components.create.mockResolvedValueOnce(mockComponent as any);
      mockQRService.mockResolvedValueOnce({ qr_code_data: '{}', qr_code_image: 'data:image/png;base64,abc' });
      mockPrismaClient.inv_components.update.mockResolvedValueOnce(mockComponent as any); // QR update

      await createComponent({
        name: 'Test',
        sku: 'TEST-SKU',
        owner_type: 'supplier' as any,
        supplier_id: 'supplier-1-uuid'
      }, TEAM_ID, USER_ID);

      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );

      // Get operation
      mockPrismaClient.inv_components.findFirst.mockResolvedValueOnce(mockComponent as any);
      await getComponentById('component-1-uuid', TEAM_ID);

      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'component-1-uuid', team_id: TEAM_ID }
        })
      );

      // List operation
      mockPrismaClient.inv_components.findMany.mockResolvedValueOnce([mockComponent] as any);
      mockPrismaClient.inv_components.count.mockResolvedValueOnce(1);
      await listComponents({}, TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );

      // Search operation
      mockPrismaClient.inv_components.findMany.mockResolvedValueOnce([mockComponent] as any);
      await searchComponents('test', TEAM_ID);

      expect(mockPrismaClient.inv_components.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );
    });
  });
});
