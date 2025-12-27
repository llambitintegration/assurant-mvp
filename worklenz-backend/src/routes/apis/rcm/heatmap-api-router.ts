/**
 * Heatmap API Router
 * Defines routes for resource capacity heatmap visualization
 */

import express from "express";
import RcmHeatmapController from "../../../controllers/rcm/rcm-heatmap-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";

const heatmapApiRouter = express.Router();

/**
 * GET /api/v1/rcm/heatmap
 * Get heatmap data with utilization calculations
 */
heatmapApiRouter.get(
  "/",
  safeControllerFunction(RcmHeatmapController.getHeatmap)
);

export default heatmapApiRouter;
