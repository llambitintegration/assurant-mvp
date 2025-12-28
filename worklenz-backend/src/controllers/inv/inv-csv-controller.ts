import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import * as CSVImportService from "../../services/inv/csv-import-service";

export default class InvCSVController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async importCSV(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Check if file was uploaded
    if (!req.file || !req.file.buffer) {
      return res.status(400).send(new ServerResponse(false, null, "No file uploaded"));
    }

    // Validate file is CSV
    const filename = req.file.originalname || "";
    if (!filename.toLowerCase().endsWith('.csv')) {
      return res.status(400).send(new ServerResponse(false, null, "File must be a CSV"));
    }

    // Process CSV import
    const result = await CSVImportService.importComponentsFromCSV(
      req.file.buffer,
      teamId,
      userId
    );

    // Return appropriate status based on results
    if (result.failed_imports > 0 && result.successful_imports === 0) {
      // All imports failed
      return res.status(400).send(new ServerResponse(false, result, "All imports failed"));
    } else if (result.failed_imports > 0) {
      // Partial success
      return res.status(200).send(new ServerResponse(true, result, "Import completed with some errors"));
    } else {
      // All successful
      return res.status(200).send(new ServerResponse(true, result, "All imports successful"));
    }
  }
}
