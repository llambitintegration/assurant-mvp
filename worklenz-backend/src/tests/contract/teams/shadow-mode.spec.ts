/**
 * Shadow Mode Tests: Teams Service
 *
 * Tests SQL vs Prisma execution in shadow mode for team operations
 * Focuses on high-traffic queries with JOINs
 */

import { shadowCompare, ShadowMetrics } from '../../utils/shadow-compare';
import db from '../../../config/db';
import { TeamsService } from '../../../services/teams/teams-service';
import bcrypt from 'bcrypt';

describe('Shadow Mode: Teams Service', () => {
  let teamsService: TeamsService;
  let testUser: any;
  let testTeam: any;
  let testRole: any;
  let testMember: any;
  const metrics = ShadowMetrics.getInstance();

  beforeAll(async () => {
    teamsService = new TeamsService();

    // Create test data
    const userEmail = `shadow-team-${Date.now()}@example.com`;
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('test_password', salt);

    const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
    const timezoneId = timezoneResult.rows[0]?.id;

    const userResult = await db.query(
      `INSERT INTO users (email, name, password, timezone_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [userEmail, 'Shadow Team Test User', hashedPassword, timezoneId]
    );
    testUser = userResult.rows[0];

    const teamResult = await db.query(
      `INSERT INTO teams (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, user_id`,
      [`Shadow Test Team ${Date.now()}`, testUser.id]
    );
    testTeam = teamResult.rows[0];

    const roleResult = await db.query(
      `INSERT INTO roles (name, team_id, default_role, admin_role, owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, team_id`,
      ['Shadow Role', testTeam.id, false, false, false]
    );
    testRole = roleResult.rows[0];

    const memberResult = await db.query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [testUser.id, testTeam.id, testRole.id]
    );
    testMember = memberResult.rows[0];

    // Reset metrics
    metrics.reset('teams.getTeamMemberById');
    metrics.reset('teams.getTeamMembersList');
    metrics.reset('teams.createTeamMember');
  });

  afterAll(async () => {
    // Cleanup
    if (testMember?.id) {
      await db.query('DELETE FROM team_members WHERE id = $1', [testMember.id]);
    }
    if (testRole?.id) {
      await db.query('DELETE FROM roles WHERE id = $1', [testRole.id]);
    }
    if (testTeam?.id) {
      await db.query('DELETE FROM teams WHERE id = $1', [testTeam.id]);
    }
    if (testUser?.id) {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  describe('getTeamMemberById - Shadow Mode', () => {
    it('should compare SQL vs Prisma with JOIN operations', async () => {
      const result = await shadowCompare(
        'teams.getTeamMemberById',
        // SQL function with JOIN
        async () => {
          const q = `
            SELECT tm.id,
                   tm.user_id,
                   tm.team_id,
                   tm.role_id,
                   tm.job_title_id,
                   tm.created_at,
                   tm.updated_at,
                   tm.active,
                   r.id AS role_id,
                   r.name AS role_name,
                   r.team_id AS role_team_id,
                   r.default_role,
                   r.admin_role,
                   r.owner
            FROM team_members tm
            INNER JOIN roles r ON tm.role_id = r.id
            WHERE tm.id = $1 AND tm.active = TRUE
          `;
          const sqlResult = await db.query(q, [testMember.id]);
          return sqlResult.rows[0] || null;
        },
        // Prisma function with include
        async () => {
          return await teamsService.getTeamMemberById(testMember.id);
        },
        {
          enabled: true,
          sampleRate: 1.0,
          logMismatches: true,
          logSuccesses: false,
          piiFields: ['email', 'name'],
          normalizeOptions: {
            timestampTolerance: 1000,
            treatNullAsUndefined: true
          }
        }
      );

      expect(result.matched).toBe(true);
      expect(result.differences.length).toBe(0);

      // Verify role information included (flattened fields)
      expect(result.shadowResult).toHaveProperty('role_name');
    });

    it('should track JOIN query performance', async () => {
      // Execute multiple times
      for (let i = 0; i < 10; i++) {
        await shadowCompare(
          'teams.getTeamMemberById',
          async () => {
            const q = `
              SELECT tm.id,
                     tm.user_id,
                     tm.team_id,
                     tm.role_id,
                     tm.job_title_id,
                     tm.created_at,
                     tm.updated_at,
                     tm.active,
                     r.id AS role_id,
                     r.name AS role_name,
                     r.team_id AS role_team_id,
                     r.default_role,
                     r.admin_role,
                     r.owner
              FROM team_members tm
              INNER JOIN roles r ON tm.role_id = r.id
              WHERE tm.id = $1 AND tm.active = TRUE
            `;
            const sqlResult = await db.query(q, [testMember.id]);
            return sqlResult.rows[0] || null;
          },
          async () => {
            return await teamsService.getTeamMemberById(testMember.id);
          },
          {
            enabled: true,
            sampleRate: 1.0,
            logMismatches: false,
            normalizeOptions: {
              timestampTolerance: 1000,
              treatNullAsUndefined: true
            }
          }
        );
      }

      const summary = metrics.getSummary('teams.getTeamMemberById');

      expect(summary.sampledCalls).toBeGreaterThanOrEqual(10);
      expect(summary.matchRate).toBe(1.0);

      console.log(`getTeamMemberById (JOIN) - SQL p95: ${summary.primaryLatency.p95}ms, Prisma p95: ${summary.shadowLatency.p95}ms`);
      console.log(`JOIN query latency overhead: ${summary.latencyOverhead}ms`);
    });
  });

  describe('getTeamMembersList - Shadow Mode (High-Traffic Query)', () => {
    it('should compare SQL vs Prisma for list queries', async () => {
      const result = await shadowCompare(
        'teams.getTeamMembersList',
        // SQL function
        async () => {
          const q = `
            SELECT tm.id,
                   tm.user_id,
                   tm.team_id,
                   tm.role_id,
                   tm.job_title_id,
                   tm.created_at,
                   tm.updated_at,
                   tm.active,
                   r.id AS role_id,
                   r.name AS role_name,
                   r.team_id AS role_team_id,
                   r.default_role,
                   r.admin_role,
                   r.owner,
                   u.email AS user_email,
                   u.name AS user_name
            FROM team_members tm
            INNER JOIN roles r ON tm.role_id = r.id
            LEFT JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = $1 AND tm.active = TRUE
            ORDER BY tm.created_at ASC
          `;
          const sqlResult = await db.query(q, [testTeam.id]);
          return sqlResult.rows;
        },
        // Prisma function
        async () => {
          return await teamsService.getTeamMembersList(testTeam.id);
        },
        {
          enabled: true,
          sampleRate: 1.0,
          logMismatches: true,
          logSuccesses: false,
          piiFields: ['email', 'name', 'user_email', 'user_name'],
          normalizeOptions: {
            sortArraysBy: 'id',
            timestampTolerance: 1000,
            treatNullAsUndefined: true
          }
        }
      );

      expect(result.matched).toBe(true);
      expect(result.differences.length).toBe(0);
    });

    it('should benchmark high-traffic query performance', async () => {
      // Simulate high traffic with rapid queries
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        await shadowCompare(
          'teams.getTeamMembersList',
          async () => {
            const q = `
              SELECT tm.id,
                     tm.user_id,
                     tm.team_id,
                     tm.role_id,
                     tm.job_title_id,
                     tm.created_at,
                     tm.updated_at,
                     tm.active,
                     r.id AS role_id,
                     r.name AS role_name,
                     r.team_id AS role_team_id,
                     r.default_role,
                     r.admin_role,
                     r.owner,
                     u.email AS user_email,
                     u.name AS user_name
              FROM team_members tm
              INNER JOIN roles r ON tm.role_id = r.id
              LEFT JOIN users u ON tm.user_id = u.id
              WHERE tm.team_id = $1 AND tm.active = TRUE
              ORDER BY tm.created_at ASC
            `;
            const sqlResult = await db.query(q, [testTeam.id]);
            return sqlResult.rows;
          },
          async () => {
            return await teamsService.getTeamMembersList(testTeam.id);
          },
          {
            enabled: true,
            sampleRate: 1.0,
            logMismatches: false,
            normalizeOptions: {
              sortArraysBy: 'id',
              timestampTolerance: 1000,
              treatNullAsUndefined: true
            }
          }
        );
      }

      const summary = metrics.getSummary('teams.getTeamMembersList');

      expect(summary.sampledCalls).toBeGreaterThanOrEqual(iterations);
      expect(summary.matchRate).toBe(1.0);

      // Performance benchmarking
      console.log('\n=== High-Traffic Query Performance ===');
      console.log(`Total calls: ${summary.sampledCalls}`);
      console.log(`SQL latencies (ms):`);
      console.log(`  - p50: ${summary.primaryLatency.p50}`);
      console.log(`  - p95: ${summary.primaryLatency.p95}`);
      console.log(`  - p99: ${summary.primaryLatency.p99}`);
      console.log(`  - avg: ${summary.primaryLatency.avg}`);
      console.log(`Prisma latencies (ms):`);
      console.log(`  - p50: ${summary.shadowLatency.p50}`);
      console.log(`  - p95: ${summary.shadowLatency.p95}`);
      console.log(`  - p99: ${summary.shadowLatency.p99}`);
      console.log(`  - avg: ${summary.shadowLatency.avg}`);
      console.log(`Latency overhead: ${summary.latencyOverhead}ms (${((summary.latencyOverhead / summary.primaryLatency.avg) * 100).toFixed(2)}%)`);

      // Success criteria: Prisma should be within 20% of SQL performance
      const overheadPercentage = (summary.latencyOverhead / summary.primaryLatency.avg) * 100;
      console.log(`\nPerformance check: ${overheadPercentage <= 20 ? 'PASS' : 'WARN'} (${overheadPercentage.toFixed(2)}% overhead, target: <= 20%)`);
    });
  });

  describe('createTeamMember - Shadow Mode', () => {
    it('should compare transaction-based creation', async () => {
      // Create new user for this test
      const memberEmail = `shadow-new-member-${Date.now()}@example.com`;
      const timezoneResult = await db.query('SELECT id FROM timezones LIMIT 1');
      const timezoneId = timezoneResult.rows[0]?.id;

      const memberUserResult = await db.query(
        `INSERT INTO users (email, name, password, timezone_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [memberEmail, 'Shadow New Member', 'hashed_pw', timezoneId]
      );
      const newUserId = memberUserResult.rows[0].id;
      let sqlMemberId: string;
      let prismaMemberId: string;

      try {
        const result = await shadowCompare(
          'teams.createTeamMember',
          // SQL function
          async () => {
            const q = `
              INSERT INTO team_members (user_id, team_id, role_id, active)
              VALUES ($1, $2, $3, TRUE)
              RETURNING id, user_id, team_id, role_id, job_title_id, created_at, updated_at, active
            `;
            const sqlResult = await db.query(q, [newUserId, testTeam.id, testRole.id]);
            sqlMemberId = sqlResult.rows[0].id;
            return sqlResult.rows[0];
          },
          // Prisma function
          async () => {
            const member = await teamsService.createTeamMember({
              user_id: newUserId,
              team_id: testTeam.id,
              role_id: testRole.id
            });
            prismaMemberId = member.id;
            return member;
          },
          {
            enabled: true,
            sampleRate: 1.0,
            logMismatches: true,
            normalizeOptions: {
              timestampTolerance: 1000,
              treatNullAsUndefined: true
            }
          }
        );

        // Check key fields match (IDs will differ)
        expect(result.primaryResult.user_id).toBe(result.shadowResult.user_id);
        expect(result.primaryResult.team_id).toBe(result.shadowResult.team_id);
        expect(result.primaryResult.role_id).toBe(result.shadowResult.role_id);
        expect(result.primaryResult.active).toBe(result.shadowResult.active);
      } finally {
        // Cleanup
        if (sqlMemberId!) {
          await db.query('DELETE FROM team_members WHERE id = $1', [sqlMemberId]);
        }
        if (prismaMemberId!) {
          await db.query('DELETE FROM team_members WHERE id = $1', [prismaMemberId]);
        }
        await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
      }
    });
  });

  describe('Shadow Mode Summary', () => {
    it('should export comprehensive metrics report', () => {
      const allSummaries = metrics.getAllSummaries();
      const teamsSummaries = allSummaries.filter(s => s.name.startsWith('teams.'));

      console.log('\n=== Teams Service Shadow Mode Summary ===');
      console.log(JSON.stringify(teamsSummaries, null, 2));

      // Verify all team queries tracked
      expect(teamsSummaries.length).toBeGreaterThan(0);

      // Check performance criteria
      for (const summary of teamsSummaries) {
        const overheadPct = (summary.latencyOverhead / summary.primaryLatency.avg) * 100;
        console.log(`\n${summary.name}:`);
        console.log(`  Match rate: ${(summary.matchRate * 100).toFixed(2)}%`);
        console.log(`  Overhead: ${overheadPct.toFixed(2)}%`);
        console.log(`  p95 latency: SQL=${summary.primaryLatency.p95}ms, Prisma=${summary.shadowLatency.p95}ms`);
      }
    });
  });
});
