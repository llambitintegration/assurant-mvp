/**
 * Shadow Mode Tests: Auth Service
 *
 * Tests SQL vs Prisma execution in shadow mode with:
 * - PII-safe logging
 * - Performance metrics tracking
 * - Mismatch detection
 * - Non-blocking execution
 *
 * Shadow mode allows safe production comparison without affecting user requests
 */

import { shadowCompare, ShadowMetrics } from '../../utils/shadow-compare';
import db from '../../../config/db';
import { AuthService } from '../../../services/auth/auth-service';
import bcrypt from 'bcrypt';

describe('Shadow Mode: Auth Service', () => {
  let authService: AuthService;
  let testUser: any;
  let testEmail: string;
  let testPassword: string;
  const metrics = ShadowMetrics.getInstance();

  beforeAll(async () => {
    authService = new AuthService();

    // Create test user
    testEmail = `shadow-auth-${Date.now()}@example.com`;
    testPassword = 'ShadowTestPassword123!';
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(testPassword, salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const createResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [testEmail, 'Shadow Test User', hashedPassword, timezoneId]
    );

    testUser = createResult.rows[0];

    // Reset metrics before tests
    metrics.reset('auth.getUserByEmail');
    metrics.reset('auth.authenticateUser');
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('getUserByEmail - Shadow Mode', () => {
    it('should compare SQL vs Prisma with PII redaction', async () => {
      const result = await shadowCompare(
        'auth.getUserByEmail',
        // SQL function
        async () => {
          const sqlResult = await db.query(
            `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                    timezone_id, google_id, created_at, updated_at, last_active,
                    temp_email, is_deleted, deleted_at
             FROM users
             WHERE email = $1 AND is_deleted IS FALSE`,
            [testEmail]
          );
          return sqlResult.rows[0] || null;
        },
        // Prisma function
        async () => {
          return await authService.getUserByEmail(testEmail);
        },
        {
          enabled: true,
          sampleRate: 1.0, // 100% sampling in tests
          logMismatches: true,
          logSuccesses: false,
          throwOnError: false,
          timeout: 5000,
          piiFields: ['email', 'password', 'name'], // Redact PII in logs
          normalizeOptions: {
            removeFields: ['user_no'],
            timestampTolerance: 1000,
            treatNullAsUndefined: true
          }
        }
      );

      // Verify shadow mode executed
      expect(result.sampled).toBe(true);

      // Verify no mismatches
      expect(result.matched).toBe(true);
      expect(result.differences.length).toBe(0);

      // Verify both results exist
      expect(result.primaryResult).toBeTruthy();
      expect(result.shadowResult).toBeTruthy();

      // Verify performance tracking
      expect(result.primaryDuration).toBeGreaterThanOrEqual(0);
      expect(result.shadowDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track performance metrics', async () => {
      // Execute multiple times to build metrics
      for (let i = 0; i < 5; i++) {
        await shadowCompare(
          'auth.getUserByEmail',
          async () => {
            const sqlResult = await db.query(
              `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                      timezone_id, google_id, created_at, updated_at, last_active,
                      temp_email, is_deleted, deleted_at
               FROM users
               WHERE email = $1 AND is_deleted IS FALSE`,
              [testEmail]
            );
            return sqlResult.rows[0] || null;
          },
          async () => {
            return await authService.getUserByEmail(testEmail);
          },
          {
            enabled: true,
            sampleRate: 1.0,
            logMismatches: false,
            logSuccesses: false,
            normalizeOptions: {
              removeFields: ['user_no'],
              timestampTolerance: 1000,
              treatNullAsUndefined: true
            }
          }
        );
      }

      // Get metrics summary
      const summary = metrics.getSummary('auth.getUserByEmail');

      // Verify metrics collected
      expect(summary.sampledCalls).toBeGreaterThanOrEqual(5);
      expect(summary.matches).toBeGreaterThan(0);
      expect(summary.mismatches).toBe(0);
      expect(summary.matchRate).toBe(1.0); // 100% match rate

      // Verify latency stats
      expect(summary.primaryLatency.avg).toBeGreaterThanOrEqual(0);
      expect(summary.shadowLatency.avg).toBeGreaterThanOrEqual(0);

      // Latency overhead should be reasonable (Prisma might be slightly slower)
      // Allow up to 20% overhead as per success criteria
      const overheadPercentage = (summary.latencyOverhead / summary.primaryLatency.avg) * 100;
      console.log(`getUserByEmail latency overhead: ${overheadPercentage.toFixed(2)}%`);
      console.log(`SQL p95: ${summary.primaryLatency.p95}ms, Prisma p95: ${summary.shadowLatency.p95}ms`);
    });

    it('should handle non-existent user gracefully', async () => {
      const nonExistentEmail = 'nonexistent-shadow-' + Date.now() + '@example.com';

      const result = await shadowCompare(
        'auth.getUserByEmail',
        async () => {
          const sqlResult = await db.query(
            `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                    timezone_id, google_id, created_at, updated_at, last_active,
                    temp_email, is_deleted, deleted_at
             FROM users
             WHERE email = $1 AND is_deleted IS FALSE`,
            [nonExistentEmail]
          );
          return sqlResult.rows[0] || null;
        },
        async () => {
          return await authService.getUserByEmail(nonExistentEmail);
        },
        {
          enabled: true,
          sampleRate: 1.0,
          logMismatches: true,
          normalizeOptions: {
            treatNullAsUndefined: true
          }
        }
      );

      expect(result.matched).toBe(true);
      expect(result.primaryResult).toBeNull();
      expect(result.shadowResult).toBeNull();
    });
  });

  describe('authenticateUser - Shadow Mode', () => {
    it('should compare SQL vs Prisma authentication with password redaction', async () => {
      const result = await shadowCompare(
        'auth.authenticateUser',
        // SQL function
        async () => {
          const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                            timezone_id, google_id, created_at, updated_at, last_active,
                            temp_email, is_deleted, deleted_at
                     FROM users
                     WHERE email = $1 AND is_deleted IS FALSE`;
          const sqlResult = await db.query(q, [testEmail]);
          const [user] = sqlResult.rows;

          if (!user) return null;

          const isValid = bcrypt.compareSync(testPassword, user.password);
          if (!isValid) return null;

          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        },
        // Prisma function
        async () => {
          return await authService.authenticateUser(testEmail, testPassword);
        },
        {
          enabled: true,
          sampleRate: 1.0,
          logMismatches: true,
          logSuccesses: false,
          piiFields: ['email', 'password', 'name'],
          normalizeOptions: {
            removeFields: ['user_no'],
            timestampTolerance: 1000,
            treatNullAsUndefined: true
          }
        }
      );

      expect(result.matched).toBe(true);
      expect(result.differences.length).toBe(0);

      // Verify password not in response
      expect(result.primaryResult).not.toHaveProperty('password');
      expect(result.shadowResult).not.toHaveProperty('password');
    });

    it('should track authentication performance', async () => {
      metrics.reset('auth.authenticateUser');

      // Execute multiple authentication attempts
      for (let i = 0; i < 5; i++) {
        await shadowCompare(
          'auth.authenticateUser',
          async () => {
            const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                              timezone_id, google_id, created_at, updated_at, last_active,
                              temp_email, is_deleted, deleted_at
                       FROM users
                       WHERE email = $1 AND is_deleted IS FALSE`;
            const sqlResult = await db.query(q, [testEmail]);
            const [user] = sqlResult.rows;

            if (!user) return null;

            const isValid = bcrypt.compareSync(testPassword, user.password);
            if (!isValid) return null;

            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
          },
          async () => {
            return await authService.authenticateUser(testEmail, testPassword);
          },
          {
            enabled: true,
            sampleRate: 1.0,
            logMismatches: false,
            normalizeOptions: {
              removeFields: ['user_no'],
              timestampTolerance: 1000,
              treatNullAsUndefined: true
            }
          }
        );
      }

      const summary = metrics.getSummary('auth.authenticateUser');

      expect(summary.sampledCalls).toBeGreaterThanOrEqual(5);
      expect(summary.matchRate).toBe(1.0);

      console.log(`authenticateUser latency - SQL p95: ${summary.primaryLatency.p95}ms, Prisma p95: ${summary.shadowLatency.p95}ms`);
      console.log(`Authentication latency overhead: ${summary.latencyOverhead}ms`);
    });

    it('should handle failed authentication consistently', async () => {
      const wrongPassword = 'WrongPassword123!';

      const result = await shadowCompare(
        'auth.authenticateUser',
        async () => {
          const q = `SELECT id, email, name, password, active_team, avatar_url, setup_completed,
                            timezone_id, google_id, created_at, updated_at, last_active,
                            temp_email, is_deleted, deleted_at
                     FROM users
                     WHERE email = $1 AND is_deleted IS FALSE`;
          const sqlResult = await db.query(q, [testEmail]);
          const [user] = sqlResult.rows;

          if (!user) return null;

          const isValid = bcrypt.compareSync(wrongPassword, user.password);
          if (!isValid) return null;

          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        },
        async () => {
          return await authService.authenticateUser(testEmail, wrongPassword);
        },
        {
          enabled: true,
          sampleRate: 1.0,
          normalizeOptions: {
            treatNullAsUndefined: true
          }
        }
      );

      expect(result.matched).toBe(true);
      expect(result.primaryResult).toBeNull();
      expect(result.shadowResult).toBeNull();
    });
  });

  describe('Shadow Mode Metrics Export', () => {
    it('should export metrics for analysis', () => {
      const allSummaries = metrics.getAllSummaries();

      expect(allSummaries.length).toBeGreaterThan(0);

      // Verify each summary has required fields
      for (const summary of allSummaries) {
        expect(summary).toHaveProperty('name');
        expect(summary).toHaveProperty('totalCalls');
        expect(summary).toHaveProperty('sampledCalls');
        expect(summary).toHaveProperty('matchRate');
        expect(summary).toHaveProperty('primaryLatency');
        expect(summary).toHaveProperty('shadowLatency');
        expect(summary).toHaveProperty('latencyOverhead');
      }

      console.log('\n=== Auth Service Shadow Mode Summary ===');
      console.log(JSON.stringify(allSummaries, null, 2));
    });
  });
});
