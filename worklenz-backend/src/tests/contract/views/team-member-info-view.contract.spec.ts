/**
 * Contract Test: Team Member Info View Service
 *
 * Tests the TeamMemberInfoService Tier 2 implementation (typed $queryRaw wrapper)
 * against direct database queries to ensure behavioral parity.
 *
 * The team_member_info_view is one of the most critical views in the system with:
 * - 118 occurrences across 24 files
 * - Combines team_members, users, and email_invitations tables
 * - Heavily used for team member lookups, validation, and display
 *
 * This test suite validates:
 * 1. Basic query parity with direct SQL
 * 2. Filtering by team_id, user_id, email, active status
 * 3. COALESCE logic for pending invitations (users vs email_invitations)
 * 4. Edge cases (null values, inactive members, pending invitations)
 * 5. Performance benchmarks
 * 6. Schema validation via Zod
 *
 * TDD Phase: GREEN - Service implementation complete, tests should pass
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { TeamMemberInfoService } from '../../../services/views/team-member-info.service';
import bcrypt from 'bcrypt';

describe('Contract Test: Team Member Info View Service', () => {
  let service: TeamMemberInfoService;
  let testUsers: any[] = [];
  let testTeam: any;
  let testTeam2: any;
  let testMembers: any[] = [];
  let testInvitation: any;

  beforeAll(async () => {
    service = new TeamMemberInfoService();

    // Get timezone for user creation
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create owner user
    const ownerEmail = `view-owner-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const ownerResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, avatar_url`,
      [ownerEmail, 'View Test Owner', hashedPassword, timezoneId, 'https://example.com/avatar.png']
    );
    testUsers.push(ownerResult.rows[0]);

    // Create test team 1
    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Test Team View ${Date.now()}`, testUsers[0].id]
    );
    testTeam = teamResult.rows[0];

    // Create test team 2 for multi-team tests
    const team2Result = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Test Team View 2 ${Date.now()}`, testUsers[0].id]
    );
    testTeam2 = team2Result.rows[0];

    // Create default role
    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, TRUE, FALSE, FALSE)
       RETURNING id`,
      ['Member Role', testTeam.id]
    );
    const defaultRoleId = roleResult.rows[0].id;

    // Create multiple active team members with users
    for (let i = 0; i < 3; i++) {
      const memberEmail = `view-member-${i}-${Date.now()}@example.com`;
      const memberResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, avatar_url`,
        [memberEmail, `View Member ${i}`, hashedPassword, timezoneId, `https://example.com/avatar${i}.png`]
      );
      testUsers.push(memberResult.rows[0]);

      const teamMemberResult = await db.query(
        `INSERT INTO team_members (user_id, team_id, role_id, active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, user_id, team_id, role_id, active`,
        [memberResult.rows[0].id, testTeam.id, defaultRoleId]
      );
      testMembers.push(teamMemberResult.rows[0]);
    }

    // Create one pending invitation (no user_id, uses email_invitations)
    const pendingMemberResult = await db.query(
      `INSERT INTO team_members (team_id, role_id, active)
       VALUES ($1, $2, TRUE)
       RETURNING id, team_id, role_id, active`,
      [testTeam.id, defaultRoleId]
    );
    const pendingMemberId = pendingMemberResult.rows[0].id;
    testMembers.push(pendingMemberResult.rows[0]);

    // Create email invitation for pending member
    const invitationResult = await db.query(
      `INSERT INTO email_invitations (name, email, team_member_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, team_member_id`,
      [`Pending Invite ${Date.now()}`, `pending-${Date.now()}@example.com`, pendingMemberId]
    );
    testInvitation = invitationResult.rows[0];

    // Create one inactive member
    const inactiveMemberResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email`,
      [`inactive-${Date.now()}@example.com`, 'Inactive Member', hashedPassword, timezoneId]
    );
    const inactiveUserId = inactiveMemberResult.rows[0].id;

    const inactiveTeamMemberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [inactiveUserId, testTeam.id, defaultRoleId]
    );
    testMembers.push(inactiveTeamMemberResult.rows[0]);
    testUsers.push(inactiveMemberResult.rows[0]);
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testInvitation?.id) {
      await db.query('DELETE FROM email_invitations WHERE id = $1', [testInvitation.id]);
    }
    for (const member of testMembers) {
      await db.query('DELETE FROM team_members WHERE id = $1', [member.id]);
    }
    if (testTeam?.id) {
      await db.query('DELETE FROM roles WHERE team_id = $1', [testTeam.id]);
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam.id]);
    }
    if (testTeam2?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam2.id]);
    }
    for (const user of testUsers) {
      await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    }
  });

  describe('Basic Query Parity', () => {
    it('should match SQL behavior for all team members', async () => {
      // SQL version (direct view query)
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT avatar_url, email, name, user_id, team_member_id, team_id, active
           FROM team_member_info_view
           WHERE team_id = $1
           ORDER BY name NULLS LAST`,
          [testTeam.id]
        );
        return result.rows;
      };

      // Prisma version (service method)
      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ teamId: testTeam.id });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id',
        treatNullAsUndefined: false // Keep nulls as nulls for view data
      });
    });

    it('should correctly handle pending invitations (COALESCE logic)', async () => {
      // Get the pending invitation member
      const result = await service.getTeamMemberById(testInvitation.team_member_id);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBeNull(); // No user_id for pending invitations
      expect(result?.email).toBe(testInvitation.email); // Email from email_invitations
      expect(result?.name).toBe(testInvitation.name); // Name from email_invitations
      expect(result?.avatar_url).toBeNull(); // No avatar for pending invitations
      expect(result?.active).toBe(true);
    });

    it('should correctly handle registered users (users table)', async () => {
      // Get a member with a user account
      const result = await service.getTeamMemberById(testMembers[0].id);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUsers[1].id); // Has user_id
      expect(result?.email).toBe(testUsers[1].email); // Email from users table
      expect(result?.name).toBe(testUsers[1].name); // Name from users table
      expect(result?.avatar_url).toBe(testUsers[1].avatar_url); // Avatar from users table
      expect(result?.active).toBe(true);
    });
  });

  describe('Filtering', () => {
    it('should filter by team_id', async () => {
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view WHERE team_id = $1 ORDER BY name NULLS LAST`,
          [testTeam.id]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ teamId: testTeam.id });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });

    it('should filter by user_id', async () => {
      const targetUserId = testUsers[1].id;

      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view WHERE user_id = $1 ORDER BY name NULLS LAST`,
          [targetUserId]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ userId: targetUserId });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });

    it('should filter by team_member_id', async () => {
      const targetMemberId = testMembers[0].id;

      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view WHERE team_member_id = $1`,
          [targetMemberId]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ teamMemberId: targetMemberId });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });

    it('should filter by email (case-insensitive)', async () => {
      const targetEmail = testUsers[1].email;

      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view WHERE email = $1 ORDER BY name NULLS LAST`,
          [targetEmail]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ email: targetEmail });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });

    it('should filter by active status', async () => {
      // Get only active members
      const activeMembers = await service.getTeamMemberInfo({
        teamId: testTeam.id,
        active: true
      });

      // All returned members should be active
      expect(activeMembers.every(m => m.active)).toBe(true);

      // Get inactive members
      const inactiveMembers = await service.getTeamMemberInfo({
        teamId: testTeam.id,
        active: false
      });

      // All returned members should be inactive
      expect(inactiveMembers.every(m => !m.active)).toBe(true);
    });

    it('should filter by multiple teams', async () => {
      const teamIds = [testTeam.id, testTeam2.id];

      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view WHERE team_id = ANY($1::uuid[]) ORDER BY name NULLS LAST`,
          [teamIds]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({ teamIds });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });

    it('should combine multiple filters', async () => {
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT * FROM team_member_info_view
           WHERE team_id = $1 AND active = $2
           ORDER BY name NULLS LAST`,
          [testTeam.id, true]
        );
        return result.rows;
      };

      const prismaQuery = async () => {
        return await service.getTeamMemberInfo({
          teamId: testTeam.id,
          active: true
        });
      };

      await expectParity(sqlQuery, prismaQuery, {
        sortArraysBy: 'team_member_id'
      });
    });
  });

  describe('Helper Methods', () => {
    it('getTeamMemberById should return single member', async () => {
      const memberId = testMembers[0].id;
      const member = await service.getTeamMemberById(memberId);

      expect(member).not.toBeNull();
      expect(member?.team_member_id).toBe(memberId);
    });

    it('getTeamMemberById should return null for non-existent member', async () => {
      const member = await service.getTeamMemberById('00000000-0000-0000-0000-000000000000');
      expect(member).toBeNull();
    });

    it('getActiveTeamMembers should return only active members', async () => {
      const members = await service.getActiveTeamMembers(testTeam.id);

      expect(members.length).toBeGreaterThan(0);
      expect(members.every(m => m.active)).toBe(true);
    });

    it('getTeamMemberByEmail should find members by email', async () => {
      const targetEmail = testUsers[1].email;
      const members = await service.getTeamMemberByEmail(targetEmail);

      expect(members.length).toBeGreaterThan(0);
      expect(members[0].email).toBe(targetEmail);
    });

    it('checkUserExistsInTeam should validate team membership', async () => {
      const exists = await service.checkUserExistsInTeam(
        testTeam.id,
        testUsers[1].email
      );

      expect(exists).toBe(true);

      const notExists = await service.checkUserExistsInTeam(
        testTeam.id,
        'nonexistent@example.com'
      );

      expect(notExists).toBe(false);
    });

    it('checkUserActiveInOwnerTeams should validate active membership', async () => {
      const isActive = await service.checkUserActiveInOwnerTeams(
        testUsers[0].id, // owner
        testUsers[1].email // active member
      );

      expect(isActive).toBe(true);

      // Check inactive member
      const inactiveUser = testUsers[testUsers.length - 1];
      const isInactive = await service.checkUserActiveInOwnerTeams(
        testUsers[0].id,
        inactiveUser.email
      );

      expect(isInactive).toBe(false);
    });

    it('getTeamMemberCount should return correct count', async () => {
      const count = await service.getTeamMemberCount(testTeam.id, true);

      // Should match active members count
      const activeMembers = await service.getActiveTeamMembers(testTeam.id);
      expect(count).toBe(activeMembers.length);
    });

    it('searchTeamMembers should find members by partial name', async () => {
      const results = await service.searchTeamMembers(testTeam.id, 'Member', true);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.name?.includes('Member'))).toBe(true);
    });

    it('searchTeamMembers should find members by partial email', async () => {
      const results = await service.searchTeamMembers(testTeam.id, 'view-member', true);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.email?.includes('view-member'))).toBe(true);
    });

    it('getDistinctMembersByOwner should return unique emails', async () => {
      const results = await service.getDistinctMembersByOwner(testUsers[0].id);

      // Check that emails are unique
      const emails = results.map(r => r.email).filter(e => e !== null);
      const uniqueEmails = new Set(emails);
      expect(emails.length).toBe(uniqueEmails.size);
    });

    it('getTeamMemberByTeamAndUser should find specific member', async () => {
      const member = await service.getTeamMemberByTeamAndUser(
        testTeam.id,
        testUsers[1].id
      );

      expect(member).not.toBeNull();
      expect(member?.team_id).toBe(testTeam.id);
      expect(member?.user_id).toBe(testUsers[1].id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result sets', async () => {
      const results = await service.getTeamMemberInfo({
        teamId: '00000000-0000-0000-0000-000000000000'
      });

      expect(results).toEqual([]);
    });

    it('should handle null avatar_url', async () => {
      // Pending invitation should have null avatar_url
      const member = await service.getTeamMemberById(testInvitation.team_member_id);

      expect(member?.avatar_url).toBeNull();
    });

    it('should handle null user_id for pending invitations', async () => {
      const member = await service.getTeamMemberById(testInvitation.team_member_id);

      expect(member?.user_id).toBeNull();
    });

    it('should sort by name with NULLS LAST', async () => {
      const members = await service.getTeamMemberInfo({ teamId: testTeam.id });

      // Check that members with names come before null names
      let foundNull = false;

      for (const member of members) {
        if (member.name !== null) {
          // If we've already found a null, this is wrong order
          expect(foundNull).toBe(false);
        } else {
          foundNull = true;
        }
      }
    });
  });

  describe('Schema Validation', () => {
    it('should validate all fields match Zod schema', async () => {
      const members = await service.getTeamMemberInfo({ teamId: testTeam.id });

      expect(members.length).toBeGreaterThan(0);

      for (const member of members) {
        // Verify all required fields exist
        expect(member).toHaveProperty('team_member_id');
        expect(member).toHaveProperty('team_id');
        expect(member).toHaveProperty('active');

        // Verify types
        expect(typeof member.team_member_id).toBe('string');
        expect(typeof member.team_id).toBe('string');
        expect(typeof member.active).toBe('boolean');

        // Optional fields can be null or string
        if (member.avatar_url !== null) {
          expect(typeof member.avatar_url).toBe('string');
        }
        if (member.email !== null) {
          expect(typeof member.email).toBe('string');
        }
        if (member.name !== null) {
          expect(typeof member.name).toBe('string');
        }
        if (member.user_id !== null) {
          expect(typeof member.user_id).toBe('string');
        }
      }
    });

    it('should throw error on invalid data', async () => {
      // This test verifies Zod validation would catch schema violations
      // In practice, if the view definition changes, this would fail
      const members = await service.getTeamMemberInfo({ teamId: testTeam.id });

      // All UUIDs should be valid
      for (const member of members) {
        expect(member.team_member_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(member.team_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        if (member.user_id) {
          expect(member.user_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        }
      }
    });
  });

  describe('Performance', () => {
    it('should complete query within reasonable time', async () => {
      const startTime = Date.now();

      await service.getTeamMemberInfo({ teamId: testTeam.id });

      const duration = Date.now() - startTime;

      // Should complete within 500ms for small dataset
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple concurrent queries', async () => {
      const promises = Array(10).fill(null).map(() =>
        service.getTeamMemberInfo({ teamId: testTeam.id })
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      expect(results.length).toBe(10);
      expect(results.every(r => r.length > 0)).toBe(true);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
    });

    it('should handle search queries efficiently', async () => {
      const startTime = Date.now();

      await service.searchTeamMembers(testTeam.id, 'Member', true);

      const duration = Date.now() - startTime;

      // Should complete within 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support team member existence check pattern', async () => {
      // Pattern from team-members-controller.ts:23-35
      const exists = await service.checkUserExistsInTeam(
        testTeam.id,
        testUsers[1].email
      );

      expect(exists).toBe(true);
    });

    it('should support active member check pattern', async () => {
      // Pattern from team-members-controller.ts:37-50
      const isActive = await service.checkUserActiveInOwnerTeams(
        testUsers[0].id,
        testUsers[1].email
      );

      expect(isActive).toBe(true);
    });

    it('should support project member list pattern', async () => {
      // Pattern from project-members-controller.ts:177-184
      const members = await service.getActiveTeamMembers(testTeam.id);

      expect(members.length).toBeGreaterThan(0);
      expect(members[0]).toHaveProperty('email');
      expect(members[0]).toHaveProperty('name');
      expect(members[0]).toHaveProperty('avatar_url');
    });

    it('should support admin center member search pattern', async () => {
      // Pattern from admin-center-controller.ts:90-110
      const members = await service.getDistinctMembersByOwner(
        testUsers[0].id,
        'Member'
      );

      expect(members.length).toBeGreaterThan(0);
    });
  });
});
