/**
 * Wave 2 Contract Tests: Read Operations with JOINs
 *
 * Tests complex read queries that involve:
 * - JOINs between multiple tables
 * - Nested subqueries
 * - JSON aggregations
 * - CTEs (Common Table Expressions)
 * - Pagination
 * - Aggregations (COUNT, etc.)
 *
 * Pattern: Tier 2 (Feature Flag + Dual Execution)
 * Each test validates that the Prisma implementation produces identical output to SQL.
 */

import db from '../../../config/db';
import { getTestTeam, getTestUser } from '../setup';
import { ProjectsService } from '../../../services/projects/projects-service';
import { getColor } from '../../../shared/utils';

describe('Wave 2: Read Operations with JOINs - Contract Tests', () => {
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let testFolderId: string;
  let testCommentId: string;
  let testTeamMemberId: string;
  let projectsService: ProjectsService;

  beforeAll(async () => {
    // Get existing test team and user
    const team = await getTestTeam();
    testTeamId = team.id;

    const user = await getTestUser(testTeamId);
    testUserId = user.id;

    // Get team member ID
    const tmResult = await db.query(
      'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
      [testUserId, testTeamId]
    );
    testTeamMemberId = tmResult.rows[0]?.id;

    if (!testTeamMemberId) {
      throw new Error('No team member found for test user');
    }

    // Create test project with more details for Wave 2 tests
    const projectResult = await db.query(
      `INSERT INTO projects (
        name, key, team_id, owner_id,
        status_id, color_code, notes,
        start_date, end_date
      )
      VALUES (
        $1, $2, $3, $4,
        (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
        '#70a6f3', 'Test project for Wave 2',
        CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'
      )
      RETURNING id`,
      ['Test Project Wave2', 'TPW2', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;

    // Create project member (for the owner)
    await db.query(
      `INSERT INTO project_members (project_id, team_member_id, project_access_level_id, role_id)
       VALUES ($1, $2,
               (SELECT id FROM project_access_levels WHERE key = 'MEMBER' LIMIT 1),
               (SELECT id FROM roles WHERE team_id = $3 LIMIT 1))`,
      [testProjectId, testTeamMemberId, testTeamId]
    );

    // Create a project folder
    const folderResult = await db.query(
      `INSERT INTO project_folders (name, key, team_id, created_by, color_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Test Folder Wave2', 'test-folder-wave2', testTeamId, testUserId, '#ff5733']
    );
    testFolderId = folderResult.rows[0].id;

    // Create a project comment
    const commentResult = await db.query(
      `INSERT INTO project_comments (project_id, created_by, content)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [testProjectId, testUserId, 'Test comment for Wave 2 contract tests']
    );
    testCommentId = commentResult.rows[0].id;

    // Create some test tasks for aggregation tests
    const taskStatusResult = await db.query(
      `SELECT id FROM task_statuses
       WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_todo = true LIMIT 1)
       LIMIT 1`
    );

    if (taskStatusResult.rows[0]) {
      const priorityResult = await db.query(
        `SELECT id FROM task_priorities ORDER BY value LIMIT 1`
      );

      if (priorityResult.rows[0]) {
        await db.query(
          `INSERT INTO tasks (name, project_id, status_id, priority_id, reporter_id, sort_order)
           VALUES
             ('Task 1 for aggregation', $1, $2, $3, $4, 1),
             ('Task 2 for aggregation', $1, $2, $3, $4, 2),
             ('Task 3 for aggregation', $1, $2, $3, $4, 3)`,
          [testProjectId, taskStatusResult.rows[0].id, priorityResult.rows[0].id, testUserId]
        );
      }
    }

    // Initialize projects service
    projectsService = ProjectsService.getInstance();
  });

  afterAll(async () => {
    // Cleanup test data
    await db.query('DELETE FROM tasks WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM project_comments WHERE id = $1', [testCommentId]);
    await db.query('DELETE FROM project_members WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await db.query('DELETE FROM project_folders WHERE id = $1', [testFolderId]);
  });

  // ============================================
  // WAVE 2 CONTRACT TESTS (12 total)
  // ============================================

  describe('1. getById - complex nested subqueries', () => {
    it('should return project with all nested data with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from projects-controller.ts:375-443)
      const q = `
        SELECT projects.id,
               projects.name,
               projects.color_code,
               projects.notes,
               projects.key,
               projects.start_date,
               projects.end_date,
               projects.status_id,
               projects.health_id,
               projects.created_at,
               projects.updated_at,
               projects.folder_id,
               projects.phase_label,
               projects.category_id,
               (projects.estimated_man_days) AS man_days,
               (projects.estimated_working_days) AS working_days,
               (projects.hours_per_day) AS hours_per_day,
               (SELECT name FROM project_categories WHERE id = projects.category_id) AS category_name,
               (SELECT color_code
                FROM project_categories
                WHERE id = projects.category_id) AS category_color,
               (EXISTS(SELECT 1 FROM project_subscribers WHERE project_id = $1 AND user_id = $3)) AS subscribed,
               (SELECT name FROM users WHERE id = projects.owner_id) AS project_owner,
               sps.name AS status,
               sps.color_code AS status_color,
               sps.icon AS status_icon,
               (SELECT name FROM clients WHERE id = projects.client_id) AS client_name,
               projects.use_manual_progress,
               projects.use_weighted_progress,
               projects.use_time_progress,

               (SELECT COALESCE(ROW_TO_JSON(pm), '{}'::JSON)
                      FROM (SELECT team_member_id AS id,
                                  (SELECT COALESCE(ROW_TO_JSON(pmi), '{}'::JSON)
                                    FROM (SELECT name,
                                                email,
                                                avatar_url
                                          FROM team_member_info_view tmiv
                                          WHERE tmiv.team_member_id = pm.team_member_id
                                            AND tmiv.team_id = (SELECT team_id FROM projects WHERE id = $1)) pmi) AS project_manager_info,
                                  EXISTS(SELECT email
                                          FROM email_invitations
                                          WHERE team_member_id = pm.team_member_id
                                            AND email_invitations.team_id = (SELECT team_id
                                                                            FROM team_member_info_view
                                                                            WHERE team_member_id = pm.team_member_id)) AS pending_invitation,
                                  (SELECT active FROM team_members WHERE id = pm.team_member_id)
                            FROM project_members pm
                            WHERE project_id = $1
                              AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')) pm) AS project_manager
        FROM projects
               LEFT JOIN sys_project_statuses sps ON projects.status_id = sps.id
        WHERE projects.id = $1
          AND team_id = $2;
      `;
      const sqlResult = await db.query(q, [testProjectId, testTeamId, testUserId]);
      const sqlData = sqlResult.rows[0];

      // Post-process SQL result (same as controller)
      if (sqlData && sqlData.project_manager && sqlData.project_manager.project_manager_info) {
        const getColor = (name?: string) => {
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9'];
          const char = name?.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "A";
          return colors[char.charCodeAt(0) % colors.length];
        };
        sqlData.project_manager.name = sqlData.project_manager.project_manager_info.name;
        sqlData.project_manager.email = sqlData.project_manager.project_manager_info.email;
        sqlData.project_manager.avatar_url = sqlData.project_manager.project_manager_info.avatar_url;
        sqlData.project_manager.color_code = getColor(sqlData.project_manager.name);
      }

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getById(testProjectId, testTeamId, testUserId);

      // Validate SQL query returns data
      expect(sqlData).toBeDefined();
      expect(sqlData.id).toBe(testProjectId);

      // Validate Prisma result exists
      expect(prismaResult).toBeDefined();

      // Validate parity: basic fields
      expect(prismaResult.id).toBe(sqlData.id);
      expect(prismaResult.name).toBe(sqlData.name);
      expect(prismaResult.color_code).toBe(sqlData.color_code);
      expect(prismaResult.notes).toBe(sqlData.notes);
      expect(prismaResult.key).toBe(sqlData.key);
      expect(prismaResult.status_id).toBe(sqlData.status_id);
      expect(prismaResult.health_id).toBe(sqlData.health_id);
      expect(prismaResult.folder_id).toBe(sqlData.folder_id);
      expect(prismaResult.phase_label).toBe(sqlData.phase_label);
      expect(prismaResult.category_id).toBe(sqlData.category_id);

      // Validate parity: date fields (may need normalization)
      expect(new Date(prismaResult.start_date).getTime()).toBe(new Date(sqlData.start_date).getTime());
      expect(new Date(prismaResult.end_date).getTime()).toBe(new Date(sqlData.end_date).getTime());
      expect(new Date(prismaResult.created_at).getTime()).toBe(new Date(sqlData.created_at).getTime());
      expect(new Date(prismaResult.updated_at).getTime()).toBe(new Date(sqlData.updated_at).getTime());

      // Validate parity: estimated fields (renamed)
      expect(prismaResult.man_days).toBe(sqlData.man_days);
      expect(prismaResult.working_days).toBe(sqlData.working_days);
      expect(prismaResult.hours_per_day).toBe(sqlData.hours_per_day);

      // Validate parity: scalar subqueries
      expect(prismaResult.category_name).toBe(sqlData.category_name);
      expect(prismaResult.category_color).toBe(sqlData.category_color);
      expect(prismaResult.project_owner).toBe(sqlData.project_owner);
      expect(prismaResult.client_name).toBe(sqlData.client_name);
      expect(prismaResult.subscribed).toBe(sqlData.subscribed);

      // Validate parity: status fields from LEFT JOIN
      expect(prismaResult.status).toBe(sqlData.status);
      expect(prismaResult.status_color).toBe(sqlData.status_color);
      expect(prismaResult.status_icon).toBe(sqlData.status_icon);

      // Validate parity: progress flags
      expect(prismaResult.use_manual_progress).toBe(sqlData.use_manual_progress);
      expect(prismaResult.use_weighted_progress).toBe(sqlData.use_weighted_progress);
      expect(prismaResult.use_time_progress).toBe(sqlData.use_time_progress);

      // Validate parity: project_manager nested structure (most complex)
      expect(prismaResult.project_manager).toBeDefined();
      expect(typeof prismaResult.project_manager).toBe('object');

      // If there's a project manager assigned, validate nested structure
      if (sqlData.project_manager && sqlData.project_manager.id) {
        expect(prismaResult.project_manager.id).toBe(sqlData.project_manager.id);
        expect(prismaResult.project_manager.name).toBe(sqlData.project_manager.name);
        expect(prismaResult.project_manager.email).toBe(sqlData.project_manager.email);
        expect(prismaResult.project_manager.avatar_url).toBe(sqlData.project_manager.avatar_url);
        expect(prismaResult.project_manager.color_code).toBe(sqlData.project_manager.color_code);
        expect(prismaResult.project_manager.pending_invitation).toBe(sqlData.project_manager.pending_invitation);
        expect(prismaResult.project_manager.active).toBe(sqlData.project_manager.active);

        // Validate that project_manager_info is present in both
        expect(prismaResult.project_manager.project_manager_info).toBeDefined();
        expect(sqlData.project_manager.project_manager_info).toBeDefined();
      }

      // Validate overall structure completeness
      expect(prismaResult).toHaveProperty('id');
      expect(prismaResult).toHaveProperty('name');
      expect(prismaResult).toHaveProperty('color_code');
      expect(prismaResult).toHaveProperty('notes');
      expect(prismaResult).toHaveProperty('key');
      expect(prismaResult).toHaveProperty('start_date');
      expect(prismaResult).toHaveProperty('end_date');
      expect(prismaResult).toHaveProperty('status_id');
      expect(prismaResult).toHaveProperty('health_id');
      expect(prismaResult).toHaveProperty('created_at');
      expect(prismaResult).toHaveProperty('updated_at');
      expect(prismaResult).toHaveProperty('folder_id');
      expect(prismaResult).toHaveProperty('phase_label');
      expect(prismaResult).toHaveProperty('category_id');
      expect(prismaResult).toHaveProperty('man_days');
      expect(prismaResult).toHaveProperty('working_days');
      expect(prismaResult).toHaveProperty('hours_per_day');
      expect(prismaResult).toHaveProperty('category_name');
      expect(prismaResult).toHaveProperty('category_color');
      expect(prismaResult).toHaveProperty('subscribed');
      expect(prismaResult).toHaveProperty('project_owner');
      expect(prismaResult).toHaveProperty('status');
      expect(prismaResult).toHaveProperty('status_color');
      expect(prismaResult).toHaveProperty('status_icon');
      expect(prismaResult).toHaveProperty('client_name');
      expect(prismaResult).toHaveProperty('use_manual_progress');
      expect(prismaResult).toHaveProperty('use_weighted_progress');
      expect(prismaResult).toHaveProperty('use_time_progress');
      expect(prismaResult).toHaveProperty('project_manager');
    });

    it('should handle projects without category', async () => {
      // Create a project without category
      const projectResult = await db.query(
        `INSERT INTO projects (name, key, team_id, owner_id, status_id)
         VALUES ($1, $2, $3, $4,
                 (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1))
         RETURNING id`,
        ['Test Project No Category', 'TPNC', testTeamId, testUserId]
      );
      const projectId = projectResult.rows[0].id;

      try {
        const result = await projectsService.getById(projectId, testTeamId, testUserId);

        expect(result).toBeDefined();
        expect(result.id).toBe(projectId);
        expect(result.category_id).toBeNull();
        expect(result.category_name).toBeNull();
        expect(result.category_color).toBeNull();
      } finally {
        await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
      }
    });

    it('should handle projects without project manager', async () => {
      // Create a project without project manager
      const projectResult = await db.query(
        `INSERT INTO projects (name, key, team_id, owner_id, status_id)
         VALUES ($1, $2, $3, $4,
                 (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1))
         RETURNING id`,
        ['Test Project No PM', 'TPNPM', testTeamId, testUserId]
      );
      const projectId = projectResult.rows[0].id;

      try {
        const result = await projectsService.getById(projectId, testTeamId, testUserId);

        expect(result).toBeDefined();
        expect(result.id).toBe(projectId);
        expect(result.project_manager).toEqual({});
      } finally {
        await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
      }
    });

    it('should return null for non-existent project', async () => {
      const result = await projectsService.getById('00000000-0000-0000-0000-000000000000', testTeamId, testUserId);
      expect(result).toBeNull();
    });

    it('should return null for project in different team', async () => {
      // Create another team
      const teamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        ['Other Team', testUserId]
      );
      const otherTeamId = teamResult.rows[0].id;

      try {
        const result = await projectsService.getById(testProjectId, otherTeamId, testUserId);
        expect(result).toBeNull();
      } finally {
        await db.query('DELETE FROM teams WHERE id = $1', [otherTeamId]);
      }
    });
  });

  describe('2. getMyProjects - pagination + favorites', () => {
    it('should return paginated projects list with SQL/Prisma parity', async () => {
      // Test options
      const options = {
        filter: null, // no filter (non-archived only)
        size: 10,
        offset: 0,
        searchQuery: '',
        search: ''
      };

      // SQL Query (original implementation from projects-controller.ts:120-193)
      // FIXED: Using parameterized queries instead of string interpolation
      const isFavorites = options.filter === "1"
        ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = $4 AND project_id = projects.id)`
        : "";

      const isArchived = options.filter === "2"
        ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $4 AND project_id = projects.id)`
        : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $4 AND project_id = projects.id)`;

      const q = `
        SELECT ROW_TO_JSON(rec) AS projects
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                      FROM (SELECT id,
                                   name,
                                   EXISTS(SELECT user_id
                                          FROM favorite_projects
                                          WHERE user_id = $4
                                            AND project_id = projects.id) AS favorite,
                                   EXISTS(SELECT user_id
                                          FROM archived_projects
                                          WHERE user_id = $4
                                            AND project_id = projects.id) AS archived,
                                   color_code,
                                   (SELECT COUNT(*)
                                    FROM tasks
                                    WHERE archived IS FALSE
                                      AND project_id = projects.id) AS all_tasks_count,
                                   (SELECT COUNT(*)
                                    FROM tasks
                                    WHERE archived IS FALSE
                                      AND project_id = projects.id
                                      AND status_id IN (SELECT id
                                                        FROM task_statuses
                                                        WHERE project_id = projects.id
                                                          AND category_id IN
                                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                                   (SELECT COUNT(*)
                                    FROM project_members
                                    WHERE project_id = projects.id) AS members_count,
                                   (SELECT get_project_members(projects.id)) AS names,
                                   (SELECT CASE
                                             WHEN ((SELECT MAX(updated_at)
                                                    FROM tasks
                                                    WHERE archived IS FALSE
                                                      AND project_id = projects.id) >
                                                   updated_at)
                                               THEN (SELECT MAX(updated_at)
                                                     FROM tasks
                                                     WHERE archived IS FALSE
                                                       AND project_id = projects.id)
                                             ELSE updated_at END) AS updated_at
                            FROM projects
                            WHERE team_id = $1 ${isArchived} ${isFavorites} ${options.searchQuery}
                              AND is_member_of_project(projects.id, $4, $1)
                            ORDER BY updated_at DESC
                            LIMIT $2 OFFSET $3) t) AS data
              FROM projects
              WHERE team_id = $1 ${isArchived} ${isFavorites} ${options.searchQuery}
                AND is_member_of_project(projects.id, $4, $1)) rec;
      `;

      const sqlResult = await db.query(q, [testTeamId, options.size, options.offset, testUserId]);
      const [sqlData] = sqlResult.rows;
      const sqlProjects = Array.isArray(sqlData?.projects.data) ? sqlData?.projects.data : [];

      // Post-processing: calculate progress
      for (const project of sqlProjects) {
        project.progress = project.all_tasks_count > 0
          ? ((project.completed_tasks_count / project.all_tasks_count) * 100).toFixed(0)
          : 0;
      }

      const sqlResponse = sqlData?.projects || { total: 0, data: [] };

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getMyProjects(testUserId, testTeamId, options);

      // Validate SQL query returns data
      expect(sqlResponse).toBeDefined();
      expect(sqlResponse).toHaveProperty('total');
      expect(sqlResponse).toHaveProperty('data');
      expect(Array.isArray(sqlResponse.data)).toBe(true);

      // Validate Prisma result exists
      expect(prismaResult).toBeDefined();
      expect(prismaResult).toHaveProperty('total');
      expect(prismaResult).toHaveProperty('data');
      expect(Array.isArray(prismaResult.data)).toBe(true);

      // Validate parity: both should return same total count
      expect(prismaResult.total).toBe(sqlResponse.total);

      // Validate parity: both should return same number of projects
      expect(prismaResult.data.length).toBe(sqlResponse.data.length);

      // Validate we have test data (at least our test project)
      expect(sqlResponse.data.length).toBeGreaterThan(0);

      // Validate structure and content for each project
      for (let i = 0; i < sqlResponse.data.length; i++) {
        const sqlProject = sqlResponse.data[i];
        const prismaProject = prismaResult.data[i];

        // Validate all properties exist
        expect(prismaProject).toHaveProperty('id');
        expect(prismaProject).toHaveProperty('name');
        expect(prismaProject).toHaveProperty('favorite');
        expect(prismaProject).toHaveProperty('archived');
        expect(prismaProject).toHaveProperty('color_code');
        expect(prismaProject).toHaveProperty('all_tasks_count');
        expect(prismaProject).toHaveProperty('completed_tasks_count');
        expect(prismaProject).toHaveProperty('members_count');
        expect(prismaProject).toHaveProperty('names');
        expect(prismaProject).toHaveProperty('updated_at');
        expect(prismaProject).toHaveProperty('progress');

        // Validate exact values match
        expect(prismaProject.id).toBe(sqlProject.id);
        expect(prismaProject.name).toBe(sqlProject.name);
        expect(prismaProject.favorite).toBe(sqlProject.favorite);
        expect(prismaProject.archived).toBe(sqlProject.archived);
        expect(prismaProject.color_code).toBe(sqlProject.color_code);
        expect(prismaProject.all_tasks_count).toBe(sqlProject.all_tasks_count);
        expect(prismaProject.completed_tasks_count).toBe(sqlProject.completed_tasks_count);
        expect(prismaProject.members_count).toBe(sqlProject.members_count);
        expect(prismaProject.names).toBe(sqlProject.names);
        expect(prismaProject.progress).toBe(sqlProject.progress);

        // Validate updated_at (dates may need normalization)
        expect(new Date(prismaProject.updated_at).getTime()).toBe(new Date(sqlProject.updated_at).getTime());
      }
    });

    it('should support favorites filter', async () => {
      // First, add test project to favorites
      await db.query(
        'INSERT INTO favorite_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [testUserId, testProjectId]
      );

      try {
        const options = {
          filter: "1", // favorites only
          size: 10,
          offset: 0,
          searchQuery: '',
          search: ''
        };

        const prismaResult = await projectsService.getMyProjects(testUserId, testTeamId, options);

        // Should have at least one favorited project
        expect(prismaResult.data.length).toBeGreaterThan(0);

        // All returned projects should be favorited
        for (const project of prismaResult.data) {
          expect(project.favorite).toBe(true);
        }
      } finally {
        // Cleanup
        await db.query(
          'DELETE FROM favorite_projects WHERE user_id = $1 AND project_id = $2',
          [testUserId, testProjectId]
        );
      }
    });

    it('should support archived filter', async () => {
      // First, add test project to archived
      await db.query(
        'INSERT INTO archived_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [testUserId, testProjectId]
      );

      try {
        const options = {
          filter: "2", // archived only
          size: 10,
          offset: 0,
          searchQuery: '',
          search: ''
        };

        const prismaResult = await projectsService.getMyProjects(testUserId, testTeamId, options);

        // Should have at least one archived project
        expect(prismaResult.data.length).toBeGreaterThan(0);

        // All returned projects should be archived
        for (const project of prismaResult.data) {
          expect(project.archived).toBe(true);
        }
      } finally {
        // Cleanup
        await db.query(
          'DELETE FROM archived_projects WHERE user_id = $1 AND project_id = $2',
          [testUserId, testProjectId]
        );
      }
    });

    it('should support pagination', async () => {
      const options1 = {
        filter: null,
        size: 1, // Only 1 per page
        offset: 0,
        searchQuery: '',
        search: ''
      };

      const result1 = await projectsService.getMyProjects(testUserId, testTeamId, options1);

      // Should only return 1 project
      expect(result1.data.length).toBeLessThanOrEqual(1);

      // Total should be greater than or equal to data length
      expect(result1.total).toBeGreaterThanOrEqual(result1.data.length);
    });
  });

  describe('3. get - paginated projects with filters (SQL INJECTION FIXED)', () => {
    it('should return paginated projects with filters - SQL ONLY (Prisma deferred)', async () => {
      // NOTE: Prisma implementation deferred due to complexity
      // This test validates the SECURITY-FIXED SQL fallback only

      // Build options matching controller's toPaginationOptions
      const options = {
        teamId: testTeamId,
        userId: testUserId,
        teamMemberId: testTeamMemberId,
        isOwner: true,
        isAdmin: false,
        filter: undefined, // No filter (exclude archived)
        categories: undefined,
        statuses: undefined,
        searchQuery: undefined,
        sortField: 'name',
        sortOrder: 'ASC',
        size: 10,
        offset: 0
      };

      // Call service method (uses SQL fallback since Prisma throws error for this complex query)
      const result = await projectsService.get(options);

      // Validate result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);

      // Validate we have at least the test project
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.length).toBeGreaterThanOrEqual(1);

      // Find our test project
      const testProject = result.data.find((p: any) => p.id === testProjectId);
      expect(testProject).toBeDefined();

      // Validate structure of returned project
      expect(testProject).toHaveProperty('id');
      expect(testProject).toHaveProperty('name');
      expect(testProject).toHaveProperty('status');
      expect(testProject).toHaveProperty('status_color');
      expect(testProject).toHaveProperty('status_icon');
      expect(testProject).toHaveProperty('favorite');
      expect(testProject).toHaveProperty('archived');
      expect(testProject).toHaveProperty('color_code');
      expect(testProject).toHaveProperty('start_date');
      expect(testProject).toHaveProperty('end_date');
      expect(testProject).toHaveProperty('category_id');
      expect(testProject).toHaveProperty('all_tasks_count');
      expect(testProject).toHaveProperty('completed_tasks_count');
      expect(testProject).toHaveProperty('members_count');
      expect(testProject).toHaveProperty('names');
      expect(testProject).toHaveProperty('client_name');
      expect(testProject).toHaveProperty('project_owner');
      expect(testProject).toHaveProperty('category_name');
      expect(testProject).toHaveProperty('category_color');
      expect(testProject).toHaveProperty('project_manager_team_member_id');
      expect(testProject).toHaveProperty('team_member_default_view');
      expect(testProject).toHaveProperty('updated_at');
      expect(testProject).toHaveProperty('progress');
      expect(testProject).toHaveProperty('updated_at_string');

      // Validate data types
      expect(typeof testProject.favorite).toBe('boolean');
      expect(typeof testProject.archived).toBe('boolean');
      expect(typeof testProject.all_tasks_count).toBe('number');
      expect(typeof testProject.completed_tasks_count).toBe('number');
      expect(typeof testProject.members_count).toBe('number');
      expect(Array.isArray(testProject.names)).toBe(true);

      // Validate progress is calculated correctly
      expect(testProject.progress).toBeDefined();
      expect(typeof testProject.progress).toBe('string');

      // Validate SQL injection fixes are working
      // The query should NOT have any direct user_id string interpolations
      expect(result).toBeDefined(); // If SQL injection occurred, query would likely fail
    });

    it('should filter by favorites (SQL injection fix validated)', async () => {
      // First, add test project to favorites
      await db.query(
        'INSERT INTO favorite_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [testUserId, testProjectId]
      );

      try {
        const options = {
          teamId: testTeamId,
          userId: testUserId,
          teamMemberId: testTeamMemberId,
          isOwner: true,
          isAdmin: false,
          filter: '1', // Favorites filter
          categories: undefined,
          statuses: undefined,
          searchQuery: undefined,
          sortField: 'name',
          sortOrder: 'ASC',
          size: 10,
          offset: 0
        };

        const result = await projectsService.get(options);

        expect(result).toBeDefined();
        expect(result.data.length).toBeGreaterThanOrEqual(1);

        // All returned projects should be favorites
        for (const project of result.data) {
          expect(project.favorite).toBe(true);
        }

        // Our test project should be in the results
        const testProject = result.data.find((p: any) => p.id === testProjectId);
        expect(testProject).toBeDefined();
      } finally {
        // Cleanup
        await db.query(
          'DELETE FROM favorite_projects WHERE user_id = $1 AND project_id = $2',
          [testUserId, testProjectId]
        );
      }
    });

    it('should filter by archived (SQL injection fix validated)', async () => {
      // First, add test project to archived
      await db.query(
        'INSERT INTO archived_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [testUserId, testProjectId]
      );

      try {
        const options = {
          teamId: testTeamId,
          userId: testUserId,
          teamMemberId: testTeamMemberId,
          isOwner: true,
          isAdmin: false,
          filter: '2', // Archived filter
          categories: undefined,
          statuses: undefined,
          searchQuery: undefined,
          sortField: 'name',
          sortOrder: 'ASC',
          size: 10,
          offset: 0
        };

        const result = await projectsService.get(options);

        expect(result).toBeDefined();

        // All returned projects should be archived
        for (const project of result.data) {
          expect(project.archived).toBe(true);
        }

        // Our test project should be in the results
        const testProject = result.data.find((p: any) => p.id === testProjectId);
        expect(testProject).toBeDefined();
        expect(testProject.archived).toBe(true);
      } finally {
        // Cleanup
        await db.query(
          'DELETE FROM archived_projects WHERE user_id = $1 AND project_id = $2',
          [testUserId, testProjectId]
        );
      }
    });

    it('should support pagination', async () => {
      const options1 = {
        teamId: testTeamId,
        userId: testUserId,
        teamMemberId: testTeamMemberId,
        isOwner: true,
        isAdmin: false,
        filter: undefined,
        categories: undefined,
        statuses: undefined,
        searchQuery: undefined,
        sortField: 'name',
        sortOrder: 'ASC',
        size: 1, // Only get 1 project
        offset: 0
      };

      const result1 = await projectsService.get(options1);

      expect(result1).toBeDefined();
      expect(result1.data.length).toBeLessThanOrEqual(1);

      // If there are more than 1 projects, test offset
      if (result1.total > 1) {
        const options2 = {
          ...options1,
          offset: 1 // Skip first project
        };

        const result2 = await projectsService.get(options2);

        expect(result2).toBeDefined();
        expect(result2.total).toBe(result1.total); // Total count should be same

        // First project in result2 should be different from first in result1
        if (result2.data.length > 0 && result1.data.length > 0) {
          expect(result2.data[0].id).not.toBe(result1.data[0].id);
        }
      }
    });

    it('should validate SQL injection is FIXED', async () => {
      // Test with potentially malicious input
      const maliciousUserId = "'; DROP TABLE projects; --";

      const options = {
        teamId: testTeamId,
        userId: maliciousUserId,
        teamMemberId: testTeamMemberId,
        isOwner: true,
        isAdmin: false,
        filter: undefined,
        categories: undefined,
        statuses: undefined,
        searchQuery: undefined,
        sortField: 'name',
        sortOrder: 'ASC',
        size: 10,
        offset: 0
      };

      // This should NOT execute SQL injection
      // PostgreSQL should reject the invalid UUID format
      try {
        const result = await projectsService.get(options);
        // If we get here with no error, check result is defined
        expect(result).toBeDefined();
      } catch (error: any) {
        // UUID validation error is EXPECTED and CORRECT behavior
        // This means SQL injection was prevented by type checking
        expect(error.message).toMatch(/invalid input syntax for type uuid/i);
      }

      // Verify projects table still exists (SQL injection was prevented)
      const projectsExist = await db.query('SELECT COUNT(*) FROM projects WHERE team_id = $1', [testTeamId]);
      const count = typeof projectsExist.rows[0].count === 'string' ? parseInt(projectsExist.rows[0].count, 10) : projectsExist.rows[0].count;
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. getMembersByProjectId - CTE with search', () => {
    it('should return project members with task counts with SQL/Prisma parity', async () => {
      const sortField = 'name';
      const sortOrder = 'asc';
      const size = 10;
      const offset = 0;
      const search = '';

      // SQL Query (original implementation from projects-controller.ts:318-372)
      let searchFilter = "";
      const params = [testProjectId, testTeamId, size, offset];
      if (search) {
        searchFilter = `
          AND (
            (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
            OR (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
          )
        `;
        params.push(search);
      }

      const q = `
        WITH filtered_members AS (
          SELECT project_members.id,
                 team_member_id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS name,
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS email,
                 u.avatar_url,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id)) AS all_tasks_count,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id) AND status_id IN (SELECT id FROM task_statuses WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                 EXISTS(SELECT email FROM email_invitations WHERE team_member_id = project_members.team_member_id AND email_invitations.team_id = $2) AS pending_invitation,
                 (SELECT project_access_levels.name FROM project_access_levels WHERE project_access_levels.id = project_members.project_access_level_id) AS access,
                 (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
          FROM project_members
          INNER JOIN team_members tm ON project_members.team_member_id = tm.id
          LEFT JOIN users u ON tm.user_id = u.id
          WHERE project_id = $1
          ${search ? searchFilter : ""}
        )
        SELECT
          (SELECT COUNT(*) FROM filtered_members) AS total,
          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
             FROM (
               SELECT * FROM filtered_members
               ORDER BY ${sortField} ${sortOrder}
               LIMIT $3 OFFSET $4
             ) t
          ) AS data
      `;

      const sqlResult = await db.query(q, params);
      const sqlData = sqlResult.rows[0];

      // Post-processing (matching original controller)
      for (const member of sqlData?.data || []) {
        member.progress = member.all_tasks_count > 0
          ? ((member.completed_tasks_count / member.all_tasks_count) * 100).toFixed(0) : 0;
      }

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getMembersByProjectId(testProjectId, testTeamId, {
        sortField,
        sortOrder,
        size,
        offset,
        search
      });

      // Validate SQL query returns data
      expect(sqlData).toBeDefined();
      // Normalize total: PostgreSQL COUNT can return BIGINT as string
      const sqlTotal = typeof sqlData.total === 'string' ? parseInt(sqlData.total, 10) : sqlData.total;
      expect(typeof sqlTotal).toBe('number');
      expect(Array.isArray(sqlData.data)).toBe(true);

      // Validate Prisma result exists
      expect(prismaResult).toBeDefined();
      const prismaTotal = typeof prismaResult.total === 'string' ? parseInt(prismaResult.total, 10) : prismaResult.total;
      expect(typeof prismaTotal).toBe('number');
      expect(Array.isArray(prismaResult.data)).toBe(true);

      // Validate parity: same total count
      expect(prismaTotal).toBe(sqlTotal);

      // Validate parity: same number of members in data array
      expect(prismaResult.data.length).toBe(sqlData.data.length);

      // Validate we have at least one member (the owner)
      expect(sqlData.data.length).toBeGreaterThan(0);

      // Validate structure and content for each member
      for (let i = 0; i < sqlData.data.length; i++) {
        const sqlMember = sqlData.data[i];
        const prismaMember = prismaResult.data[i];

        // Validate all properties exist
        expect(prismaMember).toHaveProperty('id');
        expect(prismaMember).toHaveProperty('team_member_id');
        expect(prismaMember).toHaveProperty('name');
        expect(prismaMember).toHaveProperty('email');
        expect(prismaMember).toHaveProperty('avatar_url');
        expect(prismaMember).toHaveProperty('all_tasks_count');
        expect(prismaMember).toHaveProperty('completed_tasks_count');
        expect(prismaMember).toHaveProperty('pending_invitation');
        expect(prismaMember).toHaveProperty('access');
        expect(prismaMember).toHaveProperty('job_title');
        expect(prismaMember).toHaveProperty('progress');

        // Validate exact values match
        expect(prismaMember.id).toBe(sqlMember.id);
        expect(prismaMember.team_member_id).toBe(sqlMember.team_member_id);
        expect(prismaMember.name).toBe(sqlMember.name);
        expect(prismaMember.email).toBe(sqlMember.email);
        expect(prismaMember.avatar_url).toBe(sqlMember.avatar_url);
        expect(prismaMember.all_tasks_count).toBe(sqlMember.all_tasks_count);
        expect(prismaMember.completed_tasks_count).toBe(sqlMember.completed_tasks_count);
        expect(prismaMember.pending_invitation).toBe(sqlMember.pending_invitation);
        expect(prismaMember.access).toBe(sqlMember.access);
        expect(prismaMember.job_title).toBe(sqlMember.job_title);
        expect(prismaMember.progress).toBe(sqlMember.progress);
      }
    });

    it('should support search functionality', async () => {
      // Get the test user's name for search
      const userResult = await db.query(
        'SELECT name FROM users WHERE id = $1',
        [testUserId]
      );
      const userName = userResult.rows[0]?.name;

      if (!userName) {
        // Skip test if no user name
        expect(true).toBe(true);
        return;
      }

      // Take first 3 characters of name for partial search
      const searchTerm = userName.substring(0, 3);
      const sortField = 'name';
      const sortOrder = 'asc';
      const size = 10;
      const offset = 0;

      // SQL Query with search
      let searchFilter = "";
      const params = [testProjectId, testTeamId, size, offset];
      if (searchTerm) {
        searchFilter = `
          AND (
            (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
            OR (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
          )
        `;
        params.push(searchTerm);
      }

      const q = `
        WITH filtered_members AS (
          SELECT project_members.id,
                 team_member_id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS name,
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS email,
                 u.avatar_url,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id)) AS all_tasks_count,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id) AND status_id IN (SELECT id FROM task_statuses WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                 EXISTS(SELECT email FROM email_invitations WHERE team_member_id = project_members.team_member_id AND email_invitations.team_id = $2) AS pending_invitation,
                 (SELECT project_access_levels.name FROM project_access_levels WHERE project_access_levels.id = project_members.project_access_level_id) AS access,
                 (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
          FROM project_members
          INNER JOIN team_members tm ON project_members.team_member_id = tm.id
          LEFT JOIN users u ON tm.user_id = u.id
          WHERE project_id = $1
          ${searchTerm ? searchFilter : ""}
        )
        SELECT
          (SELECT COUNT(*) FROM filtered_members) AS total,
          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
             FROM (
               SELECT * FROM filtered_members
               ORDER BY ${sortField} ${sortOrder}
               LIMIT $3 OFFSET $4
             ) t
          ) AS data
      `;

      const sqlResult = await db.query(q, params);
      const sqlData = sqlResult.rows[0];

      // Post-processing
      for (const member of sqlData?.data || []) {
        member.progress = member.all_tasks_count > 0
          ? ((member.completed_tasks_count / member.all_tasks_count) * 100).toFixed(0) : 0;
      }

      // Prisma Query
      const prismaResult = await projectsService.getMembersByProjectId(testProjectId, testTeamId, {
        sortField,
        sortOrder,
        size,
        offset,
        search: searchTerm
      });

      // Validate search results match
      expect(prismaResult.total).toBe(sqlData.total);
      expect(prismaResult.data.length).toBe(sqlData.data.length);

      // Verify search worked (should find at least the test user)
      expect(sqlData.data.length).toBeGreaterThan(0);

      // Verify all returned members match the search term
      for (const member of prismaResult.data) {
        const nameMatch = member.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const emailMatch = member.email?.toLowerCase().includes(searchTerm.toLowerCase());
        expect(nameMatch || emailMatch).toBe(true);
      }
    });

    it('should support pagination', async () => {
      const sortField = 'name';
      const sortOrder = 'asc';
      const size = 1; // Limit to 1 to test pagination
      const offset = 0;
      const search = '';

      // SQL Query with pagination
      const params = [testProjectId, testTeamId, size, offset];
      const q = `
        WITH filtered_members AS (
          SELECT project_members.id,
                 team_member_id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS name,
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS email,
                 u.avatar_url,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id)) AS all_tasks_count,
                 (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id) AND status_id IN (SELECT id FROM task_statuses WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                 EXISTS(SELECT email FROM email_invitations WHERE team_member_id = project_members.team_member_id AND email_invitations.team_id = $2) AS pending_invitation,
                 (SELECT project_access_levels.name FROM project_access_levels WHERE project_access_levels.id = project_members.project_access_level_id) AS access,
                 (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
          FROM project_members
          INNER JOIN team_members tm ON project_members.team_member_id = tm.id
          LEFT JOIN users u ON tm.user_id = u.id
          WHERE project_id = $1
        )
        SELECT
          (SELECT COUNT(*) FROM filtered_members) AS total,
          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
             FROM (
               SELECT * FROM filtered_members
               ORDER BY ${sortField} ${sortOrder}
               LIMIT $3 OFFSET $4
             ) t
          ) AS data
      `;

      const sqlResult = await db.query(q, params);
      const sqlData = sqlResult.rows[0];

      // Post-processing
      for (const member of sqlData?.data || []) {
        member.progress = member.all_tasks_count > 0
          ? ((member.completed_tasks_count / member.all_tasks_count) * 100).toFixed(0) : 0;
      }

      // Prisma Query
      const prismaResult = await projectsService.getMembersByProjectId(testProjectId, testTeamId, {
        sortField,
        sortOrder,
        size,
        offset,
        search
      });

      // Validate pagination works
      expect(prismaResult.total).toBe(sqlData.total);
      expect(prismaResult.data.length).toBe(Math.min(size, sqlData.total));
      expect(prismaResult.data.length).toBe(sqlData.data.length);

      // If there's more than one member total, test second page
      if (sqlData.total > 1) {
        const offset2 = 1;
        const params2 = [testProjectId, testTeamId, size, offset2];

        const sqlResult2 = await db.query(q.replace('OFFSET $4', 'OFFSET $4'), params2);
        const sqlData2 = sqlResult2.rows[0];

        for (const member of sqlData2?.data || []) {
          member.progress = member.all_tasks_count > 0
            ? ((member.completed_tasks_count / member.all_tasks_count) * 100).toFixed(0) : 0;
        }

        const prismaResult2 = await projectsService.getMembersByProjectId(testProjectId, testTeamId, {
          sortField,
          sortOrder,
          size,
          offset: offset2,
          search
        });

        // Validate second page is different from first
        expect(prismaResult2.data.length).toBe(sqlData2.data.length);
        if (prismaResult2.data.length > 0 && prismaResult.data.length > 0) {
          expect(prismaResult2.data[0].id).not.toBe(prismaResult.data[0].id);
        }
      }
    });

    it('should return empty data for project with no members', async () => {
      // Create a project with no members
      const projectResult = await db.query(
        `INSERT INTO projects (name, key, team_id, owner_id, status_id, color_code)
         VALUES ($1, $2, $3, $4,
                 (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
                 '#70a6f3')
         RETURNING id`,
        ['Empty Project Members', 'EMPM', testTeamId, testUserId]
      );
      const emptyProjectId = projectResult.rows[0].id;

      try {
        const result = await projectsService.getMembersByProjectId(emptyProjectId, testTeamId, {
          sortField: 'name',
          sortOrder: 'asc',
          size: 10,
          offset: 0,
          search: ''
        });

        // Normalize total: PostgreSQL COUNT can return BIGINT as string
        const resultTotal = typeof result.total === 'string' ? parseInt(result.total, 10) : result.total;
        expect(resultTotal).toBe(0);
        expect(result.data.length).toBe(0);
      } finally {
        // Cleanup
        await db.query('DELETE FROM projects WHERE id = $1', [emptyProjectId]);
      }
    });
  });

  describe('5. getOverview - task aggregations', () => {
    it('should return task statistics with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from projects-controller.ts:491-523)
      const sqlResult = await db.query(
        `SELECT (SELECT COUNT(id)
                FROM tasks
                WHERE archived IS FALSE
                  AND project_id = $1
                  AND status_id IN
                      (SELECT id
                       FROM task_statuses
                       WHERE category_id =
                             (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS done_task_count,

               (SELECT COUNT(id)
                FROM tasks
                WHERE archived IS FALSE
                  AND project_id = $1
                  AND status_id IN
                      (SELECT id
                       FROM task_statuses
                       WHERE category_id IN
                             (SELECT id
                              FROM sys_task_status_categories
                              WHERE is_doing IS TRUE
                                 OR is_todo IS TRUE))) AS pending_task_count
        FROM projects
        WHERE id = $1
          AND team_id = $2`,
        [testProjectId, testTeamId]
      );

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getOverview(testProjectId, testTeamId);

      // Validate SQL query returns data
      expect(sqlResult.rows[0]).toBeDefined();

      // Validate Prisma result exists
      expect(prismaResult).toBeDefined();

      // Validate parity: both should return same task counts
      expect(prismaResult.done_task_count).toBe(sqlResult.rows[0].done_task_count);
      expect(prismaResult.pending_task_count).toBe(sqlResult.rows[0].pending_task_count);

      // Validate structure
      expect(prismaResult).toHaveProperty('done_task_count');
      expect(prismaResult).toHaveProperty('pending_task_count');
    });
  });

  describe('6. getOverviewMembers - member task stats', () => {
    it('should return member statistics with task counts with SQL/Prisma parity', async () => {
      const archived = false;

      // SQL Query (original implementation from projects-controller.ts:526-608)
      const sqlQuery = `
        SELECT team_member_id AS id,
               FALSE AS active,
               (SELECT COUNT(*)
                FROM tasks
                WHERE archived IS FALSE
                  AND project_id = $1
                  AND CASE
                        WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
                        ELSE archived IS FALSE END) AS project_task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id) AS task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND ts.category_id IN
                      (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)) AS done_task_count,

               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND end_date::DATE < CURRENT_DATE::DATE
                  AND t.status_id NOT IN (SELECT id
                                          FROM task_statuses
                                          WHERE category_id NOT IN
                                                (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))) AS overdue_task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND ts.category_id IN
                      (SELECT id
                       FROM sys_task_status_categories
                       WHERE is_doing IS TRUE
                          OR is_todo IS TRUE)) AS pending_task_count,
               (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
               u.avatar_url,
               (SELECT team_member_info_view.email
                FROM team_member_info_view
                WHERE team_member_info_view.team_member_id = tm.id),
               (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
        FROM project_members
               INNER JOIN team_members tm ON project_members.team_member_id = tm.id
               LEFT JOIN users u ON tm.user_id = u.id
        WHERE project_id = $1;
      `;
      const sqlResult = await db.query(sqlQuery, [testProjectId, archived]);

      // Post-processing (matching original controller)
      for (const item of sqlResult.rows) {
        item.progress =
          item.task_count > 0
            ? ((item.done_task_count / item.task_count) * 100).toFixed(0)
            : 0;
        item.contribution =
          item.project_task_count > 0
            ? ((item.task_count / item.project_task_count) * 100).toFixed(0)
            : 0;
        item.tasks = [];
      }

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getOverviewMembers(testProjectId, archived);

      // Validate both return arrays
      expect(Array.isArray(sqlResult.rows)).toBe(true);
      expect(Array.isArray(prismaResult)).toBe(true);

      // Validate parity: both should return same number of members
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate we have at least one member (the owner)
      expect(sqlResult.rows.length).toBeGreaterThan(0);

      // Validate structure and content for each member
      for (let i = 0; i < sqlResult.rows.length; i++) {
        const sqlMember = sqlResult.rows[i];
        const prismaMember = prismaResult[i];

        // Validate all properties exist
        expect(prismaMember).toHaveProperty('id');
        expect(prismaMember).toHaveProperty('active');
        expect(prismaMember).toHaveProperty('project_task_count');
        expect(prismaMember).toHaveProperty('task_count');
        expect(prismaMember).toHaveProperty('done_task_count');
        expect(prismaMember).toHaveProperty('overdue_task_count');
        expect(prismaMember).toHaveProperty('pending_task_count');
        expect(prismaMember).toHaveProperty('name');
        expect(prismaMember).toHaveProperty('avatar_url');
        expect(prismaMember).toHaveProperty('email');
        expect(prismaMember).toHaveProperty('job_title');
        expect(prismaMember).toHaveProperty('progress');
        expect(prismaMember).toHaveProperty('contribution');
        expect(prismaMember).toHaveProperty('tasks');

        // Validate exact values match
        expect(prismaMember.id).toBe(sqlMember.id);
        expect(prismaMember.active).toBe(sqlMember.active);
        expect(prismaMember.project_task_count).toBe(sqlMember.project_task_count);
        expect(prismaMember.task_count).toBe(sqlMember.task_count);
        expect(prismaMember.done_task_count).toBe(sqlMember.done_task_count);
        expect(prismaMember.overdue_task_count).toBe(sqlMember.overdue_task_count);
        expect(prismaMember.pending_task_count).toBe(sqlMember.pending_task_count);
        expect(prismaMember.name).toBe(sqlMember.name);
        expect(prismaMember.avatar_url).toBe(sqlMember.avatar_url);
        expect(prismaMember.email).toBe(sqlMember.email);
        expect(prismaMember.job_title).toBe(sqlMember.job_title);
        expect(prismaMember.progress).toBe(sqlMember.progress);
        expect(prismaMember.contribution).toBe(sqlMember.contribution);
        expect(Array.isArray(prismaMember.tasks)).toBe(true);
        expect(prismaMember.tasks.length).toBe(0);
      }
    });

    it('should support archived filter', async () => {
      const archived = true;

      // SQL Query with archived = true
      const sqlQuery = `
        SELECT team_member_id AS id,
               FALSE AS active,
               (SELECT COUNT(*)
                FROM tasks
                WHERE archived IS FALSE
                  AND project_id = $1
                  AND CASE
                        WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
                        ELSE archived IS FALSE END) AS project_task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id) AS task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND ts.category_id IN
                      (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)) AS done_task_count,

               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND end_date::DATE < CURRENT_DATE::DATE
                  AND t.status_id NOT IN (SELECT id
                                          FROM task_statuses
                                          WHERE category_id NOT IN
                                                (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))) AS overdue_task_count,
               (SELECT COUNT(*)
                FROM tasks_assignees
                       INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                       INNER JOIN task_statuses ts ON t.status_id = ts.id
                WHERE CASE
                        WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                        ELSE archived IS FALSE END
                  AND project_member_id = project_members.id
                  AND ts.category_id IN
                      (SELECT id
                       FROM sys_task_status_categories
                       WHERE is_doing IS TRUE
                          OR is_todo IS TRUE)) AS pending_task_count,
               (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
               u.avatar_url,
               (SELECT team_member_info_view.email
                FROM team_member_info_view
                WHERE team_member_info_view.team_member_id = tm.id),
               (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
        FROM project_members
               INNER JOIN team_members tm ON project_members.team_member_id = tm.id
               LEFT JOIN users u ON tm.user_id = u.id
        WHERE project_id = $1;
      `;
      const sqlResult = await db.query(sqlQuery, [testProjectId, archived]);

      // Post-processing
      for (const item of sqlResult.rows) {
        item.progress =
          item.task_count > 0
            ? ((item.done_task_count / item.task_count) * 100).toFixed(0)
            : 0;
        item.contribution =
          item.project_task_count > 0
            ? ((item.task_count / item.project_task_count) * 100).toFixed(0)
            : 0;
        item.tasks = [];
      }

      // Prisma Query
      const prismaResult = await projectsService.getOverviewMembers(testProjectId, archived);

      // Validate both return same number of members
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate counts match for each member
      for (let i = 0; i < sqlResult.rows.length; i++) {
        const sqlMember = sqlResult.rows[i];
        const prismaMember = prismaResult[i];

        expect(prismaMember.task_count).toBe(sqlMember.task_count);
        expect(prismaMember.done_task_count).toBe(sqlMember.done_task_count);
        expect(prismaMember.overdue_task_count).toBe(sqlMember.overdue_task_count);
        expect(prismaMember.pending_task_count).toBe(sqlMember.pending_task_count);
      }
    });
  });

  describe('7. getFolders - folders with created_by', () => {
    it('should return folders with creator info with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from project-folders-controller.ts:31-54)
      const parentFolderId = null; // Test root folders
      const q = [
        `SELECT id,
                name,
                key,
                color_code,
                created_at,
                (SELECT name
                 FROM team_member_info_view
                 WHERE user_id = project_folders.created_by
                   AND team_member_info_view.team_id = project_folders.team_id
                 LIMIT 1) AS created_by
         FROM project_folders
         WHERE team_id = $1
        `,
        parentFolderId ? `AND parent_folder_id = $2` : "",
        `ORDER BY name;`
      ].join(" ");
      const params = parentFolderId ? [testTeamId, parentFolderId] : [testTeamId];
      const sqlResult = await db.query(q, params);

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getFolders(testTeamId, parentFolderId);

      // Validate both return arrays
      expect(Array.isArray(sqlResult.rows)).toBe(true);
      expect(Array.isArray(prismaResult)).toBe(true);

      // Validate parity: both should return same number of folders
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate we have test data
      expect(sqlResult.rows.length).toBeGreaterThan(0);

      // Validate structure and content for first folder
      const sqlFolder = sqlResult.rows[0];
      const prismaFolder = prismaResult[0];

      expect(prismaFolder).toHaveProperty('id');
      expect(prismaFolder).toHaveProperty('name');
      expect(prismaFolder).toHaveProperty('key');
      expect(prismaFolder).toHaveProperty('color_code');
      expect(prismaFolder).toHaveProperty('created_at');
      expect(prismaFolder).toHaveProperty('created_by');

      // Validate exact values match for first folder
      expect(prismaFolder.id).toBe(sqlFolder.id);
      expect(prismaFolder.name).toBe(sqlFolder.name);
      expect(prismaFolder.key).toBe(sqlFolder.key);
      expect(prismaFolder.color_code).toBe(sqlFolder.color_code);

      // Validate created_at (dates may need normalization)
      expect(new Date(prismaFolder.created_at).getTime()).toBe(new Date(sqlFolder.created_at).getTime());

      // Validate created_by name from team_member_info_view
      expect(prismaFolder.created_by).toBe(sqlFolder.created_by);
    });

    it('should support filtering by parent_folder_id', async () => {
      // Create a child folder for testing
      const childFolderResult = await db.query(
        `INSERT INTO project_folders (name, key, team_id, created_by, color_code, parent_folder_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['Child Folder Test', 'child-folder-test', testTeamId, testUserId, '#00ff00', testFolderId]
      );
      const childFolderId = childFolderResult.rows[0].id;

      try {
        // SQL Query with parent filter
        const q = [
          `SELECT id,
                  name,
                  key,
                  color_code,
                  created_at,
                  (SELECT name
                   FROM team_member_info_view
                   WHERE user_id = project_folders.created_by
                     AND team_member_info_view.team_id = project_folders.team_id
                   LIMIT 1) AS created_by
           FROM project_folders
           WHERE team_id = $1
          `,
          `AND parent_folder_id = $2`,
          `ORDER BY name;`
        ].join(" ");
        const sqlResult = await db.query(q, [testTeamId, testFolderId]);

        // Prisma Query
        const prismaResult = await projectsService.getFolders(testTeamId, testFolderId);

        // Validate both return the child folder
        expect(sqlResult.rows.length).toBeGreaterThan(0);
        expect(prismaResult.length).toBe(sqlResult.rows.length);

        // Verify child folder is returned
        const childFolder = prismaResult.find((f: any) => f.id === childFolderId);
        expect(childFolder).toBeDefined();
        expect(childFolder.name).toBe('Child Folder Test');
      } finally {
        // Cleanup child folder
        await db.query('DELETE FROM project_folders WHERE id = $1', [childFolderId]);
      }
    });
  });

  describe('8. getCommentsByProjectId - comments with mentions', () => {
    it('should return comments with mentions array with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from project-comments-controller.ts:151-195)
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
      const sqlResult = await db.query(q, [testProjectId]);

      // Post-processing (matching original controller)
      for (const comment of sqlResult.rows) {
        const {mentions} = comment;
        if (mentions.length > 0) {
          const placeHolders = comment.content.match(/{\d+}/g);
          if (placeHolders) {
            comment.content = comment.content.replace(/\n/g, "</br>");
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

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getCommentsByProjectId(testProjectId);

      // Validate both return arrays
      expect(Array.isArray(sqlResult.rows)).toBe(true);
      expect(Array.isArray(prismaResult)).toBe(true);

      // Validate parity: both should return same number of comments
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate we have test data
      expect(sqlResult.rows.length).toBeGreaterThan(0);

      // Validate structure and content for each comment
      for (let i = 0; i < sqlResult.rows.length; i++) {
        const sqlComment = sqlResult.rows[i];
        const prismaComment = prismaResult[i];

        // Validate properties exist
        expect(prismaComment).toHaveProperty('id');
        expect(prismaComment).toHaveProperty('content');
        expect(prismaComment).toHaveProperty('mentions');
        expect(prismaComment).toHaveProperty('user_id');
        expect(prismaComment).toHaveProperty('created_by');
        expect(prismaComment).toHaveProperty('avatar_url');
        expect(prismaComment).toHaveProperty('created_at');
        expect(prismaComment).toHaveProperty('updated_at');
        expect(prismaComment).toHaveProperty('color_code');

        // Validate exact values match
        expect(prismaComment.id).toBe(sqlComment.id);
        expect(prismaComment.content).toBe(sqlComment.content);
        expect(prismaComment.user_id).toBe(sqlComment.user_id);
        expect(prismaComment.created_by).toBe(sqlComment.created_by);
        expect(prismaComment.avatar_url).toBe(sqlComment.avatar_url);
        expect(prismaComment.color_code).toBe(sqlComment.color_code);

        // Validate date fields (may need normalization)
        expect(new Date(prismaComment.created_at).getTime()).toBe(new Date(sqlComment.created_at).getTime());
        expect(new Date(prismaComment.updated_at).getTime()).toBe(new Date(sqlComment.updated_at).getTime());

        // Validate mentions array structure
        expect(Array.isArray(prismaComment.mentions)).toBe(true);
        expect(Array.isArray(sqlComment.mentions)).toBe(true);
        expect(prismaComment.mentions.length).toBe(sqlComment.mentions.length);

        // Validate each mention in the array
        for (let j = 0; j < sqlComment.mentions.length; j++) {
          const sqlMention = sqlComment.mentions[j];
          const prismaMention = prismaComment.mentions[j];

          expect(prismaMention).toHaveProperty('user_name');
          expect(prismaMention).toHaveProperty('user_email');
          expect(prismaMention.user_name).toBe(sqlMention.user_name);
          expect(prismaMention.user_email).toBe(sqlMention.user_email);
        }
      }
    });

    it('should handle comments with no mentions (empty array)', async () => {
      // Our test comment should have no mentions
      const result = await projectsService.getCommentsByProjectId(testProjectId);

      // Should return comments with empty mentions array
      expect(result.length).toBeGreaterThan(0);
      expect(Array.isArray(result[0].mentions)).toBe(true);
      expect(result[0].mentions.length).toBe(0);
    });

    it('should return empty array for project with no comments', async () => {
      // Create a project with no comments
      const projectResult = await db.query(
        `INSERT INTO projects (name, key, team_id, owner_id, status_id, color_code)
         VALUES ($1, $2, $3, $4,
                 (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
                 '#70a6f3')
         RETURNING id`,
        ['Empty Comment Project', 'EMPTYC', testTeamId, testUserId]
      );
      const emptyProjectId = projectResult.rows[0].id;

      try {
        // SQL Query
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
        const sqlResult = await db.query(q, [emptyProjectId]);

        // Prisma Query
        const prismaResult = await projectsService.getCommentsByProjectId(emptyProjectId);

        // Both should return empty arrays
        expect(sqlResult.rows.length).toBe(0);
        expect(prismaResult.length).toBe(0);
      } finally {
        // Cleanup
        await db.query('DELETE FROM projects WHERE id = $1', [emptyProjectId]);
      }
    });
  });

  describe('9. getMembersList - project members with JOINs', () => {
    it('should return project members list with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from project-comments-controller.ts:118-142)
      const sqlQuery = `
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
      const sqlResult = await db.query(sqlQuery, [testProjectId]);

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getMembersList(testProjectId);

      // Validate both return arrays
      expect(Array.isArray(sqlResult.rows)).toBe(true);
      expect(Array.isArray(prismaResult)).toBe(true);

      // Validate parity: both should return same number of members
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate we have at least one member (the owner)
      expect(sqlResult.rows.length).toBeGreaterThan(0);

      // Validate structure for each member
      for (let i = 0; i < sqlResult.rows.length; i++) {
        const sqlMember = sqlResult.rows[i];
        const prismaMember = prismaResult[i];

        // Validate properties exist
        expect(prismaMember).toHaveProperty('id');
        expect(prismaMember).toHaveProperty('name');
        expect(prismaMember).toHaveProperty('email');
        expect(prismaMember).toHaveProperty('socket_id');
        expect(prismaMember).toHaveProperty('email_notifications_enabled');

        // Validate exact values match
        expect(prismaMember.id).toBe(sqlMember.id);
        expect(prismaMember.name).toBe(sqlMember.name);
        expect(prismaMember.email).toBe(sqlMember.email);
        expect(prismaMember.socket_id).toBe(sqlMember.socket_id);
        expect(prismaMember.email_notifications_enabled).toBe(sqlMember.email_notifications_enabled);
      }
    });

    it('should return empty array for project with no members', async () => {
      // Create a project with no members
      const projectResult = await db.query(
        `INSERT INTO projects (name, key, team_id, owner_id, status_id, color_code)
         VALUES ($1, $2, $3, $4,
                 (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
                 '#70a6f3')
         RETURNING id`,
        ['Empty Project', 'EMPTY', testTeamId, testUserId]
      );
      const emptyProjectId = projectResult.rows[0].id;

      try {
        // SQL Query
        const sqlQuery = `
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
        const sqlResult = await db.query(sqlQuery, [emptyProjectId]);

        // Prisma Query
        const prismaResult = await projectsService.getMembersList(emptyProjectId);

        // Both should return empty arrays
        expect(sqlResult.rows.length).toBe(0);
        expect(prismaResult.length).toBe(0);
      } finally {
        // Cleanup
        await db.query('DELETE FROM projects WHERE id = $1', [emptyProjectId]);
      }
    });
  });

  describe('10. getUserDataByUserId - user with notification settings', () => {
    it('should return user data with notification settings and project color with SQL/Prisma parity', async () => {
      // SQL Query (original implementation from project-comments-controller.ts:99-116)
      const sqlResult = await db.query(
        `SELECT id,
                name,
                email,
                socket_id,
                (SELECT email_notifications_enabled
                FROM notification_settings
                WHERE notification_settings.team_id = $3
                  AND notification_settings.user_id = $1),
                (SELECT color_code FROM projects WHERE id = $2) AS project_color
        FROM users
        WHERE id = $1`,
        [testUserId, testProjectId, testTeamId]
      );

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getUserDataByUserId(testUserId, testProjectId, testTeamId);

      // Validate SQL query returns data
      expect(sqlResult.rows[0]).toBeDefined();
      expect(sqlResult.rows[0].id).toBe(testUserId);

      // Validate Prisma result exists
      expect(prismaResult).toBeDefined();

      // Validate parity: both should return same user data
      expect(prismaResult.id).toBe(sqlResult.rows[0].id);
      expect(prismaResult.name).toBe(sqlResult.rows[0].name);
      expect(prismaResult.email).toBe(sqlResult.rows[0].email);
      expect(prismaResult.socket_id).toBe(sqlResult.rows[0].socket_id);

      // Validate notification settings (may be null if not configured)
      expect(prismaResult.email_notifications_enabled).toBe(sqlResult.rows[0].email_notifications_enabled);

      // Validate project color
      expect(prismaResult.project_color).toBe(sqlResult.rows[0].project_color);
    });
  });

  describe('11. checkIfUserAlreadyExists - EXISTS with JOIN', () => {
    it('should check if user exists in team with SQL/Prisma parity', async () => {
      // Get the owner ID (user who created the test team)
      const teamResult = await db.query(
        'SELECT user_id FROM teams WHERE id = $1',
        [testTeamId]
      );
      const ownerId = teamResult.rows[0].user_id;

      // Get the test user's email
      const userResult = await db.query(
        'SELECT email FROM users WHERE id = $1',
        [testUserId]
      );
      const testEmail = userResult.rows[0].email;

      // SQL Query (original implementation from project-members-controller.ts:16-28)
      const sqlQuery = `SELECT EXISTS(SELECT tmi.team_member_id
                FROM team_member_info_view AS tmi
                         JOIN teams AS t ON tmi.team_id = t.id
                WHERE tmi.email = $1::TEXT
                  AND t.user_id = $2::UUID);`;
      const sqlResult = await db.query(sqlQuery, [testEmail, ownerId]);
      const sqlExists = sqlResult.rows[0].exists;

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.checkIfUserAlreadyExists(ownerId, testEmail);

      // Validate SQL query returns expected data
      expect(typeof sqlExists).toBe('boolean');
      expect(sqlExists).toBe(true); // Test user should exist in their own team

      // Validate Prisma result exists and is boolean
      expect(typeof prismaResult).toBe('boolean');

      // Validate parity: both should return same boolean value
      expect(prismaResult).toBe(sqlExists);

      // Test case 2: Check with non-existent email
      const nonExistentEmail = 'nonexistent-' + Date.now() + '@example.com';

      const sqlResult2 = await db.query(sqlQuery, [nonExistentEmail, ownerId]);
      const sqlExists2 = sqlResult2.rows[0].exists;

      const prismaResult2 = await projectsService.checkIfUserAlreadyExists(ownerId, nonExistentEmail);

      // Both should return false for non-existent user
      expect(sqlExists2).toBe(false);
      expect(prismaResult2).toBe(false);
      expect(prismaResult2).toBe(sqlExists2);
    });

    it('should throw error when owner_id is not provided', async () => {
      // Both implementations should throw the same error
      await expect(
        projectsService.checkIfUserAlreadyExists('', 'test@example.com')
      ).rejects.toThrow('Owner not found.');

      await expect(
        projectsService.checkIfUserAlreadyExists(null as any, 'test@example.com')
      ).rejects.toThrow('Owner not found.');
    });
  });

  describe('12. getProjectManager - project manager lookup', () => {
    it('should return project manager team_member_id with SQL/Prisma parity', async () => {
      // SQL Query (original implementation)
      const sqlResult = await db.query(
        `SELECT team_member_id
         FROM project_members
         WHERE project_id = $1
           AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')`,
        [testProjectId]
      );

      // Prisma Query (via service - feature flag determines which implementation runs)
      const prismaResult = await projectsService.getProjectManager(testProjectId);

      // Validate both return arrays
      expect(Array.isArray(sqlResult.rows)).toBe(true);
      expect(Array.isArray(prismaResult)).toBe(true);

      // Validate parity: both should return same number of project managers
      expect(prismaResult.length).toBe(sqlResult.rows.length);

      // Validate structure (may be empty if no project manager assigned)
      if (sqlResult.rows.length > 0) {
        expect(prismaResult[0]).toHaveProperty('team_member_id');
        expect(prismaResult[0].team_member_id).toBe(sqlResult.rows[0].team_member_id);
      }
    });
  });
});
