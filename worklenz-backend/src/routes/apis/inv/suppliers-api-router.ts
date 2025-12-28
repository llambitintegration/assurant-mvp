import express from "express";
import InvSuppliersController from "../../../controllers/inv/inv-suppliers-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createSupplierValidator,
  updateSupplierValidator,
  idParamValidator,
  listQueryValidator,
  searchQueryValidator
} from "../../../middlewares/validators/inv/supplier-validator";

const suppliersApiRouter = express.Router();

// Create a new supplier
suppliersApiRouter.post(
  "/",
  createSupplierValidator,
  safeControllerFunction(InvSuppliersController.create)
);

// List suppliers with filters
suppliersApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(InvSuppliersController.list)
);

// Search suppliers
suppliersApiRouter.get(
  "/search",
  searchQueryValidator,
  safeControllerFunction(InvSuppliersController.search)
);

// Get a single supplier by ID
suppliersApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvSuppliersController.getById)
);

// Update a supplier
suppliersApiRouter.put(
  "/:id",
  idParamValidator,
  updateSupplierValidator,
  safeControllerFunction(InvSuppliersController.update)
);

// Delete a supplier (soft delete)
suppliersApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvSuppliersController.delete)
);

export default suppliersApiRouter;
