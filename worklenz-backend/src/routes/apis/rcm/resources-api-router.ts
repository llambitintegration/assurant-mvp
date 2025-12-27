import express from "express";
import RcmResourcesController from "../../../controllers/rcm/rcm-resources-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createResourceValidator,
  updateResourceValidator,
  idParamValidator,
  typeParamValidator,
  listQueryValidator,
  searchQueryValidator
} from "../../../middlewares/validators/rcm/resource-validator";

const resourcesApiRouter = express.Router();

// List resources with filters
resourcesApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(RcmResourcesController.list)
);

// Search resources
resourcesApiRouter.get(
  "/search",
  searchQueryValidator,
  safeControllerFunction(RcmResourcesController.search)
);

// Get resources by type
resourcesApiRouter.get(
  "/by-type/:type",
  typeParamValidator,
  safeControllerFunction(RcmResourcesController.getByType)
);

// Get a single resource by ID
resourcesApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(RcmResourcesController.getById)
);

// Create a new resource
resourcesApiRouter.post(
  "/",
  createResourceValidator,
  safeControllerFunction(RcmResourcesController.create)
);

// Update a resource
resourcesApiRouter.put(
  "/:id",
  idParamValidator,
  updateResourceValidator,
  safeControllerFunction(RcmResourcesController.update)
);

// Delete a resource
resourcesApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(RcmResourcesController.delete)
);

export default resourcesApiRouter;
