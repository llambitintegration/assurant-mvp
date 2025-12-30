/**
 * Integration Tests for Inventory Transactions API
 * Tests actual HTTP endpoints with real database connection
 */

import {
  setupIntegrationTest,
  teardownIntegrationTest,
  cleanAfterEach,
  getPrismaClient
} from './setup';
import {
  getRequest,
  postRequest,
  unauthenticatedRequest,
  expectSuccess,
  expectSuccessWithData,
  expectUnauthorized,
  expectBadRequest,
  expectPaginatedList,
  expectListWithItems,
  validateTransactionStructure,
  TestSession
} from './helpers';
import {
  createSupplier,
  createComponent,
  createTransaction,
  createTransactions
} from './fixtures';

describe('Inventory Transactions API - Integration Tests', () => {
  let testSession: TestSession;
  let teamId: string;
  let userId: string;
  let supplierId: string;
  let componentId: string;

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

  // Setup before each test
  beforeEach(async () => {
    // Create test supplier and component
    const supplier = await createSupplier({
      name: 'Transaction Test Supplier',
      teamId,
      userId
    });
    supplierId = supplier.id;

    const component = await createComponent({
      name: 'Transaction Test Component',
      sku: 'TXN-TEST-001',
      owner_type: 'supplier',
      supplier_id: supplierId,
      quantity: 100,
      unit: 'pcs',
      unit_cost: 10.00,
      teamId,
      userId
    });
    componentId = component.id;
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
  // POST /api/v1/inv/transactions - Create Transaction
  // ============================================================================

  describe('POST /api/v1/inv/transactions', () => {
    it('should create an IN transaction and increase quantity', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'IN',
        quantity: 50,
        unit_cost: 10.50,
        reference_number: 'PO-001',
        notes: 'Purchase order receipt'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      validateTransactionStructure(data);
      expect(data.transaction_type).toBe('IN');
      expect(data.quantity).toBe(50);
      expect(data.quantity_before).toBe(100);
      expect(data.quantity_after).toBe(150);

      // Verify component quantity was updated
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findUnique({
        where: { id: componentId }
      });
      expect(component?.quantity).toBe(150);
    });

    it('should create an OUT transaction and decrease quantity', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'OUT',
        quantity: 30,
        reference_number: 'WO-001',
        notes: 'Work order usage'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.transaction_type).toBe('OUT');
      expect(data.quantity).toBe(30);
      expect(data.quantity_before).toBe(100);
      expect(data.quantity_after).toBe(70);

      // Verify component quantity was updated
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findUnique({
        where: { id: componentId }
      });
      expect(component?.quantity).toBe(70);
    });

    it('should create an ADJUST transaction to set absolute quantity', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'ADJUST',
        quantity: 75,
        notes: 'Physical count adjustment'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.transaction_type).toBe('ADJUST');
      expect(data.quantity).toBe(75);
      expect(data.quantity_before).toBe(100);
      expect(data.quantity_after).toBe(75);

      // Verify component quantity was updated
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findUnique({
        where: { id: componentId }
      });
      expect(component?.quantity).toBe(75);
    });

    it('should fail to create OUT transaction with insufficient stock', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'OUT',
        quantity: 200, // More than available (100)
        notes: 'Insufficient stock test'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);

      // Verify component quantity was not changed
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findUnique({
        where: { id: componentId }
      });
      expect(component?.quantity).toBe(100);
    });

    it('should fail to create transaction without authentication', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'IN',
        quantity: 10
      };

      const response = await unauthenticatedRequest('post', '/api/v1/inv/transactions')
        .send(transactionData);

      expectUnauthorized(response);
    });

    it('should fail to create transaction without component_id', async () => {
      const transactionData = {
        transaction_type: 'IN',
        quantity: 10
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);
    });

    it('should fail to create transaction without transaction_type', async () => {
      const transactionData = {
        component_id: componentId,
        quantity: 10
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);
    });

    it('should fail to create transaction with negative quantity', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'IN',
        quantity: -10
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);
    });

    it('should fail to create transaction with invalid transaction_type', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'INVALID',
        quantity: 10
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);
    });

    it('should handle atomic quantity updates correctly', async () => {
      // Create multiple concurrent transactions
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const transactionData = {
          component_id: componentId,
          transaction_type: 'OUT',
          quantity: 10,
          notes: `Concurrent transaction ${i + 1}`
        };

        promises.push(
          postRequest('/api/v1/inv/transactions', testSession, transactionData)
        );
      }

      await Promise.all(promises);

      // Verify final quantity is correct (100 - 50 = 50)
      const prisma = getPrismaClient();
      const component = await prisma.inv_components.findUnique({
        where: { id: componentId }
      });
      expect(component?.quantity).toBe(50);

      // Verify all transactions were recorded
      const transactions = await prisma.inv_transactions.findMany({
        where: { component_id: componentId }
      });
      expect(transactions.length).toBe(5);
    });
  });

  // ============================================================================
  // GET /api/v1/inv/transactions - List Transactions
  // ============================================================================

  describe('GET /api/v1/inv/transactions', () => {
    beforeEach(async () => {
      // Create multiple transactions
      await createTransactions(componentId, teamId, userId, 5);
    });

    it('should list all transactions for the team', async () => {
      const response = await getRequest('/api/v1/inv/transactions', testSession);

      const result = expectPaginatedList(response, 5);
      expect(result.data.length).toBeGreaterThanOrEqual(5);
      result.data.forEach(validateTransactionStructure);
    });

    it('should support pagination', async () => {
      const response = await getRequest('/api/v1/inv/transactions?limit=2&offset=0', testSession);

      const result = expectPaginatedList(response);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should filter transactions by component_id', async () => {
      const response = await getRequest(`/api/v1/inv/transactions?component_id=${componentId}`, testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((transaction: any) => {
        expect(transaction.component_id).toBe(componentId);
      });
    });

    it('should filter transactions by transaction_type', async () => {
      const response = await getRequest('/api/v1/inv/transactions?transaction_type=IN', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((transaction: any) => {
        expect(transaction.transaction_type).toBe('IN');
      });
    });

    it('should filter transactions by date range', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const response = await getRequest(
        `/api/v1/inv/transactions?start_date=${startDate}&end_date=${endDate}`,
        testSession
      );

      const result = expectPaginatedList(response);
      result.data.forEach((transaction: any) => {
        const txnDate = new Date(transaction.transaction_date);
        expect(txnDate >= new Date(startDate)).toBe(true);
        expect(txnDate <= new Date(endDate)).toBe(true);
      });
    });

    it('should not show transactions from other teams', async () => {
      const response = await getRequest('/api/v1/inv/transactions', testSession);

      const result = expectPaginatedList(response);
      result.data.forEach((transaction: any) => {
        expect(transaction.team_id).toBe(teamId);
      });
    });

    it('should order transactions by date descending by default', async () => {
      const response = await getRequest('/api/v1/inv/transactions', testSession);

      const result = expectPaginatedList(response);
      for (let i = 1; i < result.data.length; i++) {
        const prevDate = new Date(result.data[i - 1].transaction_date);
        const currDate = new Date(result.data[i].transaction_date);
        expect(prevDate >= currDate).toBe(true);
      }
    });
  });

  // ============================================================================
  // GET /api/v1/inv/transactions/component/:id - Get Component Transaction History
  // ============================================================================

  describe('GET /api/v1/inv/transactions/component/:id', () => {
    beforeEach(async () => {
      // Create transaction history for component
      await createTransaction({
        component_id: componentId,
        transaction_type: 'IN',
        quantity: 50,
        unit_cost: 10.00,
        notes: 'Initial stock',
        teamId,
        userId
      });

      await createTransaction({
        component_id: componentId,
        transaction_type: 'OUT',
        quantity: 20,
        notes: 'First usage',
        teamId,
        userId
      });

      await createTransaction({
        component_id: componentId,
        transaction_type: 'ADJUST',
        quantity: 150,
        notes: 'Physical count',
        teamId,
        userId
      });
    });

    it('should get transaction history for a component', async () => {
      const response = await getRequest(`/api/v1/inv/transactions/component/${componentId}`, testSession);

      const items = expectListWithItems(response, 3);
      items.forEach((transaction: any) => {
        expect(transaction.component_id).toBe(componentId);
      });
    });

    it('should include all transaction types in history', async () => {
      const response = await getRequest(`/api/v1/inv/transactions/component/${componentId}`, testSession);

      const items = expectListWithItems(response);
      const types = items.map((t: any) => t.transaction_type);
      expect(types).toContain('IN');
      expect(types).toContain('OUT');
      expect(types).toContain('ADJUST');
    });

    it('should show quantity changes over time', async () => {
      const response = await getRequest(`/api/v1/inv/transactions/component/${componentId}`, testSession);

      const items = expectListWithItems(response);
      items.forEach((transaction: any) => {
        expect(transaction).toHaveProperty('quantity_before');
        expect(transaction).toHaveProperty('quantity_after');
        expect(typeof transaction.quantity_before).toBe('number');
        expect(typeof transaction.quantity_after).toBe('number');
      });
    });

    it('should return empty list for component with no transactions', async () => {
      // Create a new component with no transactions
      const newComponent = await createComponent({
        name: 'No Transactions Component',
        owner_type: 'supplier',
        supplier_id: supplierId,
        quantity: 0,
        teamId,
        userId
      });

      const response = await getRequest(`/api/v1/inv/transactions/component/${newComponent.id}`, testSession);

      const result = expectPaginatedList(response, 0);
      expect(result.data.length).toBe(0);
    });
  });

  // ============================================================================
  // Transaction Edge Cases and Validation
  // ============================================================================

  describe('Transaction Edge Cases', () => {
    it('should prevent OUT transaction that would result in negative stock', async () => {
      // Set component to low quantity
      const prisma = getPrismaClient();
      await prisma.inv_components.update({
        where: { id: componentId },
        data: { quantity: 5 }
      });

      const transactionData = {
        component_id: componentId,
        transaction_type: 'OUT',
        quantity: 10
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectBadRequest(response);
    });

    it('should allow ADJUST transaction to set quantity to zero', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'ADJUST',
        quantity: 0,
        notes: 'Empty stock'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.quantity_after).toBe(0);
    });

    it('should record unit_cost if provided', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'IN',
        quantity: 10,
        unit_cost: 12.99
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(parseFloat(data.unit_cost)).toBe(12.99);
    });

    it('should record reference_number if provided', async () => {
      const transactionData = {
        component_id: componentId,
        transaction_type: 'IN',
        quantity: 10,
        reference_number: 'PO-12345'
      };

      const response = await postRequest('/api/v1/inv/transactions', testSession, transactionData);

      expectSuccess(response);
      const data = expectSuccessWithData(response);
      expect(data.reference_number).toBe('PO-12345');
    });
  });
});
