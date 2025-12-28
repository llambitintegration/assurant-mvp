import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ICsvImportResult } from '@/types/inventory/csv-import.types';

const rootUrl = `${API_BASE_URL}/inv/csv`;

export const csvImportApiService = {
  importCsv: async (file: File): Promise<IServerResponse<ICsvImportResult>> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<IServerResponse<ICsvImportResult>>(
      `${rootUrl}/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};
