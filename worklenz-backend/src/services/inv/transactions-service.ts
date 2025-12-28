/**
 * Transactions Service
 * Handles atomic inventory transaction operations with proper locking and quantity management
 */

import prisma from "../../config/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { inv_transaction_type } from "@prisma/client";
import {
  ITransaction,
  ICreateTransactionDto,
  ITransactionFilters,
  ITransactionListResponse,
  IComponentHistory
} from "../../interfaces/inv/transaction.interface";

/**
 * Create a transaction with atomic quantity updates
 * Uses Prisma transaction to ensure atomicity and prevent race conditions
 *
 * Transaction Types:
 * - IN: Increase quantity (quantity_after = quantity_before + quantity)
 * - OUT: Decrease quantity (quantity_after = quantity_before - quantity)
 * - ADJUST: Set to exact quantity (quantity_after = quantity)
 */
export async function createTransaction(
  data: ICreateTransactionDto,
  teamId: string,
  userId: string
): Promise<ITransaction> {
  // Validate required fields
  if (!data.component_id) {
    throw new Error("component_id is required");
  }

  if (!data.transaction_type) {
    throw new Error("transaction_type is required");
  }

  if (!data.quantity || data.quantity <= 0) {
    throw new Error("quantity must be greater than 0");
  }

  // Validate transaction type
  const validTypes: inv_transaction_type[] = ['IN', 'OUT', 'ADJUST'];
  if (!validTypes.includes(data.transaction_type)) {
    throw new Error(`Invalid transaction_type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Parse transaction date if provided
  let transactionDate = new Date();
  if (data.transaction_date) {
    transactionDate = typeof data.transaction_date === 'string'
      ? new Date(data.transaction_date)
      : data.transaction_date;
  }

  // Execute transaction atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock component row and get current quantity
    // Using findFirst with team_id for security
    const component = await tx.inv_components.findFirst({
      where: {
        id: data.component_id,
        team_id: teamId,
        is_active: true
      }
    });

    if (!component) {
      throw new Error("Component not found or does not belong to this team");
    }

    const currentQuantity = Number(component.quantity);
    const transactionQuantity = Number(data.quantity);
    let newQuantity: number;

    // 2. Calculate new quantity based on transaction type
    switch (data.transaction_type) {
      case 'IN':
        // Increase inventory
        newQuantity = currentQuantity + transactionQuantity;
        break;

      case 'OUT':
        // Decrease inventory - validate sufficient stock
        if (currentQuantity < transactionQuantity) {
          throw new Error(
            `Insufficient stock. Available: ${currentQuantity}, Requested: ${transactionQuantity}`
          );
        }
        newQuantity = currentQuantity - transactionQuantity;
        break;

      case 'ADJUST':
        // Set to exact quantity (for inventory counts/corrections)
        newQuantity = transactionQuantity;
        break;

      default:
        throw new Error(`Unsupported transaction type: ${data.transaction_type}`);
    }

    // 3. Create transaction record with before/after quantities
    const transaction = await tx.inv_transactions.create({
      data: {
        component_id: data.component_id,
        transaction_type: data.transaction_type,
        quantity: transactionQuantity,
        quantity_before: currentQuantity,
        quantity_after: newQuantity,
        unit_cost: data.unit_cost !== undefined && data.unit_cost !== null
          ? new Decimal(data.unit_cost)
          : null,
        reference_number: data.reference_number || null,
        notes: data.notes || null,
        transaction_date: transactionDate,
        team_id: teamId,
        created_by: userId,
        is_active: true
      }
    });

    // 4. Update component quantity
    await tx.inv_components.update({
      where: { id: data.component_id },
      data: {
        quantity: newQuantity,
        updated_at: new Date()
      }
    });

    return transaction;
  });

  return result;
}

/**
 * Get a transaction by ID with component details
 */
export async function getTransactionById(
  id: string,
  teamId: string
): Promise<ITransaction | null> {
  const transaction = await prisma.inv_transactions.findFirst({
    where: {
      id,
      team_id: teamId
    },
    include: {
      component: {
        include: {
          supplier: true,
          storage_location: true
        }
      }
    }
  });

  if (!transaction) {
    return null;
  }

  return transaction as any;
}

/**
 * List transactions with pagination and filtering
 */
export async function listTransactions(
  filters: ITransactionFilters,
  teamId: string
): Promise<ITransactionListResponse> {
  const page = filters.page || 1;
  const size = filters.size || 20;
  const skip = (page - 1) * size;

  // Build where clause
  const where: any = {
    team_id: teamId
  };

  // Filter by is_active (default to true)
  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  } else {
    where.is_active = true;
  }

  // Filter by component_id
  if (filters.component_id) {
    where.component_id = filters.component_id;
  }

  // Filter by transaction_type
  if (filters.transaction_type) {
    where.transaction_type = filters.transaction_type;
  }

  // Filter by date range
  if (filters.start_date || filters.end_date) {
    where.transaction_date = {};

    if (filters.start_date) {
      const startDate = typeof filters.start_date === 'string'
        ? new Date(filters.start_date)
        : filters.start_date;
      where.transaction_date.gte = startDate;
    }

    if (filters.end_date) {
      const endDate = typeof filters.end_date === 'string'
        ? new Date(filters.end_date)
        : filters.end_date;
      where.transaction_date.lte = endDate;
    }
  }

  // Execute queries in parallel
  const [transactions, total] = await Promise.all([
    prisma.inv_transactions.findMany({
      where,
      skip,
      take: size,
      include: {
        component: {
          select: {
            name: true,
            sku: true,
            category: true
          }
        }
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' }
      ]
    }),
    prisma.inv_transactions.count({ where })
  ]);

  const totalPages = Math.ceil(total / size);

  return {
    data: transactions as any,
    total,
    page,
    size,
    totalPages
  };
}

/**
 * Get full transaction history for a component
 * Returns transactions in chronological order with component details
 */
export async function getComponentHistory(
  componentId: string,
  teamId: string,
  filters?: ITransactionFilters
): Promise<IComponentHistory[]> {
  // Verify component exists and belongs to team
  const component = await prisma.inv_components.findFirst({
    where: {
      id: componentId,
      team_id: teamId
    }
  });

  if (!component) {
    throw new Error("Component not found or does not belong to this team");
  }

  // Build where clause
  const where: any = {
    component_id: componentId,
    team_id: teamId
  };

  // Filter by is_active (default to true)
  if (filters?.is_active !== undefined) {
    where.is_active = filters.is_active;
  } else {
    where.is_active = true;
  }

  // Filter by transaction_type
  if (filters?.transaction_type) {
    where.transaction_type = filters.transaction_type;
  }

  // Filter by date range
  if (filters?.start_date || filters?.end_date) {
    where.transaction_date = {};

    if (filters.start_date) {
      const startDate = typeof filters.start_date === 'string'
        ? new Date(filters.start_date)
        : filters.start_date;
      where.transaction_date.gte = startDate;
    }

    if (filters.end_date) {
      const endDate = typeof filters.end_date === 'string'
        ? new Date(filters.end_date)
        : filters.end_date;
      where.transaction_date.lte = endDate;
    }
  }

  // Get transactions with user information
  const transactions = await prisma.inv_transactions.findMany({
    where,
    include: {
      component: {
        select: {
          name: true,
          sku: true,
          category: true
        }
      }
    },
    orderBy: [
      { transaction_date: 'asc' },
      { created_at: 'asc' }
    ]
  });

  // Transform to IComponentHistory format
  const history: IComponentHistory[] = transactions.map(transaction => {
    // Convert Decimal to number - handles both Prisma Decimal objects and plain numbers
    const convertToNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      // Check if it's a Decimal with toNumber method
      if (typeof value === 'object' && typeof value.toNumber === 'function') {
        return value.toNumber();
      }
      // Fallback to Number conversion
      return Number(value);
    };

    const unitCost = transaction.unit_cost ? convertToNumber(transaction.unit_cost) : null;
    const quantity = convertToNumber(transaction.quantity);

    const totalValue = unitCost !== null && !isNaN(unitCost) && !isNaN(quantity)
      ? quantity * unitCost
      : null;

    return {
      ...transaction,
      quantity, // Use converted number instead of Decimal from spread
      unit_cost: unitCost, // Use converted number instead of Decimal from spread
      component_name: transaction.component.name,
      component_sku: transaction.component.sku,
      component_category: transaction.component.category,
      total_value: totalValue !== null ? totalValue : undefined,
      created_by_name: undefined // Could be populated with a join to users table if needed
    };
  });

  return history;
}
