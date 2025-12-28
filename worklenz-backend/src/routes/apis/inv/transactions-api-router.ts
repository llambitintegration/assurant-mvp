import express from "express";
import InvTransactionsController from "../../../controllers/inv/inv-transactions-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createTransactionValidator,
  idParamValidator,
  componentIdParamValidator,
  listQueryValidator,
  componentHistoryQueryValidator
} from "../../../middlewares/validators/inv/transaction-validator";

const transactionsApiRouter = express.Router();

// Create a new transaction
transactionsApiRouter.post(
  "/",
  createTransactionValidator,
  safeControllerFunction(InvTransactionsController.create)
);

// List transactions with filters
transactionsApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(InvTransactionsController.list)
);

// Get a single transaction by ID
transactionsApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(InvTransactionsController.getById)
);

// Get transaction history for a component
transactionsApiRouter.get(
  "/component/:componentId",
  componentIdParamValidator,
  componentHistoryQueryValidator,
  safeControllerFunction(InvTransactionsController.getComponentHistory)
);

export default transactionsApiRouter;
