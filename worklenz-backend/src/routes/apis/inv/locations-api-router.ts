import express from "express";
import InvLocationsController from "../../../controllers/inv/inv-locations-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createLocationValidator,
  updateLocationValidator,
  idParamValidator,
  listQueryValidator,
  searchQueryValidator,
  hierarchyQueryValidator
} from "../../../middlewares/validators/inv/location-validator";

const locationsApiRouter = express.Router();

// Create a new storage location
locationsApiRouter.post(
  "/",
  createLocationValidator,
  safeControllerFunction(InvLocationsController.create)
);

// List storage locations with filters
locationsApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(InvLocationsController.list)
);

// Search storage locations
locationsApiRouter.get(
  "/search",
  searchQueryValidator,
  safeControllerFunction(InvLocationsController.search)
);

// Get location hierarchy
locationsApiRouter.get(
  "/hierarchy",
  hierarchyQueryValidator,
  safeControllerFunction(InvLocationsController.getHierarchy)
);

// Get a single storage location by ID
locationsApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvLocationsController.getById)
);

// Update a storage location
locationsApiRouter.put(
  "/:id",
  idParamValidator,
  updateLocationValidator,
  safeControllerFunction(InvLocationsController.update)
);

// Delete a storage location (soft delete)
locationsApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvLocationsController.delete)
);

export default locationsApiRouter;
