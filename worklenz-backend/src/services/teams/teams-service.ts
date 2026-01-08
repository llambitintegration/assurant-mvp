/**
 * Teams Service
 * Handles team and team member management using Prisma ORM
 *
 * This service replaces SQL queries in teams-controller.ts with Prisma implementations
 * All methods are validated against contract tests to ensure behavioral parity
 */

import prisma from '../../config/prisma';

/**
 * DTO for creating a team member
 */
export interface ICreateTeamMemberDto {
  user_id: string;
  team_id: string;
  role_id: string;
  job_title_id?: string;
}

export class TeamsService {
  /**
   * Get team member by ID with role information
   * Replaces: teams-controller.ts:150-175 pattern
   *
   * @param memberId - Team member ID
   * @returns Team member with role or null if not found
   */
  async getTeamMemberById(memberId: string) {
    const result = await prisma.team_members.findFirst({
      where: {
        id: memberId,
        active: true // Only return active members
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            team_id: true,
            default_role: true,
            admin_role: true,
            owner: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true
          }
        },
        job_titles: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!result) {
      return null;
    }

    // Flatten the structure to match SQL query output
    const { role, user, job_titles, ...teamMember } = result;

    return {
      ...teamMember,
      // Flatten role fields to root level (matching SQL JOIN pattern)
      role_name: role?.name,
      role_team_id: role?.team_id,
      default_role: role?.default_role,
      admin_role: role?.admin_role,
      owner: role?.owner
      // Note: user and job_titles are not included in the SQL query for this endpoint
    };
  }

