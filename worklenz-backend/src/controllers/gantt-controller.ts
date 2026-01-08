import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import { teamMemberInfoService } from "../services/views/team-member-info.service";
import { getFeatureFlags } from "../services/feature-flags/feature-flags.service";

export default class GanttController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getPhaseLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT phase_label
        FROM projects
        WHERE id = $1;`;
    const result = await db.query(q, [req.query.project_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id AS "TaskID",
       name AS "TaskName",
       start_date AS "StartDate",
       end_date AS "EndDate",
       (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
       (SELECT color_code
        FROM sys_task_status_categories
        WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)),
       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
        FROM (SELECT id AS "TaskID",
                     name AS "TaskName",
                     start_date AS "StartDate",
                     end_date AS "EndDate",
                     (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                     (SELECT color_code
                      FROM sys_task_status_categories
                      WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id))
              FROM tasks t
              WHERE t.parent_task_id = tasks.id) rec) AS subtasks
        FROM tasks
        WHERE archived IS FALSE
          AND project_id = $1
          AND parent_task_id IS NULL
        ORDER BY roadmap_sort_order, created_at DESC;`;
    const result = await db.query(q, [req.query.project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getPhasesByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT name AS label,
       (SELECT MIN(start_date)
        FROM tasks
        WHERE id IN (SELECT task_id FROM task_phase WHERE phase_id = project_phases.id)) as day
      FROM project_phases
      WHERE project_id = $1;`;
    const result = await db.query(q, [req.params.id]);
    for (const phase of result.rows) {
      phase.day = new Date(phase.day);
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getWorkload(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const featureFlags = getFeatureFlags();

    if (featureFlags.isEnabled('teams')) {
      // NEW: Use TeamMemberInfoService
      const qProjectMembers = `SELECT id, team_member_id FROM project_members WHERE project_id = $1`;
      const pmResult = await db.query(qProjectMembers, [req.query.project_id]);

      const workloadData = [];

      for (const pm of pmResult.rows) {
        const memberInfo = await teamMemberInfoService.getTeamMemberById(pm.team_member_id);

        if (memberInfo) {
          const qSubtasks = `
            SELECT id AS "TaskID",
                   name AS "TaskName",
                   start_date AS "StartDate",
                   end_date AS "EndDate"
            FROM tasks
            INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
            WHERE archived IS FALSE
              AND project_id = $1
              AND ta.team_member_id = $2
            ORDER BY roadmap_sort_order, start_date DESC
          `;
          const subtasksResult = await db.query(qSubtasks, [req.query.project_id, pm.team_member_id]);

          const memberData = {
            TaskID: pm.id,
            team_member_id: memberInfo.team_member_id,
            TaskName: memberInfo.name,
            avatar_url: memberInfo.avatar_url,
            email: memberInfo.email,
            project_member: true,
            subtasks: subtasksResult.rows,
            color_code: getColor(memberInfo.name || '')
          };

          workloadData.push(memberData);
        }
      }

      // Sort by name
      workloadData.sort((a, b) => (a.TaskName || '').localeCompare(b.TaskName || ''));

      return res.status(200).send(new ServerResponse(true, workloadData));
    }

    // LEGACY: Use direct SQL query
    const q = `SELECT pm.id AS "TaskID",
       tmiv.team_member_id,
       name AS "TaskName",
       avatar_url,
       email,
       TRUE as project_member,
       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
        FROM (SELECT id AS "TaskID",
                     name AS "TaskName",
                     start_date AS "StartDate",
                     end_date AS "EndDate"
              FROM tasks
                       INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
              WHERE archived IS FALSE
                AND project_id = pm.project_id
                AND ta.team_member_id = tmiv.team_member_id
              ORDER BY roadmap_sort_order, start_date DESC) rec) AS subtasks
      FROM project_members pm
              INNER JOIN team_member_info_view tmiv ON pm.team_member_id = tmiv.team_member_id
      WHERE project_id = $1
      ORDER BY tmiv.name;`;
    const result = await db.query(q, [req.query.project_id]);

    for (const member of result.rows) {
      member.color_code = getColor(member.TaskName);
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
