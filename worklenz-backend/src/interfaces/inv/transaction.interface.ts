/**
 * Transaction Interfaces
 * TypeScript interfaces for inventory transaction-related data structures
 */

import { inv_transaction_type } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Database model interface (matches Prisma schema)
 */
export interface ITransaction {
  id?: string;
  component_id?: string;
  transaction_type?: inv_transaction_type;
  quantity?: number;
  quantity_before?: number;
  quantity_after?: number;
  unit_cost?: Decimal | number | null;
  reference_number?: string | null;
  notes?: string | null;
  transaction_date?: Date;
  team_id?: string;
  created_by?: string;
  created_at?: Date;
  is_active?: boolean;
}

/**
 * DTO for creating a new transaction
 */
export interface ICreateTransactionDto {
  component_id: string;
  transaction_type: inv_transaction_type;
  quantity: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
  transaction_date?: Date | string;
}

/**
 * Filters for querying transactions
 */
export interface ITransactionFilters {
  component_id?: string;
  transaction_type?: inv_transaction_type;
  start_date?: Date | string;
  end_date?: Date | string;
  is_active?: boolean;
  page?: number;
  size?: number;
}

/**
 * Paginated list response
 */
export interface ITransactionListResponse {
  data: ITransaction[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Component transaction history with component details
 */
export interface IComponentHistory extends ITransaction {
  component_name?: string;
  component_sku?: string | null;
  component_category?: string | null;
  created_by_name?: string; // User who created the transaction
  total_value?: number; // quantity * unit_cost
}
