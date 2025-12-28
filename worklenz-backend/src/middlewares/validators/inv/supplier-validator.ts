/**
 * Supplier Validators
 * Validation middleware for supplier-related endpoints
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
 * Validator for creating a supplier
 * POST /api/inv/suppliers
 */
export const createSupplierValidator = [
  body("name")
    .exists().withMessage("Supplier name is required")
    .trim()
    .notEmpty().withMessage("Supplier name cannot be empty")
    .isLength({ max: 200 }).withMessage("Supplier name must be at most 200 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format")
    .isLength({ max: 255 }).withMessage("Email must be at most 255 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Phone must be at most 50 characters"),

  body("address")
    .optional()
    .trim(),

  body("notes")
    .optional()
    .trim(),

  handleValidationErrors
];

/**
 * Validator for updating a supplier
 * PUT /api/inv/suppliers/:id
 */
export const updateSupplierValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty().withMessage("Supplier name cannot be empty")
    .isLength({ max: 200 }).withMessage("Supplier name must be at most 200 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format")
    .isLength({ max: 255 }).withMessage("Email must be at most 255 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Phone must be at most 50 characters"),

  body("address")
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
 * Validator for supplier ID parameter
 * Used in GET, PUT, DELETE /api/inv/suppliers/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Supplier ID is required")
    .isUUID().withMessage("Invalid supplier ID format"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/inv/suppliers
 */
export const listQueryValidator = [
  query("is_active")
    .optional()
    .isIn(["true", "false"]).withMessage("is_active must be 'true' or 'false'"),

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
 * GET /api/inv/suppliers/search
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
