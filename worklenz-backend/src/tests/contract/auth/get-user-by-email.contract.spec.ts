/**
 * Contract Test: Get User by Email
 *
 * Tests the core user lookup by email functionality
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED - This test captures SQL behavior and will fail until Prisma implementation is complete
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import prisma from '../../../config/prisma';
import { AuthService } from '../../../services/auth/auth-service';
import bcrypt from 'bcrypt';

describe('Contract Test: Get User by Email', () => {
  let authService: AuthService;
  let testUser: any;
  let testEmail: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test user with known data
    testEmail = `test-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    // Get default timezone
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create user using SQL to ensure test data exists
    const createResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, password, active_team, avatar_url, setup_completed,
                 timezone_id, google_id, created_at, updated_at, last_active,
                 temp_email, is_deleted, deleted_at`,
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

  it('should match SQL behavior for valid email lookup', async () => {
    // SQL version (current implementation)
    const sqlQuery = async () => {
      const result = await db.query(
        `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                timezone_id, google_id, created_at, updated_at, last_active,
                temp_email, is_deleted, deleted_at
         FROM users
         WHERE email = $1 AND is_deleted IS FALSE`,
        [testEmail]
      );
      return result.rows[0] || null;
    };

    // Prisma version (new implementation)
    const prismaQuery = async () => {
      return await authService.getUserByEmail(testEmail);
    };

    // Assert parity between SQL and Prisma
    await expectParity(sqlQuery, prismaQuery, {
      sortArraysBy: 'email',
      removeFields: ['user_no'], // Auto-increment field may differ
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for non-existent email', async () => {
    const nonExistentEmail = 'nonexistent-' + Date.now() + '@example.com';

    // SQL version
    const sqlQuery = async () => {
      const result = await db.query(
        `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                timezone_id, google_id, created_at, updated_at, last_active,
                temp_email, is_deleted, deleted_at
         FROM users
         WHERE email = $1 AND is_deleted IS FALSE`,
        [nonExistentEmail]
      );
      return result.rows[0] || null;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.getUserByEmail(nonExistentEmail);
    };

    await expectParity(sqlQuery, prismaQuery, {
      treatNullAsUndefined: true
    });
  });

  it('should match SQL behavior for case-insensitive email lookup', async () => {
    const upperCaseEmail = testEmail.toUpperCase();

    // SQL version - case insensitive
    const sqlQuery = async () => {
      const result = await db.query(
        `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                timezone_id, google_id, created_at, updated_at, last_active,
                temp_email, is_deleted, deleted_at
         FROM users
         WHERE LOWER(email) = LOWER($1) AND is_deleted IS FALSE`,
        [upperCaseEmail]
      );
      return result.rows[0] || null;
    };

    // Prisma version
    const prismaQuery = async () => {
      return await authService.getUserByEmail(upperCaseEmail);
    };

    await expectParity(sqlQuery, prismaQuery, {
      removeFields: ['user_no'],
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });

  it('should exclude deleted users', async () => {
    // Create a deleted user
    const deletedEmail = `deleted-${Date.now()}@example.com`;
    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const deletedUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id, is_deleted, deleted_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       RETURNING id`,
      [deletedEmail, 'Deleted User', 'hashed_pw', timezoneId]
    );
    const deletedUserId = deletedUserResult.rows[0].id;

    try {
      // SQL version - should not return deleted user
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                  timezone_id, google_id, created_at, updated_at, last_active,
                  temp_email, is_deleted, deleted_at
           FROM users
           WHERE email = $1 AND is_deleted IS FALSE`,
          [deletedEmail]
        );
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByEmail(deletedEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    } finally {
      // Cleanup
      await db.query('DELETE FROM users WHERE id = $1', [deletedUserId]);
    }
  });
});
