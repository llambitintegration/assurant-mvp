/**
 * Contract Test: Team Member Lookup
 *
 * Tests getting a team member with role information
 * Validates that Prisma implementation matches existing SQL behavior with JOINs
 *
 * TDD Phase: RED - This test captures SQL behavior and will fail until Prisma implementation is complete
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { TeamsService } from '../../../services/teams/teams-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Team Member Lookup', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam: any;
  let testRole: any;
  let testMember: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create test user
    const userEmail = `team-member-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Team Member Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create test team
    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id, created_at, updated_at`,
      [`Test Team ${Date.now()}`, testUser.id]
    );
    testTeam = teamResult.rows[0];

    // Create test role
    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, team_id, default_role, admin_role, owner`,
      ['Test Role', testTeam.id, false, false, false]
    );
    testRole = roleResult.rows[0];

    // Create team member
    const memberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, team_id, role_id, job_title_id, created_at, updated_at, active`,
      [testUser.id, testTeam.id, testRole.id, true]
    );
    testMember = memberResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup in reverse order of creation
    if (testMember?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [testMember.id]);
    }
    if (testRole?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [testRole.id]);
    }
    if (testTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam.id]);
    }
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  it('should match SQL behavior for team member lookup with role JOIN', async () => {
    // SQL version (mimics teams-controller.ts:150-175 pattern)
    const sqlQuery = async () => {
      const q = `
        SELECT tm.id,
               tm.user_id,
               tm.team_id,
               tm.role_id,
               tm.job_title_id,
               tm.created_at,
               tm.updated_at,
               tm.active,
               r.id AS role_id,
               r.name AS role_name,
               r.team_id AS role_team_id,
               r.default_role,
               r.admin_role,
               r.owner
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = $1 AND tm.active = TRUE
      `;
      const result = await db.query(q, [testMember.id]);
      return result.rows[0] || null;
    };

    // Prisma version (new implementation with include)
    const prismaQuery = async () => {
      return await teamsService.getTeamMemberById(testMember.id);
    };

    // Assert parity
    await expectParity(sqlQuery, prismaQuery, {
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for non-existent member', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    // SQL version
    const sqlQuery = async () => {
      const q = `
        SELECT tm.id,
               tm.user_id,
               tm.team_id,
               tm.role_id,
               tm.job_title_id,
               tm.created_at,
               tm.updated_at,
               tm.active,
               r.id AS role_id,
               r.name AS role_name,
               r.team_id AS role_team_id,
               r.default_role,
               r.admin_role,
               r.owner
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.id = $1 AND tm.active = TRUE
      `;
      const result = await db.query(q, [nonExistentId]);
      return result.rows[0] || null;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await teamsService.getTeamMemberById(nonExistentId);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should exclude inactive members', async () => {
    // Create inactive member
    const inactiveMemberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [testUser.id, testTeam.id, testRole.id]
    );
    const inactiveMemberId = inactiveMemberResult.rows[0].id;

    try {
      // SQL version - should not return inactive member
      const sqlQuery = async () => {
        const q = `
          SELECT tm.id,
                 tm.user_id,
                 tm.team_id,
                 tm.role_id,
                 tm.job_title_id,
                 tm.created_at,
                 tm.updated_at,
                 tm.active,
                 r.id AS role_id,
                 r.name AS role_name,
                 r.team_id AS role_team_id,
                 r.default_role,
                 r.admin_role,
                 r.owner
          FROM team_members tm
          INNER JOIN roles r ON tm.role_id = r.id
          WHERE tm.id = $1 AND tm.active = TRUE
        `;
        const result = await db.query(q, [inactiveMemberId]);
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await teamsService.getTeamMemberById(inactiveMemberId);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    } finally {
      // Cleanup
      await db.query('DELETE FROM team_members WHERE id = $1', [inactiveMemberId]);
    }
  });

  it('should include role information in response', async () => {
    const result = await teamsService.getTeamMemberById(testMember.id);

    // Verify role information is included (flattened fields matching SQL JOIN output)
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('role_name');
    expect(result).toHaveProperty('role_team_id');
    expect(result).toHaveProperty('default_role');
    expect(result).toHaveProperty('admin_role');
    expect(result).toHaveProperty('owner');
  });
});
