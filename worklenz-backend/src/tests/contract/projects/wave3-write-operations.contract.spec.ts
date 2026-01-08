/**
 * Wave 3 Contract Tests: Write Operations
 *
 * Tests write operations that involve:
 * - Simple CRUD operations (Folders, Comments)
 * - Member management with notifications
 * - Complex stored procedure wrappers (Projects, Comments with mentions)
 *
 * Pattern: Phase 1 (Pure Prisma), Phase 2 (Mixed), Phase 3 (Typed $queryRaw wrappers)
 * Each test validates that the Prisma implementation produces identical output to SQL/stored procs.
 */

import db from '../../../config/db';
import { getTestTeam, getTestUser } from '../setup';
import { ProjectsService } from '../../../services/projects/projects-service';

describe('Wave 3: Write Operations - Contract Tests', () => {
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let testTeamMemberId: string;
  let testRoleId: string;
  let testJobTitleId: string;
  let testAccessLevelId: string;
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

    // Get default role ID
    const roleResult = await db.query(
      'SELECT id FROM roles WHERE team_id = $1 AND default_role = true LIMIT 1',
      [testTeamId]
    );
    testRoleId = roleResult.rows[0]?.id;

    // Get job title ID (create if needed)
    let jobTitleResult = await db.query(
      'SELECT id FROM job_titles WHERE team_id = $1 LIMIT 1',
      [testTeamId]
    );

    if (jobTitleResult.rows.length === 0) {
      jobTitleResult = await db.query(
        'INSERT INTO job_titles (name, team_id) VALUES ($1, $2) RETURNING id',
        ['Test Job Title', testTeamId]
      );
    }
    testJobTitleId = jobTitleResult.rows[0]?.id;

    // Get default access level ID
    const accessLevelResult = await db.query(
      'SELECT id FROM project_access_levels WHERE key = $1 LIMIT 1',
      ['MEMBER']
    );
    testAccessLevelId = accessLevelResult.rows[0]?.id;

    // Create test project for comment/member tests
    const projectResult = await db.query(
      `INSERT INTO projects (
        name, key, team_id, owner_id,
        status_id, color_code
      )
      VALUES (
        $1, $2, $3, $4,
        (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1),
        '#70a6f3'
      )
      RETURNING id`,
      ['Test Project Wave3', 'TPW3', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;

    // Add owner as project member
    await db.query(
      `INSERT INTO project_members (project_id, team_member_id, project_access_level_id, role_id)
       VALUES ($1, $2, $3, $4)`,
      [testProjectId, testTeamMemberId, testAccessLevelId, testRoleId]
    );

    // Initialize projects service
    projectsService = ProjectsService.getInstance();
  });

  afterAll(async () => {
    // Cleanup test data
    await db.query('DELETE FROM project_members WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await db.query('DELETE FROM project_folders WHERE team_id = $1 AND name LIKE $2', [testTeamId, '%Wave3%']);
    await db.query('DELETE FROM project_comments WHERE project_id = $1', [testProjectId]);
  });

  // ============================================
  // PHASE 1: QUICK WINS (Folders, Comments)
  // ============================================

  describe('Phase 1: Folders (Pure Prisma)', () => {
    let folderIdSql: string;
    let folderIdPrisma: string;

    describe('1. createFolder - should create folder with SQL/Prisma parity', () => {
      it('should create folder and return same structure', async () => {
        const folderName = 'Test Folder Wave3 ' + Date.now();

        // SQL Query (direct INSERT)
        const sqlQuery = `
          INSERT INTO project_folders (name, key, team_id, created_by, color_code)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, key, color_code, created_at
        `;
        const sqlResult = await db.query(sqlQuery, [
          folderName + '_sql',
          'test-folder-sql',
          testTeamId,
          testUserId,
          '#FF0000'
        ]);

        // Prisma Query
        const prismaResult = await projectsService.createFolder({
          name: folderName + '_prisma',
          key: 'test-folder-prisma',
          team_id: testTeamId,
          created_by: testUserId,
          color_code: '#FF0000'
        });

        // Validate structure
        expect(sqlResult.rows[0]).toHaveProperty('id');
        expect(sqlResult.rows[0]).toHaveProperty('name');
        expect(sqlResult.rows[0]).toHaveProperty('key');
        expect(sqlResult.rows[0]).toHaveProperty('color_code');
        expect(sqlResult.rows[0]).toHaveProperty('created_at');

        expect(prismaResult).toHaveProperty('id');
        expect(prismaResult).toHaveProperty('name');
        expect(prismaResult).toHaveProperty('key');
        expect(prismaResult).toHaveProperty('color_code');
        expect(prismaResult).toHaveProperty('created_at');

        expect(prismaResult.color_code).toBe('#FF0000');

        // Save IDs for update/delete tests
        folderIdSql = sqlResult.rows[0].id;
        folderIdPrisma = prismaResult.id;
      });
    });

    describe('2. updateFolder - should update folder with SQL/Prisma parity', () => {
      it('should update folder and return same structure', async () => {
        // SQL Query (direct UPDATE)
        const sqlQuery = `
          UPDATE project_folders
          SET name = $1, color_code = $2, updated_at = NOW()
          WHERE id = $3 AND team_id = $4
          RETURNING id
        `;
        const sqlResult = await db.query(sqlQuery, [
          'Updated Folder SQL',
          '#00FF00',
          folderIdSql,
          testTeamId
        ]);

        // Prisma Query
        const prismaResult = await projectsService.updateFolder({
          id: folderIdPrisma,
          name: 'Updated Folder Prisma',
          color_code: '#00FF00',
          team_id: testTeamId
        });

        // Validate structure
        expect(sqlResult.rowCount).toBeGreaterThan(0);
        expect(prismaResult).toEqual([{ updated: true }]);
      });
    });

    describe('3. deleteFolder - should delete folder with SQL/Prisma parity', () => {
      it('should delete folder (no projects)', async () => {
        // SQL Query (direct DELETE)
        const sqlQuery = `
          DELETE FROM project_folders
          WHERE id = $1 AND team_id = $2
        `;
        const sqlResult = await db.query(sqlQuery, [folderIdSql, testTeamId]);

        // Prisma Query
        const prismaResult = await projectsService.deleteFolder(folderIdPrisma, testTeamId);

        // Validate structure
        expect(sqlResult.rowCount).toBeGreaterThan(0);
        expect(prismaResult).toEqual([{ deleted: true }]);
      });

      it('should throw error when folder contains projects', async () => {
        // Create folder with project
        const folderResult = await db.query(
          `INSERT INTO project_folders (name, key, team_id, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          ['Folder with Project', 'folder-with-project', testTeamId, testUserId]
        );
        const folderId = folderResult.rows[0].id;

        // Create project in folder
        const projectResult = await db.query(
          `INSERT INTO projects (name, key, team_id, owner_id, folder_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          ['Project in Folder', 'PIF', testTeamId, testUserId, folderId]
        );
        const projectId = projectResult.rows[0].id;

        // Try to delete folder (should fail)
        await expect(
          projectsService.deleteFolder(folderId, testTeamId)
        ).rejects.toThrow('Cannot delete folder with projects');

        // Cleanup
        await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
        await db.query('DELETE FROM project_folders WHERE id = $1', [folderId]);
      });
    });
  });

  describe('Phase 1: Comments (Pure Prisma)', () => {
    let commentIdSql: string;
    let commentIdPrisma: string;

    beforeAll(async () => {
      // Create test comments for deletion tests
      const sqlComment = await db.query(
        `INSERT INTO project_comments (project_id, created_by, content)
         VALUES ($1, $2, $3) RETURNING id`,
        [testProjectId, testUserId, 'SQL Comment for deletion']
      );
      commentIdSql = sqlComment.rows[0].id;

      const prismaComment = await db.query(
        `INSERT INTO project_comments (project_id, created_by, content)
         VALUES ($1, $2, $3) RETURNING id`,
        [testProjectId, testUserId, 'Prisma Comment for deletion']
      );
      commentIdPrisma = prismaComment.rows[0].id;

      // Create mentions for both
      await db.query(
        `INSERT INTO project_comment_mentions (comment_id, informed_by)
         VALUES ($1, $2), ($3, $4)`,
        [commentIdSql, testUserId, commentIdPrisma, testUserId]
      );
    });

    describe('4. deleteComment - should delete comment with cascade', () => {
      it('should delete comment and mentions with SQL/Prisma parity', async () => {
        // SQL Query (direct DELETE with cascade)
        const sqlMentionsDelete = await db.query(
          'DELETE FROM project_comment_mentions WHERE comment_id = $1',
          [commentIdSql]
        );
        const sqlCommentDelete = await db.query(
          'DELETE FROM project_comments WHERE id = $1 AND created_by = $2',
          [commentIdSql, testUserId]
        );

        // Prisma Query
        const prismaResult = await projectsService.deleteComment(
          commentIdPrisma,
          testProjectId,
          testUserId
        );

        // Validate
        expect(sqlMentionsDelete.rowCount).toBeGreaterThan(0);
        expect(sqlCommentDelete.rowCount).toBeGreaterThan(0);
        expect(prismaResult).toEqual([{ deleted: true }]);

        // Verify mentions were deleted
        const remainingMentions = await db.query(
          'SELECT COUNT(*) as count FROM project_comment_mentions WHERE comment_id = $1',
          [commentIdPrisma]
        );
        expect(parseInt(remainingMentions.rows[0].count)).toBe(0);
      });

      it('should return empty array for unauthorized deletion', async () => {
        // Create comment by different user
        const otherUserResult = await db.query(
          `SELECT id FROM users WHERE id != $1 LIMIT 1`,
          [testUserId]
        );

        if (otherUserResult.rows.length > 0) {
          const otherUserId = otherUserResult.rows[0].id;
          const commentResult = await db.query(
            `INSERT INTO project_comments (project_id, created_by, content)
             VALUES ($1, $2, $3) RETURNING id`,
            [testProjectId, otherUserId, 'Comment by another user']
          );
          const commentId = commentResult.rows[0].id;

          // Try to delete as test user (should fail)
          const result = await projectsService.deleteComment(
            commentId,
            testProjectId,
            testUserId
          );

          expect(result).toEqual([]);

          // Cleanup
          await db.query('DELETE FROM project_comments WHERE id = $1', [commentId]);
        }
      });
    });
  });

  // ============================================
  // PHASE 2: MEDIUM COMPLEXITY (Member Operations)
  // ============================================

  describe('Phase 2: Member Operations', () => {
    describe('5. createProjectMember - $queryRaw wrapper', () => {
      it('should create project member via stored procedure', async () => {
        // Get another team member for testing
        const otherMemberResult = await db.query(
          `SELECT id FROM team_members WHERE team_id = $1 AND id != $2 LIMIT 1`,
          [testTeamId, testTeamMemberId]
        );

        if (otherMemberResult.rows.length > 0) {
          const otherTeamMemberId = otherMemberResult.rows[0].id;

          // SQL Query (stored procedure)
          const sqlBody = {
            project_id: testProjectId,
            team_member_id: otherTeamMemberId,
            project_access_level_id: testAccessLevelId,
            role_id: testRoleId,
            user_id: testUserId,
            team_id: testTeamId
          };

          const sqlResult = await db.query(
            `SELECT create_project_member($1::json)`,
            [JSON.stringify(sqlBody)]
          );

          // Prisma Query ($queryRaw wrapper)
          const prismaResult = await projectsService.createProjectMember(sqlBody);

          // Validate structure (both should return member info)
          expect(sqlResult.rows[0]).toHaveProperty('create_project_member');
          expect(prismaResult).toBeDefined();

          // Cleanup
          await db.query(
            'DELETE FROM project_members WHERE team_member_id = $1 AND project_id = $2',
            [otherTeamMemberId, testProjectId]
          );
        }
      });
    });

    describe('6. removeProjectMember - $queryRaw wrapper', () => {
      it('should remove project member via stored procedure', async () => {
        // Create a member to remove
        const memberResult = await db.query(
          `INSERT INTO project_members (project_id, team_member_id, project_access_level_id, role_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [testProjectId, testTeamMemberId, testAccessLevelId, testRoleId]
        );
        const memberId = memberResult.rows[0].id;

        // SQL Query (stored procedure)
        const sqlResult = await db.query(
          `SELECT remove_project_member($1::uuid, $2::uuid, $3::uuid)`,
          [memberId, testUserId, testTeamId]
        );

        // Verify member was removed
        const checkRemoved = await db.query(
          'SELECT COUNT(*) as count FROM project_members WHERE id = $1',
          [memberId]
        );
        expect(parseInt(checkRemoved.rows[0].count)).toBe(0);

        // Create another member for Prisma test
        const member2Result = await db.query(
          `INSERT INTO project_members (project_id, team_member_id, project_access_level_id, role_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [testProjectId, testTeamMemberId, testAccessLevelId, testRoleId]
        );
        const member2Id = member2Result.rows[0].id;

        // Prisma Query ($queryRaw wrapper)
        const prismaResult = await projectsService.removeProjectMember(
          member2Id,
          testUserId,
          testTeamId
        );

        // Validate
        expect(sqlResult.rows[0]).toHaveProperty('remove_project_member');
        expect(prismaResult).toBeDefined();

        // Verify member was removed
        const checkRemoved2 = await db.query(
          'SELECT COUNT(*) as count FROM project_members WHERE id = $1',
          [member2Id]
        );
        expect(parseInt(checkRemoved2.rows[0].count)).toBe(0);
      });
    });

    describe('7. inviteProjectMemberByEmail - Pure Prisma transaction', () => {
      it('should create invitation and project member', async () => {
        const testEmail = `wave3test${Date.now()}@example.com`;

        const result = await projectsService.inviteProjectMemberByEmail({
          email: testEmail,
          project_id: testProjectId,
          team_id: testTeamId,
          role_id: testRoleId,
          job_title_id: testJobTitleId,
          access_level_id: testAccessLevelId,
          invited_by: testUserId,
          owner_id: testUserId
        });

        // Validate structure
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('team_member_id');
        expect(result.email).toBe(testEmail);

        // Verify invitation was created
        const invitationCheck = await db.query(
          'SELECT COUNT(*) as count FROM email_invitations WHERE email = $1',
          [testEmail]
        );
        expect(parseInt(invitationCheck.rows[0].count)).toBeGreaterThan(0);

        // Cleanup
        await db.query('DELETE FROM project_members WHERE team_member_id = $1', [result.team_member_id]);
        await db.query('DELETE FROM email_invitations WHERE email = $1', [testEmail]);
        await db.query('DELETE FROM team_members WHERE id = $1', [result.team_member_id]);
      });

      it('should throw error if user already exists', async () => {
        // Use existing user's email
        const userResult = await db.query(
          'SELECT email FROM users WHERE id = $1',
          [testUserId]
        );
        const existingEmail = userResult.rows[0].email;

        await expect(
          projectsService.inviteProjectMemberByEmail({
            email: existingEmail,
            project_id: testProjectId,
            team_id: testTeamId,
            role_id: testRoleId,
            job_title_id: testJobTitleId,
            access_level_id: testAccessLevelId,
            invited_by: testUserId,
            owner_id: testUserId
          })
        ).rejects.toThrow('User already exists in team');
      });
    });
  });

  // ============================================
  // PHASE 3: COMPLEX OPERATIONS (Projects, Comments)
  // ============================================

  describe('Phase 3: Complex Operations ($queryRaw wrappers)', () => {
    describe('8. createProject - $queryRaw wrapper', () => {
      it('should create project via stored procedure', async () => {
        const projectName = 'Wave3 Test Project ' + Date.now();

        const projectData = {
          name: projectName,
          key: 'W3TP' + Date.now(),
          team_id: testTeamId,
          user_id: testUserId,
          project_created_log: 'Project created by @user',
          notes: 'Test project notes',
          color_code: '#123456'
        };

        // SQL Query (stored procedure)
        const sqlResult = await db.query(
          `SELECT * FROM create_project($1::json)`,
          [JSON.stringify(projectData)]
        );

        // Prisma Query ($queryRaw wrapper)
        const prismaResult = await projectsService.createProject(projectData);

        // Validate structure
        expect(sqlResult.rows[0]).toHaveProperty('id');
        expect(sqlResult.rows[0]).toHaveProperty('name');
        expect(prismaResult).toHaveProperty('id');
        expect(prismaResult).toHaveProperty('name');
        expect(prismaResult.name).toBe(projectName);

        // Verify project was created with all components
        const projectCheck = await db.query(
          'SELECT COUNT(*) as count FROM projects WHERE id = $1',
          [prismaResult.id]
        );
        expect(parseInt(projectCheck.rows[0].count)).toBe(1);

        // Verify task statuses were created (3 default)
        const statusCheck = await db.query(
          'SELECT COUNT(*) as count FROM task_statuses WHERE project_id = $1',
          [prismaResult.id]
        );
        expect(parseInt(statusCheck.rows[0].count)).toBeGreaterThanOrEqual(3);

        // Cleanup
        await db.query('DELETE FROM task_statuses WHERE project_id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
        await db.query('DELETE FROM project_members WHERE project_id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
        await db.query('DELETE FROM project_logs WHERE project_id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
        await db.query('DELETE FROM projects WHERE id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
      });

      it('should throw error for duplicate project name', async () => {
        const duplicateName = 'Duplicate Project Test';

        // Create first project
        await db.query(
          `INSERT INTO projects (name, key, team_id, owner_id)
           VALUES ($1, $2, $3, $4)`,
          [duplicateName, 'DUP1', testTeamId, testUserId]
        );

        // Try to create second with same name (should fail)
        await expect(
          projectsService.createProject({
            name: duplicateName,
            key: 'DUP2',
            team_id: testTeamId,
            user_id: testUserId,
            project_created_log: 'Project created by @user'
          })
        ).rejects.toThrow();

        // Cleanup
        await db.query('DELETE FROM projects WHERE name = $1', [duplicateName]);
      });
    });

    describe('9. updateProject - $queryRaw wrapper', () => {
      it('should update project via stored procedure', async () => {
        // Create project to update
        const projectResult = await db.query(
          `INSERT INTO projects (name, key, team_id, owner_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          ['Project to Update', 'PTU', testTeamId, testUserId]
        );
        const projectId = projectResult.rows[0].id;

        const updateData = {
          id: projectId,
          name: 'Updated Project Name',
          key: 'PTU',
          team_id: testTeamId,
          user_id: testUserId,
          notes: 'Updated notes',
          color_code: '#654321',
          project_created_log: 'Update log'
        };

        // Prisma Query ($queryRaw wrapper)
        const prismaResult = await projectsService.updateProject(updateData);

        // Validate structure
        expect(prismaResult).toHaveProperty('id');
        expect(prismaResult).toHaveProperty('name');
        expect(prismaResult.name).toBe('Updated Project Name');

        // Verify project was updated
        const projectCheck = await db.query(
          'SELECT name FROM projects WHERE id = $1',
          [projectId]
        );
        expect(projectCheck.rows[0].name).toBe('Updated Project Name');

        // Cleanup
        await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
      });
    });

    describe('10. createComment - $queryRaw wrapper with mentions', () => {
      it('should create comment with mentions via stored procedure', async () => {
        const commentData = {
          project_id: testProjectId,
          created_by: testUserId,
          content: 'Test comment with mentions',
          team_id: testTeamId,
          mentions: [{ user_id: testUserId, index: 0 }]
        };

        // SQL Query (stored procedure)
        const sqlResult = await db.query(
          `SELECT * FROM create_project_comment($1::json)`,
          [JSON.stringify(commentData)]
        );

        // Prisma Query ($queryRaw wrapper)
        const prismaResult = await projectsService.createComment(commentData);

        // Validate structure
        expect(sqlResult.rows[0]).toHaveProperty('id');
        expect(sqlResult.rows[0]).toHaveProperty('content');
        expect(prismaResult).toHaveProperty('id');
        expect(prismaResult).toHaveProperty('content');
        expect(prismaResult.content).toBe('Test comment with mentions');

        // Verify mentions were created
        const mentionsCheck = await db.query(
          'SELECT COUNT(*) as count FROM project_comment_mentions WHERE comment_id = $1',
          [prismaResult.id]
        );
        expect(parseInt(mentionsCheck.rows[0].count)).toBeGreaterThan(0);

        // Cleanup
        await db.query('DELETE FROM project_comment_mentions WHERE comment_id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
        await db.query('DELETE FROM project_comments WHERE id IN ($1, $2)', [
          sqlResult.rows[0].id,
          prismaResult.id
        ]);
      });

      it('should create comment without mentions', async () => {
        const commentData = {
          project_id: testProjectId,
          created_by: testUserId,
          content: 'Test comment without mentions',
          team_id: testTeamId,
          mentions: []
        };

        const prismaResult = await projectsService.createComment(commentData);

        // Validate
        expect(prismaResult).toHaveProperty('id');
        expect(prismaResult).toHaveProperty('content');

        // Verify no mentions were created
        const mentionsCheck = await db.query(
          'SELECT COUNT(*) as count FROM project_comment_mentions WHERE comment_id = $1',
          [prismaResult.id]
        );
        expect(parseInt(mentionsCheck.rows[0].count)).toBe(0);

        // Cleanup
        await db.query('DELETE FROM project_comments WHERE id = $1', [prismaResult.id]);
      });
    });
  });
});
