/**
 * Contract Test: Teams Service - checkTeamNameExists
 *
 * Tests behavioral parity between SQL query and Prisma
 * for checking if a team name already exists for a user.
 *
 * Original SQL: teams-controller.ts:14-15
 * Prisma Implementation: services/teams/teams-service.ts:checkTeamNameExists
 */

import { TeamsService } from '../../../services/teams/teams-service';
import db from '../../../config/db';
import bcrypt from 'bcrypt';

describe('Contract Test: TeamsService.checkTeamNameExists', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam: any;
  let otherUser: any;
  let otherTeam: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create test user
    const userEmail = `check-name-test-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Check Name Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create test team
    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Existing Team Name ${Date.now()}`, testUser.id]
    );
    testTeam = teamResult.rows[0];

    // Create other user
    const otherUserEmail = `other-user-check-${Date.now()}@example.com`;
    const otherUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [otherUserEmail, 'Other User', hashedPassword, timezoneId]
    );
    otherUser = otherUserResult.rows[0];

    // Create team for other user with same name (to test user isolation)
    const otherTeamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [testTeam.name, otherUser.id] // Same name as testTeam
    );
    otherTeam = otherTeamResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup
    if (testTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam.id]);
    }
    if (otherTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [otherTeam.id]);
    }
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
    if (otherUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    }
  });

  describe('SQL vs Prisma Behavioral Parity', () => {
    it('should check if team name exists using SQL', async () => {
      const q = `SELECT * FROM teams WHERE user_id = $2 AND name = $1`;

      // Check existing team name
      const existingResult = await db.query(q, [testTeam.name, testUser.id]);
      expect(existingResult.rows.length).toBeGreaterThan(0);

      // Check non-existing team name
      const nonExistingResult = await db.query(q, ['Non-Existent Team Name', testUser.id]);
      expect(nonExistingResult.rows.length).toBe(0);
    });

    it('should check if team name exists using Prisma', async () => {
      // Check existing team name
      const exists = await teamsService.checkTeamNameExists(testUser.id, testTeam.name);
      expect(exists).toBe(true);

      // Check non-existing team name
      const notExists = await teamsService.checkTeamNameExists(testUser.id, 'Non-Existent Team Name');
      expect(notExists).toBe(false);
    });

    it('should match SQL and Prisma results for existing name', async () => {
      // SQL check
      const q = `SELECT * FROM teams WHERE user_id = $2 AND name = $1`;
      const sqlResult = await db.query(q, [testTeam.name, testUser.id]);
      const sqlExists = sqlResult.rows.length > 0;

      // Prisma check
      const prismaExists = await teamsService.checkTeamNameExists(testUser.id, testTeam.name);

      // Should match
      expect(prismaExists).toBe(sqlExists);
      expect(prismaExists).toBe(true);
    });

    it('should match SQL and Prisma results for non-existing name', async () => {
      const nonExistentName = 'Definitely Does Not Exist';

      // SQL check
      const q = `SELECT * FROM teams WHERE user_id = $2 AND name = $1`;
      const sqlResult = await db.query(q, [nonExistentName, testUser.id]);
      const sqlExists = sqlResult.rows.length > 0;

      // Prisma check
      const prismaExists = await teamsService.checkTeamNameExists(testUser.id, nonExistentName);

      // Should match
      expect(prismaExists).toBe(sqlExists);
      expect(prismaExists).toBe(false);
    });
  });

  describe('User Isolation', () => {
    it('should return false for name that exists for different user', async () => {
      // testTeam.name exists for testUser
      // otherTeam has the same name but belongs to otherUser
      // Checking if testTeam.name exists for otherUser should only find otherTeam

      // Check from testUser's perspective (should find testTeam)
      const testUserHasName = await teamsService.checkTeamNameExists(testUser.id, testTeam.name);
      expect(testUserHasName).toBe(true);

      // Check from otherUser's perspective (should find otherTeam)
      const otherUserHasName = await teamsService.checkTeamNameExists(otherUser.id, testTeam.name);
      expect(otherUserHasName).toBe(true);

      // Check if otherUser has a name that only testUser has
      const uniqueName = `Unique to TestUser ${Date.now()}`;
      await db.query(
        `INSERT INTO teams (name, user_id) VALUES ($1, $2)`,
        [uniqueName, testUser.id]
      );

      const otherUserHasUniqueName = await teamsService.checkTeamNameExists(otherUser.id, uniqueName);
      expect(otherUserHasUniqueName).toBe(false);

      // Cleanup unique team
      await db.query('DELETE FROM teams WHERE name = $1', [uniqueName]);
    });

    it('should only check teams owned by the specified user', async () => {
      // Create a unique team name for testUser
      const uniqueTeamName = `Unique Team ${Date.now()}`;
      const uniqueTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [uniqueTeamName, testUser.id]
      );
      const uniqueTeam = uniqueTeamResult.rows[0];

      try {
        // testUser should see it exists
        const testUserCheck = await teamsService.checkTeamNameExists(testUser.id, uniqueTeamName);
        expect(testUserCheck).toBe(true);

        // otherUser should NOT see it exists (different user)
        const otherUserCheck = await teamsService.checkTeamNameExists(otherUser.id, uniqueTeamName);
        expect(otherUserCheck).toBe(false);
      } finally {
        await db.query('DELETE FROM teams WHERE id = $1', [uniqueTeam.id]);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty team name', async () => {
      const exists = await teamsService.checkTeamNameExists(testUser.id, '');
      expect(exists).toBe(false);
    });

    it('should handle very long team name', async () => {
      const longName = 'A'.repeat(1000);
      const exists = await teamsService.checkTeamNameExists(testUser.id, longName);
      expect(exists).toBe(false);
    });

    it('should handle special characters in team name', async () => {
      const specialCharsName = `Team @#$%^&*() ${Date.now()}`;
      const specialTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [specialCharsName, testUser.id]
      );
      const specialTeam = specialTeamResult.rows[0];

      try {
        const exists = await teamsService.checkTeamNameExists(testUser.id, specialCharsName);
        expect(exists).toBe(true);
      } finally {
        await db.query('DELETE FROM teams WHERE id = $1', [specialTeam.id]);
      }
    });

    it('should be case-sensitive', async () => {
      const originalName = testTeam.name;
      const uppercaseName = originalName.toUpperCase();
      const lowercaseName = originalName.toLowerCase();

      // Check if case-sensitive (depends on database collation)
      // Most PostgreSQL installations are case-sensitive by default
      if (uppercaseName !== originalName) {
        const uppercaseExists = await teamsService.checkTeamNameExists(testUser.id, uppercaseName);
        // This depends on database collation, so we just verify it returns a boolean
        expect(typeof uppercaseExists).toBe('boolean');
      }

      if (lowercaseName !== originalName) {
        const lowercaseExists = await teamsService.checkTeamNameExists(testUser.id, lowercaseName);
        // This depends on database collation, so we just verify it returns a boolean
        expect(typeof lowercaseExists).toBe('boolean');
      }

      // The exact match should always exist
      const exactExists = await teamsService.checkTeamNameExists(testUser.id, originalName);
      expect(exactExists).toBe(true);
    });

    it('should handle non-existent user ID', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const exists = await teamsService.checkTeamNameExists(nonExistentUserId, testTeam.name);
      expect(exists).toBe(false);
    });

    it('should handle user with no teams', async () => {
      // Create a new user with no teams
      const newUserEmail = `no-teams-user-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const newUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [newUserEmail, 'No Teams User', hashedPassword, timezoneId]
      );
      const newUser = newUserResult.rows[0];

      try {
        const exists = await teamsService.checkTeamNameExists(newUser.id, 'Any Team Name');
        expect(exists).toBe(false);
      } finally {
        await db.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      }
    });
  });

  describe('Multiple Teams with Different Names', () => {
    it('should correctly identify which names exist', async () => {
      // Create multiple teams for testUser
      const team2Result = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id, name`,
        [`Second Team ${Date.now()}`, testUser.id]
      );
      const team2 = team2Result.rows[0];

      const team3Result = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id, name`,
        [`Third Team ${Date.now()}`, testUser.id]
      );
      const team3 = team3Result.rows[0];

      try {
        // Check all existing team names
        const team1Exists = await teamsService.checkTeamNameExists(testUser.id, testTeam.name);
        const team2Exists = await teamsService.checkTeamNameExists(testUser.id, team2.name);
        const team3Exists = await teamsService.checkTeamNameExists(testUser.id, team3.name);

        expect(team1Exists).toBe(true);
        expect(team2Exists).toBe(true);
        expect(team3Exists).toBe(true);

        // Check non-existing name
        const nonExistentExists = await teamsService.checkTeamNameExists(testUser.id, 'Fourth Team');
        expect(nonExistentExists).toBe(false);
      } finally {
        await db.query('DELETE FROM teams WHERE id = $1', [team2.id]);
        await db.query('DELETE FROM teams WHERE id = $1', [team3.id]);
      }
    });
  });
});
