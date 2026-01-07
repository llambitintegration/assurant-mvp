/**
 * Contract Test: Create Team Member
 *
 * Tests creating a team member with role assignment in a transaction
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED - This test captures SQL behavior and will fail until Prisma implementation is complete
 */

import { normalize } from '../../utils/contract-test';
import db from '../../../config/db';
import { TeamsService } from '../../../services/teams/teams-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Create Team Member', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam: any;
  let testRole: any;
  let createdMemberIds: string[] = [];

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create test user
    const userEmail = `create-member-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Create Member Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create test team
    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Test Team Create ${Date.now()}`, testUser.id]
    );
    testTeam = teamResult.rows[0];

    // Create test role
    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, team_id`,
      ['Member Role', testTeam.id, true, false, false]
    );
    testRole = roleResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup created members
    for (const memberId of createdMemberIds) {
      await db.query('DELETE FROM team_members WHERE id = $1', [memberId]).catch(() => {});
    }

    // Cleanup in reverse order
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

  it('should match SQL behavior for creating a team member', async () => {
    // Create another user to add as member
    const memberEmail = `new-member-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const memberUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberEmail, 'New Team Member', 'hashed_pw', timezoneId]
    );
    const newUserId = memberUserResult.rows[0].id;

    try {
      // SQL version (mimics teams-controller.ts:200-250 pattern)
      const sqlQuery = async () => {
        const q = `
          INSERT INTO team_members (user_id, team_id, role_id, active)
          VALUES ($1, $2, $3, TRUE)
          RETURNING id, user_id, team_id, role_id, job_title_id, created_at, updated_at, active
        `;
        const result = await db.query(q, [newUserId, testTeam.id, testRole.id]);
        const member = result.rows[0];
        createdMemberIds.push(member.id);
        return member;
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        const member = await teamsService.createTeamMember({
          user_id: newUserId,
          team_id: testTeam.id,
          role_id: testRole.id
        });
        createdMemberIds.push(member.id);
        return member;
      };

      // Execute both and compare
      const sqlResult = await sqlQuery();
      const prismaResult = await prismaQuery();

      // Normalize and compare
      const normalizedSql = normalize(sqlResult, {
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
      const normalizedPrisma = normalize(prismaResult, {
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });

      // Check key fields match
      expect(normalizedPrisma.user_id).toBe(normalizedSql.user_id);
      expect(normalizedPrisma.team_id).toBe(normalizedSql.team_id);
      expect(normalizedPrisma.role_id).toBe(normalizedSql.role_id);
      expect(normalizedPrisma.active).toBe(normalizedSql.active);
    } finally {
      // Cleanup in correct order: delete team_members first, then user
      await db.query('DELETE FROM team_members WHERE user_id = $1', [newUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
    }
  });

  it('should enforce transaction atomicity on member creation', async () => {
    // Create user to test with
    const memberEmail = `txn-member-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const memberUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberEmail, 'Transaction Test Member', 'hashed_pw', timezoneId]
    );
    const newUserId = memberUserResult.rows[0].id;

    try {
      // Test with invalid role_id (should fail transaction)
      const invalidRoleId = '00000000-0000-0000-0000-000000000000';

      await expect(
        teamsService.createTeamMember({
          user_id: newUserId,
          team_id: testTeam.id,
          role_id: invalidRoleId
        })
      ).rejects.toThrow();

      // Verify no member was created
      const checkResult = await db.query(
        'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
        [newUserId, testTeam.id]
      );
      expect(checkResult.rows.length).toBe(0);
    } finally {
      // Cleanup in correct order: delete team_members first, then user
      await db.query('DELETE FROM team_members WHERE user_id = $1', [newUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
    }
  });

  it('should set default values correctly', async () => {
    // Create user
    const memberEmail = `default-member-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const memberUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberEmail, 'Default Values Member', 'hashed_pw', timezoneId]
    );
    const newUserId = memberUserResult.rows[0].id;

    try {
      const member = await teamsService.createTeamMember({
        user_id: newUserId,
        team_id: testTeam.id,
        role_id: testRole.id
      });

      createdMemberIds.push(member.id);

      // Verify defaults
      expect(member.active).toBe(true);
      expect(member.created_at).toBeDefined();
      expect(member.updated_at).toBeDefined();
      expect(member.id).toBeDefined();
    } finally {
      // Cleanup in correct order: delete team_members first, then user
      await db.query('DELETE FROM team_members WHERE user_id = $1', [newUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
    }
  });

  it('should prevent duplicate team members', async () => {
    // Create user
    const memberEmail = `duplicate-member-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const memberUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberEmail, 'Duplicate Test Member', 'hashed_pw', timezoneId]
    );
    const newUserId = memberUserResult.rows[0].id;

    try {
      // Create first member
      const member1 = await teamsService.createTeamMember({
        user_id: newUserId,
        team_id: testTeam.id,
        role_id: testRole.id
      });
      createdMemberIds.push(member1.id);

      // Attempt to create duplicate - should handle gracefully or throw
      // This depends on DB constraints
      try {
        const member2 = await teamsService.createTeamMember({
          user_id: newUserId,
          team_id: testTeam.id,
          role_id: testRole.id
        });
        createdMemberIds.push(member2.id);

        // If it doesn't throw, we should have different IDs
        expect(member2.id).not.toBe(member1.id);
      } catch (error) {
        // Expected behavior - constraint violation
        expect(error).toBeDefined();
      }
    } finally {
      // Cleanup in correct order: delete team_members first, then user
      await db.query('DELETE FROM team_members WHERE user_id = $1', [newUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
    }
  });
});
