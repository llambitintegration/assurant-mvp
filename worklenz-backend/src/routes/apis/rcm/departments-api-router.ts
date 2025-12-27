/**
 * Departments API Router
 * Defines routes for department management
 */

import express from "express";
import RcmDepartmentsController from "../../../controllers/rcm/rcm-departments-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import {
  createDepartmentValidator,
  updateDepartmentValidator,
  idParamValidator,
  resourceIdParamValidator,
  assignResourceValidator,
  updateAssignmentValidator,
  listQueryValidator,
  hierarchyQueryValidator,
  getByIdQueryValidator
} from "../../../middlewares/validators/rcm/department-validator";

const departmentsApiRouter = express.Router();

/**
 * GET /api/rcm/departments/roots
 * Get all root departments (departments with no parent)
 */
departmentsApiRouter.get(
  "/roots",
  safeControllerFunction(RcmDepartmentsController.getRoots)
);

/**
 * GET /api/rcm/departments/hierarchy
 * Get department hierarchy tree
 */
departmentsApiRouter.get(
  "/hierarchy",
  hierarchyQueryValidator,
  safeControllerFunction(RcmDepartmentsController.getHierarchy)
);

/**
 * GET /api/rcm/departments
 * List departments with filtering and pagination
 */
departmentsApiRouter.get(
  "/",
  listQueryValidator,
  safeControllerFunction(RcmDepartmentsController.list)
);

/**
 * GET /api/rcm/departments/:id
 * Get a department by ID
 */
departmentsApiRouter.get(
  "/:id",
  getByIdQueryValidator,
  safeControllerFunction(RcmDepartmentsController.getById)
);

/**
 * POST /api/rcm/departments
 * Create a new department
 */
departmentsApiRouter.post(
  "/",
  createDepartmentValidator,
  safeControllerFunction(RcmDepartmentsController.create)
);

/**
 * PUT /api/rcm/departments/:id
 * Update a department
 */
departmentsApiRouter.put(
  "/:id",
  idParamValidator,
  updateDepartmentValidator,
  safeControllerFunction(RcmDepartmentsController.update)
);

/**
 * DELETE /api/rcm/departments/:id
 * Delete a department (soft delete)
 */
departmentsApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(RcmDepartmentsController.delete)
);

/**
 * GET /api/rcm/departments/:id/resources
 * Get all resources assigned to a department
 */
departmentsApiRouter.get(
  "/:id/resources",
  idParamValidator,
  safeControllerFunction(RcmDepartmentsController.getResources)
);

/**
 * POST /api/rcm/departments/:id/resources
 * Assign a resource to a department
 */
departmentsApiRouter.post(
  "/:id/resources",
  assignResourceValidator,
  safeControllerFunction(RcmDepartmentsController.assignResource)
);

/**
 * PATCH /api/rcm/departments/:id/resources/:resourceId
 * Update resource assignment (e.g., change primary status)
 */
departmentsApiRouter.patch(
  "/:id/resources/:resourceId",
  updateAssignmentValidator,
  safeControllerFunction(RcmDepartmentsController.updateAssignment)
);

/**
 * DELETE /api/rcm/departments/:id/resources/:resourceId
 * Unassign a resource from a department
 */
departmentsApiRouter.delete(
  "/:id/resources/:resourceId",
  resourceIdParamValidator,
  safeControllerFunction(RcmDepartmentsController.unassignResource)
);

export default departmentsApiRouter;
