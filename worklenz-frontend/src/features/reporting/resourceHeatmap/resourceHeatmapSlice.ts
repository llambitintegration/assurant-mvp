/**
 * Resource Heatmap Redux Slice
 * State management for resource capacity heatmap feature
 */

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { resourceHeatmapApiService } from '@/api/reporting/resource-heatmap.api.service';
import { IHeatmapResource } from '@/types/reporting/resource-heatmap.types';

type ResourceHeatmapState = {
  // Data
  resources: IHeatmapResource[];
  periodLabels: string[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  granularity: 'daily' | 'weekly' | 'monthly';
  selectedDepartmentIds: string[];
  selectedResourceTypes: ('personnel' | 'equipment')[];
  selectedProjectId: string | null;
  searchQuery: string;
  includeUnavailability: boolean;

  // Pagination
  page: number;
  pageSize: number;

  // UI State
  isDetailDrawerOpen: boolean;
  selectedResourceId: string | null;
  selectedPeriodIndex: number | null;
  activeTab: 'heatmap' | 'table';
};

const initialState: ResourceHeatmapState = {
  // Data
  resources: [],
  periodLabels: [],
  total: 0,
  isLoading: false,
  error: null,

  // Filters
  granularity: 'weekly',
  selectedDepartmentIds: [],
  selectedResourceTypes: [],
  selectedProjectId: null,
  searchQuery: '',
  includeUnavailability: false,

  // Pagination
  page: 1,
  pageSize: 20,

  // UI State
  isDetailDrawerOpen: false,
  selectedResourceId: null,
  selectedPeriodIndex: null,
  activeTab: 'heatmap',
};

/**
 * Async thunk to fetch heatmap data
 */
export const fetchHeatmapData = createAsyncThunk(
  'resourceHeatmap/fetchHeatmapData',
  async (_, { getState }) => {
    const state = (getState() as any);
    const reportingState = state.reportingReducer;
    const heatmapState = state.resourceHeatmapReducer;

    const params: any = {
      start_date: reportingState.dateRange[0],
      end_date: reportingState.dateRange[1],
      granularity: heatmapState.granularity,
      include_unavailability: heatmapState.includeUnavailability,
      page: heatmapState.page,
      size: heatmapState.pageSize,
    };

    // Only include optional filters if they have values
    if (heatmapState.selectedDepartmentIds.length > 0) {
      params.department_ids = heatmapState.selectedDepartmentIds;
    }

    if (heatmapState.selectedResourceTypes.length > 0) {
      params.resource_types = heatmapState.selectedResourceTypes;
    }

    if (heatmapState.selectedProjectId) {
      params.project_id = heatmapState.selectedProjectId;
    }

    const response = await resourceHeatmapApiService.getHeatmapData(params);
    return response.body;
  }
);

const resourceHeatmapSlice = createSlice({
  name: 'resourceHeatmapReducer',
  initialState,
  reducers: {
    // Filter actions
    setGranularity: (state, action: PayloadAction<'daily' | 'weekly' | 'monthly'>) => {
      state.granularity = action.payload;
      state.page = 1; // Reset to first page when filter changes
    },
    setSelectedDepartmentIds: (state, action: PayloadAction<string[]>) => {
      state.selectedDepartmentIds = action.payload;
      state.page = 1;
    },
    setSelectedResourceTypes: (state, action: PayloadAction<('personnel' | 'equipment')[]>) => {
      state.selectedResourceTypes = action.payload;
      state.page = 1;
    },
    setSelectedProjectId: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload;
      state.page = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.page = 1;
    },
    setIncludeUnavailability: (state, action: PayloadAction<boolean>) => {
      state.includeUnavailability = action.payload;
      state.page = 1;
    },

    // Pagination actions
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.page = 1;
    },

    // UI actions
    openDetailDrawer: (state, action: PayloadAction<{ resourceId: string; periodIndex: number }>) => {
      state.isDetailDrawerOpen = true;
      state.selectedResourceId = action.payload.resourceId;
      state.selectedPeriodIndex = action.payload.periodIndex;
    },
    closeDetailDrawer: (state) => {
      state.isDetailDrawerOpen = false;
      state.selectedResourceId = null;
      state.selectedPeriodIndex = null;
    },
    setActiveTab: (state, action: PayloadAction<'heatmap' | 'table'>) => {
      state.activeTab = action.payload;
    },

    // Reset action
    resetFilters: (state) => {
      state.granularity = initialState.granularity;
      state.selectedDepartmentIds = initialState.selectedDepartmentIds;
      state.selectedResourceTypes = initialState.selectedResourceTypes;
      state.selectedProjectId = initialState.selectedProjectId;
      state.searchQuery = initialState.searchQuery;
      state.includeUnavailability = initialState.includeUnavailability;
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHeatmapData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHeatmapData.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.resources = action.payload.resources || [];
          state.periodLabels = action.payload.period_labels || [];
          state.total = action.payload.total || 0;
        } else {
          state.resources = [];
          state.periodLabels = [];
          state.total = 0;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchHeatmapData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch heatmap data';
      });
  },
});

export const {
  setGranularity,
  setSelectedDepartmentIds,
  setSelectedResourceTypes,
  setSelectedProjectId,
  setSearchQuery,
  setIncludeUnavailability,
  setPage,
  setPageSize,
  openDetailDrawer,
  closeDetailDrawer,
  setActiveTab,
  resetFilters,
} = resourceHeatmapSlice.actions;

export default resourceHeatmapSlice.reducer;
