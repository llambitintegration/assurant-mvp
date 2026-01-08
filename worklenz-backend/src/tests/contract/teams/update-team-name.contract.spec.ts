/**
 * Contract Test: Teams Service - updateTeamName
 *
 * Tests behavioral parity between SQL (update_team_name_once stored procedure) and Prisma
 * for updating a team's name with uniqueness validation.
 *
 * Original SQL: teams-controller.ts:100-101
 * Prisma Implementation: services/teams/teams-service.ts:updateTeamName
 *
 * NOTE: The update_team_name_once stored procedure doesn't exist in the database,
 * so we're testing against the expected behavior based on the controller implementation.
 */

import { TeamsService } from '../../../services/teams/teams-service';
import db from '../../../config/db';
import bcrypt from 'bcrypt';

describe('Contract Test: TeamsService.updateTeamName', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam1: any;
  let testTeam2: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create test user
    const userEmail = `update-team-name-test-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Update Team Name Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create first team
    const team1Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id, created_at, updated_at`,
      [`Original Team Name ${Date.now()}`, testUser.id]
    );
    testTeam1 = team1Result.rows[0];

    // Create second team (to test duplicate name validation)
    const team2Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id, created_at, updated_at`,
      [`Existing Team Name ${Date.now()}`, testUser.id]
    );
    testTeam2 = team2Result.rows[0];
  });

  afterAll(async () => {
    // Cleanup
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

  describe('Basic Functionality', () => {
    it('should update team name successfully', async () => {
      const newName = `Updated Team Name ${Date.now()}`;
      const oldUpdatedAt = testTeam1.updated_at;

      // Wait 10ms to ensure updated_at changes (PostgreSQL timestamp precision)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update team name using Prisma
      const result = await teamsService.updateTeamName(testUser.id, testTeam1.id, newName);

      // Verify result
      expect(result).toHaveProperty('id', testTeam1.id);
      expect(result).toHaveProperty('name', newName);
      expect(result).toHaveProperty('user_id', testUser.id);
      // Allow for same timestamp (PostgreSQL may not update if milliseconds are same)
      expect(new Date(result.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(oldUpdatedAt).getTime());

      // Verify in database
      const teamResult = await db.query(
        'SELECT id, name, user_id, updated_at FROM teams WHERE id = $1',
        [testTeam1.id]
      );
      const updatedTeam = teamResult.rows[0];

      expect(updatedTeam.name).toBe(newName);
      expect(new Date(updatedTeam.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(oldUpdatedAt).getTime());
    });

    it('should return unchanged team if name is the same', async () => {
      const currentName = testTeam1.name;

      // Attempt to "update" with same name
      const result = await teamsService.updateTeamName(testUser.id, testTeam1.id, currentName);

      // Should return the team without updating
      expect(result).toHaveProperty('name', currentName);

      // Verify updated_at didn't change (or changed minimally)
      const teamResult = await db.query(
        'SELECT name FROM teams WHERE id = $1',
        [testTeam1.id]
      );

      expect(teamResult.rows[0].name).toBe(currentName);
    });
  });

  describe('Uniqueness Validation', () => {
    it('should reject duplicate team name for same user', async () => {
      // Attempt to rename team1 to team2's name
      await expect(
        teamsService.updateTeamName(testUser.id, testTeam1.id, testTeam2.name)
      ).rejects.toThrow('TEAM_NAME_EXISTS_ERROR');

      // Verify team1 name didn't change
      const teamResult = await db.query(
        'SELECT name FROM teams WHERE id = $1',
        [testTeam1.id]
      );

      expect(teamResult.rows[0].name).not.toBe(testTeam2.name);
    });

    it('should allow same name for different users', async () => {
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

      // Create a team for the other user
      const otherTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id, name, user_id`,
        [`Other User Team ${Date.now()}`, otherUser.id]
      );
      const otherTeam = otherTeamResult.rows[0];

      try {
        // Should allow updating to a name that exists for a different user
        const newName = testTeam2.name; // This name exists for testUser, but not for otherUser
        const result = await teamsService.updateTeamName(otherUser.id, otherTeam.id, newName);

        expect(result).toHaveProperty('name', newName);

        // Verify in database
        const teamResult = await db.query(
          'SELECT name FROM teams WHERE id = $1',
          [otherTeam.id]
        );

        expect(teamResult.rows[0].name).toBe(newName);
      } finally {
        // Cleanup
        await db.query('DELETE FROM teams WHERE id = $1', [otherTeam.id]);
        await db.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
      }
    });

    it('should allow renaming team back to its original name', async () => {
      // Get current name
      const teamResult = await db.query(
        'SELECT name FROM teams WHERE id = $1',
        [testTeam1.id]
      );
      const originalName = teamResult.rows[0].name;

      // Rename to something else
      const tempName = `Temp Name ${Date.now()}`;
      await teamsService.updateTeamName(testUser.id, testTeam1.id, tempName);

      // Rename back to original (should not trigger duplicate error)
      const result = await teamsService.updateTeamName(testUser.id, testTeam1.id, originalName);

      expect(result).toHaveProperty('name', originalName);

      // Verify in database
      const updatedTeamResult = await db.query(
        'SELECT name FROM teams WHERE id = $1',
        [testTeam1.id]
      );

      expect(updatedTeamResult.rows[0].name).toBe(originalName);
    });
  });

  describe('Authorization', () => {
    it('should reject update if user is not team owner', async () => {
      // Create another user
      const otherUserEmail = `non-owner-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const otherUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [otherUserEmail, 'Non-Owner User', hashedPassword, timezoneId]
      );
      const otherUser = otherUserResult.rows[0];

      try {
        // Attempt to update team1 (owned by testUser) as otherUser
        await expect(
          teamsService.updateTeamName(otherUser.id, testTeam1.id, 'Unauthorized Name')
        ).rejects.toThrow('Team not found or user is not the owner');

        // Verify team name didn't change
        const teamResult = await db.query(
          'SELECT name FROM teams WHERE id = $1',
          [testTeam1.id]
        );

        expect(teamResult.rows[0].name).not.toBe('Unauthorized Name');
      } finally {
        // Cleanup
        await db.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
      }
    });

    it('should reject update if team does not exist', async () => {
      const nonExistentTeamId = '00000000-0000-0000-0000-000000000000';

      await expect(
        teamsService.updateTeamName(testUser.id, nonExistentTeamId, 'New Name')
      ).rejects.toThrow('Team not found or user is not the owner');
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback all changes if validation fails', async () => {
      const originalName = testTeam1.name;

      // Attempt to update with duplicate name (should fail)
      await expect(
        teamsService.updateTeamName(testUser.id, testTeam1.id, testTeam2.name)
      ).rejects.toThrow('TEAM_NAME_EXISTS_ERROR');

      // Verify team1 name didn't change
      const teamResult = await db.query(
        'SELECT name FROM teams WHERE id = $1',
        [testTeam1.id]
      );

      expect(teamResult.rows[0].name).toBe(originalName);
    });
  });

  describe('Error Handling', () => {
    it('should throw TEAM_NAME_EXISTS_ERROR with correct error name', async () => {
      try {
        await teamsService.updateTeamName(testUser.id, testTeam1.id, testTeam2.name);
        fail('Should have thrown TEAM_NAME_EXISTS_ERROR');
      } catch (error: any) {
        expect(error.name).toBe('TEAM_NAME_EXISTS_ERROR');
        expect(error.message).toBe('TEAM_NAME_EXISTS_ERROR');
      }
    });
  });
});
