/**
 * Labels Service Contract Tests
 *
 * Tests all 6 label operations with SQL/Prisma parity validation
 * Pattern: Feature Flag + Dual Execution
 * Each test validates that the Prisma implementation produces identical output to SQL.
 *
 * Operations tested:
 * 1. getLabels - Get labels for team with usage statistics
 * 2. getLabelsByTask - Get labels for a specific task
 * 3. getLabelsByProject - Get labels used in a project
 * 4. updateLabelColor - Update label color
 * 5. updateLabel - Update label name and/or color
 * 6. deleteLabel - Delete a label
 */

import db from '../../../config/db';
import { getTestTeam, getTestUser } from '../setup';
import { LabelsService } from '../../../services/labels/labels-service';
import { TASK_PRIORITY_COLOR_ALPHA } from '../../../shared/constants';

describe('Labels Service - Contract Tests', () => {
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let testTaskId: string;
  let testLabelId1: string;
  let testLabelId2: string;
  let testLabelId3: string;
  let labelsService: LabelsService;

  beforeAll(async () => {
    // Get existing test team and user
    const team = await getTestTeam();
    testTeamId = team.id;

    const user = await getTestUser(testTeamId);
    testUserId = user.id;

    // Create test project
    const projectResult = await db.query(
      `INSERT INTO projects (name, key, team_id, owner_id, status_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1))
       RETURNING id`,
      ['Test Project Labels', 'TPL', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;

    // Create test task
    const taskStatusResult = await db.query(
      `SELECT id FROM task_statuses
       WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_todo = true LIMIT 1)
       LIMIT 1`
    );
    const priorityResult = await db.query(
      `SELECT id FROM task_priorities ORDER BY value LIMIT 1`
    );

    const taskResult = await db.query(
      `INSERT INTO tasks (name, project_id, status_id, priority_id, reporter_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING id`,
      ['Test Task for Labels', testProjectId, taskStatusResult.rows[0].id, priorityResult.rows[0].id, testUserId]
    );
    testTaskId = taskResult.rows[0].id;

    // Create test labels
    const label1Result = await db.query(
      `INSERT INTO team_labels (name, color_code, team_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Bug', '#FF0000', testTeamId]
    );
    testLabelId1 = label1Result.rows[0].id;

    const label2Result = await db.query(
      `INSERT INTO team_labels (name, color_code, team_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Feature', '#00FF00', testTeamId]
    );
    testLabelId2 = label2Result.rows[0].id;

    const label3Result = await db.query(
      `INSERT INTO team_labels (name, color_code, team_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Enhancement', '#0000FF', testTeamId]
    );
    testLabelId3 = label3Result.rows[0].id;

    // Attach labels to task
    await db.query(
      `INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2), ($1, $3)`,
      [testTaskId, testLabelId1, testLabelId2]
    );

    // Initialize labels service
    labelsService = LabelsService.getInstance();
  });

  afterAll(async () => {
    // Cleanup test data
    await db.query('DELETE FROM task_labels WHERE task_id = $1', [testTaskId]);
    await db.query('DELETE FROM tasks WHERE id = $1', [testTaskId]);
    await db.query('DELETE FROM team_labels WHERE id IN ($1, $2, $3)', [testLabelId1, testLabelId2, testLabelId3]);
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
  });

  // ============================================
  // CONTRACT TESTS (6 total)
  // ============================================

  describe('1. getLabels - Get all team labels with usage statistics', () => {
    it('should return labels ordered by usage in project (SQL/Prisma parity)', async () => {
      // SQL Query (original implementation from labels-controller.ts:13-33)
      const q = `
        WITH lbs AS (SELECT id,
                            name,
                            color_code,
                            (SELECT COUNT(*) FROM task_labels WHERE label_id = team_labels.id) AS usage,
                            EXISTS(SELECT 1
                                   FROM task_labels
                                   WHERE task_labels.label_id = team_labels.id
                                     AND EXISTS(SELECT 1
                                                FROM tasks
                                                WHERE id = task_labels.task_id
                                                  AND project_id = $2)) AS used
                     FROM team_labels
                     WHERE team_id = $1
                     ORDER BY name)
        SELECT id, name, color_code, usage
        FROM lbs
        ORDER BY used DESC;
      `;
      const sqlResult = await db.query(q, [testTeamId, testProjectId]);
      const sqlData = sqlResult.rows;

      // Prisma implementation
      const prismaData = await labelsService.getLabels({
        team_id: testTeamId,
        project_id: testProjectId
      });

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.length).toBeGreaterThan(0);

      // Verify ordering: labels used in project come first
      const usedLabels = prismaData.filter(l =>
        [testLabelId1, testLabelId2].includes(l.id)
      );
      const unusedLabels = prismaData.filter(l => l.id === testLabelId3);

      if (unusedLabels.length > 0) {
        const lastUsedIndex = prismaData.findIndex(l => l.id === usedLabels[usedLabels.length - 1].id);
        const firstUnusedIndex = prismaData.findIndex(l => l.id === unusedLabels[0].id);
        expect(lastUsedIndex).toBeLessThan(firstUnusedIndex);
      }
    });

    it('should return labels without project filter (SQL/Prisma parity)', async () => {
      // SQL Query without project filter
      const q = `
        WITH lbs AS (SELECT id,
                            name,
                            color_code,
                            (SELECT COUNT(*) FROM task_labels WHERE label_id = team_labels.id) AS usage,
                            EXISTS(SELECT 1
                                   FROM task_labels
                                   WHERE task_labels.label_id = team_labels.id
                                     AND EXISTS(SELECT 1
                                                FROM tasks
                                                WHERE id = task_labels.task_id
                                                  AND project_id = $2)) AS used
                     FROM team_labels
                     WHERE team_id = $1
                     ORDER BY name)
        SELECT id, name, color_code, usage
        FROM lbs
        ORDER BY used DESC;
      `;
      const sqlResult = await db.query(q, [testTeamId, null]);
      const sqlData = sqlResult.rows;

      // Prisma implementation
      const prismaData = await labelsService.getLabels({
        team_id: testTeamId,
        project_id: null
      });

      // Validate
      expect(prismaData).toEqual(sqlData);
    });
  });

  describe('2. getLabelsByTask - Get labels for a specific task', () => {
    it('should return labels attached to the task (SQL/Prisma parity)', async () => {
      // SQL Query (original implementation from labels-controller.ts:37-46)
      const q = `
        SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id) as name,
               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id) as color_code
        FROM task_labels
        WHERE task_id = $1;
      `;
      const sqlResult = await db.query(q, [testTaskId]);
      const sqlData = sqlResult.rows;

      // Prisma implementation
      const prismaData = await labelsService.getLabelsByTask({
        task_id: testTaskId
      });

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.length).toBe(2); // We attached 2 labels
      expect(prismaData.map(l => l.name).sort()).toEqual(['Bug', 'Feature']);
    });
  });

  describe('3. getLabelsByProject - Get labels used in a project', () => {
    it('should return labels used in project with alpha transparency (SQL/Prisma parity)', async () => {
      // SQL Query (original implementation from labels-controller.ts:49-67)
      const q = `
        SELECT id, name, color_code
        FROM team_labels
        WHERE team_id = $2
          AND EXISTS(SELECT 1
                     FROM tasks
                     WHERE project_id = $1
                       AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
        ORDER BY name;
      `;
      const sqlResult = await db.query(q, [testProjectId, testTeamId]);
      const sqlData = sqlResult.rows;

      // Add alpha transparency (same as controller)
      for (const label of sqlData) {
        label.color_code = label.color_code + TASK_PRIORITY_COLOR_ALPHA;
      }

      // Prisma implementation
      const prismaData = await labelsService.getLabelsByProject({
        project_id: testProjectId,
        team_id: testTeamId
      });

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.length).toBe(2); // Only Bug and Feature are used in the project
      expect(prismaData.every(l => l.color_code.endsWith(TASK_PRIORITY_COLOR_ALPHA))).toBe(true);
    });
  });

  describe('4. updateLabelColor - Update label color', () => {
    it('should update label color (SQL/Prisma parity)', async () => {
      const newColor = '#FFAA00';

      // SQL Query (original implementation from labels-controller.ts:70-81)
      const q = `UPDATE team_labels
                 SET color_code = $3
                 WHERE id = $1
                   AND team_id = $2;`;
      await db.query(q, [testLabelId3, testTeamId, newColor]);

      // Verify SQL update
      const sqlCheckResult = await db.query(
        'SELECT color_code FROM team_labels WHERE id = $1',
        [testLabelId3]
      );
      const sqlColor = sqlCheckResult.rows[0].color_code;
      expect(sqlColor).toBe(newColor);

      // Reset for Prisma test
      await db.query(
        'UPDATE team_labels SET color_code = $1 WHERE id = $2',
        ['#0000FF', testLabelId3]
      );

      // Prisma implementation
      await labelsService.updateLabelColor({
        id: testLabelId3,
        team_id: testTeamId,
        color_code: newColor
      });

      // Verify Prisma update
      const prismaCheckResult = await db.query(
        'SELECT color_code FROM team_labels WHERE id = $1',
        [testLabelId3]
      );
      const prismaColor = prismaCheckResult.rows[0].color_code;

      // Validate
      expect(prismaColor).toBe(sqlColor);
      expect(prismaColor).toBe(newColor);
    });
  });

  describe('5. updateLabel - Update label name and/or color', () => {
    it('should update label name only (SQL/Prisma parity)', async () => {
      const newName = 'Critical Bug';

      // Create a test label for this test
      const testLabelResult = await db.query(
        `INSERT INTO team_labels (name, color_code, team_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Test Label for Update', '#AAAAAA', testTeamId]
      );
      const testLabelId = testLabelResult.rows[0].id;

      // SQL Query (original implementation from labels-controller.ts:84-112)
      const updates = ['name = $3'];
      const values = [testLabelId, testTeamId, newName];
      const q = `UPDATE team_labels
                 SET ${updates.join(', ')}
                 WHERE id = $1
                   AND team_id = $2;`;
      await db.query(q, values);

      // Verify SQL update
      const sqlCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const sqlData = sqlCheckResult.rows[0];

      // Reset for Prisma test
      await db.query(
        'UPDATE team_labels SET name = $1 WHERE id = $2',
        ['Test Label for Update', testLabelId]
      );

      // Prisma implementation
      await labelsService.updateLabel({
        id: testLabelId,
        team_id: testTeamId,
        name: newName
      });

      // Verify Prisma update
      const prismaCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const prismaData = prismaCheckResult.rows[0];

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.name).toBe(newName);

      // Cleanup
      await db.query('DELETE FROM team_labels WHERE id = $1', [testLabelId]);
    });

    it('should update label color only (SQL/Prisma parity)', async () => {
      const newColor = '#FF00AA';

      // Create a test label for this test
      const testLabelResult = await db.query(
        `INSERT INTO team_labels (name, color_code, team_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Test Label Color Update', '#BBBBBB', testTeamId]
      );
      const testLabelId = testLabelResult.rows[0].id;

      // SQL implementation
      const updates = ['color_code = $3'];
      const values = [testLabelId, testTeamId, newColor];
      const q = `UPDATE team_labels
                 SET ${updates.join(', ')}
                 WHERE id = $1
                   AND team_id = $2;`;
      await db.query(q, values);

      // Verify SQL update
      const sqlCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const sqlData = sqlCheckResult.rows[0];

      // Reset for Prisma test
      await db.query(
        'UPDATE team_labels SET color_code = $1 WHERE id = $2',
        ['#BBBBBB', testLabelId]
      );

      // Prisma implementation
      await labelsService.updateLabel({
        id: testLabelId,
        team_id: testTeamId,
        color_code: newColor
      });

      // Verify Prisma update
      const prismaCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const prismaData = prismaCheckResult.rows[0];

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.color_code).toBe(newColor);

      // Cleanup
      await db.query('DELETE FROM team_labels WHERE id = $1', [testLabelId]);
    });

    it('should update both name and color (SQL/Prisma parity)', async () => {
      const newName = 'High Priority';
      const newColor = '#AA00FF';

      // Create a test label for this test
      const testLabelResult = await db.query(
        `INSERT INTO team_labels (name, color_code, team_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Test Label Both Update', '#CCCCCC', testTeamId]
      );
      const testLabelId = testLabelResult.rows[0].id;

      // SQL implementation
      const updates = ['name = $3', 'color_code = $4'];
      const values = [testLabelId, testTeamId, newName, newColor];
      const q = `UPDATE team_labels
                 SET ${updates.join(', ')}
                 WHERE id = $1
                   AND team_id = $2;`;
      await db.query(q, values);

      // Verify SQL update
      const sqlCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const sqlData = sqlCheckResult.rows[0];

      // Reset for Prisma test
      await db.query(
        'UPDATE team_labels SET name = $1, color_code = $2 WHERE id = $3',
        ['Test Label Both Update', '#CCCCCC', testLabelId]
      );

      // Prisma implementation
      await labelsService.updateLabel({
        id: testLabelId,
        team_id: testTeamId,
        name: newName,
        color_code: newColor
      });

      // Verify Prisma update
      const prismaCheckResult = await db.query(
        'SELECT name, color_code FROM team_labels WHERE id = $1',
        [testLabelId]
      );
      const prismaData = prismaCheckResult.rows[0];

      // Validate
      expect(prismaData).toEqual(sqlData);
      expect(prismaData.name).toBe(newName);
      expect(prismaData.color_code).toBe(newColor);

      // Cleanup
      await db.query('DELETE FROM team_labels WHERE id = $1', [testLabelId]);
    });

    it('should throw error when no fields to update', async () => {
      // Prisma implementation should throw error
      await expect(
        labelsService.updateLabel({
          id: testLabelId1,
          team_id: testTeamId
        })
      ).rejects.toThrow('No valid fields to update');
    });
  });

  describe('6. deleteLabel - Delete a label', () => {
    it('should delete label and cascade to task_labels (SQL/Prisma parity)', async () => {
      // Create test labels for deletion
      const sqlLabelResult = await db.query(
        `INSERT INTO team_labels (name, color_code, team_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['SQL Delete Test', '#111111', testTeamId]
      );
      const sqlLabelId = sqlLabelResult.rows[0].id;

      const prismaLabelResult = await db.query(
        `INSERT INTO team_labels (name, color_code, team_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Prisma Delete Test', '#222222', testTeamId]
      );
      const prismaLabelId = prismaLabelResult.rows[0].id;

      // Attach labels to tasks
      await db.query(
        `INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2), ($1, $3)`,
        [testTaskId, sqlLabelId, prismaLabelId]
      );

      // SQL Query (original implementation from labels-controller.ts:115-122)
      const q = `DELETE
                 FROM team_labels
                 WHERE id = $1
                   AND team_id = $2;`;
      await db.query(q, [sqlLabelId, testTeamId]);

      // Verify SQL deletion
      const sqlCheckResult = await db.query(
        'SELECT * FROM team_labels WHERE id = $1',
        [sqlLabelId]
      );
      expect(sqlCheckResult.rows.length).toBe(0);

      // Verify cascade deletion in task_labels
      const sqlCascadeCheck = await db.query(
        'SELECT * FROM task_labels WHERE label_id = $1',
        [sqlLabelId]
      );
      expect(sqlCascadeCheck.rows.length).toBe(0);

      // Prisma implementation
      await labelsService.deleteLabel({
        id: prismaLabelId,
        team_id: testTeamId
      });

      // Verify Prisma deletion
      const prismaCheckResult = await db.query(
        'SELECT * FROM team_labels WHERE id = $1',
        [prismaLabelId]
      );
      expect(prismaCheckResult.rows.length).toBe(0);

      // Verify cascade deletion in task_labels
      const prismaCascadeCheck = await db.query(
        'SELECT * FROM task_labels WHERE label_id = $1',
        [prismaLabelId]
      );
      expect(prismaCascadeCheck.rows.length).toBe(0);

      // Both should have identical behavior
      expect(sqlCheckResult.rows.length).toBe(prismaCheckResult.rows.length);
      expect(sqlCascadeCheck.rows.length).toBe(prismaCascadeCheck.rows.length);
    });
  });
});
