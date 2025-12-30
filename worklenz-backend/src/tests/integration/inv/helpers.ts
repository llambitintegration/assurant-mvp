/**
 * Integration Test Helpers for Inventory Management
 * Provides authentication, request builders, and common assertion utilities
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { Response } from 'supertest';

/**
 * Session data structure for authenticated requests
 */
export interface TestSession {
  teamId: string;
  userId: string;
  email: string;
  teamName?: string;
}

/**
 * Generate a JWT token for testing
 * This simulates an authenticated session
 */
export function generateAuthToken(session: TestSession): string {
  const payload = {
    id: session.userId,
    email: session.email,
    team_id: session.teamId,
    team_name: session.teamName || 'Test Team',
    is_member: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };

  const secret = process.env.JWT_SECRET || 'test-secret-key-min-32-characters-long';
  return jwt.sign(payload, secret);
}

/**
 * Create an authenticated request object
 * This adds the session cookie to the request
 */
export function authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, session: TestSession) {
  const token = generateAuthToken(session);

  const req = request(app)[method](url);

  // Add authorization header
  req.set('Authorization', `Bearer ${token}`);

  // Add session cookie (some endpoints might check this)
  req.set('Cookie', [`connect.sid=s%3A${token}`]);

  return req;
}

/**
 * Make an authenticated GET request
 */
export function getRequest(url: string, session: TestSession) {
  return authenticatedRequest('get', url, session);
}

/**
 * Make an authenticated POST request
 */
export function postRequest(url: string, session: TestSession, body?: any) {
  const req = authenticatedRequest('post', url, session);
  if (body) {
    req.send(body);
  }
  return req;
}

/**
 * Make an authenticated PUT request
 */
export function putRequest(url: string, session: TestSession, body?: any) {
  const req = authenticatedRequest('put', url, session);
  if (body) {
    req.send(body);
  }
  return req;
}

/**
 * Make an authenticated DELETE request
 */
export function deleteRequest(url: string, session: TestSession) {
  return authenticatedRequest('delete', url, session);
}

/**
 * Make an unauthenticated request (for testing auth failures)
 */
export function unauthenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  return request(app)[method](url);
}

// ============================================================================
// Response Assertion Helpers
// ============================================================================

/**
 * Assert that a response was successful (200 OK)
 */
export function expectSuccess(response: Response, expectedData?: any): void {
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('done', true);

  if (expectedData !== undefined) {
    expect(response.body.body).toMatchObject(expectedData);
  }
}

/**
 * Assert that a response contains expected data structure
 */
export function expectSuccessWithData(response: Response): any {
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('done', true);
  expect(response.body).toHaveProperty('body');
  return response.body.body;
}

/**
 * Assert that a response was an error
 */
export function expectError(response: Response, statusCode: number, messagePattern?: string | RegExp): void {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('done', false);

  if (messagePattern) {
    if (typeof messagePattern === 'string') {
      expect(response.body.message).toContain(messagePattern);
    } else {
      expect(response.body.message).toMatch(messagePattern);
    }
  }
}

/**
 * Assert that a response was unauthorized (401)
 */
export function expectUnauthorized(response: Response): void {
  expectError(response, 401);
}

/**
 * Assert that a response was forbidden (403)
 */
export function expectForbidden(response: Response): void {
  expectError(response, 403);
}

/**
 * Assert that a response was not found (404)
 */
export function expectNotFound(response: Response): void {
  expectError(response, 404);
}

/**
 * Assert that a response was a bad request (400)
 */
export function expectBadRequest(response: Response, messagePattern?: string | RegExp): void {
  expectError(response, 400, messagePattern);
}

/**
 * Assert that a response was a validation error (422)
 */
export function expectValidationError(response: Response, messagePattern?: string | RegExp): void {
  expectError(response, 422, messagePattern);
}

/**
 * Assert that a response contains a list with pagination
 */
