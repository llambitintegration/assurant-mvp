/**
 * Components Redux Slice
 * State management for component management feature
 */

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { componentsApiService } from '@/api/inventory/components.api.service';
import {
  IComponent,
  ICreateComponentDto,
  IUpdateComponentDto,
  ILowStockComponent,
  OwnerType,
} from '@/types/inventory/component.types';
import {
  validatePaginatedResponse,
  validateEntityResponse,
  validateArrayResponse,
} from '@/utils/api-validators';

type ComponentsState = {
  // Data
  components: IComponent[];
  lowStockComponents: ILowStockComponent[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  isActiveFilter: boolean | undefined;
  ownerTypeFilter: OwnerType | undefined;
  supplierIdFilter: string | undefined;
  storageLocationIdFilter: string | undefined;
  categoryFilter: string | undefined;
  lowStockFilter: boolean | undefined;
  searchQuery: string;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;

  // UI State - Main Drawer
  isDrawerOpen: boolean;
  selectedComponentId: string | null;
  drawerMode: 'create' | 'edit' | 'view';

  // UI State - Detail Drawer
  isDetailDrawerOpen: boolean;
  detailComponentId: string | null;
};

const initialState: ComponentsState = {
  // Data
  components: [],
  lowStockComponents: [],
  total: 0,
  isLoading: false,
  error: null,

  // Filters
  isActiveFilter: undefined,
  ownerTypeFilter: undefined,
  supplierIdFilter: undefined,
  storageLocationIdFilter: undefined,
  categoryFilter: undefined,
  lowStockFilter: undefined,
  searchQuery: '',

  // Pagination
  page: 1,
  pageSize: 20,
  totalPages: 1,

  // UI State - Main Drawer
  isDrawerOpen: false,
  selectedComponentId: null,
  drawerMode: 'view',

  // UI State - Detail Drawer
  isDetailDrawerOpen: false,
  detailComponentId: null,
};

/**
 * Async thunk to fetch components
 */
export const fetchComponents = createAsyncThunk(
  'components/fetchComponents',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as any).inventoryComponents as ComponentsState;

    const params: any = {
      page: state.page,
      size: state.pageSize,
    };

    // Only include optional filters if they have values
    if (state.isActiveFilter !== undefined) {
      params.is_active = state.isActiveFilter;
    }

    if (state.ownerTypeFilter !== undefined) {
      params.owner_type = state.ownerTypeFilter;
    }

    if (state.supplierIdFilter !== undefined) {
      params.supplier_id = state.supplierIdFilter;
    }

    if (state.storageLocationIdFilter !== undefined) {
      params.storage_location_id = state.storageLocationIdFilter;
    }

    if (state.categoryFilter !== undefined) {
      params.category = state.categoryFilter;
    }

    if (state.lowStockFilter !== undefined) {
      params.low_stock = state.lowStockFilter;
    }

    if (state.searchQuery) {
      params.search = state.searchQuery;
    }

    const response = await componentsApiService.getComponents(params);

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to fetch components');
    }

    // Validate response structure
    if (!validatePaginatedResponse(response.body)) {
      return rejectWithValue('Invalid components data structure received from server');
    }

    return response.body;
  }
);

/**
 * Async thunk to fetch low stock components
 */
export const fetchLowStockComponents = createAsyncThunk(
  'components/fetchLowStockComponents',
  async (_, { rejectWithValue }) => {
    const response = await componentsApiService.getLowStockComponents();

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to fetch low stock components');
    }

    // Validate response structure
    if (!validateArrayResponse(response.body)) {
      return rejectWithValue('Invalid low stock components data structure received from server');
    }

    return response.body;
  }
);

/**
 * Async thunk to create a new component
 */
export const createComponent = createAsyncThunk(
  'components/createComponent',
  async (data: ICreateComponentDto, { dispatch, rejectWithValue }) => {
    const response = await componentsApiService.createComponent(data);

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to create component');
    }

    // Validate response structure
    if (!validateEntityResponse(response.body)) {
      return rejectWithValue('Invalid response structure received from server');
    }

    // Refresh the list after creation
    dispatch(fetchComponents());
    return response.body;
  }
);

/**
 * Async thunk to update an existing component
 */
export const updateComponent = createAsyncThunk(
  'components/updateComponent',
  async ({ id, data }: { id: string; data: IUpdateComponentDto }, { dispatch, rejectWithValue }) => {
    const response = await componentsApiService.updateComponent(id, data);

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to update component');
    }

    // Validate response structure
    if (!validateEntityResponse(response.body)) {
      return rejectWithValue('Invalid response structure received from server');
    }

    // Refresh the list after update
    dispatch(fetchComponents());
    return response.body;
  }
);

/**
 * Async thunk to delete a component
 */
export const deleteComponent = createAsyncThunk(
  'components/deleteComponent',
  async (id: string, { dispatch, rejectWithValue }) => {
    const response = await componentsApiService.deleteComponent(id);

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to delete component');
    }

    // Refresh the list after deletion
    dispatch(fetchComponents());
    return id;
  }
);

/**
 * Async thunk to generate QR code for a component
 */
