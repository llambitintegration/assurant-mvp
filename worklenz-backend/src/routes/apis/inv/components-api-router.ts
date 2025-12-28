import express from "express";
import InvComponentsController from "../../../controllers/inv/inv-components-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createComponentValidator,
  updateComponentValidator,
  idParamValidator,
  listQueryValidator,
  searchQueryValidator,
  lowStockQueryValidator,
  generateQRValidator
} from "../../../middlewares/validators/inv/component-validator";

const componentsApiRouter = express.Router();

// Create a new component
componentsApiRouter.post(
  "/",
  createComponentValidator,
  safeControllerFunction(InvComponentsController.create)
);

// List components with filters
componentsApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(InvComponentsController.list)
);

// Search components
componentsApiRouter.get(
  "/search",
  searchQueryValidator,
  safeControllerFunction(InvComponentsController.search)
);

// Get low stock components
componentsApiRouter.get(
  "/low-stock",
  lowStockQueryValidator,
  safeControllerFunction(InvComponentsController.getLowStock)
);

// Get a single component by ID
componentsApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvComponentsController.getById)
);

// Update a component
componentsApiRouter.put(
  "/:id",
  idParamValidator,
  updateComponentValidator,
  safeControllerFunction(InvComponentsController.update)
);

// Delete a component (soft delete)
componentsApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvComponentsController.delete)
);

// Generate QR code for a component
componentsApiRouter.post(
  "/:id/qr",
  generateQRValidator,
  safeControllerFunction(InvComponentsController.generateQR)
);

export default componentsApiRouter;
