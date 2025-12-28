/**
 * Inventory Transactions Redux Slice
 * State management for inventory transaction management feature
 */

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { transactionsApiService } from '@/api/inventory/transactions.api.service';
import {
  ITransaction,
  IComponentHistory,
  ITransactionFilters,
  TransactionType,
  ICreateTransactionDto,
} from '@/types/inventory/transaction.types';

type TransactionsState = {
  // Data
  transactions: ITransaction[];
  componentHistory: IComponentHistory[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: ITransactionFilters;
  dateRange: [string, string] | null;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;

  // UI State
  isModalOpen: boolean;
  selectedTransactionId: string | null;
};

const initialState: TransactionsState = {
  // Data
  transactions: [],
  componentHistory: [],
  total: 0,
  isLoading: false,
  error: null,

  // Filters
  filters: {},
  dateRange: null,

  // Pagination
  page: 1,
  pageSize: 20,
  totalPages: 0,

  // UI State
  isModalOpen: false,
  selectedTransactionId: null,
};

/**
 * Async thunk to fetch transactions
 */
export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (_, { getState }) => {
    const state = (getState() as any).transactionsReducer as TransactionsState;

    const params: Partial<ITransactionFilters> = {
      ...state.filters,
      page: state.page,
      size: state.pageSize,
    };

    // Add date range if set
    if (state.dateRange) {
      params.start_date = state.dateRange[0];
      params.end_date = state.dateRange[1];
    }

    const response = await transactionsApiService.getTransactions(params);
    return response.body;
  }
);

/**
 * Async thunk to fetch component history
 */
export const fetchComponentHistory = createAsyncThunk(
  'transactions/fetchComponentHistory',
  async (componentId: string, { getState }) => {
    const state = (getState() as any).transactionsReducer as TransactionsState;

    const params: Partial<ITransactionFilters> = {
      page: state.page,
      size: state.pageSize,
    };

    // Add date range if set
    if (state.dateRange) {
      params.start_date = state.dateRange[0];
      params.end_date = state.dateRange[1];
    }

    const response = await transactionsApiService.getComponentHistory(componentId, params);
    return response.body;
  }
);

/**
 * Async thunk to create a new transaction
 */
export const createTransaction = createAsyncThunk(
  'transactions/createTransaction',
  async (data: ICreateTransactionDto, { dispatch }) => {
    const response = await transactionsApiService.createTransaction(data);
    // Refresh transactions list after creation
    dispatch(fetchTransactions());
    return response.body;
  }
);

const transactionsSlice = createSlice({
  name: 'transactionsReducer',
  initialState,
  reducers: {
    // Filter actions
    setFilters: (state, action: PayloadAction<Partial<ITransactionFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1; // Reset to first page when filters change
    },
    setComponentFilter: (state, action: PayloadAction<string | undefined>) => {
      state.filters.component_id = action.payload;
      state.page = 1;
    },
    setTransactionTypeFilter: (state, action: PayloadAction<TransactionType | undefined>) => {
      state.filters.transaction_type = action.payload;
      state.page = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string | undefined>) => {
      state.filters.search = action.payload;
      state.page = 1;
    },
    setDateRange: (state, action: PayloadAction<[string, string] | null>) => {
      state.dateRange = action.payload;
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

    // Modal actions
    openModal: (state) => {
      state.isModalOpen = true;
    },
    closeModal: (state) => {
      state.isModalOpen = false;
    },
    setSelectedTransaction: (state, action: PayloadAction<string | null>) => {
      state.selectedTransactionId = action.payload;
    },

    // Reset action
    resetFilters: (state) => {
      state.filters = initialState.filters;
      state.dateRange = initialState.dateRange;
      state.page = 1;
    },
    clearComponentHistory: (state) => {
      state.componentHistory = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.transactions = action.payload.data || [];
          state.total = action.payload.total || 0;
          state.page = action.payload.page || 1;
          state.totalPages = action.payload.totalPages || 0;
        } else {
          state.transactions = [];
          state.total = 0;
          state.totalPages = 0;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch transactions';
      })
      // Fetch component history
      .addCase(fetchComponentHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchComponentHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.componentHistory = action.payload.data || [];
          state.total = action.payload.total || 0;
          state.page = action.payload.page || 1;
          state.totalPages = action.payload.totalPages || 0;
        } else {
          state.componentHistory = [];
          state.total = 0;
          state.totalPages = 0;
          state.error = 'No data received from server';
        }
      })
      .addCase(fetchComponentHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch component history';
      })
      // Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state) => {
        state.isLoading = false;
        state.isModalOpen = false; // Close modal on success
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create transaction';
      });
  },
});

export const {
  setFilters,
  setComponentFilter,
  setTransactionTypeFilter,
  setSearchQuery,
  setDateRange,
  setPage,
  setPageSize,
  openModal,
  closeModal,
  setSelectedTransaction,
  resetFilters,
  clearComponentHistory,
} = transactionsSlice.actions;

export default transactionsSlice.reducer;
