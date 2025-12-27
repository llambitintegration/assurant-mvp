/**
 * Allocation Validators
 * Validation middleware for allocation-related endpoints
 */

import { body, param, query, validationResult } from "express-validator";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import { NextFunction } from "express";

/**
 * Handle validation errors
 */
export const handleValidationErrors = (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): IWorkLenzResponse | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).send(new ServerResponse(false, null, firstError.msg));
  }
  return next();
};

/**
 * Validator for creating an allocation
 * POST /api/rcm/allocations
 */
export const createAllocationValidator = [
  body("resource_id")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  body("project_id")
    .exists().withMessage("Project ID is required")
    .isUUID().withMessage("Invalid project ID format"),

  body("start_date")
    .exists().withMessage("Start date is required")
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("end_date")
    .exists().withMessage("End date is required")
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("allocation_percent")
    .exists().withMessage("Allocation percent is required")
    .isFloat({ min: 0.01, max: 100 }).withMessage("Allocation percent must be between 0.01 and 100"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Notes must be at most 5000 characters"),

  handleValidationErrors
];

/**
 * Validator for updating an allocation
 * PUT /api/rcm/allocations/:id
 */
export const updateAllocationValidator = [
  body("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("allocation_percent")
    .optional()
    .isFloat({ min: 0.01, max: 100 }).withMessage("Allocation percent must be between 0.01 and 100"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Notes must be at most 5000 characters"),

  body("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  handleValidationErrors
];

/**
 * Validator for allocation ID parameter
 * Used in GET, PUT, DELETE /api/rcm/allocations/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Allocation ID is required")
    .isUUID().withMessage("Invalid allocation ID format"),

  handleValidationErrors
];

/**
 * Validator for resource ID parameter
 * Used in GET /api/rcm/allocations/resource/:resourceId
 */
export const resourceIdParamValidator = [
  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  handleValidationErrors
];

/**
 * Validator for project ID parameter
 * Used in GET /api/rcm/allocations/project/:projectId
 */
export const projectIdParamValidator = [
  param("projectId")
    .exists().withMessage("Project ID is required")
    .isUUID().withMessage("Invalid project ID format"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/rcm/allocations
 */
export const listQueryValidator = [
  query("resource_id")
    .optional()
    .isUUID().withMessage("Invalid resource ID format"),

  query("project_id")
    .optional()
    .isUUID().withMessage("Invalid project ID format"),

  query("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)"),

  query("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)"),

  query("is_active")
    .optional()
    .isIn(["true", "false"]).withMessage("is_active must be 'true' or 'false'"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("size")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Size must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for get by ID query parameters
 * GET /api/rcm/allocations/:id
 */
export const getByIdQueryValidator = [
  param("id")
    .exists().withMessage("Allocation ID is required")
    .isUUID().withMessage("Invalid allocation ID format"),

  query("include_resource")
    .optional()
    .isIn(["true", "false"]).withMessage("include_resource must be 'true' or 'false'"),

  handleValidationErrors
];

/**
 * Validator for resource allocations query parameters
 * GET /api/rcm/allocations/resource/:resourceId
 */
export const resourceAllocationsQueryValidator = [
  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  query("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)"),

  query("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)"),

  handleValidationErrors
];

/**
 * Validator for resource summary query parameters
 * GET /api/rcm/allocations/resource/:resourceId/summary
 */
export const resourceSummaryValidator = [
  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  query("start_date")
    .exists().withMessage("Start date is required")
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)"),

  query("end_date")
    .exists().withMessage("End date is required")
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)"),

  handleValidationErrors
];