export function expectPaginatedList(response: Response, expectedMinItems: number = 0): any {
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('done', true);
  expect(response.body.body).toHaveProperty('data');
  expect(Array.isArray(response.body.body.data)).toBe(true);
  expect(response.body.body.data.length).toBeGreaterThanOrEqual(expectedMinItems);

  // Common pagination fields
  expect(response.body.body).toHaveProperty('total');

  return response.body.body;
}

/**
 * Assert that a list response contains items
 */
export function expectListWithItems(response: Response, minItems: number = 1): any[] {
  const result = expectPaginatedList(response, minItems);
  expect(result.data.length).toBeGreaterThanOrEqual(minItems);
  return result.data;
}

/**
 * Assert that a response contains an empty list
 */
export function expectEmptyList(response: Response): void {
  expectPaginatedList(response, 0);
  expect(response.body.body.data.length).toBe(0);
}

// ============================================================================
// Data Validation Helpers
// ============================================================================

/**
 * Validate that an object has the expected inventory component structure
 */
export function validateComponentStructure(component: any): void {
  expect(component).toHaveProperty('id');
  expect(component).toHaveProperty('name');
  expect(component).toHaveProperty('quantity');
  expect(component).toHaveProperty('team_id');
  expect(component).toHaveProperty('created_at');
  expect(component).toHaveProperty('updated_at');
  expect(component).toHaveProperty('is_active');
}

/**
 * Validate that an object has the expected supplier structure
 */
export function validateSupplierStructure(supplier: any): void {
  expect(supplier).toHaveProperty('id');
  expect(supplier).toHaveProperty('name');
  expect(supplier).toHaveProperty('team_id');
  expect(supplier).toHaveProperty('created_at');
  expect(supplier).toHaveProperty('updated_at');
  expect(supplier).toHaveProperty('is_active');
}

/**
 * Validate that an object has the expected storage location structure
 */
export function validateLocationStructure(location: any): void {
  expect(location).toHaveProperty('id');
  expect(location).toHaveProperty('location_code');
  expect(location).toHaveProperty('name');
  expect(location).toHaveProperty('team_id');
  expect(location).toHaveProperty('created_at');
  expect(location).toHaveProperty('updated_at');
  expect(location).toHaveProperty('is_active');
}

/**
 * Validate that an object has the expected transaction structure
 */
export function validateTransactionStructure(transaction: any): void {
  expect(transaction).toHaveProperty('id');
  expect(transaction).toHaveProperty('component_id');
  expect(transaction).toHaveProperty('transaction_type');
  expect(transaction).toHaveProperty('quantity');
  expect(transaction).toHaveProperty('quantity_before');
  expect(transaction).toHaveProperty('quantity_after');
  expect(transaction).toHaveProperty('team_id');
  expect(transaction).toHaveProperty('created_at');
}

/**
 * Validate that an object has the expected dashboard stats structure
 */
export function validateDashboardStatsStructure(stats: any): void {
  expect(stats).toHaveProperty('total_components');
  expect(stats).toHaveProperty('total_suppliers');
  expect(stats).toHaveProperty('total_locations');
  expect(stats).toHaveProperty('low_stock_count');
  expect(stats).toHaveProperty('total_inventory_value');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract the ID from a creation response
 */
export function extractCreatedId(response: Response): string {
  expectSuccessWithData(response);
  const data = response.body.body;

  // Handle both direct object and nested data
  const id = data.id || data.data?.id;
  expect(id).toBeDefined();
  expect(typeof id).toBe('string');

  return id;
}

/**
 * Create a multipart/form-data request for file uploads
 */
export function uploadRequest(url: string, session: TestSession) {
  const token = generateAuthToken(session);

  const req = request(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', [`connect.sid=s%3A${token}`]);

  return req;
}

/**
 * Wait for async operations to complete
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await waitFor(delayMs * Math.pow(2, i));
    }
  }
  throw new Error('Operation failed after retries');
}
