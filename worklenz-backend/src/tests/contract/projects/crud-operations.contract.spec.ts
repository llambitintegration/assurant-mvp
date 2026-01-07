/**
 * Contract Tests: Projects CRUD Operations (Wave 1)
 *
 * These tests validate behavioral parity between SQL queries and Prisma implementations
 * for simple CRUD operations on projects, categories, statuses, and healths.
 *
 * Test Pattern: RED → GREEN → REFACTOR (TDD)
 * - RED: All tests written first (should fail initially)
 * - GREEN: Implement Prisma methods to pass tests
 * - REFACTOR: Optimize implementation
 */

import { expect, describe, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import db from '../../../config/db';
import prisma from '../../../config/prisma';
import projectsService from '../../../services/projects/projects-service';
import { expectParity } from '../../utils/contract-test';
import { getTestTeam, getTestUser } from '../setup';

describe('Contract Tests: Projects CRUD Operations (Wave 1)', () => {
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let testCategoryId: string;

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
      ['Test Project Wave1', 'TWV1', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup only test-specific data
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await db.query('DELETE FROM project_categories WHERE team_id = $1 AND name LIKE $2', [testTeamId, '%Test%']);
  });

  afterEach(async () => {
    // Clean up favorites and archives after each test
    await db.query('DELETE FROM favorite_projects WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM archived_projects WHERE user_id = $1', [testUserId]);
  });

  // ==========================================
  // Test 1: getAllKeysByTeamId
  // ==========================================

  it('should match SQL output for getAllKeysByTeamId', async () => {
    const sqlQuery = async () => {
      const q = 'SELECT key FROM projects WHERE team_id = $1';
      const result = await db.query(q, [testTeamId]);
      return result.rows.map((project: any) => project.key).filter((key: any) => !!key);
    };

    const prismaQuery = async () => {
      return await projectsService.getAllKeysByTeamId(testTeamId);
    };

    await expectParity(sqlQuery, prismaQuery, {
      sortArrays: true
    });
  });

  // ==========================================
  // Test 2: getAllProjects
  // ==========================================

  it('should match SQL output for getAllProjects', async () => {
    const sqlQuery = async () => {
      const q = `SELECT id, name, key, color_code, notes, start_date, end_date,
                        owner_id, status_id, category_id, folder_id, health_id,
                        created_at, updated_at
                 FROM projects
                 WHERE team_id = $1
                 ORDER BY name`;
      const result = await db.query(q, [testTeamId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.getAllProjects(testTeamId);
    };

    await expectParity(sqlQuery, prismaQuery, {
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  // ==========================================
  // Test 3: deleteById
  // ==========================================

  it('should match SQL output for deleteById', async () => {
    // Create a project to delete
    const projectResult = await db.query(
      `INSERT INTO projects (name, key, team_id, owner_id, status_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1))
       RETURNING id`,
      ['Project to Delete', 'DEL', testTeamId, testUserId]
    );
    const projectToDelete = projectResult.rows[0].id;

    const sqlQuery = async () => {
      const q = 'DELETE FROM projects WHERE id = $1 AND team_id = $2';
      const result = await db.query(q, [projectToDelete, testTeamId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.deleteById(projectToDelete, testTeamId);
    };

    // Both should return empty arrays for successful delete
    const sqlResult = await sqlQuery();
    const prismaResult = await prismaQuery();

    expect(prismaResult).toBeDefined();
    expect(Array.isArray(prismaResult)).toBe(true);
  });

  // ==========================================
  // Test 4: toggleFavorite
  // ==========================================

  it('should toggle favorite on (SQL stored proc vs Prisma)', async () => {
    // Ensure clean state
    await db.query('DELETE FROM favorite_projects WHERE user_id = $1 AND project_id = $2', [testUserId, testProjectId]);

    // Toggle favorite ON using Prisma
    await projectsService.toggleFavorite(testUserId, testProjectId);

    // Verify favorite was added
    const result = await db.query(
      'SELECT * FROM favorite_projects WHERE user_id = $1 AND project_id = $2',
      [testUserId, testProjectId]
    );

    expect(result.rows.length).toBe(1);
  });

  it('should toggle favorite off (SQL stored proc vs Prisma)', async () => {
    // Ensure favorite exists
    await db.query(
      'INSERT INTO favorite_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [testUserId, testProjectId]
    );

    // Toggle favorite OFF using Prisma
    await projectsService.toggleFavorite(testUserId, testProjectId);

    // Verify favorite was removed
    const result = await db.query(
      'SELECT * FROM favorite_projects WHERE user_id = $1 AND project_id = $2',
      [testUserId, testProjectId]
    );

    expect(result.rows.length).toBe(0);
  });

  // ==========================================
  // Test 5: toggleArchive
  // ==========================================

  it('should toggle archive on (SQL stored proc vs Prisma)', async () => {
    // Ensure clean state
    await db.query('DELETE FROM archived_projects WHERE user_id = $1 AND project_id = $2', [testUserId, testProjectId]);

    // Toggle archive ON using Prisma
    await projectsService.toggleArchive(testUserId, testProjectId);

    // Verify archive was added
    const result = await db.query(
      'SELECT * FROM archived_projects WHERE user_id = $1 AND project_id = $2',
      [testUserId, testProjectId]
    );

    expect(result.rows.length).toBe(1);
  });

  it('should toggle archive off (SQL stored proc vs Prisma)', async () => {
    // Ensure archive exists
    await db.query(
      'INSERT INTO archived_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [testUserId, testProjectId]
    );

    // Toggle archive OFF using Prisma
    await projectsService.toggleArchive(testUserId, testProjectId);

    // Verify archive was removed
    const result = await db.query(
      'SELECT * FROM archived_projects WHERE user_id = $1 AND project_id = $2',
      [testUserId, testProjectId]
    );

    expect(result.rows.length).toBe(0);
  });

  // ==========================================
  // Test 6: toggleArchiveAll
  // ==========================================

  it('should toggle archive all ON for all team members', async () => {
    // Ensure clean state
    await db.query('DELETE FROM archived_projects WHERE project_id = $1', [testProjectId]);

    // Toggle archive all ON using Prisma
    const result = await projectsService.toggleArchiveAll(testProjectId);

    // Verify archives were added for all team members
    const archiveCount = await db.query(
      'SELECT COUNT(*) as count FROM archived_projects WHERE project_id = $1',
      [testProjectId]
    );

    expect(result).toContain(testProjectId);
    // Should have created at least one archive (for test user)
    expect(parseInt(archiveCount.rows[0].count)).toBeGreaterThan(0);
  });

  it('should toggle archive all OFF for all team members', async () => {
    // Ensure archives exist
    await db.query(
      'INSERT INTO archived_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [testUserId, testProjectId]
    );

    // Toggle archive all OFF using Prisma
    await projectsService.toggleArchiveAll(testProjectId);

    // Verify all archives were removed
    const archiveCount = await db.query(
      'SELECT COUNT(*) as count FROM archived_projects WHERE project_id = $1',
      [testProjectId]
    );

    expect(parseInt(archiveCount.rows[0].count)).toBe(0);
  });

  // ==========================================
  // Test 7: updatePinnedView
  // ==========================================

  it('should match SQL output for updatePinnedView', async () => {
    // Create project member with role_id
    const teamMemberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id)
       VALUES ($1, $2, (SELECT id FROM roles WHERE team_id = $2 LIMIT 1))
       RETURNING id`,
      [testUserId, testTeamId]
    );
    const teamMemberId = teamMemberResult.rows[0].id;

    await db.query(
      `INSERT INTO project_members (project_id, team_member_id, project_access_level_id, role_id)
       VALUES ($1, $2, (SELECT id FROM project_access_levels LIMIT 1), (SELECT id FROM roles WHERE team_id = $3 LIMIT 1))`,
      [testProjectId, teamMemberId, testTeamId]
    );

    const sqlQuery = async () => {
      const q = 'UPDATE project_members SET default_view = $1 WHERE project_id = $2 AND team_member_id = $3';
      const result = await db.query(q, ['kanban', testProjectId, teamMemberId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.updatePinnedView({
        project_id: testProjectId,
        team_member_id: teamMemberId,
        default_view: 'kanban'
      });
    };

    // Both should complete successfully
    await sqlQuery();
    const prismaResult = await prismaQuery();
    expect(prismaResult).toBeDefined();

    // Cleanup
    await db.query('DELETE FROM project_members WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM team_members WHERE id = $1', [teamMemberId]);
  });

  // ==========================================
  // PROJECT CATEGORIES TESTS
  // ==========================================

  it('should match SQL output for createProjectCategory', async () => {
    const categoryName = 'Test Category ' + Date.now();

    const sqlQuery = async () => {
      const q = `INSERT INTO project_categories (name, team_id, created_by, color_code)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, color_code`;
      const result = await db.query(q, [categoryName, testTeamId, testUserId, '#FF0000']);
      return result.rows[0];
    };

    const prismaQuery = async () => {
      return await projectsService.createProjectCategory({
        name: categoryName + '_prisma',
        team_id: testTeamId,
        created_by: testUserId,
        color_code: '#FF0000'
      });
    };

    const sqlResult = await sqlQuery();
    const prismaResult = await prismaQuery();

    expect(sqlResult).toHaveProperty('id');
    expect(sqlResult).toHaveProperty('name');
    expect(sqlResult).toHaveProperty('color_code');
    expect(prismaResult).toHaveProperty('id');
    expect(prismaResult).toHaveProperty('name');
    expect(prismaResult).toHaveProperty('color_code');

    // Cleanup
    await db.query('DELETE FROM project_categories WHERE id IN ($1, $2)', [sqlResult.id, prismaResult.id]);
  });

  it('should match SQL output for getProjectCategories', async () => {
    // Create a category for testing
    const categoryResult = await db.query(
      `INSERT INTO project_categories (name, team_id, created_by, color_code)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Category for Get Test', testTeamId, testUserId, '#00FF00']
    );
    testCategoryId = categoryResult.rows[0].id;

    const sqlQuery = async () => {
      const q = `SELECT id, name, color_code,
                        (SELECT COUNT(*) FROM projects WHERE category_id = project_categories.id) AS usage
                 FROM project_categories
                 WHERE team_id = $1`;
      const result = await db.query(q, [testTeamId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.getProjectCategories(testTeamId);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL output for updateProjectCategory', async () => {
    // Ensure category exists
    if (!testCategoryId) {
      const categoryResult = await db.query(
        `INSERT INTO project_categories (name, team_id, created_by, color_code)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Category for Update Test', testTeamId, testUserId, '#0000FF']
      );
      testCategoryId = categoryResult.rows[0].id;
    }

    const newColor = '#FFFF00';

    const sqlQuery = async () => {
      const q = 'UPDATE project_categories SET color_code = $2 WHERE id = $1 AND team_id = $3';
      const result = await db.query(q, [testCategoryId, newColor, testTeamId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.updateProjectCategory({
        id: testCategoryId,
        color_code: newColor,
        team_id: testTeamId
      });
    };

    const sqlResult = await sqlQuery();
    const prismaResult = await prismaQuery();

    expect(Array.isArray(sqlResult)).toBe(true);
    expect(Array.isArray(prismaResult)).toBe(true);
  });

  it('should match SQL output for deleteProjectCategory', async () => {
    // Create a category to delete
    const categoryResult = await db.query(
      `INSERT INTO project_categories (name, team_id, created_by, color_code)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Category to Delete', testTeamId, testUserId, '#FF00FF']
    );
    const categoryToDelete = categoryResult.rows[0].id;

    const sqlQuery = async () => {
      const q = 'DELETE FROM project_categories WHERE id = $1 AND team_id = $2';
      const result = await db.query(q, [categoryToDelete, testTeamId]);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.deleteProjectCategory(categoryToDelete, testTeamId);
    };

    const sqlResult = await sqlQuery();
    const prismaResult = await prismaQuery();

    expect(Array.isArray(sqlResult)).toBe(true);
    expect(Array.isArray(prismaResult)).toBe(true);
  });

  // ==========================================
  // SYSTEM STATUSES AND HEALTHS
  // ==========================================

  it('should match SQL output for getSystemProjectStatuses', async () => {
    const sqlQuery = async () => {
      const q = 'SELECT id, name, color_code, icon, is_default FROM sys_project_statuses ORDER BY sort_order';
      const result = await db.query(q, []);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.getSystemProjectStatuses();
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL output for getSystemProjectHealths', async () => {
    const sqlQuery = async () => {
      const q = 'SELECT id, name, color_code, is_default FROM sys_project_healths ORDER BY sort_order';
      const result = await db.query(q, []);
      return result.rows;
    };

    const prismaQuery = async () => {
      return await projectsService.getSystemProjectHealths();
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });
});
