import express from "express";
import suppliersApiRouter from "./suppliers-api-router";
import locationsApiRouter from "./locations-api-router";
import componentsApiRouter from "./components-api-router";
import transactionsApiRouter from "./transactions-api-router";
import csvApiRouter from "./csv-api-router";
import dashboardApiRouter from "./dashboard-api-router";

const invRouter = express.Router();

// Suppliers endpoints
invRouter.use("/suppliers", suppliersApiRouter);

// Storage Locations endpoints
invRouter.use("/locations", locationsApiRouter);

// Components endpoints
invRouter.use("/components", componentsApiRouter);

// Transactions endpoints
invRouter.use("/transactions", transactionsApiRouter);

// CSV Import endpoints
invRouter.use("/csv", csvApiRouter);

// Dashboard endpoints
invRouter.use("/dashboard", dashboardApiRouter);

export default invRouter;
