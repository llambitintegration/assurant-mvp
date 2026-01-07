/**
 * Contract Test: Get Team Members List
 *
 * Tests listing all team members with roles (high-traffic query)
 * Validates that Prisma implementation matches existing SQL behavior with JOINs
 *
 * TDD Phase: RED - This test captures SQL behavior and will fail until Prisma implementation is complete
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { TeamsService } from '../../../services/teams/teams-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Get Team Members List', () => {
  let teamsService: TeamsService;
  let testUsers: any[] = [];
  let testTeam: any;
  let testRoles: any[] = [];
  let testMembers: any[] = [];

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create owner user
    const ownerEmail = `list-owner-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const ownerResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [ownerEmail, 'List Owner', hashedPassword, timezoneId]
    );
    testUsers.push(ownerResult.rows[0]);

    // Create test team
    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Test Team List ${Date.now()}`, testUsers[0].id]
    );
    testTeam = teamResult.rows[0];

    // Create multiple roles
    const adminRoleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, FALSE, TRUE, FALSE)
       RETURNING id, name, team_id, default_role, admin_role, owner`,
      ['Admin Role', testTeam.id]
    );
    testRoles.push(adminRoleResult.rows[0]);

    const memberRoleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, TRUE, FALSE, FALSE)
       RETURNING id, name, team_id, default_role, admin_role, owner`,
      ['Member Role', testTeam.id]
    );
    testRoles.push(memberRoleResult.rows[0]);

    // Create multiple team members
    for (let i = 0; i < 3; i++) {
      const memberEmail = `list-member-${i}-${Date.now()}@example.com`;
      const memberResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name`,
        [memberEmail, `Team Member ${i}`, hashedPassword, timezoneId]
      );
      testUsers.push(memberResult.rows[0]);

      // Assign role (alternate between admin and member roles)
      const roleId = testRoles[i % 2].id;
      const teamMemberResult = await db.query(
        `INSERT INTO team_members (user_id, team_id, role_id, active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, user_id, team_id, role_id, job_title_id, created_at, updated_at, active`,
        [memberResult.rows[0].id, testTeam.id, roleId]
      );
      testMembers.push(teamMemberResult.rows[0]);
    }
  });

  afterAll(async () => {
    // Cleanup in reverse order
    for (const member of testMembers) {
      await db.query('DELETE FROM team_members WHERE id = $1', [member.id]);
    }
    for (const role of testRoles) {
      await db.query('DELETE FROM roles WHERE id = $1', [role.id]);
    }
    if (testTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam.id]);
    }
    for (const user of testUsers) {
      await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    }
  });

  it('should match SQL behavior for listing all team members with roles', async () => {
    // SQL version (mimics teams-controller.ts:50-80 pattern)
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
               r.owner,
               u.email AS user_email,
               u.name AS user_name
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1 AND tm.active = TRUE
        ORDER BY tm.created_at ASC
      `;
      const result = await db.query(q, [testTeam.id]);
      return result.rows;
    };

    // Prisma version (new implementation)
    const prismaQuery = async () => {
      return await teamsService.getTeamMembersList(testTeam.id);
    };

    // Assert parity
    await expectParity(sqlQuery, prismaQuery, {
      sortArraysBy: 'id',
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  it('should return empty array for team with no members', async () => {
    // Create empty team
    const emptyTeamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [`Empty Team ${Date.now()}`, testUsers[0].id]
    );
    const emptyTeamId = emptyTeamResult.rows[0].id;

    try {
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
                 r.owner,
                 u.email AS user_email,
                 u.name AS user_name
          FROM team_members tm
          INNER JOIN roles r ON tm.role_id = r.id
          LEFT JOIN users u ON tm.user_id = u.id
          WHERE tm.team_id = $1 AND tm.active = TRUE
          ORDER BY tm.created_at ASC
        `;
        const result = await db.query(q, [emptyTeamId]);
        return result.rows;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await teamsService.getTeamMembersList(emptyTeamId);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    } finally {
      // Cleanup
      await db.query('DELETE FROM teams WHERE id = $1', [emptyTeamId]);
    }
  });

  it('should exclude inactive members from list', async () => {
    // Create inactive member
    const inactiveEmail = `inactive-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const inactiveUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [inactiveEmail, 'Inactive Member', 'hashed_pw', timezoneId]
    );
    const inactiveUserId = inactiveUserResult.rows[0].id;

    const inactiveMemberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [inactiveUserId, testTeam.id, testRoles[0].id]
    );
    const inactiveMemberId = inactiveMemberResult.rows[0].id;

    try {
      // Get list
      const members = await teamsService.getTeamMembersList(testTeam.id);

      // Verify inactive member is not in list
      const inactiveMemberInList = members.find((m: any) => m.id === inactiveMemberId);
      expect(inactiveMemberInList).toBeUndefined();

      // Verify active members are present
      expect(members.length).toBe(testMembers.length);
    } finally {
      // Cleanup
      await db.query('DELETE FROM team_members WHERE id = $1', [inactiveMemberId]);
      await db.query('DELETE FROM users WHERE id = $1', [inactiveUserId]);
    }
  });

  it('should include role information for each member', async () => {
    const members = await teamsService.getTeamMembersList(testTeam.id);

    expect(members.length).toBeGreaterThan(0);

    // Check each member has role information (flattened fields matching SQL JOIN output)
    for (const member of members) {
      expect(member).toHaveProperty('role_name');
      expect(member).toHaveProperty('role_team_id');
      expect(member).toHaveProperty('default_role');
      expect(member).toHaveProperty('admin_role');
      expect(member).toHaveProperty('owner');
      expect(member).toHaveProperty('user_email');
      expect(member).toHaveProperty('user_name');
    }
  });

  it('should sort members by creation date', async () => {
    const members = await teamsService.getTeamMembersList(testTeam.id);

    // Verify sorted by created_at ascending
    for (let i = 1; i < members.length; i++) {
      const prev = new Date(members[i - 1].created_at).getTime();
      const curr = new Date(members[i].created_at).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('should handle high-traffic query efficiently', async () => {
    const startTime = Date.now();

    // Execute query
    await teamsService.getTeamMembersList(testTeam.id);

    const duration = Date.now() - startTime;

    // Should complete within reasonable time (< 500ms for small dataset)
    expect(duration).toBeLessThan(500);
  });
});
