/**
 * RCM Departments Controller
 * Handles HTTP requests for department management
 */

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  createDepartment,
  getDepartmentById,
  listDepartments,
  updateDepartment,
  deleteDepartment,
  getRootDepartments,
  getDepartmentHierarchy,
  assignResourceToDepartment,
  unassignResourceFromDepartment,
  getDepartmentResources,
  updateResourceAssignment
} from "../../services/rcm/departments-service";
import {
  ICreateDepartmentDto,
  IUpdateDepartmentDto,
  IDepartmentFilters,
  IAssignResourceDto
} from "../../interfaces/rcm/department.interface";

export default class RcmDepartmentsController extends WorklenzControllerBase {
  /**
   * Create a new department
   * POST /api/rcm/departments
   */
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: ICreateDepartmentDto = req.body;
    const department = await createDepartment(data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, department, "Department created successfully"));
  }

  /**
   * Get a department by ID
   * GET /api/rcm/departments/:id
   */
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;
    const includeHierarchy = req.query.include_hierarchy === "true";

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const department = await getDepartmentById(departmentId, teamId, includeHierarchy);

    if (!department) {
      return res.status(404).send(new ServerResponse(false, null, "Department not found"));
    }

    return res.status(200).send(new ServerResponse(true, department));
  }

  /**
   * List departments with filtering and pagination
   * GET /api/rcm/departments
   */
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const filters: IDepartmentFilters = {
      parent_dept_id: req.query.parent_dept_id as string,
      is_active: req.query.is_active ? req.query.is_active === "true" : undefined,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20
    };

    const result = await listDepartments(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Update a department
   * PUT /api/rcm/departments/:id
   */
  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IUpdateDepartmentDto = req.body;
    const department = await updateDepartment(departmentId, data, teamId);

    return res.status(200).send(new ServerResponse(true, department, "Department updated successfully"));
  }

  /**
   * Delete a department (soft delete)
   * DELETE /api/rcm/departments/:id
   */
  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await deleteDepartment(departmentId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Department deleted successfully"));
  }

  /**
   * Get root departments (departments with no parent)
   * GET /api/rcm/departments/roots
   */
  @HandleExceptions()
  public static async getRoots(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const departments = await getRootDepartments(teamId);

    return res.status(200).send(new ServerResponse(true, departments));
  }

  /**
   * Get department hierarchy tree
   * GET /api/rcm/departments/hierarchy
   */
  @HandleExceptions()
  public static async getHierarchy(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const rootDepartmentId = req.query.root_id as string;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const hierarchy = await getDepartmentHierarchy(teamId, rootDepartmentId);

    return res.status(200).send(new ServerResponse(true, hierarchy));
  }

  /**
   * Assign a resource to a department
   * POST /api/rcm/departments/:id/resources
   */
  @HandleExceptions()
  public static async assignResource(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const departmentId = req.params.id;

    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const data: IAssignResourceDto = req.body;
    await assignResourceToDepartment(departmentId, data, teamId, userId);

    return res.status(200).send(new ServerResponse(true, null, "Resource assigned to department successfully"));
  }

  /**
   * Unassign a resource from a department
   * DELETE /api/rcm/departments/:id/resources/:resourceId
   */
  @HandleExceptions()
  public static async unassignResource(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;
    const resourceId = req.params.resourceId;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    await unassignResourceFromDepartment(departmentId, resourceId, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Resource unassigned from department successfully"));
  }

  /**
   * Get all resources assigned to a department
   * GET /api/rcm/departments/:id/resources
   */
  @HandleExceptions()
  public static async getResources(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const department = await getDepartmentResources(departmentId, teamId);

    if (!department) {
      return res.status(404).send(new ServerResponse(false, null, "Department not found"));
    }

    return res.status(200).send(new ServerResponse(true, department.resource_assignments));
  }

  /**
   * Update resource assignment (e.g., change primary status)
   * PATCH /api/rcm/departments/:id/resources/:resourceId
   */
  @HandleExceptions()
  public static async updateAssignment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const departmentId = req.params.id;
    const resourceId = req.params.resourceId;
    const isPrimary = req.body.is_primary;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (typeof isPrimary !== "boolean") {
      return res.status(400).send(new ServerResponse(false, null, "is_primary must be a boolean"));
    }

    await updateResourceAssignment(departmentId, resourceId, isPrimary, teamId);

    return res.status(200).send(new ServerResponse(true, null, "Resource assignment updated successfully"));
  }
}
