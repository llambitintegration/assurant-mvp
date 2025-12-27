/**
 * Test Helper Utilities
 * Provides mock request/response objects and assertion helpers
 */

import { IWorkLenzRequest } from '../../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../../interfaces/worklenz-response';

/**
 * Create a mock request object for testing controllers
 */
export function createMockRequest(overrides: any = {}): IWorkLenzRequest {
  const mockRequest: any = {
    user: {
      team_id: 'team-1-uuid',
      id: 'user-1-uuid',
      email: 'test@example.com',
      ...overrides.user
    },
    query: {},
    params: {},
    body: {},
    headers: {},
    method: 'GET',
    url: '/test',
    ...overrides
  };

  return mockRequest as IWorkLenzRequest;
}

/**
 * Create a mock response object for testing controllers
 */
export function createMockResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res as IWorkLenzResponse;
}

/**
 * Assert that a response was successful (200 OK)
 */
export function expectSuccessResponse(response: any, expectedData?: any): void {
  expect(response.status).toHaveBeenCalledWith(200);
  const sentData = response.send.mock.calls[0][0];
  expect(sentData.done).toBe(true);

  if (expectedData !== undefined) {
    expect(sentData.body).toEqual(expectedData);
  }
}

/**
 * Assert that a response was an error
 */
export function expectErrorResponse(response: any, statusCode?: number, message?: string): void {
  if (statusCode) {
    expect(response.status).toHaveBeenCalledWith(statusCode);
  }

  const sentData = response.send.mock.calls[0][0];
  expect(sentData.done).toBe(false);

  if (message) {
    expect(sentData.message).toContain(message);
  }
}

/**
 * Assert that a response was unauthorized (401)
 */
export function expectUnauthorizedResponse(response: any, message = 'Unauthorized'): void {
  expectErrorResponse(response, 401, message);
}

/**
 * Assert that a response was a bad request (400)
 */
export function expectBadRequestResponse(response: any, message?: string): void {
  expectErrorResponse(response, 400, message);
}

/**
 * Assert that a response was not found (404)
 */
export function expectNotFoundResponse(response: any, message?: string): void {
  expectErrorResponse(response, 404, message);
}

/**
 * Create a minimal session object
 */
export function createMockSession(overrides: any = {}): any {
  return {
    id: 'session-123',
    user: {
      id: 'user-1-uuid',
      email: 'test@example.com'
    },
    ...overrides
  };
}
