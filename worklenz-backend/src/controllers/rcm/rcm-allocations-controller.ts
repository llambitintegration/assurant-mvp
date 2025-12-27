/**
 * RCM Allocations Controller
 * Handles HTTP requests for allocation management
 */

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  createAllocation,
  getAllocationById,
  listAllocations,
  updateAllocation,
  deleteAllocation,
  getResourceAllocations,
  calculateTotalAllocation,
  getProjectAllocations
} from "../../services/rcm/allocations-service";
import {
  ICreateAllocationDto,
  IUpdateAllocationDto,
  IAllocationFilters
} from "../../interfaces/rcm/allocation.interface";

export default class RcmAllocationsController extends WorklenzControllerBase {
  /**
   * Create a new allocation
   * POST /api/rcm/allocations
   */
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: ICreateAllocationDto = req.body;
    const allocation = await createAllocation(data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, allocation, "Allocation created successfully"));
  }

  /**
   * Get an allocation by ID
   * GET /api/rcm/allocations/:id
   */
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const allocationId = req.params.id;
    const includeResource = req.query.include_resource === "true";

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const allocation = await getAllocationById(allocationId, teamId, includeResource);

    if (!allocation) {
      return res.status(404).send(new ServerResponse(false, null, "Allocation not found"));
    }

    return res.status(200).send(new ServerResponse(true, allocation));
  }

  /**
   * List allocations with filtering and pagination
   * GET /api/rcm/allocations
   */
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const filters: IAllocationFilters = {
      resource_id: req.query.resource_id as string,
      project_id: req.query.project_id as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      is_active: req.query.is_active ? req.query.is_active === "true" : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20
    };

    const result = await listAllocations(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Update an allocation
   * PUT /api/rcm/allocations/:id
   */
  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const allocationId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IUpdateAllocationDto = req.body;
    const allocation = await updateAllocation(allocationId, data, teamId);

    return res.status(200).send(new ServerResponse(true, allocation, "Allocation updated successfully"));
  }

  /**
   * Delete an allocation (soft delete)
   * DELETE /api/rcm/allocations/:id
   */
  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const allocationId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await deleteAllocation(allocationId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Allocation deleted successfully"));
  }

  /**
   * Get all allocations for a specific resource
   * GET /api/rcm/allocations/resource/:resourceId
   */
  @HandleExceptions()
  public static async getByResource(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.resourceId;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const allocations = await getResourceAllocations(resourceId, teamId, startDate, endDate);

    return res.status(200).send(new ServerResponse(true, allocations));
  }

  /**
   * Get allocation summary for a resource (total allocation %)
   * GET /api/rcm/allocations/resource/:resourceId/summary
   */
  @HandleExceptions()
  public static async getResourceSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.resourceId;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (!startDate || !endDate) {
      return res.status(400).send(new ServerResponse(false, null, "Start date and end date are required"));
    }

    const summary = await calculateTotalAllocation(resourceId, teamId, startDate, endDate);

    return res.status(200).send(new ServerResponse(true, summary));
  }

  /**
   * Get all allocations for a specific project
   * GET /api/rcm/allocations/project/:projectId
   */
  @HandleExceptions()
  public static async getByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const projectId = req.params.projectId;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const allocations = await getProjectAllocations(projectId, teamId);

    return res.status(200).send(new ServerResponse(true, allocations));
  }
}
