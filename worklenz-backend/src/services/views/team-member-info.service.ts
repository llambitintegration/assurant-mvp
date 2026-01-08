/**
 * Team Member Info View Service
 * Handles queries against the team_member_info_view using Prisma's $queryRaw
 *
 * This service implements the Tier 2 approach (typed $queryRaw wrapper) for view migration.
 * The view combines team_members, users, and email_invitations tables to provide a unified
 * interface for retrieving team member information across the application.
 *
 * View Definition:
 * - avatar_url: User's avatar (from users table)
 * - email: User email or invited email (COALESCE of users.email and email_invitations.email)
 * - name: User name or invited name (COALESCE of users.name and email_invitations.name)
 * - user_id: The actual user ID (may be null for pending invitations)
 * - team_member_id: The team member record ID
 * - team_id: The team ID
 * - active: Whether the team member is active
 *
 * Usage Locations: 24 files, 118 occurrences (as of Phase 2B)
 *
 * Why Tier 2 (typed $queryRaw) instead of pure Prisma?
 * - The view has complex COALESCE logic with subqueries
 * - View is heavily used (118 occurrences across codebase)
 * - PostgreSQL has optimized the view execution plan
 * - Easier to maintain parity with existing SQL behavior
 * - Can be gradually replaced with pure Prisma in Phase 5 if needed
 */

import { z } from 'zod';
import prisma from '../../config/prisma';

/**
 * Zod schema for team_member_info_view output
 * Ensures type safety and runtime validation of query results
 */
