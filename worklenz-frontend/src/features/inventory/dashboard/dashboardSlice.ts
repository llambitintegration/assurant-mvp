import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dashboardApiService } from '@/api/inventory/dashboard.api.service';
import {
  IDashboardStats,
  ILowStockAlert,
  IInventoryValueByCategory,
} from '@/types/inventory/dashboard.types';
import logger from '@/utils/errorLogger';

// State interface
export interface IDashboardState {
  stats: IDashboardStats | null;
  lowStockAlerts: ILowStockAlert[];
  inventoryValueByCategory: IInventoryValueByCategory[];
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: IDashboardState = {
  stats: null,
  lowStockAlerts: [],
  inventoryValueByCategory: [],
  loading: false,
  error: null,
};

// Helper function for error handling
const handleDashboardError = (error: any, action: string) => {
  logger.error(action, error);
  return error.response?.data?.message || 'An unknown error has occurred';
};

// Async thunk
export const fetchDashboardData = createAsyncThunk(
  'inventory/dashboard/fetchData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardApiService.getDashboardData();

      if (!response.done) {
        return rejectWithValue(response.message || 'Failed to fetch dashboard data');
      }

      return response.body;
    } catch (error: any) {
      return rejectWithValue(handleDashboardError(error, 'Fetch Dashboard Data'));
    }
  }
);

// Slice
const dashboardSlice = createSlice({
  name: 'inventoryDashboard',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      // Fetch dashboard data cases
      .addCase(fetchDashboardData.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.stats = action.payload.stats || null;
          state.lowStockAlerts = action.payload.low_stock_alerts || [];
          state.inventoryValueByCategory = action.payload.inventory_value_by_category || [];
        }
        state.error = null;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default dashboardSlice.reducer;
