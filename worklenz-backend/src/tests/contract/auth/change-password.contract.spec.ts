/**
 * Contract Test: Change Password
 *
 * Tests the password change functionality
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED -> GREEN -> REFACTOR
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { AuthService } from '../../../services/auth/auth-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Change Password', () => {
  let authService: AuthService;
  let testUser: any;
  let testEmail: string;
  let testPassword: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test user with known password
    testEmail = `change-pw-${Date.now()}@example.com`;
    testPassword = 'CurrentPassword123!';
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(testPassword, salt);

    // Get default timezone
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create user using SQL to ensure test data exists
    const createResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, password`,
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

  it('should match SQL behavior for successful password change', async () => {
    const newPassword = 'NewPassword456!';
    let sqlResult: boolean;
    let prismaResult: boolean;

    // SQL version (current implementation) - test with separate user state
    const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
    const result = await db.query(q, [testUser.id]);
    const [data] = result.rows;

    if (!data) {
      sqlResult = false;
    } else if (bcrypt.compareSync(testPassword, data.password)) {
      const salt = bcrypt.genSaltSync(10);
      const encryptedPassword = bcrypt.hashSync(newPassword, salt);

      const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
      await db.query(updatePasswordQ, [encryptedPassword, testUser.id]);

      sqlResult = true;
    } else {
      sqlResult = false;
    }

    // Reset password back to original for Prisma test
    const resetSalt = bcrypt.genSaltSync(10);
    const resetHash = bcrypt.hashSync(testPassword, resetSalt);
    await db.query(`UPDATE users SET password = $1 WHERE id = $2`, [resetHash, testUser.id]);

    // Prisma version (new implementation)
    prismaResult = await authService.changePassword(testUser.id, testPassword, newPassword);

    // Compare results
    expect(prismaResult).toBe(sqlResult);

    // Verify password was actually changed by checking if new password works
    const verifyResult = await db.query(
      `SELECT password FROM users WHERE id = $1`,
      [testUser.id]
    );
    const updatedPassword = verifyResult.rows[0].password;
    expect(bcrypt.compareSync(newPassword, updatedPassword)).toBe(true);
  });

  it('should match SQL behavior for incorrect current password', async () => {
    const wrongCurrentPassword = 'WrongPassword123!';
    const newPassword = 'NewPassword789!';

    // SQL version
    const sqlQuery = async () => {
      const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
      const result = await db.query(q, [testUser.id]);
      const [data] = result.rows;

      if (!data) {
        return false;
      }

      // Compare the password - should fail
      if (bcrypt.compareSync(wrongCurrentPassword, data.password)) {
        const salt = bcrypt.genSaltSync(10);
        const encryptedPassword = bcrypt.hashSync(newPassword, salt);

        const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
        await db.query(updatePasswordQ, [encryptedPassword, testUser.id]);

        return true;
      }

      return false;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.changePassword(testUser.id, wrongCurrentPassword, newPassword);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for non-existent user', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
    const newPassword = 'NewPassword999!';

    // SQL version
    const sqlQuery = async () => {
      const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
      const result = await db.query(q, [nonExistentUserId]);
      const [data] = result.rows;

      if (!data) {
        return false;
      }

      if (bcrypt.compareSync(testPassword, data.password)) {
        const salt = bcrypt.genSaltSync(10);
        const encryptedPassword = bcrypt.hashSync(newPassword, salt);

        const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
        await db.query(updatePasswordQ, [encryptedPassword, nonExistentUserId]);

        return true;
      }

      return false;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.changePassword(nonExistentUserId, testPassword, newPassword);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for Google OAuth users (no password)', async () => {
    // Create a Google OAuth user (no password)
    const googleEmail = `google-oauth-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const googleUserResult = await db.query(
      `INSERT INTO users (email, name, google_id, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [googleEmail, 'Google User', 'google-123456', timezoneId]
    );
    const googleUserId = googleUserResult.rows[0].id;

    try {
      const newPassword = 'NewPassword111!';

      // SQL version
      const sqlQuery = async () => {
        const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
        const result = await db.query(q, [googleUserId]);
        const [data] = result.rows;

        if (!data) {
          return false;
        }

        // User has no password, can't change it
        if (!data.password) {
          return false;
        }

        if (bcrypt.compareSync('any_password', data.password)) {
          const salt = bcrypt.genSaltSync(10);
          const encryptedPassword = bcrypt.hashSync(newPassword, salt);

          const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
          await db.query(updatePasswordQ, [encryptedPassword, googleUserId]);

          return true;
        }

        return false;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.changePassword(googleUserId, 'any_password', newPassword);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    } finally {
      // Cleanup
      await db.query('DELETE FROM users WHERE id = $1', [googleUserId]);
    }
  });
});
