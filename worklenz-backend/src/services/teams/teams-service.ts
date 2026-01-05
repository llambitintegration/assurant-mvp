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
   * Get teams for a user
   * Includes teams owned by user and teams where user is a member
   *
   * @param userId - User ID
   * @param activeTeamId - Currently active team ID (optional)
   * @returns Array of teams with metadata
   */
  async getTeamsForUser(userId: string, activeTeamId?: string) {
    // Get teams owned by user
    const ownedTeams = await prisma.teams.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        name: true,
        user_id: true,
        created_at: true,
        updated_at: true
      }
    });

    // Get teams where user is a member
    const memberTeams = await prisma.team_members.findMany({
      where: {
        user_id: userId,
        active: true
      },
      select: {
        team: {
          select: {
            id: true,
            name: true,
            user_id: true,
            created_at: true,
            updated_at: true
          }
        }
      }
    });

    // Combine and deduplicate
    const allTeams = [
      ...ownedTeams,
      ...memberTeams.map(m => m.team)
    ];

    // Remove duplicates by team ID
    const uniqueTeams = Array.from(
      new Map(allTeams.map(team => [team.id, team])).values()
    );

    // Add metadata
    return uniqueTeams.map(team => ({
      ...team,
      active: team.id === activeTeamId,
      owner: team.user_id === userId
    }));
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
}
