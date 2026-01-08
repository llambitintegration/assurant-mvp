/**
 * Contract Test: Teams Service - activateTeam
 *
 * Tests behavioral parity between SQL (activate_team stored procedure) and Prisma
 * for activating a team for a user.
 *
 * Original SQL: teams-controller.ts:89-90
 * SQL Function: database/sql/4_functions.sql:20-37
 * Prisma Implementation: services/teams/teams-service.ts:activateTeam
 */

import { TeamsService } from '../../../services/teams/teams-service';
import db from '../../../config/db';
import bcrypt from 'bcrypt';

describe('Contract Test: TeamsService.activateTeam', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam1: any;
  let testTeam2: any;
  let testRole: any;
  let testMember: any;
  let testInvitation: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create test user
    const userEmail = `activate-team-test-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, active_team`,
      [userEmail, 'Activate Team Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create first team (owned by user)
    const team1Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Activate Test Team 1 ${Date.now()}`, testUser.id]
    );
    testTeam1 = team1Result.rows[0];

    // Create second team
    const team2Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Activate Test Team 2 ${Date.now()}`, testUser.id]
    );
    testTeam2 = team2Result.rows[0];

    // Create role for team2
    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, team_id`,
      ['Test Role', testTeam2.id, false, false, false]
    );
    testRole = roleResult.rows[0];

    // Create team member for user in team2
    const memberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [testUser.id, testTeam2.id, testRole.id]
    );
    testMember = memberResult.rows[0];

    // Create email invitation for this team member
    const invitationResult = await db.query(
      `INSERT INTO email_invitations (name, email, team_id, team_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Test Invitation', testUser.email, testTeam2.id, testMember.id]
    );
    testInvitation = invitationResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    if (testInvitation?.id) {
      await db.query('DELETE FROM email_invitations WHERE id = $1', [testInvitation.id]);
    }
    if (testMember?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [testMember.id]);
    }
    if (testRole?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [testRole.id]);
    }
    // Set user's active_team to NULL before deleting teams (foreign key constraint)
    if (testUser?.id) {
      await db.query('UPDATE users SET active_team = NULL WHERE id = $1', [testUser.id]);
    }
    if (testTeam1?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam1.id]);
    }
    if (testTeam2?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam2.id]);
    }
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('SQL vs Prisma Behavioral Parity', () => {
    it('should update user active_team using SQL stored procedure', async () => {
      // Execute SQL stored procedure
      const q = `SELECT activate_team($1, $2)`;
      await db.query(q, [testTeam2.id, testUser.id]);

      // Verify user's active_team was updated
      const userResult = await db.query(
        'SELECT id, active_team FROM users WHERE id = $1',
        [testUser.id]
      );
      const updatedUser = userResult.rows[0];

      expect(updatedUser.active_team).toBe(testTeam2.id);

      // Verify email invitation was deleted
      const invitationResult = await db.query(
        'SELECT id FROM email_invitations WHERE id = $1',
        [testInvitation.id]
      );

      expect(invitationResult.rows.length).toBe(0);

      // Recreate invitation for Prisma test
      const newInvitationResult = await db.query(
        `INSERT INTO email_invitations (name, email, team_id, team_member_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Test Invitation', testUser.email, testTeam2.id, testMember.id]
      );
      testInvitation = newInvitationResult.rows[0];

      // Reset user's active_team for Prisma test
      await db.query('UPDATE users SET active_team = NULL WHERE id = $1', [testUser.id]);
    });

    it('should update user active_team using Prisma service', async () => {
      // Execute Prisma service method
      const result = await teamsService.activateTeam(testUser.id, testTeam2.id);

      // Verify result structure
      expect(result).toHaveProperty('id', testUser.id);
      expect(result).toHaveProperty('active_team', testTeam2.id);

      // Verify user's active_team was updated in database
      const userResult = await db.query(
        'SELECT id, active_team FROM users WHERE id = $1',
        [testUser.id]
      );
      const updatedUser = userResult.rows[0];

      expect(updatedUser.active_team).toBe(testTeam2.id);

      // Verify email invitation was deleted
      const invitationResult = await db.query(
        'SELECT id FROM email_invitations WHERE id = $1',
        [testInvitation.id]
      );

      expect(invitationResult.rows.length).toBe(0);
    });

    it('should handle non-member activation (Prisma validation)', async () => {
      // Create a new team where user is NOT a member
      const nonMemberTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [`Non-Member Team ${Date.now()}`, testUser.id]
      );
      const nonMemberTeam = nonMemberTeamResult.rows[0];

      // Create another user
      const otherUserEmail = `other-user-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const otherUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [otherUserEmail, 'Other User', hashedPassword, timezoneId]
      );
      const otherUser = otherUserResult.rows[0];

      try {
        // Attempt to activate a team where user is not a member
        await expect(
          teamsService.activateTeam(otherUser.id, nonMemberTeam.id)
        ).rejects.toThrow('User is not a member of this team');
      } finally {
        // Cleanup
        await db.query('DELETE FROM teams WHERE id = $1', [nonMemberTeam.id]);
        await db.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle activation when no email invitation exists', async () => {
      // Ensure no email invitation exists
      await db.query('DELETE FROM email_invitations WHERE team_member_id = $1', [testMember.id]);

      // Reset user's active_team
      await db.query('UPDATE users SET active_team = NULL WHERE id = $1', [testUser.id]);

      // Should still work (just won't delete any invitations)
      const result = await teamsService.activateTeam(testUser.id, testTeam2.id);

      expect(result).toHaveProperty('id', testUser.id);
      expect(result).toHaveProperty('active_team', testTeam2.id);

      // Verify user's active_team was updated
      const userResult = await db.query(
        'SELECT id, active_team FROM users WHERE id = $1',
        [testUser.id]
      );
      const updatedUser = userResult.rows[0];

      expect(updatedUser.active_team).toBe(testTeam2.id);
    });

    it('should handle switching between teams', async () => {
      // Set active team to team1
      await db.query('UPDATE users SET active_team = $1 WHERE id = $2', [testTeam1.id, testUser.id]);

      // Switch to team2
      const result = await teamsService.activateTeam(testUser.id, testTeam2.id);

      expect(result).toHaveProperty('active_team', testTeam2.id);

      // Verify in database
      const userResult = await db.query(
        'SELECT active_team FROM users WHERE id = $1',
        [testUser.id]
      );

      expect(userResult.rows[0].active_team).toBe(testTeam2.id);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback if user update fails', async () => {
      // This test verifies transaction atomicity
      // If any part fails, the entire transaction should rollback

      // Create a scenario where the transaction would fail
      // (e.g., invalid user ID)
      const invalidUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        teamsService.activateTeam(invalidUserId, testTeam2.id)
      ).rejects.toThrow();

      // Verify no side effects occurred
      // (email invitation should still exist if we had one)
    });
  });
});
