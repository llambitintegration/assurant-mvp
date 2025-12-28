import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IDashboardResponse } from '@/types/inventory/dashboard.types';

const rootUrl = `${API_BASE_URL}/inv/dashboard`;

export const dashboardApiService = {
  getDashboardData: async (): Promise<IServerResponse<IDashboardResponse>> => {
    const response = await apiClient.get<IServerResponse<IDashboardResponse>>(rootUrl);
    return response.data;
  },
};
