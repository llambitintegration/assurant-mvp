import { body, param, query, validationResult } from "express-validator";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import { NextFunction } from "express";

// Middleware to handle validation errors
export const handleValidationErrors = (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).send(new ServerResponse(false, null, firstError.msg));
  }
  return next();
};

// Validator for creating a resource
export const createResourceValidator = [
  body("resource_type")
    .exists().withMessage("Resource type is required")
    .isIn(["personnel", "equipment"]).withMessage("Resource type must be 'personnel' or 'equipment'"),

  // Personnel fields
  body("first_name")
    .if(body("resource_type").equals("personnel"))
    .notEmpty().withMessage("First name is required for personnel")
    .trim()
    .isLength({ max: 100 }).withMessage("First name must be at most 100 characters"),

  body("last_name")
    .if(body("resource_type").equals("personnel"))
    .notEmpty().withMessage("Last name is required for personnel")
    .trim()
    .isLength({ max: 100 }).withMessage("Last name must be at most 100 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format")
    .isLength({ max: 255 }).withMessage("Email must be at most 255 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Phone must be at most 50 characters"),

  body("employee_id")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Employee ID must be at most 50 characters"),

  // Equipment fields
  body("equipment_name")
    .if(body("resource_type").equals("equipment"))
    .notEmpty().withMessage("Equipment name is required for equipment")
    .trim()
    .isLength({ max: 200 }).withMessage("Equipment name must be at most 200 characters"),

  body("model")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Model must be at most 100 characters"),

  body("serial_number")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Serial number must be at most 100 characters"),

  // Common fields
  body("notes")
    .optional()
    .trim(),

  handleValidationErrors
];

// Validator for updating a resource
export const updateResourceValidator = [
  body("resource_type")
    .optional()
    .isIn(["personnel", "equipment"]).withMessage("Resource type must be 'personnel' or 'equipment'"),

  body("first_name")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("First name must be at most 100 characters"),

  body("last_name")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Last name must be at most 100 characters"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format")
    .isLength({ max: 255 }).withMessage("Email must be at most 255 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Phone must be at most 50 characters"),

  body("employee_id")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Employee ID must be at most 50 characters"),

  body("equipment_name")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Equipment name must be at most 200 characters"),

  body("model")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Model must be at most 100 characters"),

  body("serial_number")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Serial number must be at most 100 characters"),

  body("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  body("notes")
    .optional()
    .trim(),

  handleValidationErrors
];

// Validator for UUID params
export const idParamValidator = [
  param("id")
    .exists().withMessage("Resource ID is required")
    .isUUID().withMessage("Invalid resource ID format"),

  handleValidationErrors
];

// Validator for resource type param
export const typeParamValidator = [
  param("type")
    .exists().withMessage("Resource type is required")
    .isIn(["personnel", "equipment"]).withMessage("Resource type must be 'personnel' or 'equipment'"),

  handleValidationErrors
];

// Validator for list query params
export const listQueryValidator = [
  query("resource_type")
    .optional()
    .isIn(["personnel", "equipment"]).withMessage("Resource type must be 'personnel' or 'equipment'"),

  query("is_active")
    .optional()
    .isBoolean().withMessage("is_active must be a boolean"),

  query("department_id")
    .optional()
    .isUUID().withMessage("Invalid department ID format"),

  query("skill_id")
    .optional()
    .isUUID().withMessage("Invalid skill ID format"),

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

// Validator for search query
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
