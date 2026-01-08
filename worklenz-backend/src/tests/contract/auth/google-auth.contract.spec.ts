/**
 * Contract Test: Google OAuth Authentication
 *
 * Tests the Google OAuth authentication functionality
 * Validates that Prisma implementation matches existing SQL behavior
 *
 * TDD Phase: RED -> GREEN -> REFACTOR
 */

import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { AuthService } from '../../../services/auth/auth-service';

describe('Contract Test: Google OAuth Authentication', () => {
  let authService: AuthService;
  let testGoogleUser: any;
  let testLocalUser: any;
  let testGoogleId: string;
  let testEmail: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test Google OAuth user
    testGoogleId = `google-test-${Date.now()}`;
    testEmail = `google-auth-${Date.now()}@example.com`;

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    // Create Google OAuth user (no password)
    const googleUserResult = await db.query(
      `INSERT INTO users (email, name, google_id, timezone_id, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, google_id, active_team, avatar_url, setup_completed,
                 timezone_id, created_at, updated_at, last_active`,
      [testEmail, 'Google Test User', testGoogleId, timezoneId, 'https://example.com/avatar.jpg']
    );

    testGoogleUser = googleUserResult.rows[0];

    // Create a local user for testing local account check
    const localEmail = `local-${Date.now()}@example.com`;
    const localUserResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email`,
      [localEmail, 'Local User', 'hashed_password', timezoneId]
    );

    testLocalUser = localUserResult.rows[0];
  });

  afterAll(async () => {
    // Cleanup test users
    if (testGoogleUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testGoogleUser.id]);
    }
    if (testLocalUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testLocalUser.id]);
    }
  });

  describe('getUserByGoogleId', () => {
    it('should match SQL behavior for valid Google ID lookup', async () => {
      // SQL version (current implementation)
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 AND is_deleted IS FALSE`,
          [testGoogleId]
        );
        return result.rows[0] || null;
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        return await authService.getUserByGoogleId(testGoogleId);
      };

      // Assert parity between SQL and Prisma
      await expectParity(sqlQuery, prismaQuery, {
        removeFields: ['user_no'],
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for non-existent Google ID', async () => {
      const nonExistentGoogleId = 'google-nonexistent-123456';

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 AND is_deleted IS FALSE`,
          [nonExistentGoogleId]
        );
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByGoogleId(nonExistentGoogleId);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });
  });

  describe('getUserByGoogleIdOrEmail', () => {
    it('should match SQL behavior for Google ID match', async () => {
      const normalizedEmail = testEmail.toLowerCase().trim();

      // SQL version (matches auth-controller.ts:315-318)
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 OR LOWER(email) = $2`,
          [testGoogleId, normalizedEmail]
        );
        return result.rows[0] || null;
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        return await authService.getUserByGoogleIdOrEmail(testGoogleId, testEmail);
      };

      // Assert parity between SQL and Prisma
      await expectParity(sqlQuery, prismaQuery, {
        removeFields: ['user_no'],
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for email match only', async () => {
      const differentGoogleId = 'different-google-id';
      const normalizedEmail = testEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 OR LOWER(email) = $2`,
          [differentGoogleId, normalizedEmail]
        );
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByGoogleIdOrEmail(differentGoogleId, testEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        removeFields: ['user_no'],
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for no match', async () => {
      const nonExistentGoogleId = 'google-nonexistent-999';
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
      const normalizedEmail = nonExistentEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 OR LOWER(email) = $2`,
          [nonExistentGoogleId, normalizedEmail]
        );
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByGoogleIdOrEmail(nonExistentGoogleId, nonExistentEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for case-insensitive email', async () => {
      const upperCaseEmail = testEmail.toUpperCase();
      const normalizedEmail = upperCaseEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT id, email, name, google_id, active_team, avatar_url, setup_completed,
                  timezone_id, created_at, updated_at, last_active
           FROM users
           WHERE google_id = $1 OR LOWER(email) = $2`,
          [testGoogleId, normalizedEmail]
        );
        return result.rows[0] || null;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.getUserByGoogleIdOrEmail(testGoogleId, upperCaseEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        removeFields: ['user_no'],
        timestampTolerance: 1000,
        treatNullAsUndefined: true
      });
    });
  });

  describe('hasLocalAccount', () => {
    it('should match SQL behavior for existing local account', async () => {
      const normalizedEmail = testLocalUser.email.toLowerCase().trim();

      // SQL version (matches auth-controller.ts:309)
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;`,
          [normalizedEmail]
        );
        return (result.rowCount || 0) > 0;
      };

      // Prisma version (new implementation)
      const prismaQuery = async () => {
        return await authService.hasLocalAccount(testLocalUser.email);
      };

      // Assert parity between SQL and Prisma
      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for Google OAuth user (no local account)', async () => {
      const normalizedEmail = testEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;`,
          [normalizedEmail]
        );
        return (result.rowCount || 0) > 0;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.hasLocalAccount(testEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for non-existent email', async () => {
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
      const normalizedEmail = nonExistentEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;`,
          [normalizedEmail]
        );
        return (result.rowCount || 0) > 0;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.hasLocalAccount(nonExistentEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });

    it('should match SQL behavior for case-insensitive email', async () => {
      const upperCaseEmail = testLocalUser.email.toUpperCase();
      const normalizedEmail = upperCaseEmail.toLowerCase().trim();

      // SQL version
      const sqlQuery = async () => {
        const result = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;`,
          [normalizedEmail]
        );
        return (result.rowCount || 0) > 0;
      };

      // Prisma version
      const prismaQuery = async () => {
        return await authService.hasLocalAccount(upperCaseEmail);
      };

      await expectParity(sqlQuery, prismaQuery, {
        treatNullAsUndefined: true
      });
    });
  });
});
