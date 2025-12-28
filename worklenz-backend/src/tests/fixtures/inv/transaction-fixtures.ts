/**
 * Transaction Test Fixtures
 * Provides mock transaction data for testing inventory movements
 */

import { Prisma } from '@prisma/client';

/**
 * Base transaction properties
 */
const baseTransactionProps = {
  team_id: 'team-1-uuid',
  created_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock IN transaction (receiving stock)
 */
export function createMockInTransaction(overrides: any = {}): any {
  return {
    id: 'transaction-in-1-uuid',
    component_id: 'component-1-uuid',
    transaction_type: 'IN' as const,
    quantity: new Prisma.Decimal(100),
    quantity_before: new Prisma.Decimal(500),
    quantity_after: new Prisma.Decimal(600),
    reference_number: 'PO-2024-001',
    notes: 'Received from supplier',
    ...baseTransactionProps,
    ...overrides,
  };
}

/**
 * Create a mock OUT transaction (issuing stock)
 */
export function createMockOutTransaction(overrides: any = {}): any {
  return {
    id: 'transaction-out-1-uuid',
    component_id: 'component-1-uuid',
    transaction_type: 'OUT' as const,
    quantity: new Prisma.Decimal(50),
    quantity_before: new Prisma.Decimal(600),
    quantity_after: new Prisma.Decimal(550),
    reference_number: 'WO-2024-001',
    notes: 'Issued for production',
    ...baseTransactionProps,
    ...overrides,
  };
}

/**
 * Create a mock ADJUST transaction (inventory adjustment)
 */
export function createMockAdjustTransaction(overrides: any = {}): any {
  return {
    id: 'transaction-adjust-1-uuid',
    component_id: 'component-1-uuid',
    transaction_type: 'ADJUST' as const,
    quantity: new Prisma.Decimal(525), // New quantity after adjustment
    quantity_before: new Prisma.Decimal(550),
    quantity_after: new Prisma.Decimal(525),
    reference_number: 'ADJ-2024-001',
    notes: 'Inventory count adjustment - found discrepancy',
    ...baseTransactionProps,
    ...overrides,
  };
}

/**
 * Create a transaction history for a component
 */
export function createComponentTransactionHistory(componentId: string): any[] {
  return [
    // Initial stock received
    createMockInTransaction({
      id: 'transaction-history-1-uuid',
      component_id: componentId,
      quantity: new Prisma.Decimal(1000),
      quantity_before: new Prisma.Decimal(0),
      quantity_after: new Prisma.Decimal(1000),
      reference_number: 'PO-2024-001',
      notes: 'Initial stock purchase',
      created_at: new Date('2024-01-01T10:00:00Z'),
    }),
    // Stock issued
    createMockOutTransaction({
      id: 'transaction-history-2-uuid',
      component_id: componentId,
      quantity: new Prisma.Decimal(200),
      quantity_before: new Prisma.Decimal(1000),
      quantity_after: new Prisma.Decimal(800),
      reference_number: 'WO-2024-001',
      notes: 'Issued for Project Alpha',
      created_at: new Date('2024-01-05T14:30:00Z'),
    }),
    // Additional stock received
    createMockInTransaction({
      id: 'transaction-history-3-uuid',
      component_id: componentId,
      quantity: new Prisma.Decimal(500),
      quantity_before: new Prisma.Decimal(800),
      quantity_after: new Prisma.Decimal(1300),
      reference_number: 'PO-2024-002',
      notes: 'Restock order',
      created_at: new Date('2024-01-10T09:15:00Z'),
    }),
    // More stock issued
    createMockOutTransaction({
      id: 'transaction-history-4-uuid',
      component_id: componentId,
      quantity: new Prisma.Decimal(300),
      quantity_before: new Prisma.Decimal(1300),
      quantity_after: new Prisma.Decimal(1000),
      reference_number: 'WO-2024-002',
      notes: 'Issued for Project Beta',
      created_at: new Date('2024-01-15T11:45:00Z'),
    }),
    // Inventory adjustment
    createMockAdjustTransaction({
      id: 'transaction-history-5-uuid',
      component_id: componentId,
      quantity: new Prisma.Decimal(975),
      quantity_before: new Prisma.Decimal(1000),
      quantity_after: new Prisma.Decimal(975),
      reference_number: 'ADJ-2024-001',
      notes: 'Physical count adjustment',
      created_at: new Date('2024-01-20T16:00:00Z'),
    }),
  ];
}

/**
 * Create transactions for multiple components
 */
export function createMultiComponentTransactions(): any[] {
  return [
    createMockInTransaction({
      id: 'transaction-comp1-in-uuid',
      component_id: 'component-1-uuid',
      reference_number: 'PO-2024-100',
    }),
    createMockOutTransaction({
      id: 'transaction-comp1-out-uuid',
      component_id: 'component-1-uuid',
      reference_number: 'WO-2024-100',
    }),
    createMockInTransaction({
      id: 'transaction-comp2-in-uuid',
      component_id: 'component-2-uuid',
      reference_number: 'PO-2024-101',
    }),
    createMockAdjustTransaction({
      id: 'transaction-comp2-adj-uuid',
      component_id: 'component-2-uuid',
      reference_number: 'ADJ-2024-100',
    }),
  ];
}

/**
 * Create a large transaction (bulk operation)
 */
export function createLargeTransaction(overrides: any = {}): any {
  return createMockInTransaction({
    id: 'transaction-large-uuid',
    quantity: new Prisma.Decimal(10000),
    quantity_before: new Prisma.Decimal(5000),
    quantity_after: new Prisma.Decimal(15000),
    reference_number: 'PO-BULK-2024-001',
    notes: 'Bulk order for annual inventory',
    ...overrides,
  });
}

/**
 * Create a transaction that would cause insufficient stock (for validation testing)
 */
export function createInsufficientStockTransaction(): any {
  return createMockOutTransaction({
    id: 'transaction-insufficient-uuid',
    component_id: 'component-low-stock-uuid',
    quantity: new Prisma.Decimal(1000), // Trying to take out more than available
    quantity_before: new Prisma.Decimal(50),
    quantity_after: new Prisma.Decimal(-950), // Would result in negative stock
    reference_number: 'WO-INVALID-001',
    notes: 'Invalid transaction - insufficient stock',
  });
}

/**
 * Create transactions with various reference numbers
 */
export function createTransactionsWithDifferentReferences(): any[] {
  return [
    createMockInTransaction({
      id: 'transaction-po-uuid',
      reference_number: 'PO-2024-001',
      notes: 'Purchase order reference',
    }),
    createMockOutTransaction({
      id: 'transaction-wo-uuid',
      reference_number: 'WO-2024-001',
      notes: 'Work order reference',
    }),
    createMockOutTransaction({
      id: 'transaction-so-uuid',
      reference_number: 'SO-2024-001',
      notes: 'Sales order reference',
    }),
    createMockAdjustTransaction({
      id: 'transaction-adj-uuid',
      reference_number: 'ADJ-2024-001',
      notes: 'Adjustment reference',
    }),
    createMockInTransaction({
      id: 'transaction-rma-uuid',
      reference_number: 'RMA-2024-001',
      notes: 'Return merchandise authorization',
    }),
  ];
}

/**
 * Create transactions for different teams (for multi-tenancy testing)
 */
export function createTransactionsForMultipleTeams(teamIds: string[]): any[] {
  return teamIds.map((teamId, i) => {
    return createMockInTransaction({
      id: `transaction-team-${i + 1}-uuid`,
      team_id: teamId,
      component_id: `component-team-${i + 1}-uuid`,
      reference_number: `TEAM${i + 1}-PO-001`,
      notes: `Transaction for team ${i + 1}`,
    });
  });
}

/**
 * Create sequential transactions showing stock depletion
 */
export function createStockDepletionSequence(componentId: string, startingQty: number): any[] {
  const transactions: any[] = [];
  let currentQty = startingQty;
  const depletionAmounts = [100, 150, 200, 250, 300];

  depletionAmounts.forEach((amount, i) => {
    const newQty = Math.max(0, currentQty - amount);
    transactions.push(
      createMockOutTransaction({
        id: `transaction-depletion-${i + 1}-uuid`,
        component_id: componentId,
        quantity: new Prisma.Decimal(amount),
        quantity_before: new Prisma.Decimal(currentQty),
        quantity_after: new Prisma.Decimal(newQty),
        reference_number: `WO-DEPL-${String(i + 1).padStart(3, '0')}`,
        notes: `Stock depletion ${i + 1}`,
        created_at: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      })
    );
    currentQty = newQty;
  });

  return transactions;
}

/**
 * Create transactions without reference numbers (optional field testing)
 */
export function createTransactionWithoutReference(overrides: any = {}): any {
  return createMockInTransaction({
    id: 'transaction-no-ref-uuid',
    reference_number: null,
    notes: 'Manual adjustment without reference',
    ...overrides,
  });
}

/**
 * Create transactions without notes (optional field testing)
 */
export function createTransactionWithoutNotes(overrides: any = {}): any {
  return createMockInTransaction({
    id: 'transaction-no-notes-uuid',
    reference_number: 'PO-2024-999',
    notes: null,
    ...overrides,
  });
}

/**
 * Create a chronological series of transactions over a date range
 */
export function createChronologicalTransactions(componentId: string, days: number): any[] {
  const transactions = [];
  let currentQty = 1000;

  for (let i = 0; i < days; i++) {
    const isIn = i % 3 === 0; // Every third day is an IN transaction
    const amount = Math.floor(Math.random() * 100) + 50;

    if (isIn) {
      transactions.push(
        createMockInTransaction({
          id: `transaction-chrono-in-${i + 1}-uuid`,
          component_id: componentId,
          quantity: new Prisma.Decimal(amount),
          quantity_before: new Prisma.Decimal(currentQty),
          quantity_after: new Prisma.Decimal(currentQty + amount),
          reference_number: `PO-${String(i + 1).padStart(4, '0')}`,
          created_at: new Date(`2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`),
        })
      );
      currentQty += amount;
    } else {
      const outAmount = Math.min(amount, currentQty);
      transactions.push(
        createMockOutTransaction({
          id: `transaction-chrono-out-${i + 1}-uuid`,
          component_id: componentId,
          quantity: new Prisma.Decimal(outAmount),
          quantity_before: new Prisma.Decimal(currentQty),
          quantity_after: new Prisma.Decimal(currentQty - outAmount),
          reference_number: `WO-${String(i + 1).padStart(4, '0')}`,
          created_at: new Date(`2024-01-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z`),
        })
      );
      currentQty -= outAmount;
    }
  }

  return transactions;
}
