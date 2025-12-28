import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { csvImportApiService } from '@/api/inventory/csv-import.api.service';
import { ICsvImportResult } from '@/types/inventory/csv-import.types';
import logger from '@/utils/errorLogger';

// State interface
export interface ICsvImportState {
  importResult: ICsvImportResult | null;
  loading: boolean;
  error: string | null;
  currentStep: number;
  uploadedFile: File | null;
}

// Initial state
const initialState: ICsvImportState = {
  importResult: null,
  loading: false,
  error: null,
  currentStep: 0,
  uploadedFile: null,
};

// Helper function for error handling
const handleCsvImportError = (error: any, action: string) => {
  logger.error(action, error);
  return error.response?.data?.message || 'An unknown error has occurred';
};

// Async thunk
export const importCsv = createAsyncThunk(
  'inventory/csvImport/import',
  async (file: File, { rejectWithValue }) => {
    try {
      const response = await csvImportApiService.importCsv(file);

      if (!response.done) {
        return rejectWithValue(response.message || 'Failed to import CSV file');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(handleCsvImportError(error, 'Import CSV'));
    }
  }
);

// Slice
const csvImportSlice = createSlice({
  name: 'inventoryCsvImport',
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    setFile: (state, action: PayloadAction<File | null>) => {
      state.uploadedFile = action.payload;
    },
    resetImport: state => {
      state.importResult = null;
      state.loading = false;
      state.error = null;
      state.currentStep = 0;
      state.uploadedFile = null;
    },
  },
  extraReducers: builder => {
    builder
      // Import CSV cases
      .addCase(importCsv.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(importCsv.fulfilled, (state, action) => {
        state.loading = false;
        state.importResult = action.payload;
        state.error = null;
        state.currentStep = 2; // Move to results step
      })
      .addCase(importCsv.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setStep, setFile, resetImport } = csvImportSlice.actions;
export default csvImportSlice.reducer;
