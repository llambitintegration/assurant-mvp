/**
 * RCM Heatmap Controller
 * Handles HTTP requests for resource capacity heatmap visualization
 */

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { getHeatmapData } from "../../services/rcm/heatmap-service";
import { IHeatmapFilters } from "../../interfaces/rcm/heatmap.interface";

export default class RcmHeatmapController extends WorklenzControllerBase {
  /**
   * Get heatmap data with utilization calculations
   * GET /api/v1/rcm/heatmap
   */
  @HandleExceptions()
  public static async getHeatmap(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Helper to parse array query params (can be array or comma-separated string)
    const parseArrayParam = (param: any): string[] | undefined => {
      if (!param) return undefined;
      if (Array.isArray(param)) return param;
      if (typeof param === 'string') return param.split(',').filter(v => v && v !== 'undefined');
      return undefined;
    };

    const filters: IHeatmapFilters = {
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      granularity: (req.query.granularity as 'daily' | 'weekly' | 'monthly') || 'weekly',
      department_ids: parseArrayParam(req.query.department_ids),
      resource_types: parseArrayParam(req.query.resource_types) as ('personnel' | 'equipment')[] | undefined,
      project_id: req.query.project_id as string,
      include_unavailability: req.query.include_unavailability === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      size: req.query.size ? parseInt(req.query.size as string) : 20,
    };

    // Validate required fields
    if (!filters.start_date || !filters.end_date) {
      return res.status(400).send(new ServerResponse(false, null, "Start date and end date are required"));
    }

    const result = await getHeatmapData(filters, teamId);

    return res.status(200).send(new ServerResponse(true, result));
  }
}
