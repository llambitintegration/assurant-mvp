/**
 * Suppliers Service Unit Tests
 * Tests for supplier CRUD operations with team scoping and validation
 */

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_suppliers: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  }
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/suppliers-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/supplier-fixtures');

import {
  createSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
  searchSuppliers
} from '../../../../services/inv/suppliers-service';
import prisma from '../../../../config/prisma';
import {
  createMockSupplier,
  createMockSupplierList,
  createSupplierWithFullContact,
  createMinimalSupplier,
  createInactiveSupplier,
  createSuppliersForMultipleTeams
} from '../../../fixtures/inv/supplier-fixtures';
import { ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilters } from '../../../../interfaces/inv/supplier.interface';

// Get reference to the mocked prisma client
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;

describe('Suppliers Service', () => {
  const TEAM_ID = 'team-1-uuid';
  const USER_ID = 'user-1-uuid';
  const OTHER_TEAM_ID = 'team-2-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createSupplier', () => {
    it('should create a new supplier successfully', async () => {
      const createDto: ICreateSupplierDto = {
        name: 'Acme Corporation',
        contact_person: 'John Smith',
        email: 'john@acme.com',
        phone: '+1-555-0100',
        address: '123 Main St',
        notes: 'Preferred supplier'
      };

      const mockSupplier = createMockSupplier({
        id: 'new-supplier-uuid',
        ...createDto,
        team_id: TEAM_ID,
        created_by: USER_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);
      mockPrismaClient.inv_suppliers.create.mockResolvedValue(mockSupplier as any);

      const result = await createSupplier(createDto, TEAM_ID, USER_ID);

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          name: createDto.name,
          team_id: TEAM_ID,
          is_active: true
        }
      });
      expect(mockPrismaClient.inv_suppliers.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          contact_person: createDto.contact_person,
          email: createDto.email,
          phone: createDto.phone,
          address: createDto.address,
          notes: createDto.notes,
          team_id: TEAM_ID,
          created_by: USER_ID,
          is_active: true
        }
      });
    });

    it('should create a supplier with minimal information', async () => {
      const createDto: ICreateSupplierDto = {
        name: 'Basic Supplier'
      };

      const mockSupplier = createMinimalSupplier({
        id: 'minimal-supplier-uuid',
        name: createDto.name,
        team_id: TEAM_ID,
        created_by: USER_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);
      mockPrismaClient.inv_suppliers.create.mockResolvedValue(mockSupplier as any);

      const result = await createSupplier(createDto, TEAM_ID, USER_ID);

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaClient.inv_suppliers.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          contact_person: null,
          email: null,
          phone: null,
          address: null,
          notes: null,
          team_id: TEAM_ID,
          created_by: USER_ID,
          is_active: true
        }
      });
    });

    it('should throw error when name is empty', async () => {
      const createDto: ICreateSupplierDto = {
        name: ''
      };

      await expect(createSupplier(createDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier name is required');

      expect(mockPrismaClient.inv_suppliers.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaClient.inv_suppliers.create).not.toHaveBeenCalled();
    });

    it('should throw error when name is only whitespace', async () => {
      const createDto: ICreateSupplierDto = {
        name: '   '
      };

      await expect(createSupplier(createDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier name is required');
    });

    it('should throw error when supplier with same name already exists in team', async () => {
      const createDto: ICreateSupplierDto = {
        name: 'Acme Corporation'
      };

      const existingSupplier = createMockSupplier({
        id: 'existing-supplier-uuid',
        name: createDto.name,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);

      await expect(createSupplier(createDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier with this name already exists');

      expect(mockPrismaClient.inv_suppliers.create).not.toHaveBeenCalled();
    });

    it('should allow duplicate supplier names across different teams', async () => {
      const createDto: ICreateSupplierDto = {
        name: 'Acme Corporation'
      };

      const mockSupplier = createMockSupplier({
        id: 'new-supplier-uuid',
        name: createDto.name,
        team_id: TEAM_ID
      });

      // No existing supplier in TEAM_ID
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);
      mockPrismaClient.inv_suppliers.create.mockResolvedValue(mockSupplier as any);

      const result = await createSupplier(createDto, TEAM_ID, USER_ID);

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          name: createDto.name,
          team_id: TEAM_ID,
          is_active: true
        }
      });
    });
  });

  describe('getSupplierById', () => {
    it('should return supplier when found in team', async () => {
      const mockSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(mockSupplier as any);

      const result = await getSupplierById('supplier-1-uuid', TEAM_ID);

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'supplier-1-uuid',
          team_id: TEAM_ID
        }
      });
    });

    it('should return null when supplier not found', async () => {
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      const result = await getSupplierById('non-existent-uuid', TEAM_ID);

      expect(result).toBeNull();
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'non-existent-uuid',
          team_id: TEAM_ID
        }
      });
    });

    it('should return null when supplier belongs to different team', async () => {
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      const result = await getSupplierById('supplier-1-uuid', OTHER_TEAM_ID);

      expect(result).toBeNull();
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'supplier-1-uuid',
          team_id: OTHER_TEAM_ID
        }
      });
    });

    it('should find supplier with full contact information', async () => {
      const mockSupplier = createSupplierWithFullContact({
        id: 'supplier-full-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(mockSupplier as any);

      const result = await getSupplierById('supplier-full-uuid', TEAM_ID);

      expect(result).toEqual(mockSupplier);
      expect(result?.contact_person).toBe('Jane Doe');
      expect(result?.email).toBe('jane.doe@premiumcomponents.com');
    });
  });

  describe('listSuppliers', () => {
    it('should list suppliers with default pagination', async () => {
      const mockSuppliers = createMockSupplierList(5);
      const filters: ISupplierFilters = {};

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(mockSuppliers);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true
        },
        skip: 0,
        take: 20,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should list suppliers with custom pagination', async () => {
      const mockSuppliers = createMockSupplierList(3);
      const filters: ISupplierFilters = {
        page: 2,
        size: 10
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(25);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.page).toBe(2);
      expect(result.size).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true
        },
        skip: 10,
        take: 10,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should filter by is_active=true', async () => {
      const activeSuppliers = createMockSupplierList(3);
      const filters: ISupplierFilters = {
        is_active: true
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(activeSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(3);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(activeSuppliers);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true
        },
        skip: 0,
        take: 20,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should filter by is_active=false', async () => {
      const inactiveSuppliers = [createInactiveSupplier()];
      const filters: ISupplierFilters = {
        is_active: false
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(inactiveSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(inactiveSuppliers);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: false
        },
        skip: 0,
        take: 20,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should search by name', async () => {
      const mockSuppliers = [createMockSupplier({ name: 'Acme Corporation' })];
      const filters: ISupplierFilters = {
        search: 'acme'
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(mockSuppliers);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true,
          OR: [
            { name: { contains: 'acme', mode: 'insensitive' } },
            { email: { contains: 'acme', mode: 'insensitive' } },
            { contact_person: { contains: 'acme', mode: 'insensitive' } }
          ]
        },
        skip: 0,
        take: 20,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should search by email', async () => {
      const mockSuppliers = [createMockSupplier({ email: 'contact@acme.com' })];
      const filters: ISupplierFilters = {
        search: 'contact@acme'
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(mockSuppliers);
    });

    it('should search by contact_person', async () => {
      const mockSuppliers = [createMockSupplier({ contact_person: 'John Smith' })];
      const filters: ISupplierFilters = {
        search: 'john'
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual(mockSuppliers);
    });

    it('should return empty list when no suppliers match', async () => {
      const filters: ISupplierFilters = {
        search: 'nonexistent'
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue([]);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(0);

      const result = await listSuppliers(filters, TEAM_ID);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should ignore empty search strings', async () => {
      const mockSuppliers = createMockSupplierList(5);
      const filters: ISupplierFilters = {
        search: '   '
      };

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);

      await listSuppliers(filters, TEAM_ID);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true
        },
        skip: 0,
        take: 20,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should scope results to team', async () => {
      const team1Suppliers = [createMockSupplier({ team_id: TEAM_ID })];
      const filters: ISupplierFilters = {};

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(team1Suppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);

      await listSuppliers(filters, TEAM_ID);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            team_id: TEAM_ID
          })
        })
      );
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        name: 'Old Name',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateSupplierDto = {
        name: 'New Name',
        contact_person: 'Jane Doe',
        email: 'jane@newcompany.com'
      };

      const updatedSupplier = {
        ...existingSupplier,
        ...updateDto,
        updated_at: new Date()
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(existingSupplier as any);
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(null); // No duplicate
      mockPrismaClient.inv_suppliers.update.mockResolvedValue(updatedSupplier as any);

      const result = await updateSupplier('supplier-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.name).toBe('New Name');
      expect(result.contact_person).toBe('Jane Doe');
      expect(mockPrismaClient.inv_suppliers.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1-uuid' },
        data: expect.objectContaining({
          name: 'New Name',
          contact_person: 'Jane Doe',
          email: 'jane@newcompany.com',
          updated_at: expect.any(Date)
        })
      });
    });

    it('should update partial fields', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        name: 'Acme Corp',
        contact_person: 'John Smith',
        email: 'john@acme.com',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateSupplierDto = {
        phone: '+1-555-9999'
      };

      const updatedSupplier = {
        ...existingSupplier,
        phone: '+1-555-9999',
        updated_at: new Date()
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue(updatedSupplier as any);

      const result = await updateSupplier('supplier-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.phone).toBe('+1-555-9999');
      expect(result.name).toBe('Acme Corp'); // Unchanged
    });

    it('should throw error when supplier not found', async () => {
      const updateDto: IUpdateSupplierDto = {
        name: 'New Name'
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      await expect(updateSupplier('non-existent-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier not found');

      expect(mockPrismaClient.inv_suppliers.update).not.toHaveBeenCalled();
    });

    it('should throw error when supplier belongs to different team', async () => {
      const updateDto: IUpdateSupplierDto = {
        name: 'New Name'
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      await expect(updateSupplier('supplier-1-uuid', updateDto, OTHER_TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier not found');
    });

    it('should throw error when updating to duplicate name in same team', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        name: 'Old Name',
        team_id: TEAM_ID
      });

      const duplicateSupplier = createMockSupplier({
        id: 'supplier-2-uuid',
        name: 'Existing Name',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateSupplierDto = {
        name: 'Existing Name'
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(existingSupplier as any);
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValueOnce(duplicateSupplier as any);

      await expect(updateSupplier('supplier-1-uuid', updateDto, TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier with this name already exists');

      expect(mockPrismaClient.inv_suppliers.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same name (no change)', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        name: 'Same Name',
        team_id: TEAM_ID
      });

      const updateDto: IUpdateSupplierDto = {
        name: 'Same Name',
        phone: '+1-555-9999'
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue({
        ...existingSupplier,
        phone: '+1-555-9999'
      } as any);

      const result = await updateSupplier('supplier-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.name).toBe('Same Name');
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledTimes(1); // No duplicate check
    });

    it('should update is_active flag', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        is_active: true,
        team_id: TEAM_ID
      });

      const updateDto: IUpdateSupplierDto = {
        is_active: false
      };

      const updatedSupplier = {
        ...existingSupplier,
        is_active: false,
        updated_at: new Date()
      };

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue(updatedSupplier as any);

      const result = await updateSupplier('supplier-1-uuid', updateDto, TEAM_ID, USER_ID);

      expect(result.is_active).toBe(false);
    });
  });

  describe('deleteSupplier', () => {
    it('should soft delete supplier successfully', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        is_active: true,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue({
        ...existingSupplier,
        is_active: false
      } as any);

      await deleteSupplier('supplier-1-uuid', TEAM_ID, USER_ID);

      expect(mockPrismaClient.inv_suppliers.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1-uuid' },
        data: {
          is_active: false,
          updated_at: expect.any(Date)
        }
      });
    });

    it('should throw error when supplier not found', async () => {
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      await expect(deleteSupplier('non-existent-uuid', TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier not found');

      expect(mockPrismaClient.inv_suppliers.update).not.toHaveBeenCalled();
    });

    it('should throw error when supplier belongs to different team', async () => {
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);

      await expect(deleteSupplier('supplier-1-uuid', OTHER_TEAM_ID, USER_ID))
        .rejects.toThrow('Supplier not found');
    });

    it('should be idempotent - allow deleting already deleted supplier', async () => {
      const existingSupplier = createInactiveSupplier({
        id: 'supplier-1-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue(existingSupplier as any);

      await deleteSupplier('supplier-1-uuid', TEAM_ID, USER_ID);

      expect(mockPrismaClient.inv_suppliers.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1-uuid' },
        data: {
          is_active: false,
          updated_at: expect.any(Date)
        }
      });
    });

    it('should verify team ownership before deleting', async () => {
      const existingSupplier = createMockSupplier({
        id: 'supplier-1-uuid',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(existingSupplier as any);
      mockPrismaClient.inv_suppliers.update.mockResolvedValue({
        ...existingSupplier,
        is_active: false
      } as any);

      await deleteSupplier('supplier-1-uuid', TEAM_ID, USER_ID);

      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'supplier-1-uuid',
          team_id: TEAM_ID
        }
      });
    });
  });

  describe('searchSuppliers', () => {
    it('should search suppliers by name', async () => {
      const mockSuppliers = [
        createMockSupplier({ name: 'Acme Corporation' }),
        createMockSupplier({ name: 'Acme Industries' })
      ];

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      const result = await searchSuppliers('acme', TEAM_ID, 10);

      expect(result).toEqual(mockSuppliers);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith({
        where: {
          team_id: TEAM_ID,
          is_active: true,
          OR: [
            { name: { contains: 'acme', mode: 'insensitive' } },
            { email: { contains: 'acme', mode: 'insensitive' } },
            { contact_person: { contains: 'acme', mode: 'insensitive' } }
          ]
        },
        take: 10,
        orderBy: [{ name: 'asc' }]
      });
    });

    it('should search suppliers by email', async () => {
      const mockSuppliers = [
        createMockSupplier({ email: 'contact@acme.com' })
      ];

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      const result = await searchSuppliers('contact@acme', TEAM_ID);

      expect(result).toEqual(mockSuppliers);
    });

    it('should search suppliers by contact_person', async () => {
      const mockSuppliers = [
        createMockSupplier({ contact_person: 'John Smith' })
      ];

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      const result = await searchSuppliers('john', TEAM_ID);

      expect(result).toEqual(mockSuppliers);
    });

    it('should respect limit parameter', async () => {
      const mockSuppliers = createMockSupplierList(5);

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      await searchSuppliers('supplier', TEAM_ID, 5);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5
        })
      );
    });

    it('should use default limit of 10', async () => {
      const mockSuppliers = createMockSupplierList(10);

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      await searchSuppliers('supplier', TEAM_ID);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });

    it('should return empty array for empty query', async () => {
      const result = await searchSuppliers('', TEAM_ID);

      expect(result).toEqual([]);
      expect(mockPrismaClient.inv_suppliers.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace query', async () => {
      const result = await searchSuppliers('   ', TEAM_ID);

      expect(result).toEqual([]);
      expect(mockPrismaClient.inv_suppliers.findMany).not.toHaveBeenCalled();
    });

    it('should only return active suppliers', async () => {
      const activeSuppliers = createMockSupplierList(3);

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(activeSuppliers as any);

      await searchSuppliers('supplier', TEAM_ID);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true
          })
        })
      );
    });

    it('should scope results to team', async () => {
      const mockSuppliers = [createMockSupplier({ team_id: TEAM_ID })];

      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(mockSuppliers as any);

      await searchSuppliers('supplier', TEAM_ID);

      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            team_id: TEAM_ID
          })
        })
      );
    });

    it('should return empty array when no matches found', async () => {
      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue([]);

      const result = await searchSuppliers('nonexistent', TEAM_ID);

      expect(result).toEqual([]);
    });
  });

  describe('Team Isolation Tests', () => {
    it('should enforce team scoping on all operations', async () => {
      const team1Suppliers = createSuppliersForMultipleTeams([TEAM_ID]);
      const team2Suppliers = createSuppliersForMultipleTeams([OTHER_TEAM_ID]);

      // Create operation
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(null);
      mockPrismaClient.inv_suppliers.create.mockResolvedValue(team1Suppliers[0] as any);
      await createSupplier({ name: 'Test' }, TEAM_ID, USER_ID);
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );

      // Get operation
      mockPrismaClient.inv_suppliers.findFirst.mockResolvedValue(team1Suppliers[0] as any);
      await getSupplierById('supplier-1-uuid', TEAM_ID);
      expect(mockPrismaClient.inv_suppliers.findFirst).toHaveBeenCalledWith({
        where: { id: 'supplier-1-uuid', team_id: TEAM_ID }
      });

      // List operation
      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(team1Suppliers as any);
      mockPrismaClient.inv_suppliers.count.mockResolvedValue(1);
      await listSuppliers({}, TEAM_ID);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );

      // Search operation
      mockPrismaClient.inv_suppliers.findMany.mockResolvedValue(team1Suppliers as any);
      await searchSuppliers('test', TEAM_ID);
      expect(mockPrismaClient.inv_suppliers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ team_id: TEAM_ID })
        })
      );
    });
  });
});
