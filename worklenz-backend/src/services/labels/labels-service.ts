/**
 * Labels Service
 * Handles team label management using Prisma ORM
 *
 * This service replaces SQL queries in labels-controller.ts with Prisma implementations
 * All methods are validated against contract tests to ensure behavioral parity
 */

import prisma from '../../config/prisma';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { TASK_PRIORITY_COLOR_ALPHA } from '../../shared/constants';

/**
 * DTO for label creation
 */
export interface ICreateLabelDto {
  name: string;
  color_code: string;
  team_id: string;
}

/**
 * DTO for label update
 */
export interface IUpdateLabelDto {
  id: string;
  name?: string;
  color_code?: string;
  team_id: string;
}

/**
 * DTO for label color update
 */
export interface IUpdateLabelColorDto {
  id: string;
  color_code: string;
  team_id: string;
}

/**
 * DTO for getting labels by team
 */
export interface IGetLabelsDto {
  team_id: string;
  project_id?: string | null;
}

/**
 * DTO for getting labels by task
 */
export interface IGetLabelsByTaskDto {
  task_id: string;
}

/**
 * DTO for getting labels by project
 */
export interface IGetLabelsByProjectDto {
  project_id: string;
  team_id: string;
}

/**
 * DTO for deleting a label
 */
export interface IDeleteLabelDto {
  id: string;
  team_id: string;
}

/**
 * Labels Service
 * Singleton service for managing team labels
 */
export class LabelsService {
  private static instance: LabelsService;
  private featureFlags: FeatureFlagsService;

  private constructor() {
    this.featureFlags = FeatureFlagsService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LabelsService {
    if (!LabelsService.instance) {
      LabelsService.instance = new LabelsService();
    }
    return LabelsService.instance;
  }

  /**
   * Get all labels for a team with usage statistics
   * Ordered by usage in a specific project (if provided), then by name
   *
   * SQL Query:
   * WITH lbs AS (SELECT id, name, color_code,
   *              (SELECT COUNT(*) FROM task_labels WHERE label_id = team_labels.id) AS usage,
   *              EXISTS(SELECT 1 FROM task_labels WHERE task_labels.label_id = team_labels.id
   *                AND EXISTS(SELECT 1 FROM tasks WHERE id = task_labels.task_id AND project_id = $2)) AS used
   *              FROM team_labels WHERE team_id = $1 ORDER BY name)
   * SELECT id, name, color_code, usage FROM lbs ORDER BY used DESC;
   */
  async getLabels(data: IGetLabelsDto): Promise<any[]> {
    const labels = await prisma.team_labels.findMany({
      where: {
        team_id: data.team_id
      },
      include: {
        task_labels: {
          select: {
            task_id: true,
            tasks: {
              select: {
                project_id: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Calculate usage and "used in project" flag
    const result = labels.map(label => {
      const usage = label.task_labels.length;
      const used = data.project_id
        ? label.task_labels.some(tl => tl.tasks.project_id === data.project_id)
        : false;

      return {
        id: label.id,
        name: label.name,
        color_code: label.color_code,
        usage,
        used
      };
    });

    // Sort by "used" DESC (labels used in the project first), then by name
    result.sort((a, b) => {
      if (a.used !== b.used) {
        return b.used ? 1 : -1; // used items first
      }
      return a.name.localeCompare(b.name);
    });

    // Remove the "used" field from final result (it's just for sorting)
    return result.map(({ used, ...rest }) => rest);
  }

  /**
   * Get labels for a specific task
   * Returns label name and color code
   *
   * SQL Query:
   * SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id),
   *        (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
   * FROM task_labels WHERE task_id = $1;
   */
  async getLabelsByTask(data: IGetLabelsByTaskDto): Promise<any[]> {
    const taskLabels = await prisma.task_labels.findMany({
      where: {
        task_id: data.task_id
      },
      include: {
        team_labels: {
          select: {
            name: true,
            color_code: true
          }
        }
      }
    });

    return taskLabels.map(tl => ({
      name: tl.team_labels.name,
      color_code: tl.team_labels.color_code
    }));
  }

  /**
   * Get labels used in a specific project
   * Only returns labels that are actually assigned to tasks in the project
   * Adds alpha transparency to color codes
   *
   * SQL Query:
   * SELECT id, name, color_code FROM team_labels
   * WHERE team_id = $2
   *   AND EXISTS(SELECT 1 FROM tasks WHERE project_id = $1
   *     AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
   * ORDER BY name;
   */
  async getLabelsByProject(data: IGetLabelsByProjectDto): Promise<any[]> {
    const labels = await prisma.team_labels.findMany({
      where: {
        team_id: data.team_id,
        task_labels: {
          some: {
            tasks: {
              project_id: data.project_id
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        color_code: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Add alpha transparency to color codes
    return labels.map(label => ({
      ...label,
      color_code: label.color_code + TASK_PRIORITY_COLOR_ALPHA
    }));
  }

  /**
   * Update label color
   *
   * SQL Query:
   * UPDATE team_labels SET color_code = $3 WHERE id = $1 AND team_id = $2;
   */
  async updateLabelColor(data: IUpdateLabelColorDto): Promise<any> {
    return await prisma.team_labels.update({
      where: {
        id: data.id,
        team_id: data.team_id
      },
      data: {
        color_code: data.color_code
      }
    });
  }

  /**
   * Update label (name and/or color)
   * Dynamically builds update based on provided fields
   *
   * SQL Query:
   * UPDATE team_labels SET name = $3, color_code = $4 WHERE id = $1 AND team_id = $2;
   */
  async updateLabel(data: IUpdateLabelDto): Promise<any> {
    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.color_code !== undefined) {
      updateData.color_code = data.color_code;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    return await prisma.team_labels.update({
      where: {
        id: data.id,
        team_id: data.team_id
      },
      data: updateData
    });
  }

  /**
   * Delete a label by ID
   * Cascade deletes task_labels entries automatically via database constraints
   *
   * SQL Query:
   * DELETE FROM team_labels WHERE id = $1 AND team_id = $2;
   */
  async deleteLabel(data: IDeleteLabelDto): Promise<any> {
    return await prisma.team_labels.delete({
      where: {
        id: data.id,
        team_id: data.team_id
      }
    });
  }
}

/**
 * Convenience function to get labels service instance
 */
export function getLabelsService(): LabelsService {
  return LabelsService.getInstance();
}