  /**
   * Get list of team members for a team with role information
   * Replaces: teams-controller.ts:50-80 pattern (high-traffic query)
   *
   * @param teamId - Team ID
   * @returns Array of team members with roles
   */
  async getTeamMembersList(teamId: string) {
    const results = await prisma.team_members.findMany({
      where: {
        team_id: teamId,
        active: true // Only return active members
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            team_id: true,
            default_role: true,
            admin_role: true,
            owner: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true
          }
        },
        job_titles: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'asc' // Sort by creation date
      }
    });

    // Flatten the structure to match SQL query output
    return results.map(result => {
      const { role, user, job_titles, ...teamMember } = result;

      return {
        ...teamMember,
        // Flatten role fields to root level (matching SQL JOIN pattern)
        role_name: role?.name,
        role_team_id: role?.team_id,
        default_role: role?.default_role,
        admin_role: role?.admin_role,
        owner: role?.owner,
        // Flatten user fields to root level (matching LEFT JOIN pattern)
        user_email: user?.email,
        user_name: user?.name
      };
    });
  }

  /**
   * Create a new team member
   * Replaces: teams-controller.ts:200-250 pattern
   *
   * Uses transaction to ensure atomicity
   *
   * @param data - Team member creation data
   * @returns Created team member
   */
  async createTeamMember(data: ICreateTeamMemberDto) {
    // Use transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Verify role exists and belongs to the team
      const role = await tx.roles.findFirst({
        where: {
          id: data.role_id,
          team_id: data.team_id
        }
      });

      if (!role) {
        throw new Error('Role not found or does not belong to this team');
      }

      // Verify team exists
      const team = await tx.teams.findUnique({
        where: { id: data.team_id }
      });

      if (!team) {
        throw new Error('Team not found');
      }

      // Verify user exists (if user_id provided)
      if (data.user_id) {
        const user = await tx.users.findUnique({
          where: { id: data.user_id }
        });

        if (!user) {
          throw new Error('User not found');
        }
      }

      // Verify job title exists if provided
      if (data.job_title_id) {
        const jobTitle = await tx.job_titles.findFirst({
          where: {
            id: data.job_title_id,
            team_id: data.team_id
          }
        });

        if (!jobTitle) {
          throw new Error('Job title not found or does not belong to this team');
        }
      }

      // Create team member
      const teamMember = await tx.team_members.create({
        data: {
          user_id: data.user_id,
          team_id: data.team_id,
          role_id: data.role_id,
          job_title_id: data.job_title_id,
          active: true
        },
        select: {
          id: true,
          user_id: true,
          team_id: true,
          role_id: true,
          job_title_id: true,
          created_at: true,
          updated_at: true,
          active: true
        }
      });

      return teamMember;
    });
  }

  /**
   * Get team by ID
   *
   * @param teamId - Team ID
   * @returns Team or null
   */
  async getTeamById(teamId: string) {
    return await prisma.teams.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        user_id: true,
        created_at: true,
        updated_at: true,
        organization_id: true
      }
    });
  }

  /**
   * Get teams for a user with full metadata
   * Replaces: SQL query in teams-controller.ts:27-51 (Tier 2: Typed $queryRaw)
   *
   * This is a complex query with subqueries and EXISTS clauses that would be
   * inefficient to implement with pure Prisma. Using typed $queryRaw for optimal performance.
   *
   * Includes teams owned by user and teams where user is a member with:
   * - active flag (if team matches activeTeamId)
   * - owner flag (if user owns the team)
   * - pending_invitation flag (if there's a pending invitation for this user/team)
   * - owns_by field (owner name or 'You' if current user)
   *
   * @param userId - User ID
   * @param activeTeamId - Currently active team ID (optional)
   * @returns Array of teams with metadata
   */
  async getTeamsForUser(userId: string, activeTeamId?: string | null) {
    // Define the result type matching the SQL query output
    interface TeamResult {
      id: string;
      name: string;
      created_at: Date;
      active: boolean;
      owner: boolean;
      pending_invitation: boolean;
      owns_by: string;
    }

    // Use typed $queryRaw with the exact SQL query from the controller
    // This maintains 100% behavioral parity with the original implementation
    //
    // Note: When activeTeamId is null/undefined, we need to handle the comparison specially
    // because "id = NULL" always returns false in SQL (use IS NULL instead)
    // But to match the original SQL behavior, we pass NULL which makes all active flags false
    const activeTeamParam = activeTeamId ? activeTeamId : null;

    const teams = await prisma.$queryRaw<TeamResult[]>`
      SELECT id,
             name,
             created_at,
             (id = ${activeTeamParam}::uuid) AS active,
             (user_id = ${userId}::uuid) AS owner,
             EXISTS(SELECT 1
                    FROM email_invitations
                    WHERE team_id = teams.id
                      AND team_member_id = (SELECT id
                                            FROM team_members
                                            WHERE team_members.user_id = ${userId}::uuid
                                              AND team_members.team_id = teams.id)) AS pending_invitation,
             (CASE
                WHEN user_id = ${userId}::uuid THEN 'You'
                ELSE (SELECT name FROM users WHERE id = teams.user_id) END
               ) AS owns_by
      FROM teams
      WHERE user_id = ${userId}::uuid
         OR id IN (SELECT team_id FROM team_members WHERE team_members.user_id = ${userId}::uuid
               AND team_members.active IS TRUE)
      ORDER BY name;
    `;

    return teams;
  }

  /**
   * Update team member role
   *
   * @param memberId - Team member ID
   * @param roleId - New role ID
   * @returns Updated team member
   */
  async updateTeamMemberRole(memberId: string, roleId: string) {
    return await prisma.team_members.update({
      where: { id: memberId },
      data: { role_id: roleId },
      include: {
        role: true
      }
    });
  }

  /**
   * Deactivate team member (soft delete)
   *
   * @param memberId - Team member ID
   * @returns Updated team member
   */
  async deactivateTeamMember(memberId: string) {
    return await prisma.team_members.update({
      where: { id: memberId },
      data: { active: false }
    });
  }

  /**
   * Activate team member
   *
   * @param memberId - Team member ID
   * @returns Updated team member
   */
  async activateTeamMember(memberId: string) {
    return await prisma.team_members.update({
      where: { id: memberId },
      data: { active: true }
    });
  }

  /**
   * Delete team member (hard delete)
   *
   * @param memberId - Team member ID
   */
  async deleteTeamMember(memberId: string) {
    await prisma.team_members.delete({
      where: { id: memberId }
    });
  }

  /**
   * Check if user is member of team
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns Boolean indicating membership
   */
  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const count = await prisma.team_members.count({
      where: {
        user_id: userId,
        team_id: teamId,
        active: true
      }
    });

    return count > 0;
  }

  /**
   * Get team member by user and team
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @returns Team member or null
   */
  async getTeamMemberByUserAndTeam(userId: string, teamId: string) {
    return await prisma.team_members.findFirst({
      where: {
        user_id: userId,
        team_id: teamId,
        active: true
      },
      include: {
        role: true
      }
    });
  }

  /**
   * Get team member count for a team
   *
   * @param teamId - Team ID
   * @returns Number of active members
   */
  async getTeamMemberCount(teamId: string): Promise<number> {
    return await prisma.team_members.count({
      where: {
        team_id: teamId,
        active: true
      }
    });
  }

  /**
   * Activate a team for a user
   * Replaces: activate_team stored procedure (teams-controller.ts:89-90)
   *
   * Sets the user's active_team to the specified team_id
   * Also deletes any pending email invitations for this user/team
   *
   * @param userId - User ID
   * @param teamId - Team ID to activate
   * @returns Updated user with new active_team
   */
  async activateTeam(userId: string, teamId: string) {
    return await prisma.$transaction(async (tx) => {
      // Verify user is member of this team before activating
      const teamMember = await tx.team_members.findFirst({
        where: {
          user_id: userId,
          team_id: teamId,
          active: true
        }
      });

      if (!teamMember) {
        throw new Error('User is not a member of this team');
      }

      // Update user's active team
      const updatedUser = await tx.users.update({
        where: { id: userId },
        data: { active_team: teamId }
      });

      // Delete any pending email invitations for this user/team combination
      await tx.email_invitations.deleteMany({
        where: {
          team_id: teamId,
          team_member_id: teamMember.id
        }
      });

      return updatedUser;
    });
  }

  /**
   * Update team name with uniqueness validation
   * Replaces: update_team_name_once stored procedure (teams-controller.ts:100-101)
   *
   * Updates team name only if it's different from the current name
   * Validates that the new name is unique for this user
   *
   * @param userId - User ID (must be team owner)
   * @param teamId - Team ID to update
   * @param newName - New team name
   * @returns Updated team
   * @throws Error if name already exists for this user
   */
  async updateTeamName(userId: string, teamId: string, newName: string) {
    return await prisma.$transaction(async (tx) => {
      // Verify user owns this team
      const team = await tx.teams.findFirst({
        where: {
          id: teamId,
          user_id: userId
        }
      });

      if (!team) {
        throw new Error('Team not found or user is not the owner');
      }

      // Check if name is actually different
      if (team.name === newName) {
        return team; // No update needed
      }

      // Check for duplicate team name for this user
      const duplicateTeam = await tx.teams.findFirst({
        where: {
          user_id: userId,
          name: newName,
          id: { not: teamId } // Exclude current team
        }
      });

      if (duplicateTeam) {
        const error = new Error('TEAM_NAME_EXISTS_ERROR');
        error.name = 'TEAM_NAME_EXISTS_ERROR';
        throw error;
      }

      // Update team name
      const updatedTeam = await tx.teams.update({
        where: { id: teamId },
        data: {
          name: newName,
          updated_at: new Date()
        }
      });

      return updatedTeam;
    });
  }

  /**
   * Get pending team invitations for a user
   * Replaces: SQL query in teams-controller.ts:57-68
   *
   * Returns all pending email invitations sent to the user's email
   * with team and team owner information
   *
   * @param userId - User ID
   * @returns Array of pending invitations with team details
   */
  async getTeamInvites(userId: string) {
    // First get user's email
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      return [];
    }

    // Get all pending invitations for this email
    const invitations = await prisma.email_invitations.findMany({
      where: {
        email: user.email
      },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            user_id: true,
            users_teams_user_idTousers: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    // Transform to match SQL query output format
    return invitations.map(inv => ({
      id: inv.id,
      team_id: inv.team_id,
      team_member_id: inv.team_member_id,
      team_name: inv.teams?.name || null,
      team_owner: inv.teams?.users_teams_user_idTousers?.name || null
    }));
  }

  /**
   * Check if a team name already exists for a user
   * Replaces: SQL query in teams-controller.ts:14-15
   *
   * @param userId - User ID
   * @param teamName - Team name to check
   * @returns true if name exists, false otherwise
   */
  async checkTeamNameExists(userId: string, teamName: string): Promise<boolean> {
    const count = await prisma.teams.count({
      where: {
        user_id: userId,
        name: teamName
      }
    });

    return count > 0;
  }
}
