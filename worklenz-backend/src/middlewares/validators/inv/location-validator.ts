/**
 * Storage Location Validators
 * Validation middleware for storage location-related endpoints
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
 * Validator for creating a storage location
 * POST /api/inv/locations
 */
export const createLocationValidator = [
  body("location_code")
    .exists().withMessage("Location code is required")
    .trim()
    .notEmpty().withMessage("Location code cannot be empty")
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage("Location code must be alphanumeric (with underscores and hyphens allowed)")
    .isLength({ max: 50 }).withMessage("Location code must be at most 50 characters"),

  body("name")
    .exists().withMessage("Location name is required")
    .trim()
    .notEmpty().withMessage("Location name cannot be empty")
    .isLength({ max: 200 }).withMessage("Location name must be at most 200 characters"),

  body("parent_location_id")
    .optional()
    .isUUID().withMessage("Invalid parent location ID format"),

  body("description")
    .optional()
    .trim(),

  body("notes")
    .optional()
    .trim(),

  handleValidationErrors
];

/**
 * Validator for updating a storage location
 * PUT /api/inv/locations/:id
 */
export const updateLocationValidator = [
  body("location_code")
    .optional()
    .trim()
    .notEmpty().withMessage("Location code cannot be empty")
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage("Location code must be alphanumeric (with underscores and hyphens allowed)")
    .isLength({ max: 50 }).withMessage("Location code must be at most 50 characters"),

  body("name")
    .optional()
    .trim()
    .notEmpty().withMessage("Location name cannot be empty")
    .isLength({ max: 200 }).withMessage("Location name must be at most 200 characters"),

  body("parent_location_id")
    .optional()
    .isUUID().withMessage("Invalid parent location ID format"),

  body("description")
    .optional()
    .trim(),

  body("notes")
    .optional()
    .trim(),

  body("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  handleValidationErrors
];

/**
 * Validator for location ID parameter
 * Used in GET, PUT, DELETE /api/inv/locations/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Location ID is required")
    .isUUID().withMessage("Invalid location ID format"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/inv/locations
 */
export const listQueryValidator = [
  query("is_active")
    .optional()
    .isIn(["true", "false"]).withMessage("is_active must be 'true' or 'false'"),

  query("parent_location_id")
    .optional()
    .isUUID().withMessage("Invalid parent location ID format"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage("Search query must be at most 255 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("size")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Size must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for search query
 * GET /api/inv/locations/search
 */
export const searchQueryValidator = [
  query("q")
    .exists().withMessage("Search query is required")
    .trim()
    .notEmpty().withMessage("Search query cannot be empty")
    .isLength({ max: 255 }).withMessage("Search query must be at most 255 characters"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for hierarchy query
 * GET /api/inv/locations/hierarchy
 */
export const hierarchyQueryValidator = [
  query("root_location_id")
    .optional()
    .isUUID().withMessage("Invalid root location ID format"),

  handleValidationErrors
];
