/**
 * Availability Validators
 * Validation middleware for availability and unavailability-related endpoints
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

// =============================================================================
// AVAILABILITY VALIDATORS
// =============================================================================

/**
 * Validator for creating availability
 * POST /api/rcm/availability
 */
export const createAvailabilityValidator = [
  body("resource_id")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  body("effective_from")
    .exists().withMessage("Effective from date is required")
    .isISO8601().withMessage("Effective from must be a valid date (ISO 8601 format)")
    .toDate(),

  body("effective_to")
    .optional()
    .isISO8601().withMessage("Effective to must be a valid date (ISO 8601 format)")
    .toDate(),

  body("hours_per_day")
    .exists().withMessage("Hours per day is required")
    .isFloat({ min: 0.01, max: 24 }).withMessage("Hours per day must be between 0.01 and 24"),

  body("days_per_week")
    .exists().withMessage("Days per week is required")
    .isFloat({ min: 0.1, max: 7 }).withMessage("Days per week must be between 0.1 and 7"),

  body("total_hours_per_week")
    .exists().withMessage("Total hours per week is required")
    .isFloat({ min: 0.01, max: 168 }).withMessage("Total hours per week must be between 0.01 and 168"),

  handleValidationErrors
];

/**
 * Validator for updating availability
 * PUT /api/rcm/availability/:id
 */
export const updateAvailabilityValidator = [
  body("effective_from")
    .optional()
    .isISO8601().withMessage("Effective from must be a valid date (ISO 8601 format)")
    .toDate(),

  body("effective_to")
    .optional()
    .isISO8601().withMessage("Effective to must be a valid date (ISO 8601 format)")
    .toDate(),

  body("hours_per_day")
    .optional()
    .isFloat({ min: 0.01, max: 24 }).withMessage("Hours per day must be between 0.01 and 24"),

  body("days_per_week")
    .optional()
    .isFloat({ min: 0.1, max: 7 }).withMessage("Days per week must be between 0.1 and 7"),

  body("total_hours_per_week")
    .optional()
    .isFloat({ min: 0.01, max: 168 }).withMessage("Total hours per week must be between 0.01 and 168"),

  handleValidationErrors
];

/**
 * Validator for availability ID parameter
 * Used in GET, PUT, DELETE /api/rcm/availability/:id
 */
export const availabilityIdParamValidator = [
  param("id")
    .exists().withMessage("Availability ID is required")
    .isUUID().withMessage("Invalid availability ID format"),

  handleValidationErrors
];

/**
 * Validator for list availability query parameters
 * GET /api/rcm/availability
 */
export const listAvailabilityQueryValidator = [
  query("resource_id")
    .optional()
    .isUUID().withMessage("Invalid resource ID format"),

  query("effective_date")
    .optional()
    .isISO8601().withMessage("Effective date must be a valid date (ISO 8601 format)"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("size")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Size must be between 1 and 100"),

  handleValidationErrors
];

/**
 * Validator for get availability by ID query parameters
 * GET /api/rcm/availability/:id
 */
export const getAvailabilityByIdQueryValidator = [
  param("id")
    .exists().withMessage("Availability ID is required")
    .isUUID().withMessage("Invalid availability ID format"),

  query("include_resource")
    .optional()
    .isIn(["true", "false"]).withMessage("include_resource must be 'true' or 'false'"),

  handleValidationErrors
];

/**
 * Validator for resource availability endpoint
 * GET /api/rcm/availability/resource/:resourceId
 */
export const resourceAvailabilityParamValidator = [
  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  handleValidationErrors
];

// =============================================================================
// UNAVAILABILITY VALIDATORS
// =============================================================================

/**
 * Validator for creating unavailability period
 * POST /api/rcm/unavailability
 */
export const createUnavailabilityValidator = [
  body("resource_id")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  body("unavailability_type")
    .exists().withMessage("Unavailability type is required")
    .isIn(["pto", "holiday", "sick_leave", "training", "maintenance", "other"])
    .withMessage("Invalid unavailability type"),

  body("start_date")
    .exists().withMessage("Start date is required")
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("end_date")
    .exists().withMessage("End date is required")
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Description must be at most 5000 characters"),

  handleValidationErrors
];

/**
 * Validator for updating unavailability period
 * PUT /api/rcm/unavailability/:id
 */
export const updateUnavailabilityValidator = [
  body("unavailability_type")
    .optional()
    .isIn(["pto", "holiday", "sick_leave", "training", "maintenance", "other"])
    .withMessage("Invalid unavailability type"),

  body("start_date")
    .optional()
    .isISO8601().withMessage("Start date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("end_date")
    .optional()
    .isISO8601().withMessage("End date must be a valid date (ISO 8601 format)")
    .toDate(),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Description must be at most 5000 characters"),

  handleValidationErrors
];

/**
 * Validator for unavailability ID parameter
 * Used in GET, PUT, DELETE /api/rcm/unavailability/:id
 */
export const unavailabilityIdParamValidator = [
  param("id")
    .exists().withMessage("Unavailability ID is required")
    .isUUID().withMessage("Invalid unavailability ID format"),

  handleValidationErrors
];

/**
 * Validator for list unavailability query parameters
 * GET /api/rcm/unavailability
 */
export const listUnavailabilityQueryValidator = [
  query("resource_id")
    .optional()
    .isUUID().withMessage("Invalid resource ID format"),

  query("unavailability_type")
    .optional()
    .isIn(["pto", "holiday", "sick_leave", "training", "maintenance", "other"])
    .withMessage("Invalid unavailability type"),

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
 * Validator for get unavailability by ID query parameters
 * GET /api/rcm/unavailability/:id
 */
export const getUnavailabilityByIdQueryValidator = [
  param("id")
    .exists().withMessage("Unavailability ID is required")
    .isUUID().withMessage("Invalid unavailability ID format"),

  query("include_resource")
    .optional()
    .isIn(["true", "false"]).withMessage("include_resource must be 'true' or 'false'"),

  handleValidationErrors
];

/**
 * Validator for resource unavailability endpoint
 * GET /api/rcm/unavailability/resource/:resourceId
 */
export const resourceUnavailabilityQueryValidator = [
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

// =============================================================================
// CALCULATION VALIDATORS
// =============================================================================

/**
 * Validator for net hours calculation
 * GET /api/rcm/availability/resource/:resourceId/net-hours
 */
export const netHoursQueryValidator = [
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

/**
 * Validator for resource summary
 * GET /api/rcm/availability/resource/:resourceId/summary
 */
export const resourceSummaryParamValidator = [
  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  handleValidationErrors
];
