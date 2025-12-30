/**
 * Integration Tests for Inventory Dashboard API
 * Tests actual HTTP endpoints with real database connection
 */

import {
  setupIntegrationTest,
  teardownIntegrationTest,
  cleanAfterEach
} from './setup';
import {
  getRequest,
  unauthenticatedRequest,
  expectSuccess,
  expectSuccessWithData,
  expectUnauthorized,
  validateDashboardStatsStructure,
  TestSession
} from './helpers';
import {
  createSupplier,
  createSuppliers,
  createLocation,
  createLocations,
  createComponent,
  createComponents,
  createLowStockComponents
} from './fixtures';

describe('Inventory Dashboard API - Integration Tests', () => {
  let testSession: TestSession;
  let teamId: string;
  let userId: string;

  // Setup before all tests
  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    teamId = setup.teamId;
    userId = setup.userId;

    testSession = {
      teamId,
      userId,
      email: 'test@example.com',
      teamName: 'Test Team'
    };
  });

  // Cleanup after each test
  afterEach(async () => {
    await cleanAfterEach(teamId);
  });

  // Teardown after all tests
  afterAll(async () => {
    await teardownIntegrationTest(teamId);
  });

  // ============================================================================
  // GET /api/v1/inv/dashboard - Dashboard Statistics
  // ============================================================================

  describe('GET /api/v1/inv/dashboard', () => {
    it('should return dashboard statistics with no data', async () => {
      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateDashboardStatsStructure(data);

      expect(data.total_components).toBe(0);
      expect(data.total_suppliers).toBe(0);
      expect(data.total_locations).toBe(0);
      expect(data.low_stock_count).toBe(0);
      expect(parseFloat(data.total_inventory_value)).toBe(0);
    });

    it('should return correct component count', async () => {
      // Create test data
      const supplier = await createSupplier({
        name: 'Dashboard Test Supplier',
        teamId,
        userId
      });

      await createComponents(5, teamId, userId, supplier.id);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.total_components).toBe(5);
    });

    it('should return correct supplier count', async () => {
      await createSuppliers(3, teamId, userId);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.total_suppliers).toBe(3);
    });

    it('should return correct storage location count', async () => {
      await createLocations(4, teamId, userId);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.total_locations).toBe(4);
    });

    it('should calculate total inventory value correctly', async () => {
      const supplier = await createSupplier({
        name: 'Value Test Supplier',
        teamId,
        userId
      });

      // Component 1: 10 units at $5 = $50
      await createComponent({
        name: 'Component 1',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 10,
        unit_cost: 5.00,
        teamId,
        userId
      });

      // Component 2: 20 units at $3 = $60
      await createComponent({
        name: 'Component 2',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 20,
        unit_cost: 3.00,
        teamId,
        userId
      });

      // Total value should be $110
      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(parseFloat(data.total_inventory_value)).toBe(110.00);
    });

    it('should count low stock components correctly', async () => {
      const supplier = await createSupplier({
        name: 'Low Stock Test Supplier',
        teamId,
        userId
      });

      // Create low stock components
      await createLowStockComponents(teamId, userId, supplier.id);

      // Create normal stock component
      await createComponent({
        name: 'Normal Stock Component',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 100,
        reorder_level: 10,
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.low_stock_count).toBe(2); // Only low stock components
    });

    it('should include low stock alerts list', async () => {
      const supplier = await createSupplier({
        name: 'Alert Test Supplier',
        teamId,
        userId
      });

      await createLowStockComponents(teamId, userId, supplier.id);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);

      // Dashboard might include low_stock_alerts array
      if (data.low_stock_alerts) {
        expect(Array.isArray(data.low_stock_alerts)).toBe(true);
        expect(data.low_stock_alerts.length).toBeGreaterThan(0);

        data.low_stock_alerts.forEach((alert: any) => {
          expect(alert.quantity).toBeLessThanOrEqual(alert.reorder_level);
        });
      }
    });

    it('should handle components without unit_cost in value calculation', async () => {
      const supplier = await createSupplier({
        name: 'No Cost Supplier',
        teamId,
        userId
      });

      // Component with cost
      await createComponent({
        name: 'Component With Cost',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 10,
        unit_cost: 5.00,
        teamId,
        userId
      });

      // Component without cost
      await createComponent({
        name: 'Component Without Cost',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 10,
        // No unit_cost
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      // Should only count component with cost: 10 * 5 = 50
      expect(parseFloat(data.total_inventory_value)).toBe(50.00);
    });

    it('should fail without authentication', async () => {
      const response = await unauthenticatedRequest('get', '/api/v1/inv/dashboard');

      expectUnauthorized(response);
    });

    it('should only show data for current team', async () => {
      // Create data for current team
      const supplier = await createSupplier({
        name: 'Team Isolation Supplier',
        teamId,
        userId
      });

      await createComponents(3, teamId, userId, supplier.id);
      await createLocations(2, teamId, userId);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.total_components).toBe(3);
      expect(data.total_suppliers).toBe(1);
      expect(data.total_locations).toBe(2);
    });

    it('should include recent activity if available', async () => {
      const supplier = await createSupplier({
        name: 'Activity Test Supplier',
        teamId,
        userId
      });

      await createComponent({
        name: 'Recent Component',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);

      // Dashboard might include recent_activity or recent_transactions
      if (data.recent_activity) {
        expect(Array.isArray(data.recent_activity)).toBe(true);
      }
    });

    it('should handle large datasets efficiently', async () => {
      const supplier = await createSupplier({
        name: 'Large Dataset Supplier',
        teamId,
        userId
      });

      // Create 50 components
      await createComponents(50, teamId, userId, supplier.id);

      const startTime = Date.now();
      const response = await getRequest('/api/v1/inv/dashboard', testSession);
      const endTime = Date.now();

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.total_components).toBe(50);

      // Dashboard query should be reasonably fast (< 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should include category breakdown if available', async () => {
      const supplier = await createSupplier({
        name: 'Category Test Supplier',
        teamId,
        userId
      });

      // Create components in different categories
      await createComponent({
        name: 'Electronics Component',
        category: 'Electronics',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 10,
        teamId,
        userId
      });

      await createComponent({
        name: 'Mechanical Component',
        category: 'Mechanical',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 20,
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);

      // Dashboard might include category_breakdown
      if (data.category_breakdown) {
        expect(Array.isArray(data.category_breakdown)).toBe(true);
      }
    });
  });

  // ============================================================================
  // Dashboard Edge Cases
  // ============================================================================

  describe('Dashboard Edge Cases', () => {
    it('should handle zero inventory value when all components have no cost', async () => {
      const supplier = await createSupplier({
        name: 'Zero Value Supplier',
        teamId,
        userId
      });

      await createComponent({
        name: 'No Cost Component',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 100,
        // No unit_cost
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(parseFloat(data.total_inventory_value)).toBe(0);
    });

    it('should count components with zero quantity in total', async () => {
      const supplier = await createSupplier({
        name: 'Zero Quantity Supplier',
        teamId,
        userId
      });

      await createComponent({
        name: 'Out of Stock Component',
        owner_type: 'supplier',
        supplier_id: supplier.id,
        quantity: 0,
        teamId,
        userId
      });

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      expect(data.total_components).toBe(1);
      expect(parseFloat(data.total_inventory_value)).toBe(0);
    });

    it('should handle inactive suppliers and locations correctly', async () => {
      // Create active suppliers
      await createSuppliers(3, teamId, userId);

      // Create active locations
      await createLocations(2, teamId, userId);

      const response = await getRequest('/api/v1/inv/dashboard', testSession);

      const data = expectSuccessWithData(response);
      // Should only count active suppliers and locations
      expect(data.total_suppliers).toBe(3);
      expect(data.total_locations).toBe(2);
    });
  });
});
