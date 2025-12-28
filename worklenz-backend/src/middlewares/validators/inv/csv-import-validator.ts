/**
 * CSV Import Validators
 * Validation middleware for CSV import endpoints
 */

import multer from "multer";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import { NextFunction } from "express";

/**
 * Multer configuration for CSV uploads
 * - Max file size: 5MB
 * - File type: CSV only
 * - Storage: Memory (for immediate processing)
 */
export const csvUploadConfig = multer();

/**
 * Middleware for CSV upload validation
 * Handles single file upload with field name "file"
 */
export const csvUploadValidator = csvUploadConfig.single("file");

/**
 * Middleware to validate CSV upload errors
 * Catches multer errors and returns appropriate error messages
 */
export const handleCsvUploadErrors = (
  err: any,
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
): IWorkLenzResponse | void => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send(new ServerResponse(false, null, "File size exceeds 5MB limit"));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).send(new ServerResponse(false, null, "Only one file can be uploaded at a time"));
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).send(new ServerResponse(false, null, "Unexpected file field. Use 'file' as field name"));
    }
    return res.status(400).send(new ServerResponse(false, null, `Upload error: ${err.message}`));
  } else if (err) {
    // Handle custom errors from fileFilter
    return res.status(400).send(new ServerResponse(false, null, err.message));
  }

  // No file uploaded
  if (!req.file) {
    return res.status(400).send(new ServerResponse(false, null, "No file uploaded. Please upload a CSV file"));
  }

  return next();
};

/**
 * Combined CSV upload validator with error handling
 * Use this in routes to validate CSV uploads
 */
export const validateCsvUpload = [
  csvUploadValidator,
  handleCsvUploadErrors
];
