/**
 * Contract Test: Teams Service - getTeamsForUser
 *
 * Tests behavioral parity between SQL query and Prisma (typed $queryRaw)
 * for fetching all teams accessible to a user with metadata.
 *
 * Original SQL: teams-controller.ts:27-51
 * Prisma Implementation: services/teams/teams-service.ts:getTeamsForUser
 *
 * This is a complex query with subqueries and EXISTS clauses.
 * Implementation uses typed $queryRaw for optimal performance.
 */

import { TeamsService } from '../../../services/teams/teams-service';
import db from '../../../config/db';
import bcrypt from 'bcrypt';

describe('Contract Test: TeamsService.getTeamsForUser', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let otherUser: any;
  let ownedTeam: any;
  let memberTeam: any;
  let otherTeam: any;
  let roleForMemberTeam: any;
  let teamMember: any;
  let emailInvitation: any;

  beforeAll(async () => {
    teamsService = new TeamsService();

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    // Create test user
    const userEmail = `get-teams-user-${Date.now()}@example.com`;
    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Get Teams Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    // Create other user (team owner)
    const otherUserEmail = `other-team-owner-${Date.now()}@example.com`;
    const otherUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [otherUserEmail, 'Other Team Owner', hashedPassword, timezoneId]
    );
    otherUser = otherUserResult.rows[0];

    // Create team owned by testUser
    const ownedTeamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Owned Team ${Date.now()}`, testUser.id]
    );
    ownedTeam = ownedTeamResult.rows[0];

    // Create team owned by otherUser where testUser is a member
    const memberTeamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Member Team ${Date.now()}`, otherUser.id]
    );
    memberTeam = memberTeamResult.rows[0];

    // Create team owned by otherUser where testUser is NOT a member
    const otherTeamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Other Team ${Date.now()}`, otherUser.id]
    );
    otherTeam = otherTeamResult.rows[0];

    // Create role for memberTeam
    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Member Role', memberTeam.id, false, false, false]
    );
    roleForMemberTeam = roleResult.rows[0];

    // Add testUser as member of memberTeam
    const teamMemberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [testUser.id, memberTeam.id, roleForMemberTeam.id]
    );
    teamMember = teamMemberResult.rows[0];

    // Create email invitation for testUser to memberTeam
    const invitationResult = await db.query(
      `INSERT INTO email_invitations (name, email, team_id, team_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Team Invitation', testUser.email, memberTeam.id, teamMember.id]
    );
    emailInvitation = invitationResult.rows[0];

    // Set testUser's active team to ownedTeam
    await db.query('UPDATE users SET active_team = $1 WHERE id = $2', [ownedTeam.id, testUser.id]);
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (emailInvitation?.id) {
      await db.query('DELETE FROM email_invitations WHERE id = $1', [emailInvitation.id]);
    }
    if (teamMember?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [teamMember.id]);
    }
    if (roleForMemberTeam?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [roleForMemberTeam.id]);
    }
    // Set user's active_team to NULL before deleting teams (foreign key constraint)
    if (testUser?.id) {
      await db.query('UPDATE users SET active_team = NULL WHERE id = $1', [testUser.id]);
    }
    if (otherUser?.id) {
      await db.query('UPDATE users SET active_team = NULL WHERE id = $1', [otherUser.id]);
    }
    if (ownedTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [ownedTeam.id]);
    }
    if (memberTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [memberTeam.id]);
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
    it('should return teams using SQL query', async () => {
      const q = `
        SELECT id,
               name,
               created_at,
               (id = $2) AS active,
               (user_id = $1) AS owner,
               EXISTS(SELECT 1
                      FROM email_invitations
                      WHERE team_id = teams.id
                        AND team_member_id = (SELECT id
                                              FROM team_members
                                              WHERE team_members.user_id = $1
                                                AND team_members.team_id = teams.id)) AS pending_invitation,
               (CASE
                  WHEN user_id = $1 THEN 'You'
                  ELSE (SELECT name FROM users WHERE id = teams.user_id) END
                 ) AS owns_by
        FROM teams
        WHERE user_id = $1
           OR id IN (SELECT team_id FROM team_members WHERE team_members.user_id = $1
                 AND team_members.active IS TRUE)
        ORDER BY name;
      `;

      const result = await db.query(q, [testUser.id, ownedTeam.id]);
      const sqlTeams = result.rows;

      // Should return 2 teams: ownedTeam and memberTeam (NOT otherTeam)
      expect(sqlTeams.length).toBe(2);

      // Find ownedTeam
      const sqlOwnedTeam = sqlTeams.find((t: any) => t.id === ownedTeam.id);
      expect(sqlOwnedTeam).toBeDefined();
      expect(sqlOwnedTeam!.name).toBe(ownedTeam.name);
      expect(sqlOwnedTeam!.active).toBe(true); // This is the active team
      expect(sqlOwnedTeam!.owner).toBe(true); // testUser owns this team
      expect(sqlOwnedTeam!.pending_invitation).toBe(false); // No pending invitation
      expect(sqlOwnedTeam!.owns_by).toBe('You'); // Owner is testUser

      // Find memberTeam
      const sqlMemberTeam = sqlTeams.find((t: any) => t.id === memberTeam.id);
      expect(sqlMemberTeam).toBeDefined();
      expect(sqlMemberTeam!.name).toBe(memberTeam.name);
      expect(sqlMemberTeam!.active).toBe(false); // Not the active team
      expect(sqlMemberTeam!.owner).toBe(false); // testUser does NOT own this team
      expect(sqlMemberTeam!.pending_invitation).toBe(true); // Has pending invitation
      expect(sqlMemberTeam!.owns_by).toBe(otherUser.name); // Owner is otherUser

      // Should NOT include otherTeam
      const sqlOtherTeam = sqlTeams.find((t: any) => t.id === otherTeam.id);
      expect(sqlOtherTeam).toBeUndefined();
    });

    it('should return teams using Prisma service (typed $queryRaw)', async () => {
      const prismaTeams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);

      // Should return 2 teams: ownedTeam and memberTeam (NOT otherTeam)
      expect(prismaTeams.length).toBe(2);

      // Find ownedTeam
      const prismaOwnedTeam = prismaTeams.find((t: any) => t.id === ownedTeam.id);
      expect(prismaOwnedTeam).toBeDefined();
      expect(prismaOwnedTeam!.name).toBe(ownedTeam.name);
      expect(prismaOwnedTeam!.active).toBe(true);
      expect(prismaOwnedTeam!.owner).toBe(true);
      expect(prismaOwnedTeam!.pending_invitation).toBe(false);
      expect(prismaOwnedTeam!.owns_by).toBe('You');

      // Find memberTeam
      const prismaMemberTeam = prismaTeams.find((t: any) => t.id === memberTeam.id);
      expect(prismaMemberTeam).toBeDefined();
      expect(prismaMemberTeam!.name).toBe(memberTeam.name);
      expect(prismaMemberTeam!.active).toBe(false);
      expect(prismaMemberTeam!.owner).toBe(false);
      expect(prismaMemberTeam!.pending_invitation).toBe(true);
      expect(prismaMemberTeam!.owns_by).toBe(otherUser.name);

      // Should NOT include otherTeam
      const prismaOtherTeam = prismaTeams.find((t: any) => t.id === otherTeam.id);
      expect(prismaOtherTeam).toBeUndefined();
    });

    it('should match SQL and Prisma results exactly', async () => {
      // Get SQL results
      const q = `
        SELECT id,
               name,
               created_at,
               (id = $2) AS active,
               (user_id = $1) AS owner,
               EXISTS(SELECT 1
                      FROM email_invitations
                      WHERE team_id = teams.id
                        AND team_member_id = (SELECT id
                                              FROM team_members
                                              WHERE team_members.user_id = $1
                                                AND team_members.team_id = teams.id)) AS pending_invitation,
               (CASE
                  WHEN user_id = $1 THEN 'You'
                  ELSE (SELECT name FROM users WHERE id = teams.user_id) END
                 ) AS owns_by
        FROM teams
        WHERE user_id = $1
           OR id IN (SELECT team_id FROM team_members WHERE team_members.user_id = $1
                 AND team_members.active IS TRUE)
        ORDER BY name;
      `;
      const sqlResult = await db.query(q, [testUser.id, ownedTeam.id]);
      const sqlTeams = sqlResult.rows;

      // Get Prisma results
      const prismaTeams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);

      // Verify same number of results
      expect(prismaTeams.length).toBe(sqlTeams.length);

      // Verify each team matches (order should be the same: ORDER BY name)
      for (let i = 0; i < sqlTeams.length; i++) {
        expect(prismaTeams[i].id).toBe(sqlTeams[i].id);
        expect(prismaTeams[i].name).toBe(sqlTeams[i].name);
        expect(prismaTeams[i].active).toBe(sqlTeams[i].active);
        expect(prismaTeams[i].owner).toBe(sqlTeams[i].owner);
        expect(prismaTeams[i].pending_invitation).toBe(sqlTeams[i].pending_invitation);
        expect(prismaTeams[i].owns_by).toBe(sqlTeams[i].owns_by);
        // created_at timestamps should be close (within 1 second)
        expect(Math.abs(new Date(prismaTeams[i].created_at).getTime() - new Date(sqlTeams[i].created_at).getTime())).toBeLessThan(1000);
      }
    });
  });

  describe('Active Team Flag', () => {
    it('should set active=true only for the active team', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);

      const ownedTeamResult = teams.find((t: any) => t.id === ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(ownedTeamResult!.active).toBe(true);
      expect(memberTeamResult!.active).toBe(false);
    });

    it('should handle null/undefined activeTeamId', async () => {
      const teamsWithNull = await teamsService.getTeamsForUser(testUser.id, null);
      const teamsWithUndefined = await teamsService.getTeamsForUser(testUser.id, undefined);

      // All teams should have active=false (falsy values from SQL NULL comparison)
      // Note: SQL "id = NULL" returns NULL, which is falsy but not strictly false
      expect(teamsWithNull.every((t: any) => !t.active)).toBe(true);
      expect(teamsWithUndefined.every((t: any) => !t.active)).toBe(true);
    });

    it('should switch active flag when activeTeamId changes', async () => {
      // Set memberTeam as active
      const teams = await teamsService.getTeamsForUser(testUser.id, memberTeam.id);

      const ownedTeamResult = teams.find((t: any) => t.id === ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(ownedTeamResult!.active).toBe(false);
      expect(memberTeamResult!.active).toBe(true);
    });
  });

  describe('Owner Flag and owns_by Field', () => {
    it('should set owner=true and owns_by="You" for owned teams', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const ownedTeamResult = teams.find((t: any) => t.id === ownedTeam.id);

      expect(ownedTeamResult!.owner).toBe(true);
      expect(ownedTeamResult!.owns_by).toBe('You');
    });

    it('should set owner=false and owns_by=<owner_name> for member teams', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(memberTeamResult!.owner).toBe(false);
      expect(memberTeamResult!.owns_by).toBe(otherUser.name);
    });
  });

  describe('Pending Invitation Flag', () => {
    it('should set pending_invitation=true when invitation exists', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(memberTeamResult!.pending_invitation).toBe(true);
    });

    it('should set pending_invitation=false when no invitation exists', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const ownedTeamResult = teams.find((t: any) => t.id === ownedTeam.id);

      expect(ownedTeamResult!.pending_invitation).toBe(false);
    });

    it('should update pending_invitation after invitation is deleted', async () => {
      // Delete the invitation
      await db.query('DELETE FROM email_invitations WHERE id = $1', [emailInvitation.id]);

      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(memberTeamResult!.pending_invitation).toBe(false);

      // Recreate for other tests
      const newInvitationResult = await db.query(
        `INSERT INTO email_invitations (name, email, team_id, team_member_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Team Invitation', testUser.email, memberTeam.id, teamMember.id]
      );
      emailInvitation = newInvitationResult.rows[0];
    });
  });

  describe('Team Filtering', () => {
    it('should include teams owned by user', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const ownedTeamResult = teams.find((t: any) => t.id === ownedTeam.id);

      expect(ownedTeamResult).toBeDefined();
    });

    it('should include teams where user is an active member', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      expect(memberTeamResult).toBeDefined();
    });

    it('should NOT include teams where user is not a member', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const otherTeamResult = teams.find((t: any) => t.id === otherTeam.id);

      expect(otherTeamResult).toBeUndefined();
    });

    it('should NOT include teams where user is inactive member', async () => {
      // Deactivate testUser's membership in memberTeam
      await db.query('UPDATE team_members SET active = FALSE WHERE id = $1', [teamMember.id]);

      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);
      const memberTeamResult = teams.find((t: any) => t.id === memberTeam.id);

      // Should NOT include memberTeam now
      expect(memberTeamResult).toBeUndefined();

      // Reactivate for other tests
      await db.query('UPDATE team_members SET active = TRUE WHERE id = $1', [teamMember.id]);
    });
  });

  describe('Ordering', () => {
    it('should return teams ordered by name', async () => {
      const teams = await teamsService.getTeamsForUser(testUser.id, ownedTeam.id);

      // Verify teams are sorted by name
      for (let i = 1; i < teams.length; i++) {
        expect(teams[i].name.localeCompare(teams[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should return only owned team if user has no memberships', async () => {
      // Create a new user with only owned team (no memberships)
      const newUserEmail = `only-owned-${Date.now()}@example.com`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('test_password', salt);
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const newUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [newUserEmail, 'Only Owned User', hashedPassword, timezoneId]
      );
      const newUser = newUserResult.rows[0];

      const newTeamResult = await db.query(
        `INSERT INTO teams (name, user_id)
         VALUES ($1, $2)
         RETURNING id, name`,
        [`New Team ${Date.now()}`, newUser.id]
      );
      const newTeam = newTeamResult.rows[0];

      try {
        const teams = await teamsService.getTeamsForUser(newUser.id, newTeam.id);

        expect(teams.length).toBe(1);
        expect(teams[0].id).toBe(newTeam.id);
        expect(teams[0].owner).toBe(true);
        expect(teams[0].owns_by).toBe('You');
      } finally {
        await db.query('DELETE FROM teams WHERE id = $1', [newTeam.id]);
        await db.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      }
    });

    it('should return empty array if user has no teams', async () => {
      // Create a new user with no teams
      const newUserEmail = `no-teams-${Date.now()}@example.com`;
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
        const teams = await teamsService.getTeamsForUser(newUser.id, null);
        expect(teams).toEqual([]);
      } finally {
        await db.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      }
    });
  });
});
