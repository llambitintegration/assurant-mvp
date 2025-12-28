/**
 * Inventory Transaction Types
 * Types for inventory transaction management
 */

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface ITransaction {
  id: string;
  team_id: string;
  component_id: string;
  transaction_type: TransactionType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost?: number | null;
  reference_number?: string | null;
  notes?: string | null;
  transaction_date: string;
  created_by: string;
  created_at: string;

  // Populated relations
  component?: any; // Will have full component data
  created_by_user?: { name: string; email: string };
}

export interface ICreateTransactionDto {
  component_id: string;
  transaction_type: TransactionType;
  quantity: number;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
  transaction_date?: string;
}

export interface ITransactionFilters {
  component_id?: string;
  transaction_type?: TransactionType;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  size?: number;
}

export interface ITransactionListResponse {
  data: ITransaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface IComponentHistory extends ITransaction {
  component_name: string;
  component_sku?: string | null;
  total_value?: number;
}
