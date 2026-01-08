/**
 * Contract Test: Teams Service - getTeamInvites
 *
 * Tests behavioral parity between SQL query and Prisma
 * for fetching pending team invitations for a user.
 *
 * Original SQL: teams-controller.ts:57-68
 * Prisma Implementation: services/teams/teams-service.ts:getTeamInvites
 */

import { TeamsService } from '../../../services/teams/teams-service';
import db from '../../../config/db';
import bcrypt from 'bcrypt';

describe('Contract Test: TeamsService.getTeamInvites', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeamOwner: any;
  let testTeam1: any;
  let testTeam2: any;
  let testRole1: any;
  let testRole2: any;
  let testMember1: any;
  let testMember2: any;
  let testInvitation1: any;
  let testInvitation2: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create team owner
    const ownerEmail = `team-owner-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const ownerResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [ownerEmail, 'Team Owner', hashedPassword, timezoneId]
    );
    testTeamOwner = ownerResult.rows[0];

    // Create test user who will receive invitations
    const userEmail = `invite-test-user-${Date.now()}@example.com`;
    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Invite Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create team 1 (owned by testTeamOwner)
    const team1Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Invite Team 1 ${Date.now()}`, testTeamOwner.id]
    );
    testTeam1 = team1Result.rows[0];

    // Create team 2 (owned by testTeamOwner)
    const team2Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Invite Team 2 ${Date.now()}`, testTeamOwner.id]
    );
    testTeam2 = team2Result.rows[0];

    // Create roles
    const role1Result = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Role 1', testTeam1.id, false, false, false]
    );
    testRole1 = role1Result.rows[0];

    const role2Result = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Role 2', testTeam2.id, false, false, false]
    );
    testRole2 = role2Result.rows[0];

    // Create team members for testUser
    const member1Result = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [testUser.id, testTeam1.id, testRole1.id]
    );
    testMember1 = member1Result.rows[0];

    const member2Result = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [testUser.id, testTeam2.id, testRole2.id]
    );
    testMember2 = member2Result.rows[0];

    // Create email invitations
    const invitation1Result = await db.query(
      `INSERT INTO email_invitations (name, email, team_id, team_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Invitation 1', testUser.email, testTeam1.id, testMember1.id]
    );
    testInvitation1 = invitation1Result.rows[0];

    const invitation2Result = await db.query(
      `INSERT INTO email_invitations (name, email, team_id, team_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Invitation 2', testUser.email, testTeam2.id, testMember2.id]
    );
    testInvitation2 = invitation2Result.rows[0];
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    if (testInvitation1?.id) {
      await db.query('DELETE FROM email_invitations WHERE id = $1', [testInvitation1.id]);
    }
    if (testInvitation2?.id) {
      await db.query('DELETE FROM email_invitations WHERE id = $1', [testInvitation2.id]);
    }
    if (testMember1?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [testMember1.id]);
    }
    if (testMember2?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [testMember2.id]);
    }
    if (testRole1?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [testRole1.id]);
    }
    if (testRole2?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [testRole2.id]);
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
    if (testTeamOwner?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testTeamOwner.id]);
    }
  });

  describe('SQL vs Prisma Behavioral Parity', () => {
    it('should return team invites using SQL query', async () => {
      const q = `
        SELECT id,
               team_id,
               team_member_id,
               (SELECT name FROM teams WHERE id = team_id) AS team_name,
               (SELECT name FROM users WHERE id = (SELECT user_id FROM teams WHERE id = team_id)) AS team_owner
        FROM email_invitations
        WHERE email = (SELECT email FROM users WHERE id = $1);
      `;

      const result = await db.query(q, [testUser.id]);
      const sqlInvites = result.rows;

      // Verify structure
      expect(sqlInvites.length).toBe(2);
      expect(sqlInvites[0]).toHaveProperty('id');
      expect(sqlInvites[0]).toHaveProperty('team_id');
      expect(sqlInvites[0]).toHaveProperty('team_member_id');
      expect(sqlInvites[0]).toHaveProperty('team_name');
      expect(sqlInvites[0]).toHaveProperty('team_owner');

      // Verify content
      const invite1 = sqlInvites.find((inv: any) => inv.id === testInvitation1.id);
      const invite2 = sqlInvites.find((inv: any) => inv.id === testInvitation2.id);

      expect(invite1).toBeDefined();
      expect(invite1.team_id).toBe(testTeam1.id);
      expect(invite1.team_member_id).toBe(testMember1.id);
      expect(invite1.team_name).toBe(testTeam1.name);
      expect(invite1.team_owner).toBe(testTeamOwner.name);

      expect(invite2).toBeDefined();
      expect(invite2.team_id).toBe(testTeam2.id);
      expect(invite2.team_member_id).toBe(testMember2.id);
      expect(invite2.team_name).toBe(testTeam2.name);
      expect(invite2.team_owner).toBe(testTeamOwner.name);
    });

    it('should return team invites using Prisma service', async () => {
      const prismaInvites = await teamsService.getTeamInvites(testUser.id);

      // Verify structure
      expect(prismaInvites.length).toBe(2);
      expect(prismaInvites[0]).toHaveProperty('id');
      expect(prismaInvites[0]).toHaveProperty('team_id');
      expect(prismaInvites[0]).toHaveProperty('team_member_id');
      expect(prismaInvites[0]).toHaveProperty('team_name');
      expect(prismaInvites[0]).toHaveProperty('team_owner');

      // Verify content
      const invite1 = prismaInvites.find((inv: any) => inv.id === testInvitation1.id);
      const invite2 = prismaInvites.find((inv: any) => inv.id === testInvitation2.id);

      expect(invite1).toBeDefined();
      expect(invite1!.team_id).toBe(testTeam1.id);
      expect(invite1!.team_member_id).toBe(testMember1.id);
      expect(invite1!.team_name).toBe(testTeam1.name);
      expect(invite1!.team_owner).toBe(testTeamOwner.name);

      expect(invite2).toBeDefined();
      expect(invite2!.team_id).toBe(testTeam2.id);
      expect(invite2!.team_member_id).toBe(testMember2.id);
      expect(invite2!.team_name).toBe(testTeam2.name);
      expect(invite2!.team_owner).toBe(testTeamOwner.name);
    });

    it('should match SQL and Prisma results exactly', async () => {
      // Get SQL results
      const q = `
        SELECT id,
               team_id,
               team_member_id,
               (SELECT name FROM teams WHERE id = team_id) AS team_name,
               (SELECT name FROM users WHERE id = (SELECT user_id FROM teams WHERE id = team_id)) AS team_owner
        FROM email_invitations
        WHERE email = (SELECT email FROM users WHERE id = $1)
        ORDER BY id;
      `;
      const sqlResult = await db.query(q, [testUser.id]);
      const sqlInvites = sqlResult.rows;

      // Get Prisma results
      const prismaInvites = await teamsService.getTeamInvites(testUser.id);
      const sortedPrismaInvites = prismaInvites.sort((a, b) => a.id.localeCompare(b.id));

      // Verify same number of results
      expect(prismaInvites.length).toBe(sqlInvites.length);

      // Verify each invitation matches
      for (let i = 0; i < sqlInvites.length; i++) {
        expect(sortedPrismaInvites[i].id).toBe(sqlInvites[i].id);
        expect(sortedPrismaInvites[i].team_id).toBe(sqlInvites[i].team_id);
        expect(sortedPrismaInvites[i].team_member_id).toBe(sqlInvites[i].team_member_id);
        expect(sortedPrismaInvites[i].team_name).toBe(sqlInvites[i].team_name);
        expect(sortedPrismaInvites[i].team_owner).toBe(sqlInvites[i].team_owner);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array if user has no invitations', async () => {
      // Create a new user with no invitations
      const newUserEmail = `no-invites-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const newUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [newUserEmail, 'No Invites User', hashedPassword, timezoneId]
      );
      const newUser = newUserResult.rows[0];

      try {
        const invites = await teamsService.getTeamInvites(newUser.id);
        expect(invites).toEqual([]);
      } finally {
        await db.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      }
    });

    it('should return empty array if user does not exist', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const invites = await teamsService.getTeamInvites(nonExistentUserId);
      expect(invites).toEqual([]);
    });

    it('should only return invitations for user email (not all invitations)', async () => {
      // Create another user with different email
      const otherUserEmail = `other-user-invites-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const otherUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email`,
        [otherUserEmail, 'Other User', hashedPassword, timezoneId]
      );
      const otherUser = otherUserResult.rows[0];

      // Create invitation for other user
      const otherTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [`Other Team ${Date.now()}`, testTeamOwner.id]
      );
      const otherTeam = otherTeamResult.rows[0];

      const otherRoleResult = await db.query(
        `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['Other Role', otherTeam.id, false, false, false]
      );
      const otherRole = otherRoleResult.rows[0];

      const otherMemberResult = await db.query(
        `INSERT INTO team_members (user_id, team_id, role_id, active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
        [otherUser.id, otherTeam.id, otherRole.id]
      );
      const otherMember = otherMemberResult.rows[0];

      const otherInvitationResult = await db.query(
        `INSERT INTO email_invitations (name, email, team_id, team_member_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Other Invitation', otherUser.email, otherTeam.id, otherMember.id]
      );
      const otherInvitation = otherInvitationResult.rows[0];

      try {
        // Get invitations for testUser
        const testUserInvites = await teamsService.getTeamInvites(testUser.id);

        // Should only contain testUser's invitations (not otherUser's)
        expect(testUserInvites.length).toBe(2);
        expect(testUserInvites.every((inv: any) => inv.id !== otherInvitation.id)).toBe(true);

        // Get invitations for otherUser
        const otherUserInvites = await teamsService.getTeamInvites(otherUser.id);

        // Should only contain otherUser's invitation
        expect(otherUserInvites.length).toBe(1);
        expect(otherUserInvites[0].id).toBe(otherInvitation.id);
      } finally {
        // Cleanup
        await db.query('DELETE FROM email_invitations WHERE id = $1', [otherInvitation.id]);
        await db.query('DELETE FROM team_members WHERE id = $1', [otherMember.id]);
        await db.query('DELETE FROM roles WHERE id = $1', [otherRole.id]);
        await db.query('DELETE FROM teams WHERE id = $1', [otherTeam.id]);
        await db.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
      }
    });

    it('should handle null team_id in invitation', async () => {
      // Create invitation with null team_id
      const nullTeamInvitationResult = await db.query(
        `INSERT INTO email_invitations (name, email, team_id, team_member_id)
         VALUES ($1, $2, NULL, NULL)
         RETURNING id`,
        ['Null Team Invitation', testUser.email]
      );
      const nullTeamInvitation = nullTeamInvitationResult.rows[0];

      try {
        const invites = await teamsService.getTeamInvites(testUser.id);

        // Should include the null team invitation
        const nullInvite = invites.find((inv: any) => inv.id === nullTeamInvitation.id);
        expect(nullInvite).toBeDefined();
        expect(nullInvite!.team_id).toBeNull();
        expect(nullInvite!.team_name).toBeNull();
        expect(nullInvite!.team_owner).toBeNull();
      } finally {
        await db.query('DELETE FROM email_invitations WHERE id = $1', [nullTeamInvitation.id]);
      }
    });
  });
});
