import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import * as DashboardService from "../../services/inv/dashboard-service";

export default class InvDashboardController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getDashboard(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await DashboardService.getDashboardStats(teamId);
    return res.status(200).send(new ServerResponse(true, result));
  }
}