export const generateQrCode = createAsyncThunk(
  'components/generateQrCode',
  async (id: string, { dispatch, rejectWithValue }) => {
    const response = await componentsApiService.generateQrCode(id);

    if (!response.done) {
      return rejectWithValue(response.message || 'Failed to generate QR code');
    }

    // Validate response structure
    if (!validateEntityResponse(response.body)) {
      return rejectWithValue('Invalid response structure received from server');
    }

    // Refresh the list to show updated component with QR code
    dispatch(fetchComponents());
    return response.body;
  }
);

const componentsSlice = createSlice({
  name: 'componentsReducer',
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
    setOwnerTypeFilter: (state, action: PayloadAction<OwnerType | undefined>) => {
      state.ownerTypeFilter = action.payload;
      state.page = 1;
    },
    setSupplierIdFilter: (state, action: PayloadAction<string | undefined>) => {
      state.supplierIdFilter = action.payload;
      state.page = 1;
    },
    setStorageLocationIdFilter: (state, action: PayloadAction<string | undefined>) => {
      state.storageLocationIdFilter = action.payload;
      state.page = 1;
    },
    setCategoryFilter: (state, action: PayloadAction<string | undefined>) => {
      state.categoryFilter = action.payload;
      state.page = 1;
    },
    setLowStockFilter: (state, action: PayloadAction<boolean | undefined>) => {
      state.lowStockFilter = action.payload;
      state.page = 1;
    },
    setFilters: (
      state,
      action: PayloadAction<{
        is_active?: boolean;
        owner_type?: OwnerType;
        supplier_id?: string;
        storage_location_id?: string;
        category?: string;
        low_stock?: boolean;
      }>
    ) => {
      if (action.payload.is_active !== undefined) {
        state.isActiveFilter = action.payload.is_active;
      }
      if (action.payload.owner_type !== undefined) {
        state.ownerTypeFilter = action.payload.owner_type;
      }
      if (action.payload.supplier_id !== undefined) {
        state.supplierIdFilter = action.payload.supplier_id;
      }
      if (action.payload.storage_location_id !== undefined) {
        state.storageLocationIdFilter = action.payload.storage_location_id;
      }
      if (action.payload.category !== undefined) {
        state.categoryFilter = action.payload.category;
      }
      if (action.payload.low_stock !== undefined) {
        state.lowStockFilter = action.payload.low_stock;
      }
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

    // UI actions - Main Drawer
    openDrawer: (
      state,
      action: PayloadAction<{ mode: 'create' | 'edit' | 'view'; componentId?: string }>
    ) => {
      state.isDrawerOpen = true;
      state.drawerMode = action.payload.mode;
      state.selectedComponentId = action.payload.componentId || null;
    },
    closeDrawer: (state) => {
      state.isDrawerOpen = false;
      state.selectedComponentId = null;
      state.drawerMode = 'view';
    },

    // UI actions - Detail Drawer
    openDetailDrawer: (state, action: PayloadAction<string>) => {
      state.isDetailDrawerOpen = true;
      state.detailComponentId = action.payload;
    },
    closeDetailDrawer: (state) => {
      state.isDetailDrawerOpen = false;
      state.detailComponentId = null;
    },

    // Reset action
    resetFilters: (state) => {
      state.isActiveFilter = initialState.isActiveFilter;
      state.ownerTypeFilter = initialState.ownerTypeFilter;
      state.supplierIdFilter = initialState.supplierIdFilter;
      state.storageLocationIdFilter = initialState.storageLocationIdFilter;
      state.categoryFilter = initialState.categoryFilter;
      state.lowStockFilter = initialState.lowStockFilter;
      state.searchQuery = initialState.searchQuery;
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchComponents
      .addCase(fetchComponents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchComponents.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.components = action.payload.data || [];
          state.total = action.payload.total || 0;
          state.totalPages = action.payload.totalPages || 1;
        } else {
          state.components = [];
          state.total = 0;
          state.totalPages = 1;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchComponents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch components';
      })
      // fetchLowStockComponents
      .addCase(fetchLowStockComponents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLowStockComponents.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.lowStockComponents = action.payload || [];
        } else {
          state.lowStockComponents = [];
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchLowStockComponents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch low stock components';
      })
      // createComponent
      .addCase(createComponent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createComponent.fulfilled, (state) => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedComponentId = null;
        state.drawerMode = 'view';
      })
      .addCase(createComponent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create component';
      })
      // updateComponent
      .addCase(updateComponent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateComponent.fulfilled, (state) => {
        state.isLoading = false;
        state.isDrawerOpen = false;
        state.selectedComponentId = null;
        state.drawerMode = 'view';
      })
      .addCase(updateComponent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update component';
      })
      // deleteComponent
      .addCase(deleteComponent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteComponent.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteComponent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete component';
      })
      // generateQrCode
      .addCase(generateQrCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateQrCode.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(generateQrCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to generate QR code';
      });
  },
});

export const {
  setSearchQuery,
  setIsActiveFilter,
  setOwnerTypeFilter,
  setSupplierIdFilter,
  setStorageLocationIdFilter,
  setCategoryFilter,
  setLowStockFilter,
  setFilters,
  setPage,
  setPageSize,
  openDrawer,
  closeDrawer,
  openDetailDrawer,
  closeDetailDrawer,
  resetFilters,
} = componentsSlice.actions;

export default componentsSlice.reducer;
