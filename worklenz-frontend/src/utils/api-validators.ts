/**
 * API Response Validators
 *
 * Validates API response structures to prevent runtime errors
 * from malformed or unexpected data.
 */

/**
 * Validates paginated list response structure
 * Expected format: { data: T[], total: number, page: number, totalPages: number }
 */
export const validatePaginatedResponse = (body: any): boolean => {
  return (
    body &&
    typeof body === 'object' &&
    Array.isArray(body.data) &&
    typeof body.total === 'number' &&
    typeof body.page === 'number' &&
    typeof body.totalPages === 'number'
  );
};

/**
 * Validates dashboard response structure
 * Expected format: { stats: object, low_stock_alerts: array, inventory_value_by_category: array }
 */
export const validateDashboardResponse = (body: any): boolean => {
  return (
    body &&
    typeof body === 'object' &&
    body.stats &&
    typeof body.stats === 'object' &&
    Array.isArray(body.low_stock_alerts) &&
    Array.isArray(body.inventory_value_by_category)
  );
};

/**
 * Validates single entity response
 * Expected format: any non-null object
 */
export const validateEntityResponse = (body: any): boolean => {
  return body && typeof body === 'object';
};

/**
 * Validates array response
 * Expected format: array of any items
 */
export const validateArrayResponse = (body: any): boolean => {
  return Array.isArray(body);
};
