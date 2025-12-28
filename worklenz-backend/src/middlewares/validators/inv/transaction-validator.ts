/**
 * Transaction Validators
 * Validation middleware for transaction-related endpoints
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
 * Validator for creating a transaction
 * POST /api/inv/transactions
 */
export const createTransactionValidator = [
  body("component_id")
    .exists().withMessage("Component ID is required")
    .isUUID().withMessage("Invalid component ID format"),

  body("transaction_type")
    .exists().withMessage("Transaction type is required")
    .isIn(["IN", "OUT", "ADJUST"]).withMessage("Transaction type must be 'IN', 'OUT', or 'ADJUST'"),

  body("quantity")
    .exists().withMessage("Quantity is required")
    .isFloat({ gt: 0 }).withMessage("Quantity must be greater than 0")
    .toFloat(),

  body("unit_cost")
    .optional()
    .isFloat({ min: 0 }).withMessage("Unit cost must be greater than or equal to 0")
    .toFloat(),

  body("notes")
    .optional()
    .trim(),

  body("reference_number")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Reference number must be at most 100 characters"),

  handleValidationErrors
];

/**
 * Validator for transaction ID parameter
 * Used in GET /api/inv/transactions/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Transaction ID is required")
    .isUUID().withMessage("Invalid transaction ID format"),

  handleValidationErrors
];

/**
 * Validator for component ID parameter
 * Used in GET /api/inv/transactions/component/:componentId
 */
export const componentIdParamValidator = [
  param("componentId")
    .exists().withMessage("Component ID is required")
    .isUUID().withMessage("Invalid component ID format"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/inv/transactions
 */
export const listQueryValidator = [
  query("component_id")
    .optional()
    .isUUID().withMessage("Invalid component ID format"),

  query("transaction_type")
    .optional()
    .isIn(["IN", "OUT", "ADJUST"]).withMessage("Transaction type must be 'IN', 'OUT', or 'ADJUST'"),

  query("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)"),

  query("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("size")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Size must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for component history query parameters
 * GET /api/inv/transactions/component/:componentId/history
 */
export const componentHistoryQueryValidator = [
  param("componentId")
    .exists().withMessage("Component ID is required")
    .isUUID().withMessage("Invalid component ID format"),

  query("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)"),

  query("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)"),

  query("transaction_type")
    .optional()
    .isIn(["IN", "OUT", "ADJUST"]).withMessage("Transaction type must be 'IN', 'OUT', or 'ADJUST'"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("size")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Size must be between 1 and 100"),

  handleValidationErrors
];
