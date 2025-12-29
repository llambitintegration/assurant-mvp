import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import componentsReducer from '../components/componentsSlice';

describe('Components Slice - Minimal Test', () => {
  it('should export the reducer', () => {
    expect(componentsReducer).toBeDefined();
  });

  it('should have correct initial state', () => {
    const store = configureStore({
      reducer: {
        inventoryComponents: componentsReducer,
      },
    });
    
    const state = store.getState().inventoryComponents;
    expect(state.components).toEqual([]);
    expect(state.total).toBe(0);
  });
});
