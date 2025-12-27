import express from "express";
import resourcesApiRouter from "./resources-api-router";

const rcmRouter = express.Router();

// Resources endpoints
rcmRouter.use("/resources", resourcesApiRouter);

// Future RCM routers will be added here:
// rcmRouter.use("/departments", departmentsApiRouter);
// rcmRouter.use("/skills", skillsApiRouter);
// rcmRouter.use("/allocations", allocationsApiRouter);
// rcmRouter.use("/availability", availabilityApiRouter);

export default rcmRouter;
