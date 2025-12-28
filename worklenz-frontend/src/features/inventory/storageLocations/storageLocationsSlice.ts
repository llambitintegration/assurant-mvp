/**
 * Storage Locations Redux Slice
 * State management for storage location management in inventory system
 */

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storageLocationsApiService } from '@/api/inventory/storage-locations.api.service';
import {
  IStorageLocation,
  ILocationHierarchy,
  ICreateStorageLocationDto,
  IUpdateStorageLocationDto,
} from '@/types/inventory/storage-location.types';

type StorageLocationsState = {
  // Data
  locations: IStorageLocation[];
  hierarchyData: ILocationHierarchy[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  isActiveFilter: boolean | null;
  parentLocationIdFilter: string | null;
  searchQuery: string;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;

  // UI State
  isDrawerOpen: boolean;
  selectedLocationId: string | null;
  drawerMode: 'create' | 'edit' | 'view';
};

const initialState: StorageLocationsState = {
  // Data
  locations: [],
  hierarchyData: [],
  total: 0,
  isLoading: false,
  error: null,

  // Filters
  isActiveFilter: true,
  parentLocationIdFilter: null,
  searchQuery: '',

  // Pagination
  page: 1,
  pageSize: 20,
  totalPages: 0,

  // UI State
  isDrawerOpen: false,
  selectedLocationId: null,
  drawerMode: 'view',
};

/**
 * Async thunk to fetch storage locations with filters
 */
export const fetchStorageLocations = createAsyncThunk(
  'storageLocations/fetchStorageLocations',
  async (_, { getState }) => {
    const state = (getState() as any).inventoryStorageLocations;

    const params: any = {
      page: state.page,
      size: state.pageSize,
    };

    // Only include optional filters if they have values
    if (state.isActiveFilter !== null) {
      params.is_active = state.isActiveFilter;
    }

    if (state.parentLocationIdFilter) {
      params.parent_location_id = state.parentLocationIdFilter;
    }

    if (state.searchQuery) {
      params.search = state.searchQuery;
    }

    const response = await storageLocationsApiService.getStorageLocations(params);
    return response.body;
  }
);

/**
 * Async thunk to fetch location hierarchy
 */
export const fetchLocationHierarchy = createAsyncThunk(
  'storageLocations/fetchLocationHierarchy',
  async () => {
    const response = await storageLocationsApiService.getLocationHierarchy();
    return response.body;
  }
);

/**
 * Async thunk to create a new storage location
 */
export const createStorageLocation = createAsyncThunk(
  'storageLocations/createStorageLocation',
  async (data: ICreateStorageLocationDto, { dispatch }) => {
    const response = await storageLocationsApiService.createStorageLocation(data);
    // Refresh the list after creation
    dispatch(fetchStorageLocations());
    dispatch(fetchLocationHierarchy());
    return response.body;
  }
);

/**
 * Async thunk to update a storage location
 */
export const updateStorageLocation = createAsyncThunk(
  'storageLocations/updateStorageLocation',
  async ({ id, data }: { id: string; data: IUpdateStorageLocationDto }, { dispatch }) => {
    const response = await storageLocationsApiService.updateStorageLocation(id, data);
    // Refresh the list after update
    dispatch(fetchStorageLocations());
    dispatch(fetchLocationHierarchy());
    return response.body;
  }
);

/**
 * Async thunk to delete a storage location
 */
export const deleteStorageLocation = createAsyncThunk(
  'storageLocations/deleteStorageLocation',
  async (id: string, { dispatch }) => {
    await storageLocationsApiService.deleteStorageLocation(id);
    // Refresh the list after deletion
    dispatch(fetchStorageLocations());
    dispatch(fetchLocationHierarchy());
    return id;
  }
);

const storageLocationsSlice = createSlice({
  name: 'inventoryStorageLocations',
  initialState,
  reducers: {
    // Filter actions
    setIsActiveFilter: (state, action: PayloadAction<boolean | null>) => {
      state.isActiveFilter = action.payload;
      state.page = 1; // Reset to first page when filter changes
    },
    setParentLocationIdFilter: (state, action: PayloadAction<string | null>) => {
      state.parentLocationIdFilter = action.payload;
      state.page = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
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
    openDrawer: (
      state,
      action: PayloadAction<{ mode: 'create' | 'edit' | 'view'; locationId?: string }>
    ) => {
      state.isDrawerOpen = true;
      state.drawerMode = action.payload.mode;
      state.selectedLocationId = action.payload.locationId || null;
    },
    closeDrawer: state => {
      state.isDrawerOpen = false;
      state.selectedLocationId = null;
      state.drawerMode = 'view';
    },

    // Reset action
    resetFilters: state => {
      state.isActiveFilter = initialState.isActiveFilter;
      state.parentLocationIdFilter = initialState.parentLocationIdFilter;
      state.searchQuery = initialState.searchQuery;
      state.page = 1;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch storage locations
      .addCase(fetchStorageLocations.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStorageLocations.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.locations = action.payload.data || [];
          state.total = action.payload.total || 0;
          state.totalPages = action.payload.totalPages || 0;
        } else {
          state.locations = [];
          state.total = 0;
          state.totalPages = 0;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchStorageLocations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch storage locations';
      })

      // Fetch location hierarchy
      .addCase(fetchLocationHierarchy.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLocationHierarchy.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.hierarchyData = action.payload || [];
        } else {
          state.hierarchyData = [];
          state.error = 'No hierarchy data received from server';
        }
      })
      .addCase(fetchLocationHierarchy.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch location hierarchy';
      })

      // Create storage location
      .addCase(createStorageLocation.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createStorageLocation.fulfilled, state => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedLocationId = null;
      })
      .addCase(createStorageLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create storage location';
      })

      // Update storage location
      .addCase(updateStorageLocation.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateStorageLocation.fulfilled, state => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedLocationId = null;
      })
      .addCase(updateStorageLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update storage location';
      })

      // Delete storage location
      .addCase(deleteStorageLocation.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteStorageLocation.fulfilled, state => {
        state.isLoading = false;
      })
      .addCase(deleteStorageLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete storage location';
      });
  },
});

export const {
  setIsActiveFilter,
  setParentLocationIdFilter,
  setSearchQuery,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  resetFilters,
} = storageLocationsSlice.actions;

export default storageLocationsSlice.reducer;
