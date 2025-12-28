/**
 * Component Validators
 * Validation middleware for component-related endpoints
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
 * Custom validator to check owner_type and corresponding ID
 */
const validateOwnerTypeConsistency = (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void => {
  const { owner_type, supplier_id, storage_location_id } = req.body;

  if (owner_type === "supplier" && !supplier_id) {
    return res.status(400).send(new ServerResponse(false, null, "supplier_id is required when owner_type is 'supplier'"));
  }

  if (owner_type === "storage_location" && !storage_location_id) {
    return res.status(400).send(new ServerResponse(false, null, "storage_location_id is required when owner_type is 'storage_location'"));
  }

  if (owner_type === "supplier" && storage_location_id) {
    return res.status(400).send(new ServerResponse(false, null, "storage_location_id should not be provided when owner_type is 'supplier'"));
  }

  if (owner_type === "storage_location" && supplier_id) {
    return res.status(400).send(new ServerResponse(false, null, "supplier_id should not be provided when owner_type is 'storage_location'"));
  }

  return next();
};

/**
 * Validator for creating a component
 * POST /api/inv/components
 */
export const createComponentValidator = [
  body("name")
    .exists().withMessage("Component name is required")
    .trim()
    .notEmpty().withMessage("Component name cannot be empty")
    .isLength({ max: 200 }).withMessage("Component name must be at most 200 characters"),

  body("sku")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("SKU must be at most 100 characters"),

  body("description")
    .optional()
    .trim(),

  body("owner_type")
    .exists().withMessage("Owner type is required")
    .isIn(["supplier", "storage_location"]).withMessage("Owner type must be 'supplier' or 'storage_location'"),

  body("supplier_id")
    .optional()
    .isUUID().withMessage("Invalid supplier ID format"),

  body("storage_location_id")
    .optional()
    .isUUID().withMessage("Invalid storage location ID format"),

  body("quantity")
    .optional()
    .isFloat({ min: 0 }).withMessage("Quantity must be greater than or equal to 0")
    .toFloat(),

  body("unit")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Unit must be at most 50 characters"),

  body("unit_cost")
    .optional()
    .isFloat({ min: 0 }).withMessage("Unit cost must be greater than or equal to 0")
    .toFloat(),

  body("reorder_level")
    .optional()
    .isFloat({ min: 0 }).withMessage("Reorder level must be greater than or equal to 0")
    .toFloat(),

  body("notes")
    .optional()
    .trim(),

  handleValidationErrors,
  validateOwnerTypeConsistency
];

/**
 * Validator for updating a component
 * PUT /api/inv/components/:id
 */
export const updateComponentValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty().withMessage("Component name cannot be empty")
    .isLength({ max: 200 }).withMessage("Component name must be at most 200 characters"),

  body("sku")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("SKU must be at most 100 characters"),

  body("description")
    .optional()
    .trim(),

  body("owner_type")
    .optional()
    .isIn(["supplier", "storage_location"]).withMessage("Owner type must be 'supplier' or 'storage_location'"),

  body("supplier_id")
    .optional()
    .isUUID().withMessage("Invalid supplier ID format"),

  body("storage_location_id")
    .optional()
    .isUUID().withMessage("Invalid storage location ID format"),

  body("quantity")
    .optional()
    .isFloat({ min: 0 }).withMessage("Quantity must be greater than or equal to 0")
    .toFloat(),

  body("unit")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Unit must be at most 50 characters"),

  body("unit_cost")
    .optional()
    .isFloat({ min: 0 }).withMessage("Unit cost must be greater than or equal to 0")
    .toFloat(),

  body("reorder_level")
    .optional()
    .isFloat({ min: 0 }).withMessage("Reorder level must be greater than or equal to 0")
    .toFloat(),

  body("notes")
    .optional()
    .trim(),

  body("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  handleValidationErrors,
  // Only validate owner type consistency if owner_type is being updated
  (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) => {
    if (req.body.owner_type || req.body.supplier_id || req.body.storage_location_id) {
      return validateOwnerTypeConsistency(req, res, next);
    }
    return next();
  }
];

/**
 * Validator for component ID parameter
 * Used in GET, PUT, DELETE /api/inv/components/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Component ID is required")
    .isUUID().withMessage("Invalid component ID format"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/inv/components
 */
export const listQueryValidator = [
  query("is_active")
    .optional()
    .isIn(["true", "false"]).withMessage("is_active must be 'true' or 'false'"),

  query("owner_type")
    .optional()
    .isIn(["supplier", "storage_location"]).withMessage("Owner type must be 'supplier' or 'storage_location'"),

  query("supplier_id")
    .optional()
    .isUUID().withMessage("Invalid supplier ID format"),

  query("storage_location_id")
    .optional()
    .isUUID().withMessage("Invalid storage location ID format"),

  query("low_stock")
    .optional()
    .isIn(["true", "false"]).withMessage("low_stock must be 'true' or 'false'"),

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
 * GET /api/inv/components/search
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
 * Validator for low stock query
 * GET /api/inv/components/low-stock
 */
export const lowStockQueryValidator = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for QR code generation
 * POST /api/inv/components/:id/qr
 */
export const generateQRValidator = [
  param("id")
    .exists().withMessage("Component ID is required")
    .isUUID().withMessage("Invalid component ID format"),

  handleValidationErrors
];