export const TeamMemberInfoSchema = z.object({
  avatar_url: z.string().nullable(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  team_member_id: z.string().uuid(),
  team_id: z.string().uuid(),
  active: z.boolean()
});

export type TeamMemberInfo = z.infer<typeof TeamMemberInfoSchema>;

/**
 * Filters for querying team_member_info_view
 */
export interface ITeamMemberInfoFilters {
  teamId?: string;
  userId?: string;
  teamMemberId?: string;
  email?: string;
  active?: boolean;
  teamIds?: string[]; // For querying multiple teams at once
}

/**
 * Service for accessing team_member_info_view with type safety
 */
export class TeamMemberInfoService {
  /**
   * Query team_member_info_view with optional filters
   *
   * @param filters - Optional filters to apply to the query
   * @returns Array of team member info records
   *
   * @example
   * // Get all active members of a team
   * const members = await service.getTeamMemberInfo({ teamId: 'uuid', active: true });
   *
   * @example
   * // Get member by email across all teams
   * const member = await service.getTeamMemberInfo({ email: 'user@example.com' });
   */
  async getTeamMemberInfo(filters?: ITeamMemberInfoFilters): Promise<TeamMemberInfo[]> {
    // Build WHERE clause dynamically based on filters
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.teamId) {
      whereClauses.push(`team_id = $${paramIndex}::uuid`);
      params.push(filters.teamId);
      paramIndex++;
    }

    if (filters?.userId) {
      whereClauses.push(`user_id = $${paramIndex}::uuid`);
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters?.teamMemberId) {
      whereClauses.push(`team_member_id = $${paramIndex}::uuid`);
      params.push(filters.teamMemberId);
      paramIndex++;
    }

    if (filters?.email) {
      whereClauses.push(`email = $${paramIndex}::text`);
      params.push(filters.email);
      paramIndex++;
    }

    if (filters?.active !== undefined) {
      whereClauses.push(`active = $${paramIndex}::boolean`);
      params.push(filters.active);
      paramIndex++;
    }

    if (filters?.teamIds && filters.teamIds.length > 0) {
      whereClauses.push(`team_id = ANY($${paramIndex}::uuid[])`);
      params.push(filters.teamIds);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Use Prisma's $queryRaw with parameterized query
    const query = `
      SELECT
        avatar_url,
        email,
        name,
        user_id,
        team_member_id,
        team_id,
        active
      FROM team_member_info_view
      ${whereClause}
      ORDER BY name NULLS LAST
    `;

    // Execute query with Prisma's $queryRawUnsafe (parameterized)
    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // Validate and return typed results
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get a single team member by team_member_id
   *
   * @param teamMemberId - Team member ID
   * @returns Team member info or null if not found
   */
  async getTeamMemberById(teamMemberId: string): Promise<TeamMemberInfo | null> {
    const results = await this.getTeamMemberInfo({ teamMemberId });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get all active team members for a team
   *
   * @param teamId - Team ID
   * @returns Array of active team member info records
   */
  async getActiveTeamMembers(teamId: string): Promise<TeamMemberInfo[]> {
    return this.getTeamMemberInfo({ teamId, active: true });
  }

  /**
   * Get team member by email (case-insensitive)
   * Useful for checking if a user exists in any team
   *
   * @param email - Email address
   * @returns Array of team member info records matching the email
   */
  async getTeamMemberByEmail(email: string): Promise<TeamMemberInfo[]> {
    return this.getTeamMemberInfo({ email: email.toLowerCase().trim() });
  }

  /**
   * Check if a user exists in a specific team by email
   *
   * @param teamId - Team ID
   * @param email - Email address
   * @returns true if user exists in team
   */
  async checkUserExistsInTeam(teamId: string, email: string): Promise<boolean> {
    const results = await this.getTeamMemberInfo({
      teamId,
      email: email.toLowerCase().trim()
    });
    return results.length > 0;
  }

  /**
   * Check if a user is active in any team owned by a specific owner
   *
   * @param ownerId - Owner user ID
   * @param email - Email address to check
   * @returns true if user is active in any of the owner's teams
   */
  async checkUserActiveInOwnerTeams(ownerId: string, email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    const query = `
      SELECT EXISTS(
        SELECT tmi.team_member_id
        FROM team_member_info_view AS tmi
        JOIN teams AS t ON tmi.team_id = t.id
        WHERE tmi.email = $1::TEXT
          AND t.user_id = $2::UUID
          AND tmi.active = true
      ) AS exists
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(
      query,
      email.toLowerCase().trim(),
      ownerId
    );

    return result[0]?.exists || false;
  }

  /**
   * Get team members across multiple teams
   * Useful for organization-level queries
   *
   * @param teamIds - Array of team IDs
   * @param activeOnly - Only return active members (default: true)
   * @returns Array of team member info records
   */
  async getTeamMembersAcrossTeams(
    teamIds: string[],
    activeOnly: boolean = true
  ): Promise<TeamMemberInfo[]> {
    const filters: ITeamMemberInfoFilters = { teamIds };
    if (activeOnly) {
      filters.active = true;
    }
    return this.getTeamMemberInfo(filters);
  }

  /**
   * Get team member info with user details for a specific user in a team
   *
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns Team member info or null if not found
   */
  async getTeamMemberByTeamAndUser(
    teamId: string,
    userId: string
  ): Promise<TeamMemberInfo | null> {
    const results = await this.getTeamMemberInfo({ teamId, userId });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get count of team members in a team
   *
   * @param teamId - Team ID
   * @param activeOnly - Only count active members (default: true)
   * @returns Count of team members
   */
  async getTeamMemberCount(teamId: string, activeOnly: boolean = true): Promise<number> {
    const whereClauses: string[] = [`team_id = $1::uuid`];
    const params: any[] = [teamId];

    if (activeOnly) {
      whereClauses.push(`active = $2::boolean`);
      params.push(true);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
      SELECT COUNT(*) as count
      FROM team_member_info_view
      ${whereClause}
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Search team members by name or email
   *
   * @param teamId - Team ID
   * @param searchTerm - Search term (partial match)
   * @param activeOnly - Only search active members (default: true)
   * @returns Array of matching team member info records
   */
  async searchTeamMembers(
    teamId: string,
    searchTerm: string,
    activeOnly: boolean = true
  ): Promise<TeamMemberInfo[]> {
    const whereClauses: string[] = ['team_id = $1::uuid'];
    const params: any[] = [teamId];
    let paramIndex = 2;

    if (activeOnly) {
      whereClauses.push(`active = $${paramIndex}::boolean`);
      params.push(true);
      paramIndex++;
    }

    if (searchTerm) {
      whereClauses.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
      SELECT
        avatar_url,
        email,
        name,
        user_id,
        team_member_id,
        team_id,
        active
      FROM team_member_info_view
      ${whereClause}
      ORDER BY name NULLS LAST
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get distinct emails across all teams owned by a user
   * Useful for admin center and team management
   *
   * @param ownerId - Owner user ID
   * @param searchTerm - Optional search term for filtering
   * @returns Array of distinct team member info records
   */
  async getDistinctMembersByOwner(
    ownerId: string,
    searchTerm?: string
  ): Promise<TeamMemberInfo[]> {
    const params: any[] = [ownerId];
    let searchClause = '';

    if (searchTerm) {
      searchClause = `AND (outer_tmiv.email ILIKE $2 OR outer_tmiv.name ILIKE $2)`;
      params.push(`%${searchTerm}%`);
    }

    const query = `
      SELECT DISTINCT ON (email)
        avatar_url,
        email,
        name,
        user_id,
        team_member_id,
        team_id,
        active
      FROM team_member_info_view outer_tmiv
      WHERE outer_tmiv.team_id IN (
        SELECT id FROM teams WHERE user_id = $1::uuid
      )
      ${searchClause}
      ORDER BY email, team_member_id
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Batch lookup of team members by IDs
   * Returns a map for O(1) lookup: { teamMemberId: TeamMemberInfo }
   *
   * This method is critical for avoiding N+1 query patterns in high-traffic endpoints.
   * Instead of making N individual queries for each team member, this makes a single
   * query to fetch all members at once.
   *
   * @param teamMemberIds - Array of team member IDs to fetch
   * @returns Map of team member ID to TeamMemberInfo for O(1) lookup
   *
   * @example
   * // Fetch multiple team members at once
   * const memberIds = ['uuid1', 'uuid2', 'uuid3'];
   * const memberMap = await service.getTeamMembersByIds(memberIds);
   * const member1 = memberMap['uuid1']; // O(1) lookup
   */
  async getTeamMembersByIds(teamMemberIds: string[]): Promise<Record<string, TeamMemberInfo>> {
    if (!teamMemberIds || teamMemberIds.length === 0) {
      return {};
    }

    const query = `
      SELECT
        avatar_url,
        email,
        name,
        user_id,
        team_member_id,
        team_id,
        active
      FROM team_member_info_view
      WHERE team_member_id = ANY($1::uuid[])
      ORDER BY name NULLS LAST
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, teamMemberIds);

    // Convert array to map for O(1) lookup
    return result.reduce((acc, row) => {
      const member = TeamMemberInfoSchema.parse(row);
      acc[member.team_member_id] = member;
      return acc;
    }, {} as Record<string, TeamMemberInfo>);
  }

  /**
   * Get all team members for a specific team ID
   * Optionally filter by active status
   *
   * @param teamId - Team ID
   * @param activeOnly - Only return active members (default: false)
   * @returns Array of team member info records
   */
  async getTeamMembersByTeamId(teamId: string, activeOnly: boolean = false): Promise<TeamMemberInfo[]> {
    const filters: ITeamMemberInfoFilters = { teamId };
    if (activeOnly) {
      filters.active = true;
    }
    return this.getTeamMemberInfo(filters);
  }

  /**
   * Get team member by user_id and team_id
   * Useful for looking up a specific user's membership in a team
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns Team member info or null if not found
   */
  async getTeamMemberByUserId(userId: string, teamId: string): Promise<TeamMemberInfo | null> {
    const results = await this.getTeamMemberInfo({ userId, teamId });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get team member details (alias for getTeamMemberById for clarity)
   *
   * @param teamMemberId - Team member ID
   * @returns Team member info or null if not found
   */
  async getTeamMemberDetails(teamMemberId: string): Promise<TeamMemberInfo | null> {
    return this.getTeamMemberById(teamMemberId);
  }

  /**
   * Get all team members across all teams owned by a specific owner
   * Useful for organization-wide queries in admin center
   *
   * @param ownerId - Owner user ID
   * @param activeOnly - Only return active members (default: false)
   * @returns Array of team member info records
   */
  async getAllTeamMembersForOwner(ownerId: string, activeOnly: boolean = false): Promise<TeamMemberInfo[]> {
    const whereClauses: string[] = [];
    const params: any[] = [ownerId];
    let paramIndex = 2;

    if (activeOnly) {
      whereClauses.push(`active = $${paramIndex}::boolean`);
      params.push(true);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT
        avatar_url,
        email,
        name,
        user_id,
        team_member_id,
        team_id,
        active
      FROM team_member_info_view
      WHERE team_id IN (
        SELECT id FROM teams WHERE user_id = $1::uuid
      )
      ${whereClause}
      ORDER BY name NULLS LAST
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get team members for a specific project
   * Joins through project_members to find team members assigned to a project
   *
   * @param projectId - Project ID
   * @returns Array of team member info records
   */
  async getTeamMembersByProjectId(projectId: string): Promise<TeamMemberInfo[]> {
    const query = `
      SELECT DISTINCT
        tmiv.avatar_url,
        tmiv.email,
        tmiv.name,
        tmiv.user_id,
        tmiv.team_member_id,
        tmiv.team_id,
        tmiv.active
      FROM team_member_info_view tmiv
      INNER JOIN project_members pm ON tmiv.team_member_id = pm.team_member_id
      WHERE pm.project_id = $1::uuid
      ORDER BY tmiv.name NULLS LAST
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, projectId);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get all team members for teams owned by a specific owner
   * Alias for getAllTeamMembersForOwner for backward compatibility
   *
   * @param ownerId - Owner user ID
   * @param activeOnly - Only return active members (default: false)
   * @returns Array of team member info records
   */
  async getOwnerTeamMembers(ownerId: string, activeOnly: boolean = false): Promise<TeamMemberInfo[]> {
    return this.getAllTeamMembersForOwner(ownerId, activeOnly);
  }

  /**
   * Get team members with a specific role
   *
   * @param teamId - Team ID
   * @param roleId - Role ID
   * @returns Array of team member info records
   */
  async getTeamMembersByRole(teamId: string, roleId: string): Promise<TeamMemberInfo[]> {
    const query = `
      SELECT
        tmiv.avatar_url,
        tmiv.email,
        tmiv.name,
        tmiv.user_id,
        tmiv.team_member_id,
        tmiv.team_id,
        tmiv.active
      FROM team_member_info_view tmiv
      INNER JOIN team_members tm ON tmiv.team_member_id = tm.id
      WHERE tmiv.team_id = $1::uuid
        AND tm.role_id = $2::uuid
      ORDER BY tmiv.name NULLS LAST
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, teamId, roleId);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get pending invitations for a team
   * Returns team members who have been invited but haven't accepted yet
   *
   * @param teamId - Team ID
   * @returns Array of team member info records with pending invitations
   */
  async getPendingInvitations(teamId: string): Promise<TeamMemberInfo[]> {
    const query = `
      SELECT
        tmiv.avatar_url,
        tmiv.email,
        tmiv.name,
        tmiv.user_id,
        tmiv.team_member_id,
        tmiv.team_id,
        tmiv.active
      FROM team_member_info_view tmiv
      WHERE tmiv.team_id = $1::uuid
        AND tmiv.user_id IS NULL
      ORDER BY tmiv.email
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query, teamId);
    return result.map(row => TeamMemberInfoSchema.parse(row));
  }

  /**
   * Get all team members including those with pending invitations
   *
   * @param teamId - Team ID
   * @returns Array of team member info records
   */
  async getTeamMembersWithPendingInvites(teamId: string): Promise<TeamMemberInfo[]> {
    return this.getTeamMembersByTeamId(teamId, false);
  }

  /**
   * Check if a team member is active
   *
   * @param teamMemberId - Team member ID
   * @returns true if team member is active
   */
  async checkTeamMemberActive(teamMemberId: string): Promise<boolean> {
    const member = await this.getTeamMemberById(teamMemberId);
    return member?.active || false;
  }
}

/**
 * Singleton instance for convenience
 */
export const teamMemberInfoService = new TeamMemberInfoService();
