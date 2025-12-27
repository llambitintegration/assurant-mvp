import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  createResource,
  getResourceById,
  listResources,
  updateResource,
  deleteResource,
  searchResources,
  getResourcesByType
} from "../../services/rcm/resources-service";
import { ICreateResourceDto, IUpdateResourceDto, IResourceFilters } from "../../interfaces/rcm/resource.interface";

export default class RcmResourcesController extends WorklenzControllerBase {
  /**
   * POST /api/rcm/resources
   * Create a new resource
   */
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: ICreateResourceDto = req.body;
    const resource = await createResource(data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, resource, "Resource created successfully"));
  }

  /**
   * GET /api/rcm/resources/:id
   * Get a resource by ID
   */
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const resource = await getResourceById(resourceId, teamId);

    if (!resource) {
      return res.status(404).send(new ServerResponse(false, null, "Resource not found"));
    }

    return res.status(200).send(new ServerResponse(true, resource));
  }

  /**
   * GET /api/rcm/resources
   * List resources with filters and pagination
   */
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const filters: IResourceFilters = {
      resource_type: req.query.resource_type as any,
      is_active: req.query.is_active ? req.query.is_active === "true" : undefined,
      department_id: req.query.department_id as string,
      skill_id: req.query.skill_id as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20
    };

    const result = await listResources(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * PUT /api/rcm/resources/:id
   * Update a resource
   */
  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IUpdateResourceDto = req.body;
    const resource = await updateResource(resourceId, data, teamId);

    return res.status(200).send(new ServerResponse(true, resource, "Resource updated successfully"));
  }

  /**
   * DELETE /api/rcm/resources/:id
   * Delete a resource (soft delete)
   */
  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await deleteResource(resourceId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Resource deleted successfully"));
  }

  /**
   * GET /api/rcm/resources/search
   * Search resources by name or email
   */
  @HandleExceptions()
  public static async search(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const query = req.query.q as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (!query) {
      return res.status(400).send(new ServerResponse(false, null, "Search query is required"));
    }

    const resources = await searchResources(query, teamId, limit);

    return res.status(200).send(new ServerResponse(true, resources));
  }

  /**
   * GET /api/rcm/resources/by-type/:type
   * Get resources by type (personnel or equipment)
   */
  @HandleExceptions()
  public static async getByType(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const resourceType = req.params.type as any;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (resourceType !== "personnel" && resourceType !== "equipment") {
      return res.status(400).send(new ServerResponse(false, null, "Invalid resource type"));
    }

    const resources = await getResourcesByType(resourceType, teamId);

    return res.status(200).send(new ServerResponse(true, resources));
  }
}
