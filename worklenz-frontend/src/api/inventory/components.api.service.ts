/**
 * Components API Service
 * Handles API calls for component management
 */

import { IServerResponse } from '@/types/common.types';
import {
  IComponent,
  IComponentListResponse,
  ICreateComponentDto,
  IUpdateComponentDto,
  IComponentFilters,
  ILowStockComponent,
} from '@/types/inventory/component.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/inv/components`;

export const componentsApiService = {
  /**
   * Get all components with optional filters
   * @param filters - Query parameters for filtering components
   * @returns List of components with pagination
   */
  getComponents: async (
    filters: Partial<IComponentFilters>
  ): Promise<IServerResponse<IComponentListResponse>> => {
    const queryString = toQueryString(filters);
    const url = `${rootUrl}${queryString}`;
    const response = await apiClient.get<IServerResponse<IComponentListResponse>>(url);
    return response.data;
  },

  /**
   * Get a single component by ID
   * @param id - Component ID
   * @returns Component details
   */
  getComponentById: async (id: string): Promise<IServerResponse<IComponent>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<IComponent>>(url);
    return response.data;
  },

  /**
   * Search components by name
   * @param search - Search query string
   * @returns List of matching components
   */
  searchComponents: async (search: string): Promise<IServerResponse<IComponent[]>> => {
    const queryString = toQueryString({ search });
    const url = `${rootUrl}/search${queryString}`;
    const response = await apiClient.get<IServerResponse<IComponent[]>>(url);
    return response.data;
  },

  /**
   * Get low stock components
   * @returns List of components that are below their reorder level
   */
  getLowStockComponents: async (): Promise<IServerResponse<ILowStockComponent[]>> => {
    const url = `${rootUrl}/low-stock`;
    const response = await apiClient.get<IServerResponse<ILowStockComponent[]>>(url);
    return response.data;
  },

  /**
   * Create a new component
   * @param data - Component creation data
   * @returns Created component
   */
  createComponent: async (data: ICreateComponentDto): Promise<IServerResponse<IComponent>> => {
    const url = rootUrl;
    const response = await apiClient.post<IServerResponse<IComponent>>(url, data);
    return response.data;
  },

  /**
   * Update an existing component
   * @param id - Component ID
   * @param data - Component update data
   * @returns Updated component
   */
  updateComponent: async (
    id: string,
    data: IUpdateComponentDto
  ): Promise<IServerResponse<IComponent>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.put<IServerResponse<IComponent>>(url, data);
    return response.data;
  },

  /**
   * Delete a component
   * @param id - Component ID
   * @returns Deletion confirmation
   */
  deleteComponent: async (id: string): Promise<IServerResponse<void>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<void>>(url);
    return response.data;
  },

  /**
   * Generate QR code for a component
   * @param id - Component ID
   * @returns Updated component with QR code
   */
  generateQrCode: async (id: string): Promise<IServerResponse<IComponent>> => {
    const url = `${rootUrl}/${id}/qr`;
    const response = await apiClient.post<IServerResponse<IComponent>>(url);
    return response.data;
  },
};
