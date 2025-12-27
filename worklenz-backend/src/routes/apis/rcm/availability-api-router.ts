/**
 * Availability API Router
 * Defines routes for availability and unavailability management
 */

import express from "express";
import RcmAvailabilityController from "../../../controllers/rcm/rcm-availability-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createAvailabilityValidator,
  updateAvailabilityValidator,
  availabilityIdParamValidator,
  listAvailabilityQueryValidator,
  getAvailabilityByIdQueryValidator,
  resourceAvailabilityParamValidator,
  createUnavailabilityValidator,
  updateUnavailabilityValidator,
  unavailabilityIdParamValidator,
  listUnavailabilityQueryValidator,
  getUnavailabilityByIdQueryValidator,
  resourceUnavailabilityQueryValidator,
  netHoursQueryValidator,
  resourceSummaryParamValidator
} from "../../../middlewares/validators/rcm/availability-validator";

const availabilityApiRouter = express.Router();

// =============================================================================
// AVAILABILITY ENDPOINTS
// =============================================================================

/**
 * GET /api/rcm/availability/resource/:resourceId/net-hours
 * Calculate net available hours for a resource
 */
availabilityApiRouter.get(
  "/availability/resource/:resourceId/net-hours",
  netHoursQueryValidator,
  safeControllerFunction(RcmAvailabilityController.calculateNetHours)
);

/**
 * GET /api/rcm/availability/resource/:resourceId/summary
 * Get resource availability summary
 */
availabilityApiRouter.get(
  "/availability/resource/:resourceId/summary",
  resourceSummaryParamValidator,
  safeControllerFunction(RcmAvailabilityController.getResourceSummary)
);

/**
 * GET /api/rcm/availability/resource/:resourceId
 * Get all availability records for a specific resource
 */
availabilityApiRouter.get(
  "/availability/resource/:resourceId",
  resourceAvailabilityParamValidator,
  safeControllerFunction(RcmAvailabilityController.getResourceAvailability)
);

/**
 * GET /api/rcm/availability
 * List availability records with filtering and pagination
 */
availabilityApiRouter.get(
  "/availability",
  listAvailabilityQueryValidator,
  safeControllerFunction(RcmAvailabilityController.listAvailability)
);

/**
 * GET /api/rcm/availability/:id
 * Get an availability record by ID
 */
availabilityApiRouter.get(
  "/availability/:id",
  getAvailabilityByIdQueryValidator,
  safeControllerFunction(RcmAvailabilityController.getAvailabilityById)
);

/**
 * POST /api/rcm/availability
 * Create a new availability record
 */
availabilityApiRouter.post(
  "/availability",
  createAvailabilityValidator,
  safeControllerFunction(RcmAvailabilityController.createAvailability)
);

/**
 * PUT /api/rcm/availability/:id
 * Update an availability record
 */
availabilityApiRouter.put(
  "/availability/:id",
  availabilityIdParamValidator,
  updateAvailabilityValidator,
  safeControllerFunction(RcmAvailabilityController.updateAvailability)
);

/**
 * DELETE /api/rcm/availability/:id
 * Delete an availability record
 */
availabilityApiRouter.delete(
  "/availability/:id",
  availabilityIdParamValidator,
  safeControllerFunction(RcmAvailabilityController.deleteAvailability)
);

// =============================================================================
// UNAVAILABILITY ENDPOINTS
// =============================================================================

/**
 * GET /api/rcm/unavailability/resource/:resourceId
 * Get all unavailability periods for a specific resource
 */
availabilityApiRouter.get(
  "/unavailability/resource/:resourceId",
  resourceUnavailabilityQueryValidator,
  safeControllerFunction(RcmAvailabilityController.getResourceUnavailability)
);

/**
 * GET /api/rcm/unavailability
 * List unavailability periods with filtering and pagination
 */
availabilityApiRouter.get(
  "/unavailability",
  listUnavailabilityQueryValidator,
  safeControllerFunction(RcmAvailabilityController.listUnavailability)
);

/**
 * GET /api/rcm/unavailability/:id
 * Get an unavailability period by ID
 */
availabilityApiRouter.get(
  "/unavailability/:id",
  getUnavailabilityByIdQueryValidator,
  safeControllerFunction(RcmAvailabilityController.getUnavailabilityById)
);

/**
 * POST /api/rcm/unavailability
 * Create a new unavailability period
 */
availabilityApiRouter.post(
  "/unavailability",
  createUnavailabilityValidator,
  safeControllerFunction(RcmAvailabilityController.createUnavailability)
);

/**
 * PUT /api/rcm/unavailability/:id
 * Update an unavailability period
 */
availabilityApiRouter.put(
  "/unavailability/:id",
  unavailabilityIdParamValidator,
  updateUnavailabilityValidator,
  safeControllerFunction(RcmAvailabilityController.updateUnavailability)
);

/**
 * DELETE /api/rcm/unavailability/:id
 * Delete an unavailability period
 */
availabilityApiRouter.delete(
  "/unavailability/:id",
  unavailabilityIdParamValidator,
  safeControllerFunction(RcmAvailabilityController.deleteUnavailability)
);

export default availabilityApiRouter;
