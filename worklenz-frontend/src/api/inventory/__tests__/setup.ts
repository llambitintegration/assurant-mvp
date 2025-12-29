/**
 * MSW (Mock Service Worker) Setup for Inventory API Tests
 * Configures mock HTTP server for testing API interactions
 */

import { setupServer } from 'msw/node';

/**
 * Create MSW server instance
 * This server intercepts HTTP requests during tests
 */
export const server = setupServer();

/**
 * Setup and teardown hooks for MSW server
 * Note: Using global vitest functions (globals: true in vitest.config.ts)
 */
beforeAll(() => {
  // Start server before all tests
  // onUnhandledRequest: 'warn' to avoid errors for unmocked requests
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  // Reset handlers after each test to ensure test isolation
  server.resetHandlers();
});

afterAll(() => {
  // Clean up and close server after all tests
  server.close();
});

/**
 * Helper to create a successful server response
 * @param data - Response body data
 * @param done - Success status (defaults to true)
 * @returns Formatted server response
 */
export const createMockResponse = <T>(data: T, done = true) => ({
  done,
  message: done ? 'Success' : 'Error',
  body: data,
});

/**
 * Helper to create an error server response
 * @param message - Error message
 * @returns Formatted error response
 */
export const createErrorResponse = (message: string) => ({
  done: false,
  message,
  body: null,
});
