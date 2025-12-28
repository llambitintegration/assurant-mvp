import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import * as TransactionsService from "../../services/inv/transactions-service";

export default class InvTransactionsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const data = req.body;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await TransactionsService.createTransaction(data, teamId, userId);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await TransactionsService.getTransactionById(id, teamId);
    if (!result) {
      return res.status(404).send(new ServerResponse(false, null, "Transaction not found"));
    }

    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const filters = req.query;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await TransactionsService.listTransactions(filters, teamId);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async getComponentHistory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { componentId } = req.params;
    const teamId = req.user?.team_id;
    const filters = req.query;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await TransactionsService.getComponentHistory(componentId, teamId, filters);
    return res.status(200).send(new ServerResponse(true, result));
  }
}
