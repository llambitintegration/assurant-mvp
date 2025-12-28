import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import * as SuppliersService from "../../services/inv/suppliers-service";

export default class InvSuppliersController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const data = req.body;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await SuppliersService.createSupplier(data, teamId, userId);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await SuppliersService.getSupplierById(id, teamId);
    if (!result) {
      return res.status(404).send(new ServerResponse(false, null, "Supplier not found"));
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

    const result = await SuppliersService.listSuppliers(filters, teamId);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const data = req.body;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const result = await SuppliersService.updateSupplier(id, data, teamId, userId);
    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await SuppliersService.deleteSupplier(id, teamId, userId);
    return res.status(200).send(new ServerResponse(true, { message: "Supplier deleted successfully" }));
  }

  @HandleExceptions()
  public static async search(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const { q, limit } = req.query;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const query = q as string || "";
    const searchLimit = limit ? parseInt(limit as string, 10) : 10;

    const result = await SuppliersService.searchSuppliers(query, teamId, searchLimit);
    return res.status(200).send(new ServerResponse(true, result));
  }
}
