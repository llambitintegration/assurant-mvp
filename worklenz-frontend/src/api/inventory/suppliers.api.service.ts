/**
 * Suppliers API Service
 * Handles API calls for supplier management
 */

import { IServerResponse } from '@/types/common.types';
import {
  ISupplier,
  ISupplierListResponse,
  ICreateSupplierDto,
  IUpdateSupplierDto,
  ISupplierFilters,
} from '@/types/inventory/supplier.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/inv/suppliers`;

export const suppliersApiService = {
  /**
   * Get all suppliers with optional filters
   * @param filters - Query parameters for filtering suppliers
   * @returns List of suppliers with pagination
   */
  getSuppliers: async (
    filters: Partial<ISupplierFilters>
  ): Promise<IServerResponse<ISupplierListResponse>> => {
    const queryString = toQueryString(filters);
    const url = `${rootUrl}${queryString}`;
    const response = await apiClient.get<IServerResponse<ISupplierListResponse>>(url);
    return response.data;
  },

  /**
   * Get a single supplier by ID
   * @param id - Supplier ID
   * @returns Supplier details
   */
  getSupplierById: async (id: string): Promise<IServerResponse<ISupplier>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<ISupplier>>(url);
    return response.data;
  },

  /**
   * Search suppliers by name
   * @param search - Search query string
   * @returns List of matching suppliers
   */
  searchSuppliers: async (search: string): Promise<IServerResponse<ISupplier[]>> => {
    const queryString = toQueryString({ search });
    const url = `${rootUrl}/search${queryString}`;
    const response = await apiClient.get<IServerResponse<ISupplier[]>>(url);
    return response.data;
  },

  /**
   * Create a new supplier
   * @param data - Supplier creation data
   * @returns Created supplier
   */
  createSupplier: async (data: ICreateSupplierDto): Promise<IServerResponse<ISupplier>> => {
    const url = rootUrl;
    const response = await apiClient.post<IServerResponse<ISupplier>>(url, data);
    return response.data;
  },

  /**
   * Update an existing supplier
   * @param id - Supplier ID
   * @param data - Supplier update data
   * @returns Updated supplier
   */
  updateSupplier: async (
    id: string,
    data: IUpdateSupplierDto
  ): Promise<IServerResponse<ISupplier>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.put<IServerResponse<ISupplier>>(url, data);
    return response.data;
  },

  /**
   * Delete a supplier
   * @param id - Supplier ID
   * @returns Deletion confirmation
   */
  deleteSupplier: async (id: string): Promise<IServerResponse<void>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<void>>(url);
    return response.data;
  },
};
