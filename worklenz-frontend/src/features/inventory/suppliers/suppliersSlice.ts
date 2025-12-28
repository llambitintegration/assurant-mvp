/**
 * Suppliers Redux Slice
 * State management for supplier management feature
 */

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { suppliersApiService } from '@/api/inventory/suppliers.api.service';
import {
  ISupplier,
  ICreateSupplierDto,
  IUpdateSupplierDto,
} from '@/types/inventory/supplier.types';

type SuppliersState = {
  // Data
  suppliers: ISupplier[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  isActiveFilter: boolean | undefined;
  searchQuery: string;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;

  // UI State
  isDrawerOpen: boolean;
  selectedSupplierId: string | null;
  drawerMode: 'create' | 'edit' | 'view';
};

const initialState: SuppliersState = {
  // Data
  suppliers: [],
  total: 0,
  isLoading: false,
  error: null,

  // Filters
  isActiveFilter: undefined,
  searchQuery: '',

  // Pagination
  page: 1,
  pageSize: 20,
  totalPages: 1,

  // UI State
  isDrawerOpen: false,
  selectedSupplierId: null,
  drawerMode: 'view',
};

/**
 * Async thunk to fetch suppliers
 */
export const fetchSuppliers = createAsyncThunk(
  'suppliers/fetchSuppliers',
  async (_, { getState }) => {
    const state = (getState() as any).inventorySuppliers as SuppliersState;

    const params: any = {
      page: state.page,
      size: state.pageSize,
    };

    // Only include optional filters if they have values
    if (state.isActiveFilter !== undefined) {
      params.is_active = state.isActiveFilter;
    }

    if (state.searchQuery) {
      params.search = state.searchQuery;
    }

    const response = await suppliersApiService.getSuppliers(params);
    return response.body;
  }
);

/**
 * Async thunk to create a new supplier
 */
export const createSupplier = createAsyncThunk(
  'suppliers/createSupplier',
  async (data: ICreateSupplierDto, { dispatch }) => {
    const response = await suppliersApiService.createSupplier(data);
    // Refresh the list after creation
    dispatch(fetchSuppliers());
    return response.body;
  }
);

/**
 * Async thunk to update an existing supplier
 */
export const updateSupplier = createAsyncThunk(
  'suppliers/updateSupplier',
  async ({ id, data }: { id: string; data: IUpdateSupplierDto }, { dispatch }) => {
    const response = await suppliersApiService.updateSupplier(id, data);
    // Refresh the list after update
    dispatch(fetchSuppliers());
    return response.body;
  }
);

/**
 * Async thunk to delete a supplier
 */
export const deleteSupplier = createAsyncThunk(
  'suppliers/deleteSupplier',
  async (id: string, { dispatch }) => {
    await suppliersApiService.deleteSupplier(id);
    // Refresh the list after deletion
    dispatch(fetchSuppliers());
    return id;
  }
);

const suppliersSlice = createSlice({
  name: 'inventorySuppliers',
  initialState,
  reducers: {
    // Filter actions
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.page = 1; // Reset to first page when search changes
    },
    setIsActiveFilter: (state, action: PayloadAction<boolean | undefined>) => {
      state.isActiveFilter = action.payload;
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
      action: PayloadAction<{ mode: 'create' | 'edit' | 'view'; supplierId?: string }>
    ) => {
      state.isDrawerOpen = true;
      state.drawerMode = action.payload.mode;
      state.selectedSupplierId = action.payload.supplierId || null;
    },
    closeDrawer: (state) => {
      state.isDrawerOpen = false;
      state.selectedSupplierId = null;
      state.drawerMode = 'view';
    },

    // Reset action
    resetFilters: (state) => {
      state.isActiveFilter = initialState.isActiveFilter;
      state.searchQuery = initialState.searchQuery;
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchSuppliers
      .addCase(fetchSuppliers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.suppliers = action.payload.data || [];
          state.total = action.payload.total || 0;
          state.totalPages = action.payload.totalPages || 1;
        } else {
          state.suppliers = [];
          state.total = 0;
          state.totalPages = 1;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch suppliers';
      })
      // createSupplier
      .addCase(createSupplier.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createSupplier.fulfilled, (state) => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedSupplierId = null;
        state.drawerMode = 'view';
      })
      .addCase(createSupplier.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create supplier';
      })
      // updateSupplier
      .addCase(updateSupplier.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateSupplier.fulfilled, (state) => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedSupplierId = null;
        state.drawerMode = 'view';
      })
      .addCase(updateSupplier.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update supplier';
      })
      // deleteSupplier
      .addCase(deleteSupplier.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteSupplier.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteSupplier.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete supplier';
      });
  },
});

export const {
  setSearchQuery,
  setIsActiveFilter,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  resetFilters,
} = suppliersSlice.actions;

export default suppliersSlice.reducer;
