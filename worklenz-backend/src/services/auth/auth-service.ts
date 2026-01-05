/**
 * Auth Service
 * Handles authentication-related business logic using Prisma ORM
 *
 * This service replaces SQL queries in auth-controller.ts with Prisma implementations
 * All methods are validated against contract tests to ensure behavioral parity
 */

import prisma from '../../config/prisma';
import bcrypt from 'bcrypt';

export class AuthService {
  /**
   * Get user by email
   * Replaces: auth-controller.ts:25-40 SQL pattern
   *
   * @param email - User email (case-insensitive)
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string) {
    if (!email) {
      return null;
    }

    // Normalize email for case-insensitive lookup
    const normalizedEmail = email.toLowerCase().trim();

    return await prisma.users.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive' // Case-insensitive comparison
        },
        is_deleted: false // Exclude deleted users
      },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        active_team: true,
        avatar_url: true,
        setup_completed: true,
        timezone_id: true,
        google_id: true,
        created_at: true,
        updated_at: true,
        last_active: true,
        temp_email: true,
        is_deleted: true,
        deleted_at: true
      }
    });
  }

  /**
   * Authenticate user with email and password
   * Replaces: auth-controller.ts:86-113 SQL pattern
   *
   * @param email - User email
   * @param password - Plain text password to verify
   * @returns User object (without password) if authenticated, null otherwise
   */
  async authenticateUser(email: string, password: string) {
    if (!email || !password) {
      return null;
    }

    // Get user by email
    const user = await this.getUserByEmail(email);

    if (!user) {
      return null;
    }

    // Check if user has a password set (might be OAuth user)
    if (!user.password) {
      return null;
    }

    // Verify password
    const isValid = bcrypt.compareSync(password, user.password);

    if (!isValid) {
      return null;
    }

    // Return user without password field
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Change user password
   * Replaces: auth-controller.ts:86-113 changePassword functionality
   *
   * @param userId - User ID
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @returns Success boolean
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    // Get user with password
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        google_id: true
      }
    });

    if (!user || !user.password) {
      return false;
    }

    // Verify current password
    const isValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isValid) {
      return false;
    }

    // Hash new password
    const salt = bcrypt.genSaltSync(10);
    const encryptedPassword = bcrypt.hashSync(newPassword, salt);

    // Update password
    await prisma.users.update({
      where: { id: userId },
      data: { password: encryptedPassword }
    });

    return true;
  }

  /**
   * Get user by ID with password (for password reset verification)
   * Replaces: auth-controller.ts:148-169 reset password pattern
   *
   * @param userId - User ID
   * @returns User with password hash or null
   */
  async getUserByIdWithPassword(userId: string) {
    return await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        google_id: true
      }
    });
  }

  /**
   * Reset user password (without current password verification)
   * Replaces: auth-controller.ts:148-169 verify_reset_email functionality
   *
   * @param userId - User ID
   * @param newPassword - New password to set
   * @returns Success boolean
   */
  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    const salt = bcrypt.genSaltSync(10);
    const encryptedPassword = bcrypt.hashSync(newPassword, salt);

    await prisma.users.update({
      where: { id: userId },
      data: { password: encryptedPassword }
    });

    return true;
  }

  /**
   * Check if user exists by email (for registration checks)
   *
   * @param email - Email to check
   * @returns Boolean indicating if user exists
   */
  async userExists(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const count = await prisma.users.count({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        },
        is_deleted: false
      }
    });

    return count > 0;
  }

  /**
   * Get user by Google ID (for OAuth authentication)
   *
   * @param googleId - Google OAuth ID
   * @returns User object or null
   */
  async getUserByGoogleId(googleId: string) {
    return await prisma.users.findFirst({
      where: {
        google_id: googleId,
        is_deleted: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        active_team: true,
        avatar_url: true,
        setup_completed: true,
        timezone_id: true,
        google_id: true,
        created_at: true,
        updated_at: true,
        last_active: true
      }
    });
  }

  /**
   * Check if local account exists for email
   * Used to prevent Google OAuth signup if local account exists
   *
   * @param email - Email to check
   * @returns Boolean indicating if local account exists
   */
  async hasLocalAccount(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const count = await prisma.users.count({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        },
        password: {
          not: null
        },
        is_deleted: false
      }
    });

    return count > 0;
  }
}
