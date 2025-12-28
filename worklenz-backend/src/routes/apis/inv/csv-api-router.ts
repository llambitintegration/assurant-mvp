import express from "express";
import InvCsvController from "../../../controllers/inv/inv-csv-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  csvUploadValidator,
  handleCsvUploadErrors
} from "../../../middlewares/validators/inv/csv-import-validator";

const csvApiRouter = express.Router();

// Import components from CSV file
csvApiRouter.post(
  "/import",
  csvUploadValidator as any,
  handleCsvUploadErrors as any,
  safeControllerFunction(InvCsvController.importCSV)
);

export default csvApiRouter;
