/**
 * Contract Test: Reset Password
 *
 * Tests the password reset functionality (reset_password and verify_reset_email)
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED -> GREEN -> REFACTOR
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { AuthService } from '../../../services/auth/auth-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Reset Password', () => {
  let authService: AuthService;
  let testUser: any;
  let testEmail: string;
  let testPassword: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test user with known password
    testEmail = `reset-pw-${Date.now()}@example.com`;
    testPassword = 'OriginalPassword123!';
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(testPassword, salt);

    // Get default timezone
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create user using SQL to ensure test data exists
    const createResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, password, google_id`,
      [testEmail, 'Test User', hashedPassword, timezoneId]
    );

    testUser = createResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('reset_password - Send Reset Email', () => {
    it('should match SQL behavior for valid email lookup', async () => {
      const normalizedEmail = testEmail.toLowerCase().trim();

      // SQL version (current implementation)
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE LOWER(email) = $1;`;
        const result = await db.query(q, [normalizedEmail]);

        if (!result.rowCount) {
          return { exists: false, hasPassword: false, isGoogleUser: false };
        }

        const [data] = result.rows;

        return {
          exists: true,
          hasPassword: !!data?.password,
          isGoogleUser: !!data?.google_id,
          userId: data?.id,
          email: data?.email
        };
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        const user = await authService.getUserByEmail(normalizedEmail);

        if (!user) {
          return { exists: false, hasPassword: false, isGoogleUser: false };
        }

        return {
          exists: true,
          hasPassword: !!user.password,
          isGoogleUser: !!user.google_id,
          userId: user.id,
          email: user.email
        };
      };

      // Assert parity between SQL and Prisma
      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for non-existent email', async () => {
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
      const normalizedEmail = nonExistentEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE LOWER(email) = $1;`;
        const result = await db.query(q, [normalizedEmail]);

        if (!result.rowCount) {
          return { exists: false };
        }

        const [data] = result.rows;
        return {
          exists: true,
          hasPassword: !!data?.password,
          isGoogleUser: !!data?.google_id
        };
      };

      // Prisma version
      const prismaQuery = async () => {
        const user = await authService.getUserByEmail(normalizedEmail);

        if (!user) {
          return { exists: false };
        }

        return {
          exists: true,
          hasPassword: !!user.password,
          isGoogleUser: !!user.google_id
        };
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for Google OAuth user (no password)', async () => {
      // Create a Google OAuth user
      const googleEmail = `google-reset-${Date.now()}@example.com`;
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const googleUserResult = await db.query(
        `INSERT INTO users (email, name, google_id, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [googleEmail, 'Google User', 'google-789012', timezoneId]
      );
      const googleUserId = googleUserResult.rows[0].id;

      try {
        const normalizedEmail = googleEmail.toLowerCase().trim();

        // SQL version
        const sqlQuery = async () => {
          const q = `SELECT id, email, google_id, password FROM users WHERE LOWER(email) = $1;`;
          const result = await db.query(q, [normalizedEmail]);

          if (!result.rowCount) {
            return { exists: false, hasPassword: false, isGoogleUser: false };
          }

          const [data] = result.rows;
          return {
            exists: true,
            hasPassword: !!data?.password,
            isGoogleUser: !!data?.google_id
          };
        };

        // Prisma version
        const prismaQuery = async () => {
          const user = await authService.getUserByEmail(normalizedEmail);

          if (!user) {
            return { exists: false, hasPassword: false, isGoogleUser: false };
          }

          return {
            exists: true,
            hasPassword: !!user.password,
            isGoogleUser: !!user.google_id
          };
        };

        await expectParity(sqlQuery, prismaQuery, {
          treatNullAsUndefined: true
        });
      } finally {
        // Cleanup
        await db.query('DELETE FROM users WHERE id = $1', [googleUserId]);
      }
    });

    it('should match SQL behavior for case-insensitive email lookup', async () => {
      const upperCaseEmail = testEmail.toUpperCase();
      const normalizedEmail = upperCaseEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE LOWER(email) = $1;`;
        const result = await db.query(q, [normalizedEmail]);

        if (!result.rowCount) {
          return { exists: false };
        }

        const [data] = result.rows;
        return {
          exists: true,
          hasPassword: !!data?.password,
          userId: data.id
        };
      };

      // Prisma version
      const prismaQuery = async () => {
        const user = await authService.getUserByEmail(upperCaseEmail);

        if (!user) {
          return { exists: false };
        }

        return {
          exists: true,
          hasPassword: !!user.password,
          userId: user.id
        };
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });
  });

  describe('verify_reset_email - Actually Reset Password', () => {
    it('should match SQL behavior for successful password reset', async () => {
      const newPassword = 'ResetPassword456!';

      // SQL version (current implementation)
      const sqlQuery = async () => {
        // Get user by ID
        const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
        const result = await db.query(q, [testUser.id]);
        const [data] = result.rows;

        if (!data) {
          return false;
        }

        // Reset password without verification
        const salt = bcrypt.genSaltSync(10);
        const encryptedPassword = bcrypt.hashSync(newPassword, salt);
        const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
        await db.query(updatePasswordQ, [encryptedPassword, testUser.id]);

        return true;
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        return await authService.resetPassword(testUser.id, newPassword);
      };

      // Assert parity between SQL and Prisma
      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });

      // Verify password was actually reset by checking if new password works
      const verifyResult = await db.query(
        `SELECT password FROM users WHERE id = $1`,
        [testUser.id]
      );
      const updatedPassword = verifyResult.rows[0].password;
      expect(bcrypt.compareSync(newPassword, updatedPassword)).toBe(true);
    });

    it('should match SQL behavior for getUserByIdWithPassword', async () => {
      // SQL version
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
        const result = await db.query(q, [testUser.id]);
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByIdWithPassword(testUser.id);
      };

      await expectParity(sqlQuery, prismaQuery, {
        removeFields: ['user_no'],
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for non-existent user ID', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

      // SQL version
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
        const result = await db.query(q, [nonExistentUserId]);
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByIdWithPassword(nonExistentUserId);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });
  });
});
