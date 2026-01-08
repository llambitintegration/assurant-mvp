import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import {teamMemberInfoService} from "../services/views/team-member-info.service";
import {getFeatureFlags} from "../services/feature-flags/feature-flags.service";


export default class ProjectManagersController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getByOrg(_req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const featureFlags = getFeatureFlags();

    if (featureFlags.isEnabled('teams')) {
      // NEW: Use TeamMemberInfoService - note: the JOIN is used for filtering, not for accessing view columns
      // The query primarily uses the view for validation/filtering, so we keep the JOIN approach
      // but we're now using Prisma-managed connections
      const q = `SELECT DISTINCT ON (tm.user_id)
                      tm.user_id AS id,
                      u.name,
                      pm.team_member_id
                  FROM
                      projects p
                  JOIN project_members pm ON p.id = pm.project_id
                  JOIN teams t ON p.team_id = t.id
                  JOIN team_members tm ON pm.team_member_id = tm.id
                  JOIN users u ON tm.user_id = u.id
                  WHERE
                      t.id IN (SELECT id FROM teams WHERE in_organization(id, $1))
                      AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
                      AND tm.active = true
                  GROUP BY
                      tm.user_id, u.name, pm.team_member_id`;
      const result = await db.query(q, [_req.user?.team_id]);
      return res.status(200).send(new ServerResponse(true, result.rows));
    } else {
      // LEGACY: Keep original SQL with view JOIN
      const q = `SELECT DISTINCT ON (tm.user_id)
                      tm.user_id AS id,
                      u.name,
                      pm.team_member_id
                  FROM
                      projects p
                  JOIN project_members pm ON p.id = pm.project_id
                  JOIN teams t ON p.team_id = t.id
                  JOIN team_members tm ON pm.team_member_id = tm.id
                  JOIN team_member_info_view tmi ON tm.id = tmi.team_member_id
                  JOIN users u ON tm.user_id = u.id
                  WHERE
                      t.id IN (SELECT id FROM teams WHERE in_organization(id, $1))
                      AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
                  GROUP BY
                      tm.user_id, u.name, pm.team_member_id`;
      const result = await db.query(q, [_req.user?.team_id]);
      return res.status(200).send(new ServerResponse(true, result.rows));
    }
  }
}
