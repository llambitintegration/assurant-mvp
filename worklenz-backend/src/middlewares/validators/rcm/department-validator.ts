/**
 * Department Validators
 * Validation middleware for department-related endpoints
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
 * Validator for creating a department
 * POST /api/rcm/departments
 */
export const createDepartmentValidator = [
  body("name")
    .exists().withMessage("Department name is required")
    .trim()
    .notEmpty().withMessage("Department name cannot be empty")
    .isLength({ max: 200 }).withMessage("Department name must be at most 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Description must be at most 5000 characters"),

  body("parent_dept_id")
    .optional()
    .isUUID().withMessage("Invalid parent department ID format"),

  handleValidationErrors
];

/**
 * Validator for updating a department
 * PUT /api/rcm/departments/:id
 */
export const updateDepartmentValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty().withMessage("Department name cannot be empty")
    .isLength({ max: 200 }).withMessage("Department name must be at most 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Description must be at most 5000 characters"),

  body("parent_dept_id")
    .optional()
    .custom((value) => {
      // Allow null or UUID
      if (value === null) return true;
      // UUID regex pattern
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        throw new Error("Invalid parent department ID format");
      }
      return true;
    }),

  body("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  handleValidationErrors
];

/**
 * Validator for department ID parameter
 * Used in GET, PUT, DELETE /api/rcm/departments/:id
 */
export const idParamValidator = [
  param("id")
    .exists().withMessage("Department ID is required")
    .isUUID().withMessage("Invalid department ID format"),

  handleValidationErrors
];

/**
 * Validator for resource ID parameter
 * Used in DELETE /api/rcm/departments/:id/resources/:resourceId
 */
export const resourceIdParamValidator = [
  param("id")
    .exists().withMessage("Department ID is required")
    .isUUID().withMessage("Invalid department ID format"),

  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  handleValidationErrors
];

/**
 * Validator for assigning a resource to a department
 * POST /api/rcm/departments/:id/resources
 */
export const assignResourceValidator = [
  param("id")
    .exists().withMessage("Department ID is required")
    .isUUID().withMessage("Invalid department ID format"),

  body("resource_id")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  body("is_primary")
    .optional()
    .isBoolean().withMessage("is_primary must be a boolean"),

  handleValidationErrors
];

/**
 * Validator for updating resource assignment
 * PATCH /api/rcm/departments/:id/resources/:resourceId
 */
export const updateAssignmentValidator = [
  param("id")
    .exists().withMessage("Department ID is required")
    .isUUID().withMessage("Invalid department ID format"),

  param("resourceId")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  body("is_primary")
    .exists().withMessage("is_primary is required")
    .isBoolean().withMessage("is_primary must be a boolean"),

  handleValidationErrors
];

/**
 * Validator for list query parameters
 * GET /api/rcm/departments
 */
export const listQueryValidator = [
  query("parent_dept_id")
    .optional()
    .isUUID().withMessage("Invalid parent department ID format"),

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
 * Validator for hierarchy query parameters
 * GET /api/rcm/departments/hierarchy
 */
export const hierarchyQueryValidator = [
  query("root_id")
    .optional()
    .isUUID().withMessage("Invalid root department ID format"),

  handleValidationErrors
];

/**
 * Validator for include_hierarchy query parameter
 * GET /api/rcm/departments/:id
 */
export const getByIdQueryValidator = [
  param("id")
    .exists().withMessage("Department ID is required")
    .isUUID().withMessage("Invalid department ID format"),

  query("include_hierarchy")
    .optional()
    .isIn(["true", "false"]).withMessage("include_hierarchy must be 'true' or 'false'"),

  handleValidationErrors
];
