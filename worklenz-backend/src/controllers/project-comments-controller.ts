import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getColor} from "../shared/utils";
import { NotificationsService } from "../services/notifications/notifications.service";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import {teamMemberInfoService} from "../services/views/team-member-info.service";
import {getFeatureFlags} from "../services/feature-flags/feature-flags.service";

interface IMention {
  id: string;
  name: string;
}

export default class ProjectCommentsController extends WorklenzControllerBase {

  private static replaceContent(messageContent: string, mentions: { id: string; name: string }[]) {
    const mentionNames = mentions.map(mention => mention.name);

    const replacedContent = mentionNames.reduce(
      (content, mentionName, index) => {
        const regex = new RegExp(`@${mentionName}`, "g");
        return content.replace(regex, `{${index}}`);
      },
      messageContent
    );

    return replacedContent;
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
      const userId = req.user?.id;
      const mentions: IMention[] = req.body.mentions;
      const projectId = req.body.project_id;
      const teamId =  req.user?.team_id;

      let commentContent = req.body.content;
      if (mentions.length > 0) {
          commentContent = await this.replaceContent(commentContent, mentions);
      }

      const body = {
        project_id : projectId,
        created_by: userId,
        content: commentContent,
        mentions,
        team_id: teamId
      };

      const q = `SELECT create_project_comment($1) AS comment`;
      const result = await db.query(q, [JSON.stringify(body)]);
      const [data] = result.rows;

      const projectMembers = await this.getMembersList(projectId);

      const commentMessage = `<b>${req.user?.name}</b> added a comment on <b>${data.comment.project_name}</b> (${data.comment.team_name})`;

      for (const member of projectMembers || []) {
        if (member.id && member.id === req.user?.id) continue;
        NotificationsService.createNotification({
          userId: member.id,
          teamId: req.user?.team_id as string,
          socketId: member.socket_id,
          message: commentMessage,
          taskId: null,
          projectId
        });
        if (member.id !== req.user?.id && member.socket_id) {
          IO.emit(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED, member.socket_id, true);
        }
      }

      const mentionMessage = `<b>${req.user?.name}</b> has mentioned you in a comment on <b>${data.comment.project_name}</b> (${data.comment.team_name})`;
      const rdMentions = [...new Set(req.body.mentions || [])] as IMention[]; // remove duplicates

      for (const mention of rdMentions) {
        if (mention) {
          const member = await this.getUserDataByUserId(mention.id, projectId, teamId as string);
          NotificationsService.sendNotification({
            team: data.comment.team_name,
            receiver_socket_id: member.socket_id,
            message: mentionMessage,
            task_id: "",
            project_id: projectId,
            project: data.comment.project_name,
            project_color: member.project_color,
            team_id: req.user?.team_id as string
          });
        }
      }

      return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getUserDataByUserId(informedBy: string, projectId: string, team_id: string) {
    const q = `
              SELECT id,
                  name,
                  email,
                  socket_id,
                  (SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE notification_settings.team_id = $3
                    AND notification_settings.user_id = $1),
                  (SELECT color_code FROM projects WHERE id = $2) AS project_color
              FROM users
              WHERE id = $1;
    `;
    const result = await db.query(q, [informedBy, projectId, team_id]);
    const [data] = result.rows;
    return data;
  }

  private static async getMembersList(projectId: string) {
    const featureFlags = getFeatureFlags();

    if (featureFlags.isEnabled('teams')) {
      // NEW: Use TeamMemberInfoService
      const q = `
              SELECT
                  tm.user_id AS id,
                  tm.id AS team_member_id,
                  (SELECT socket_id FROM users WHERE users.id = tm.user_id) AS socket_id,
                  (SELECT email_notifications_enabled
                    FROM notification_settings
                    WHERE team_id = tm.team_id
                      AND notification_settings.user_id = tm.user_id) AS email_notifications_enabled
              FROM project_members
                  INNER JOIN team_members tm ON project_members.team_member_id = tm.id
                  LEFT JOIN users u ON tm.user_id = u.id
              WHERE project_id = $1 AND tm.user_id IS NOT NULL
      `;
      const result = await db.query(q, [projectId]);
      const members = result.rows;

      // Enrich with team member info from service
      for (const member of members) {
        const memberInfo = await teamMemberInfoService.getTeamMemberById(member.team_member_id);
        if (memberInfo) {
          member.name = memberInfo.name;
          member.email = memberInfo.email;
        }
      }

      // Sort by name after enrichment
      members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return members;
    } else {
      // LEGACY: Keep original SQL
      const q = `
              SELECT
                  tm.user_id AS id,
                  (SELECT name
                  FROM team_member_info_view
                  WHERE team_member_info_view.team_member_id = tm.id),
                  (SELECT email
                  FROM team_member_info_view
                  WHERE team_member_info_view.team_member_id = tm.id) AS email,
                  (SELECT socket_id FROM users WHERE users.id = tm.user_id) AS socket_id,
                  (SELECT email_notifications_enabled
                    FROM notification_settings
                    WHERE team_id = tm.team_id
                      AND notification_settings.user_id = tm.user_id) AS email_notifications_enabled
              FROM project_members
                  INNER JOIN team_members tm ON project_members.team_member_id = tm.id
                  LEFT JOIN users u ON tm.user_id = u.id
              WHERE project_id = $1 AND tm.user_id IS NOT NULL
              ORDER BY name
      `;
      const result = await db.query(q, [projectId]);
      const members = result.rows;
      return members;
    }
  }

  @HandleExceptions()
  public static async getMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const members = await this.getMembersList(req.params.id as string);
    return res.status(200).send(new ServerResponse(true, members || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {


    const q = `
      SELECT
        pc.id,
        pc.content AS content,
        (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
        FROM (SELECT u.name  AS user_name,
                     u.email AS user_email
              FROM project_comment_mentions pcm
                    LEFT JOIN users u ON pcm.informed_by = u.id
              WHERE pcm.comment_id = pc.id) rec) AS mentions,
        (SELECT id FROM users WHERE id = pc.created_by) AS user_id,
        (SELECT name FROM users WHERE id = pc.created_by) AS created_by,
        (SELECT avatar_url FROM users WHERE id = pc.created_by),
        pc.created_at,
        pc.updated_at
      FROM project_comments pc
      WHERE pc.project_id = $1 ORDER BY pc.updated_at
    `;
    const result = await db.query(q, [req.params.id]);

    const data = result.rows;

    for (const comment of data) {
      const {mentions} = comment;
      if (mentions.length > 0) {
        const placeHolders = comment.content.match(/{\d+}/g);
        if (placeHolders) {
          comment.content = await comment.content.replace(/\n/g, "</br>");
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
              const index = parseInt(placeHolder.match(/\d+/)[0]);
              if (index >= 0 && index < comment.mentions.length) {
                comment.content = comment.content.replace(placeHolder, `<span class='mentions'>@${comment.mentions[index].user_name}</span>`);
              }
          });
        }
      }
      const color_code = getColor(comment.created_by);
      comment.color_code = color_code;
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getCountByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT COUNT(*) AS total FROM project_comments WHERE project_id = $1`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, parseInt(data.total)));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse>  {
    const q = `DELETE FROM project_comments WHERE id = $1 RETURNING id`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

}
