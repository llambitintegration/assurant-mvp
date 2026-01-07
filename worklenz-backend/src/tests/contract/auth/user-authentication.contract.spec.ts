/**
 * Contract Test: User Authentication
 *
 * Tests user authentication with email/password verification
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED - This test captures SQL behavior and will fail until Prisma implementation is complete
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { AuthService } from '../../../services/auth/auth-service';
import bcrypt from 'bcrypt';

describe('Contract Test: User Authentication', () => {
  let authService: AuthService;
  let testUser: any;
  let testEmail: string;
  let testPassword: string;
  let hashedPassword: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test user with known credentials
    testEmail = `auth-test-${Date.now()}@example.com`;
    testPassword = 'SecurePassword123!';
    const salt = bcrypt.genSaltSync(10);
    hashedPassword = bcrypt.hashSync(testPassword, salt);

    // Get default timezone
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create user using SQL
    const createResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, password, active_team, avatar_url, setup_completed,
                 timezone_id, google_id, created_at, updated_at, last_active,
                 temp_email, is_deleted, deleted_at`,
      [testEmail, 'Auth Test User', hashedPassword, timezoneId]
    );

    testUser = createResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  it('should match SQL behavior for valid email and password', async () => {
    // SQL version (mimics current auth-controller.ts:86-113)
    const sqlQuery = async () => {
      const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                        timezone_id, google_id, created_at, updated_at, last_active,
                        temp_email, is_deleted, deleted_at
                 FROM users
                 WHERE email = $1 AND is_deleted IS FALSE`;
      const result = await db.query(q, [testEmail]);
      const [user] = result.rows;

      if (!user) return null;

      // Verify password
      const isValid = bcrypt.compareSync(testPassword, user.password);
      if (!isValid) return null;

      // Don't include password in response
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    };

    // Prisma version (new implementation)
    const prismaQuery = async () => {
      return await authService.authenticateUser(testEmail, testPassword);
    };

    // Assert parity
    await expectParity(sqlQuery, prismaQuery, {
      removeFields: ['user_no'],
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for valid email but wrong password', async () => {
    const wrongPassword = 'WrongPassword123!';

    // SQL version
    const sqlQuery = async () => {
      const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                        timezone_id, google_id, created_at, updated_at, last_active,
                        temp_email, is_deleted, deleted_at
                 FROM users
                 WHERE email = $1 AND is_deleted IS FALSE`;
      const result = await db.query(q, [testEmail]);
      const [user] = result.rows;

      if (!user) return null;

      const isValid = bcrypt.compareSync(wrongPassword, user.password);
      if (!isValid) return null;

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.authenticateUser(testEmail, wrongPassword);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for non-existent email', async () => {
    const nonExistentEmail = 'nonexistent-' + Date.now() + '@example.com';
    const somePassword = 'Password123!';

    // SQL version
    const sqlQuery = async () => {
      const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                        timezone_id, google_id, created_at, updated_at, last_active,
                        temp_email, is_deleted, deleted_at
                 FROM users
                 WHERE email = $1 AND is_deleted IS FALSE`;
      const result = await db.query(q, [nonExistentEmail]);
      const [user] = result.rows;

      if (!user) return null;

      const isValid = bcrypt.compareSync(somePassword, user.password);
      if (!isValid) return null;

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.authenticateUser(nonExistentEmail, somePassword);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for Google OAuth user (no password)', async () => {
    // Create Google OAuth user (no password)
    const googleEmail = `google-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const googleUserResult = await db.query(
      `INSERT INTO users (email, name, password, google_id, timezone_id)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id`,
      [googleEmail, 'Google User', 'google-oauth-id-123', timezoneId]
    );
    const googleUserId = googleUserResult.rows[0].id;

    try {
      // SQL version - password comparison should fail for null password
      const sqlQuery = async () => {
        const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                          timezone_id, google_id, created_at, updated_at, last_active,
                          temp_email, is_deleted, deleted_at
                   FROM users
                   WHERE email = $1 AND is_deleted IS FALSE`;
        const result = await db.query(q, [googleEmail]);
        const [user] = result.rows;

        if (!user) return null;
        if (!user.password) return null; // No password set

        const isValid = bcrypt.compareSync('any_password', user.password);
        if (!isValid) return null;

        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.authenticateUser(googleEmail, 'any_password');
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    } finally {
      // Cleanup
      await db.query('DELETE FROM users WHERE id = $1', [googleUserId]);
    }
  });

  it('should not return password field in authenticated user', async () => {
    // Prisma version
    const result = await authService.authenticateUser(testEmail, testPassword);

    // Ensure password is not exposed
    expect(result).toBeTruthy();
    expect(result).not.toHaveProperty('password');
  });
});
