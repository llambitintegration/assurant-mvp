import express from "express";
import resourcesApiRouter from "./resources-api-router";
import departmentsApiRouter from "./departments-api-router";
import allocationsApiRouter from "./allocations-api-router";
import availabilityApiRouter from "./availability-api-router";

const rcmRouter = express.Router();

// Resources endpoints
rcmRouter.use("/resources", resourcesApiRouter);

// Departments endpoints
rcmRouter.use("/departments", departmentsApiRouter);

// Allocations endpoints
rcmRouter.use("/allocations", allocationsApiRouter);

// Availability and Unavailability endpoints
// Note: This router handles both /availability and /unavailability paths
rcmRouter.use("/", availabilityApiRouter);

// Future RCM routers will be added here:
// rcmRouter.use("/skills", skillsApiRouter);

export default rcmRouter;
