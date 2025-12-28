import express from "express";
import InvDashboardController from "../../../controllers/inv/inv-dashboard-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";

const dashboardApiRouter = express.Router();

// Get dashboard statistics
dashboardApiRouter.get(
  "/",
  safeControllerFunction(InvDashboardController.getDashboard)
);

export default dashboardApiRouter;
