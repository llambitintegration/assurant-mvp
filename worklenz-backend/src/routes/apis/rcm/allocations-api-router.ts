/**
 * Allocations API Router
 * Defines routes for allocation management
 */

import express from "express";
import RcmAllocationsController from "../../../controllers/rcm/rcm-allocations-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createAllocationValidator,
  updateAllocationValidator,
  idParamValidator,
  projectIdParamValidator,
  listQueryValidator,
  getByIdQueryValidator,
  resourceAllocationsQueryValidator,
  resourceSummaryValidator
} from "../../../middlewares/validators/rcm/allocation-validator";

const allocationsApiRouter = express.Router();

/**
 * GET /api/rcm/allocations/resource/:resourceId/summary
 * Get allocation summary for a resource (total allocation %)
 */
allocationsApiRouter.get(
  "/resource/:resourceId/summary",
  resourceSummaryValidator,
  safeControllerFunction(RcmAllocationsController.getResourceSummary)
);

/**
 * GET /api/rcm/allocations/resource/:resourceId
 * Get all allocations for a specific resource
 */
allocationsApiRouter.get(
  "/resource/:resourceId",
  resourceAllocationsQueryValidator,
  safeControllerFunction(RcmAllocationsController.getByResource)
);

/**
 * GET /api/rcm/allocations/project/:projectId
 * Get all allocations for a specific project
 */
allocationsApiRouter.get(
  "/project/:projectId",
  projectIdParamValidator,
  safeControllerFunction(RcmAllocationsController.getByProject)
);

/**
 * GET /api/rcm/allocations
 * List allocations with filtering and pagination
 */
allocationsApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(RcmAllocationsController.list)
);

/**
 * GET /api/rcm/allocations/:id
 * Get an allocation by ID
 */
allocationsApiRouter.get(
  "/:id",
  getByIdQueryValidator,
  safeControllerFunction(RcmAllocationsController.getById)
);

/**
 * POST /api/rcm/allocations
 * Create a new allocation
 */
allocationsApiRouter.post(
  "/",
  createAllocationValidator,
  safeControllerFunction(RcmAllocationsController.create)
);

/**
 * PUT /api/rcm/allocations/:id
 * Update an allocation
 */
allocationsApiRouter.put(
  "/:id",
  idParamValidator,
  updateAllocationValidator,
  safeControllerFunction(RcmAllocationsController.update)
);

/**
 * DELETE /api/rcm/allocations/:id
 * Delete an allocation (soft delete)
 */
allocationsApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(RcmAllocationsController.delete)
);

export default allocationsApiRouter;
