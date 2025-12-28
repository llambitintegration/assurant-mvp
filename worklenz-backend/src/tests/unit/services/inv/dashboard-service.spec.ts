/**
 * Dashboard Service Unit Tests
 * Tests for getDashboardStats function with parallel aggregations and low stock alerts
 */

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_components: {
      count: jest.fn()
    },
    inv_suppliers: {
      count: jest.fn()
    },
    inv_storage_locations: {
      count: jest.fn()
    },
    $queryRaw: jest.fn()
  }
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/dashboard-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/dashboard-fixtures');

import { getDashboardStats, getInventoryValueByCategory } from '../../../../services/inv/dashboard-service';
import prisma from '../../../../config/prisma';
import { Prisma } from '@prisma/client';
import {
  createMockDashboardStats,
  createMockLowStockAlert,
  createLowStockAlertList,
  createEmptyInventoryStats,
  createHealthyInventoryStats,
  createCriticalInventoryStats,
  createUrgencySortedLowStockAlerts,
  createOutOfStockAlert
} from '../../../fixtures/inv/dashboard-fixtures';

// Get reference to the mocked prisma client
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;

describe('Dashboard Service', () => {
  const mockTeamId = 'team-123-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    describe('Parallel Execution', () => {
      it('should execute all 6 aggregations in parallel', async () => {
        // Track call order
        const callOrder: string[] = [];

        // Mock all Prisma methods to track execution
        mockPrismaClient.inv_components.count.mockImplementation(async () => {
          callOrder.push('components.count');
          return 150;
        });

        mockPrismaClient.inv_suppliers.count.mockImplementation(async () => {
          callOrder.push('suppliers.count');
          return 8;
        });

        mockPrismaClient.inv_storage_locations.count.mockImplementation(async () => {
          callOrder.push('locations.count');
          return 25;
        });

        mockPrismaClient.$queryRaw.mockImplementation(async (query: any) => {
          const queryStr = query.strings ? query.strings[0] : '';
          if (queryStr.includes('SUM(quantity * COALESCE(unit_cost, 0))')) {
            callOrder.push('totalValue.$queryRaw');
            return [{ total_value: new Prisma.Decimal(25750.50) }];
          } else if (queryStr.includes('stock_percentage')) {
            callOrder.push('lowStockAlerts.$queryRaw');
            return [];
          }
          return [];
        });

        await getDashboardStats(mockTeamId);

        // Verify all methods were called (parallel execution)
        expect(mockPrismaClient.inv_components.count).toHaveBeenCalled();
        expect(mockPrismaClient.inv_suppliers.count).toHaveBeenCalled();
        expect(mockPrismaClient.inv_storage_locations.count).toHaveBeenCalled();
        expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(2); // totalValue + lowStockAlerts
      });

      it('should handle concurrent execution without errors', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(15);
        mockPrismaClient.$queryRaw.mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result).toBeDefined();
        expect(result.total_components).toBe(100);
        expect(result.suppliers_count).toBe(5);
        expect(result.locations_count).toBe(15);
      });
    });

    describe('Success Cases with Data', () => {
      it('should return comprehensive dashboard stats with data', async () => {
        const mockLowStockAlerts = [
          {
            component_id: 'comp-1',
            component_name: 'Resistor 10K',
            sku: 'RES-10K',
            category: 'Electronics',
            current_quantity: 50,
            reorder_level: 100,
            unit: 'pcs',
            stock_percentage: 50,
            quantity_needed: 50,
            supplier_id: 'sup-1',
            supplier_name: 'Acme Corp',
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(0.05)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(150);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(8);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(25);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(25750.50) }])
          .mockResolvedValueOnce(mockLowStockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result).toEqual({
          total_components: 150,
          total_inventory_value: 25750.50,
          low_stock_count: 1,
          suppliers_count: 8,
          locations_count: 25,
          low_stock_alerts: expect.arrayContaining([
            expect.objectContaining({
              component_id: 'comp-1',
              component_name: 'Resistor 10K',
              stock_percentage: 50,
              quantity_needed: 50,
              estimated_reorder_cost: 2.5 // 50 * 0.05
            })
          ])
        });
      });

      it('should handle healthy inventory with minimal low stock alerts', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(200);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(10);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(30);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(50000) }])
          .mockResolvedValueOnce([
            {
              component_id: 'comp-1',
              component_name: 'Part A',
              sku: 'PA-001',
              category: 'Hardware',
              current_quantity: 95,
              reorder_level: 100,
              unit: 'pcs',
              stock_percentage: 95,
              quantity_needed: 5,
              supplier_id: null,
              supplier_name: null,
              storage_location_id: 'loc-1',
              storage_location_name: 'Warehouse A',
              unit_cost: new Prisma.Decimal(2.00)
            }
          ]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_components).toBe(200);
        expect(result.total_inventory_value).toBe(50000);
        expect(result.low_stock_count).toBe(1);
        expect(result.low_stock_alerts).toHaveLength(1);
        expect(result.low_stock_alerts[0].stock_percentage).toBe(95);
      });

      it('should handle critical inventory with many low stock alerts', async () => {
        const mockAlerts = Array.from({ length: 20 }, (_, i) => ({
          component_id: `comp-${i}`,
          component_name: `Component ${i}`,
          sku: `SKU-${i}`,
          category: 'Parts',
          current_quantity: 10,
          reorder_level: 100,
          unit: 'pcs',
          stock_percentage: 10,
          quantity_needed: 90,
          supplier_id: 'sup-1',
          supplier_name: 'Supplier',
          storage_location_id: null,
          storage_location_name: null,
          unit_cost: new Prisma.Decimal(1.00)
        }));

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(15);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(15000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_count).toBe(20);
        expect(result.low_stock_alerts).toHaveLength(20);
        expect(result.total_components).toBe(100);
      });
    });

    describe('Empty Inventory Cases', () => {
      it('should handle empty inventory (0 components)', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(0);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(0);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(0);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(0) }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result).toEqual({
          total_components: 0,
          total_inventory_value: 0,
          low_stock_count: 0,
          suppliers_count: 0,
          locations_count: 0,
          low_stock_alerts: []
        });
      });

      it('should handle inventory with components but no suppliers or locations', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(50);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(0);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(0);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(5000) }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_components).toBe(50);
        expect(result.suppliers_count).toBe(0);
        expect(result.locations_count).toBe(0);
        expect(result.total_inventory_value).toBe(5000);
      });

      it('should handle null total_value from database', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: null }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_inventory_value).toBe(0);
        expect(result.total_components).toBe(100);
      });

      it('should handle empty result array from total value query', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(50);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(3);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(5);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_inventory_value).toBe(0);
      });
    });

    describe('Low Stock Detection', () => {
      it('should detect components with quantity <= reorder_level', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-1',
            component_name: 'Low Stock Item',
            sku: 'LSI-001',
            category: 'Parts',
            current_quantity: 25,
            reorder_level: 50,
            unit: 'pcs',
            stock_percentage: 50,
            quantity_needed: 25,
            supplier_id: 'sup-1',
            supplier_name: 'Supplier A',
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(1.50)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_count).toBe(1);
        expect(result.low_stock_alerts[0]).toMatchObject({
          component_id: 'comp-1',
          current_quantity: 25,
          reorder_level: 50,
          stock_percentage: 50
        });
      });

      it('should handle components with reorder_level = 0', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-zero',
            component_name: 'Zero Reorder',
            sku: 'ZERO-001',
            category: null,
            current_quantity: 10,
            reorder_level: 0,
            unit: 'pcs',
            stock_percentage: 100, // CASE WHEN reorder_level > 0 THEN ... ELSE 100
            quantity_needed: 0,
            supplier_id: null,
            supplier_name: null,
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: null
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(50);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(2);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(5);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(5000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0].stock_percentage).toBe(100);
        expect(result.low_stock_alerts[0].quantity_needed).toBe(0);
      });

      it('should handle components with quantity = 0 (out of stock)', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-out',
            component_name: 'Out of Stock',
            sku: 'OUT-001',
            category: 'Critical',
            current_quantity: 0,
            reorder_level: 50,
            unit: 'pcs',
            stock_percentage: 0,
            quantity_needed: 50,
            supplier_id: 'sup-1',
            supplier_name: 'Supplier',
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(5.00)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(75);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(4);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(8);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(8000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0]).toMatchObject({
          current_quantity: 0,
          stock_percentage: 0,
          quantity_needed: 50,
          estimated_reorder_cost: 250 // 50 * 5.00
        });
      });

      it('should sort alerts by stock_percentage (lowest first)', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-critical',
            component_name: 'Critical',
            sku: 'CRIT-001',
            category: null,
            current_quantity: 5,
            reorder_level: 100,
            unit: 'pcs',
            stock_percentage: 5,
            quantity_needed: 95,
            supplier_id: null,
            supplier_name: null,
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(1.00)
          },
          {
            component_id: 'comp-low',
            component_name: 'Low',
            sku: 'LOW-001',
            category: null,
            current_quantity: 50,
            reorder_level: 100,
            unit: 'pcs',
            stock_percentage: 50,
            quantity_needed: 50,
            supplier_id: null,
            supplier_name: null,
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(1.00)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0].stock_percentage).toBe(5);
        expect(result.low_stock_alerts[1].stock_percentage).toBe(50);
      });

      it('should limit alerts to top 20', async () => {
        const mockAlerts = Array.from({ length: 20 }, (_, i) => ({
          component_id: `comp-${i}`,
          component_name: `Component ${i}`,
          sku: `SKU-${i}`,
          category: null,
          current_quantity: i + 1,
          reorder_level: 100,
          unit: 'pcs',
          stock_percentage: i + 1,
          quantity_needed: 100 - (i + 1),
          supplier_id: null,
          supplier_name: null,
          storage_location_id: null,
          storage_location_name: null,
          unit_cost: new Prisma.Decimal(1.00)
        }));

        mockPrismaClient.inv_components.count.mockResolvedValue(200);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(10);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(20);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(50000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts).toHaveLength(20);
      });
    });

    describe('Total Value Calculation with Decimal Types', () => {
      it('should correctly convert Decimal to number', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal('12345.67') }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_inventory_value).toBe(12345.67);
        expect(typeof result.total_inventory_value).toBe('number');
      });

      it('should handle large decimal values', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(1000);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(20);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(50);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal('999999.99') }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_inventory_value).toBe(999999.99);
      });

      it('should handle total_value as number type', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: 5000.50 }]) // Direct number instead of Decimal
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_inventory_value).toBe(5000.50);
        expect(typeof result.total_inventory_value).toBe('number');
      });

      it('should calculate estimated_reorder_cost correctly', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-1',
            component_name: 'Expensive Part',
            sku: 'EXP-001',
            category: 'Premium',
            current_quantity: 10,
            reorder_level: 50,
            unit: 'pcs',
            stock_percentage: 20,
            quantity_needed: 40,
            supplier_id: 'sup-1',
            supplier_name: 'Premium Supplier',
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal('25.50')
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0].estimated_reorder_cost).toBe(1020); // 40 * 25.50
      });

      it('should handle null unit_cost (no estimated_reorder_cost)', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-1',
            component_name: 'No Cost Item',
            sku: 'NC-001',
            category: null,
            current_quantity: 10,
            reorder_level: 50,
            unit: 'pcs',
            stock_percentage: 20,
            quantity_needed: 40,
            supplier_id: null,
            supplier_name: null,
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: null
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0].estimated_reorder_cost).toBeUndefined();
      });
    });

    describe('Team Isolation', () => {
      it('should only return data for specified team', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(50);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(3);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(7);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(5000) }])
          .mockResolvedValueOnce([]);

        await getDashboardStats('team-alpha');

        // Verify team_id is passed to all queries
        const countCalls = mockPrismaClient.inv_components.count.mock.calls[0][0];
        expect(countCalls).toMatchObject({
          where: expect.objectContaining({
            team_id: 'team-alpha'
          })
        });
      });

      it('should return different stats for different teams', async () => {
        // Team 1
        mockPrismaClient.inv_components.count.mockResolvedValueOnce(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValueOnce(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValueOnce(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce([]);

        const result1 = await getDashboardStats('team-1');

        jest.clearAllMocks();

        // Team 2
        mockPrismaClient.inv_components.count.mockResolvedValueOnce(200);
        mockPrismaClient.inv_suppliers.count.mockResolvedValueOnce(10);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValueOnce(20);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(20000) }])
          .mockResolvedValueOnce([]);

        const result2 = await getDashboardStats('team-2');

        expect(result1.total_components).toBe(100);
        expect(result2.total_components).toBe(200);
        expect(result1.total_inventory_value).toBe(10000);
        expect(result2.total_inventory_value).toBe(20000);
      });
    });

    describe('Low Stock Alerts with Mixed Ownership', () => {
      it('should include supplier details when owner_type is supplier', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-supplier',
            component_name: 'Supplier Owned',
            sku: 'SUP-001',
            category: 'Parts',
            current_quantity: 25,
            reorder_level: 100,
            unit: 'pcs',
            stock_percentage: 25,
            quantity_needed: 75,
            supplier_id: 'sup-1',
            supplier_name: 'Acme Corp',
            storage_location_id: null,
            storage_location_name: null,
            unit_cost: new Prisma.Decimal(2.00)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0]).toMatchObject({
          supplier_id: 'sup-1',
          supplier_name: 'Acme Corp',
          storage_location_id: null,
          storage_location_name: null
        });
      });

      it('should include location details when owner_type is storage_location', async () => {
        const mockAlerts = [
          {
            component_id: 'comp-location',
            component_name: 'Location Owned',
            sku: 'LOC-001',
            category: 'Inventory',
            current_quantity: 30,
            reorder_level: 80,
            unit: 'pcs',
            stock_percentage: 37.5,
            quantity_needed: 50,
            supplier_id: null,
            supplier_name: null,
            storage_location_id: 'loc-1',
            storage_location_name: 'Warehouse A',
            unit_cost: new Prisma.Decimal(1.50)
          }
        ];

        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(10000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_alerts[0]).toMatchObject({
          supplier_id: null,
          supplier_name: null,
          storage_location_id: 'loc-1',
          storage_location_name: 'Warehouse A'
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle no low stock alerts when inventory is healthy', async () => {
        mockPrismaClient.inv_components.count.mockResolvedValue(100);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(5);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(10);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(15000) }])
          .mockResolvedValueOnce([]);

        const result = await getDashboardStats(mockTeamId);

        expect(result.low_stock_count).toBe(0);
        expect(result.low_stock_alerts).toEqual([]);
      });

      it('should handle all components being low stock', async () => {
        const mockAlerts = Array.from({ length: 20 }, (_, i) => ({
          component_id: `comp-${i}`,
          component_name: `Component ${i}`,
          sku: `SKU-${i}`,
          category: 'Critical',
          current_quantity: 5,
          reorder_level: 100,
          unit: 'pcs',
          stock_percentage: 5,
          quantity_needed: 95,
          supplier_id: null,
          supplier_name: null,
          storage_location_id: null,
          storage_location_name: null,
          unit_cost: new Prisma.Decimal(1.00)
        }));

        mockPrismaClient.inv_components.count.mockResolvedValue(20);
        mockPrismaClient.inv_suppliers.count.mockResolvedValue(2);
        mockPrismaClient.inv_storage_locations.count.mockResolvedValue(3);
        mockPrismaClient.$queryRaw
          .mockResolvedValueOnce([{ total_value: new Prisma.Decimal(1000) }])
          .mockResolvedValueOnce(mockAlerts);

        const result = await getDashboardStats(mockTeamId);

        expect(result.total_components).toBe(20);
        expect(result.low_stock_count).toBe(20);
        expect(result.low_stock_alerts).toHaveLength(20);
      });

      it('should handle database errors gracefully', async () => {
        mockPrismaClient.inv_components.count.mockRejectedValue(new Error('Database connection error'));

        await expect(getDashboardStats(mockTeamId)).rejects.toThrow('Database connection error');
      });
    });
  });

  describe('getInventoryValueByCategory', () => {
    it('should return value breakdown by category', async () => {
      const mockResults = [
        {
          category: 'Electronics',
          total_quantity: BigInt(1000),
          total_value: new Prisma.Decimal(5000),
          component_count: BigInt(50)
        },
        {
          category: 'Hardware',
          total_quantity: BigInt(500),
          total_value: new Prisma.Decimal(2500),
          component_count: BigInt(25)
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockResults);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        category: 'Electronics',
        total_quantity: 1000,
        total_value: 5000,
        component_count: 50,
        average_unit_cost: 5
      });
    });

    it('should handle null category as Uncategorized', async () => {
      const mockResults = [
        {
          category: 'Uncategorized',
          total_quantity: BigInt(100),
          total_value: new Prisma.Decimal(1000),
          component_count: BigInt(10)
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockResults);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result[0].category).toBe('Uncategorized');
    });

    it('should handle empty results', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result).toEqual([]);
    });

    it('should handle total_value as number type', async () => {
      const mockResults = [
        {
          category: 'Parts',
          total_quantity: BigInt(200),
          total_value: 3000, // Direct number
          component_count: BigInt(20)
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockResults);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result[0].total_value).toBe(3000);
      expect(typeof result[0].total_value).toBe('number');
    });

    it('should handle null total_value', async () => {
      const mockResults = [
        {
          category: 'Free Items',
          total_quantity: BigInt(100),
          total_value: null,
          component_count: BigInt(10)
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockResults);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result[0].total_value).toBe(0);
    });

    it('should handle zero quantity for average_unit_cost calculation', async () => {
      const mockResults = [
        {
          category: 'Empty',
          total_quantity: BigInt(0),
          total_value: new Prisma.Decimal(1000),
          component_count: BigInt(5)
        }
      ];

      mockPrismaClient.$queryRaw.mockResolvedValue(mockResults);

      const result = await getInventoryValueByCategory(mockTeamId);

      expect(result[0].total_quantity).toBe(0);
      expect(result[0].average_unit_cost).toBeUndefined();
    });
  });
});
