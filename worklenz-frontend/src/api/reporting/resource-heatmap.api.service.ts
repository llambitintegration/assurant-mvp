/**
 * Resource Heatmap API Service
 * Handles API calls for resource capacity heatmap feature
 */

import { IServerResponse } from '@/types/common.types';
import { IResourceHeatmapResponse, IHeatmapFilters } from '@/types/reporting/resource-heatmap.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/rcm/heatmap`;
const exportUrl = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/reporting-export`;

export const resourceHeatmapApiService = {
  /**
   * Get heatmap data with utilization calculations
   */
  getHeatmapData: async (params: Partial<IHeatmapFilters>): Promise<IServerResponse<IResourceHeatmapResponse>> => {
    const queryString = toQueryString(params);
    const url = `${rootUrl}${queryString}`;
    const response = await apiClient.get<IServerResponse<IResourceHeatmapResponse>>(url);
    return response.data;
  },

  /**
   * Export heatmap data to Excel
   */
  exportHeatmap: (teamName: string, params: Partial<IHeatmapFilters>) => {
    const queryString = toQueryString({
      ...params,
      team_name: teamName
    });
    window.location.href = `${exportUrl}/resource-heatmap/export${queryString}`;
  },
};
