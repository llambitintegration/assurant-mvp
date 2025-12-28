/**
 * Inventory Transactions API Service
 * Handles API calls for inventory transaction management
 */

import { IServerResponse } from '@/types/common.types';
import {
  ITransaction,
  ITransactionListResponse,
  ICreateTransactionDto,
  ITransactionFilters,
  IComponentHistory,
} from '@/types/inventory/transaction.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/inv/transactions`;

export const transactionsApiService = {
  /**
   * Get all transactions with optional filters
   * @param filters - Query parameters for filtering transactions
   * @returns List of transactions with pagination
   */
  getTransactions: async (
    filters: Partial<ITransactionFilters>
  ): Promise<IServerResponse<ITransactionListResponse>> => {
    const queryString = toQueryString(filters);
    const url = `${rootUrl}${queryString}`;
    const response = await apiClient.get<IServerResponse<ITransactionListResponse>>(url);
    return response.data;
  },

  /**
   * Get a single transaction by ID
   * @param id - Transaction ID
   * @returns Transaction details
   */
  getTransactionById: async (id: string): Promise<IServerResponse<ITransaction>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<ITransaction>>(url);
    return response.data;
  },

  /**
   * Get transaction history for a specific component
   * @param componentId - Component ID
   * @param filters - Query parameters for filtering
   * @returns Component transaction history
   */
  getComponentHistory: async (
    componentId: string,
    filters?: Partial<ITransactionFilters>
  ): Promise<IServerResponse<ITransactionListResponse>> => {
    const queryString = filters ? toQueryString(filters) : '';
    const url = `${rootUrl}/component/${componentId}${queryString}`;
    const response = await apiClient.get<IServerResponse<ITransactionListResponse>>(url);
    return response.data;
  },

  /**
   * Create a new transaction
   * @param data - Transaction creation data
   * @returns Created transaction
   */
  createTransaction: async (
    data: ICreateTransactionDto
  ): Promise<IServerResponse<ITransaction>> => {
    const url = rootUrl;
    const response = await apiClient.post<IServerResponse<ITransaction>>(url, data);
    return response.data;
  },

  // Note: No update or delete methods - transactions are immutable
};
