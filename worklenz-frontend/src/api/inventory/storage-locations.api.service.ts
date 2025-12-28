/**
 * Storage Locations API Service
 * Handles API calls for storage location management
 */

import { IServerResponse } from '@/types/common.types';
import {
  IStorageLocation,
  ILocationHierarchy,
  IStorageLocationListResponse,
  ICreateStorageLocationDto,
  IUpdateStorageLocationDto,
  IStorageLocationFilters,
} from '@/types/inventory/storage-location.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/inv/locations`;

export const storageLocationsApiService = {
  /**
   * Get all storage locations with optional filters
   * @param filters - Query parameters for filtering locations
   * @returns List of storage locations with pagination
   */
  getStorageLocations: async (
    filters: Partial<IStorageLocationFilters>
  ): Promise<IServerResponse<IStorageLocationListResponse>> => {
    const queryString = toQueryString(filters);
    const url = `${rootUrl}${queryString}`;
    const response = await apiClient.get<IServerResponse<IStorageLocationListResponse>>(url);
    return response.data;
  },

  /**
   * Get a single storage location by ID
   * @param id - Storage location ID
   * @returns Storage location details
   */
  getStorageLocationById: async (id: string): Promise<IServerResponse<IStorageLocation>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<IStorageLocation>>(url);
    return response.data;
  },

  /**
   * Get location hierarchy tree
   * @returns Hierarchical tree structure of all locations
   */
  getLocationHierarchy: async (): Promise<IServerResponse<ILocationHierarchy[]>> => {
    const url = `${rootUrl}/hierarchy`;
    const response = await apiClient.get<IServerResponse<ILocationHierarchy[]>>(url);
    return response.data;
  },

  /**
   * Search storage locations by name or code
   * @param search - Search query string
   * @returns List of matching storage locations
   */
  searchStorageLocations: async (search: string): Promise<IServerResponse<IStorageLocation[]>> => {
    const queryString = toQueryString({ search });
    const url = `${rootUrl}/search${queryString}`;
    const response = await apiClient.get<IServerResponse<IStorageLocation[]>>(url);
    return response.data;
  },

  /**
   * Create a new storage location
   * @param data - Storage location creation data
   * @returns Created storage location
   */
  createStorageLocation: async (
    data: ICreateStorageLocationDto
  ): Promise<IServerResponse<IStorageLocation>> => {
    const url = rootUrl;
    const response = await apiClient.post<IServerResponse<IStorageLocation>>(url, data);
    return response.data;
  },

  /**
   * Update an existing storage location
   * @param id - Storage location ID
   * @param data - Storage location update data
   * @returns Updated storage location
   */
  updateStorageLocation: async (
    id: string,
    data: IUpdateStorageLocationDto
  ): Promise<IServerResponse<IStorageLocation>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.put<IServerResponse<IStorageLocation>>(url, data);
    return response.data;
  },

  /**
   * Delete a storage location
   * @param id - Storage location ID
   * @returns Deletion confirmation
   */
  deleteStorageLocation: async (id: string): Promise<IServerResponse<void>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<void>>(url);
    return response.data;
  },
};
