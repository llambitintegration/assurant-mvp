/**
 * RCM Availability Controller
 * Handles HTTP requests for availability and unavailability management
 */

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  createAvailability,
  getAvailabilityById,
  listAvailability,
  updateAvailability,
  deleteAvailability,
  getResourceAvailability,
  createUnavailabilityPeriod,
  getUnavailabilityById,
  listUnavailability,
  updateUnavailabilityPeriod,
  deleteUnavailabilityPeriod,
  getResourceUnavailability,
  calculateNetAvailableHours,
  getResourceAvailabilitySummary
} from "../../services/rcm/availability-service";
import {
  ICreateAvailabilityDto,
  IUpdateAvailabilityDto,
  IAvailabilityFilters,
  ICreateUnavailabilityDto,
  IUpdateUnavailabilityDto,
  IUnavailabilityFilters
} from "../../interfaces/rcm/availability.interface";

export default class RcmAvailabilityController extends WorklenzControllerBase {
  // ==========================================================================
  // AVAILABILITY ENDPOINTS
  // ==========================================================================

  /**
   * Create a new availability record
   * POST /api/rcm/availability
   */
  @HandleExceptions()
  public static async createAvailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: ICreateAvailabilityDto = req.body;
    const availability = await createAvailability(data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, availability, "Availability created successfully"));
  }

  /**
   * Get an availability record by ID
   * GET /api/rcm/availability/:id
   */
  @HandleExceptions()
  public static async getAvailabilityById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const availabilityId = req.params.id;
    const includeResource = req.query.include_resource === "true";

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const availability = await getAvailabilityById(availabilityId, teamId, includeResource);

    if (!availability) {
      return res.status(404).send(new ServerResponse(false, null, "Availability record not found"));
    }

    return res.status(200).send(new ServerResponse(true, availability));
  }

  /**
   * List availability records with filtering and pagination
   * GET /api/rcm/availability
   */
  @HandleExceptions()
  public static async listAvailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const filters: IAvailabilityFilters = {
      resource_id: req.query.resource_id as string,
      effective_date: req.query.effective_date as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20
    };

    const result = await listAvailability(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Update an availability record
   * PUT /api/rcm/availability/:id
   */
  @HandleExceptions()
  public static async updateAvailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const availabilityId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IUpdateAvailabilityDto = req.body;
    const availability = await updateAvailability(availabilityId, data, teamId);

    return res.status(200).send(new ServerResponse(true, availability, "Availability updated successfully"));
  }

  /**
   * Delete an availability record
   * DELETE /api/rcm/availability/:id
   */
  @HandleExceptions()
  public static async deleteAvailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const availabilityId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await deleteAvailability(availabilityId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Availability deleted successfully"));
  }

  /**
   * Get all availability records for a specific resource
   * GET /api/rcm/availability/resource/:resourceId
   */
  @HandleExceptions()
  public static async getResourceAvailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.resourceId;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const availability = await getResourceAvailability(resourceId, teamId);

    return res.status(200).send(new ServerResponse(true, availability));
  }

  // ==========================================================================
  // UNAVAILABILITY ENDPOINTS
  // ==========================================================================

  /**
   * Create a new unavailability period
   * POST /api/rcm/unavailability
   */
  @HandleExceptions()
  public static async createUnavailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: ICreateUnavailabilityDto = req.body;
    const unavailability = await createUnavailabilityPeriod(data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, unavailability, "Unavailability period created successfully"));
  }

  /**
   * Get an unavailability period by ID
   * GET /api/rcm/unavailability/:id
   */
  @HandleExceptions()
  public static async getUnavailabilityById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const unavailabilityId = req.params.id;
    const includeResource = req.query.include_resource === "true";

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const unavailability = await getUnavailabilityById(unavailabilityId, teamId, includeResource);

    if (!unavailability) {
      return res.status(404).send(new ServerResponse(false, null, "Unavailability period not found"));
    }

    return res.status(200).send(new ServerResponse(true, unavailability));
  }

  /**
   * List unavailability periods with filtering and pagination
   * GET /api/rcm/unavailability
   */
  @HandleExceptions()
  public static async listUnavailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const filters: IUnavailabilityFilters = {
      resource_id: req.query.resource_id as string,
      unavailability_type: req.query.unavailability_type as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20
    };

    const result = await listUnavailability(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Update an unavailability period
   * PUT /api/rcm/unavailability/:id
   */
  @HandleExceptions()
  public static async updateUnavailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const unavailabilityId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IUpdateUnavailabilityDto = req.body;
    const unavailability = await updateUnavailabilityPeriod(unavailabilityId, data, teamId);

    return res.status(200).send(new ServerResponse(true, unavailability, "Unavailability period updated successfully"));
  }

  /**
   * Delete an unavailability period
   * DELETE /api/rcm/unavailability/:id
   */
  @HandleExceptions()
  public static async deleteUnavailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const unavailabilityId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await deleteUnavailabilityPeriod(unavailabilityId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Unavailability period deleted successfully"));
  }

  /**
   * Get all unavailability periods for a specific resource
   * GET /api/rcm/unavailability/resource/:resourceId
   */
  @HandleExceptions()
  public static async getResourceUnavailability(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.resourceId;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const unavailability = await getResourceUnavailability(resourceId, teamId, startDate, endDate);

    return res.status(200).send(new ServerResponse(true, unavailability));
  }

  // ==========================================================================
  // CALCULATION ENDPOINTS
  // ==========================================================================

  /**
   * Calculate net available hours for a resource
   * GET /api/rcm/availability/resource/:resourceId/net-hours
   */
  @HandleExceptions()
  public static async calculateNetHours(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
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

    const result = await calculateNetAvailableHours(resourceId, teamId, startDate, endDate);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Get resource availability summary
   * GET /api/rcm/availability/resource/:resourceId/summary
   */
  @HandleExceptions()
  public static async getResourceSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.resourceId;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const summary = await getResourceAvailabilitySummary(resourceId, teamId);

    return res.status(200).send(new ServerResponse(true, summary));
  }
}
