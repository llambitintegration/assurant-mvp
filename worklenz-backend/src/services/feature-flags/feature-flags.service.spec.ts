/**
 * Tests for Feature Flags Service
 */

import {
  featureFlags,
  PrismaModule,
  shouldUsePrisma,
  isShadowModeEnabled,
  usePrismaOr,
  usePrismaOrSync
} from './feature-flags.service';

describe('Feature Flags Service', () => {
  beforeEach(() => {
    // Clear all overrides before each test
    featureFlags.clearAllOverrides();

    // Reset environment variables
    delete process.env.USE_PRISMA_ALL;
    delete process.env.USE_PRISMA_AUTH;
    delete process.env.SHADOW_COMPARE_AUTH;
    delete process.env.SHADOW_MODE_SAMPLE_RATE;

    // Reload flags
    featureFlags.reload();
  });

  describe('shouldUsePrisma', () => {
    it('should return false by default', () => {
      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(false);
    });

    it('should return true when module flag is set', () => {
      process.env.USE_PRISMA_AUTH = 'true';
      featureFlags.reload();

      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(true);
    });

    it('should return true for all modules when USE_PRISMA_ALL is set', () => {
      process.env.USE_PRISMA_ALL = 'true';
      featureFlags.reload();

      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(true);
      expect(shouldUsePrisma(PrismaModule.TEAMS)).toBe(true);
      expect(shouldUsePrisma(PrismaModule.PROJECTS)).toBe(true);
    });

    it('should respect runtime overrides', () => {
      featureFlags.setOverride(PrismaModule.AUTH, true);

      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(true);

      featureFlags.setOverride(PrismaModule.AUTH, false);

      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(false);
    });

    it('should clear overrides', () => {
      featureFlags.setOverride(PrismaModule.AUTH, true);
      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(true);

      featureFlags.clearOverride(PrismaModule.AUTH);
      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(false);
    });
  });

  describe('isShadowModeEnabled', () => {
    it('should return false by default', () => {
      expect(isShadowModeEnabled(PrismaModule.AUTH)).toBe(false);
    });

    it('should return true when shadow mode flag is set', () => {
      process.env.SHADOW_COMPARE_AUTH = 'true';
      featureFlags.reload();

      expect(isShadowModeEnabled(PrismaModule.AUTH)).toBe(true);
    });
  });

  describe('getShadowSampleRate', () => {
    it('should return default sample rate', () => {
      expect(featureFlags.getShadowSampleRate()).toBe(0.01);
    });

    it('should return configured sample rate', () => {
      process.env.SHADOW_MODE_SAMPLE_RATE = '0.5';
      featureFlags.reload();

      expect(featureFlags.getShadowSampleRate()).toBe(0.5);
    });

    it('should clamp sample rate between 0 and 1', () => {
      process.env.SHADOW_MODE_SAMPLE_RATE = '1.5';
      featureFlags.reload();

      expect(featureFlags.getShadowSampleRate()).toBeLessThanOrEqual(1);

      process.env.SHADOW_MODE_SAMPLE_RATE = '-0.5';
      featureFlags.reload();

      expect(featureFlags.getShadowSampleRate()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('usePrismaOr', () => {
    it('should call Prisma function when flag is enabled', async () => {
      featureFlags.setOverride(PrismaModule.AUTH, true);

      const prismaFn = jest.fn().mockResolvedValue('prisma');
      const sqlFn = jest.fn().mockResolvedValue('sql');

      const result = await usePrismaOr(PrismaModule.AUTH, prismaFn, sqlFn);

      expect(result).toBe('prisma');
      expect(prismaFn).toHaveBeenCalled();
      expect(sqlFn).not.toHaveBeenCalled();
    });

    it('should call SQL function when flag is disabled', async () => {
      featureFlags.setOverride(PrismaModule.AUTH, false);

      const prismaFn = jest.fn().mockResolvedValue('prisma');
      const sqlFn = jest.fn().mockResolvedValue('sql');

      const result = await usePrismaOr(PrismaModule.AUTH, prismaFn, sqlFn);

      expect(result).toBe('sql');
      expect(sqlFn).toHaveBeenCalled();
      expect(prismaFn).not.toHaveBeenCalled();
    });
  });

  describe('usePrismaOrSync', () => {
    it('should call Prisma function when flag is enabled', () => {
      featureFlags.setOverride(PrismaModule.AUTH, true);

      const prismaFn = jest.fn().mockReturnValue('prisma');
      const sqlFn = jest.fn().mockReturnValue('sql');

      const result = usePrismaOrSync(PrismaModule.AUTH, prismaFn, sqlFn);

      expect(result).toBe('prisma');
      expect(prismaFn).toHaveBeenCalled();
      expect(sqlFn).not.toHaveBeenCalled();
    });

    it('should call SQL function when flag is disabled', () => {
      featureFlags.setOverride(PrismaModule.AUTH, false);

      const prismaFn = jest.fn().mockReturnValue('prisma');
      const sqlFn = jest.fn().mockReturnValue('sql');

      const result = usePrismaOrSync(PrismaModule.AUTH, prismaFn, sqlFn);

      expect(result).toBe('sql');
      expect(sqlFn).toHaveBeenCalled();
      expect(prismaFn).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should provide summary of configuration', () => {
      process.env.USE_PRISMA_AUTH = 'true';
      process.env.USE_PRISMA_TEAMS = 'true';
      process.env.SHADOW_COMPARE_AUTH = 'true';
      process.env.SHADOW_MODE_SAMPLE_RATE = '0.1';
      featureFlags.reload();

      const summary = featureFlags.getSummary();

      expect(summary.usePrisma).toContain('AUTH');
      expect(summary.usePrisma).toContain('TEAMS');
      expect(summary.useSql).toContain('PROJECTS');
      expect(summary.shadowMode).toContain('AUTH');
      expect(summary.shadowSampleRate).toBe(0.1);
    });
  });

  describe('getAllFlags', () => {
    it('should return all feature flags', () => {
      const flags = featureFlags.getAllFlags();

      expect(flags).toHaveProperty(PrismaModule.AUTH);
      expect(flags).toHaveProperty(PrismaModule.TEAMS);
      expect(flags).toHaveProperty(PrismaModule.PROJECTS);
    });
  });

  describe('boolean parsing', () => {
    it('should parse various true values', () => {
      const trueValues = ['true', 'TRUE', '1', 'yes', 'YES'];

      for (const value of trueValues) {
        process.env.USE_PRISMA_AUTH = value;
        featureFlags.reload();
        expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(true);
      }
    });

    it('should parse various false values', () => {
      const falseValues = ['false', 'FALSE', '0', 'no', 'NO'];

      for (const value of falseValues) {
        process.env.USE_PRISMA_AUTH = value;
        featureFlags.reload();
        expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(false);
      }
    });

    it('should use default for invalid values', () => {
      process.env.USE_PRISMA_AUTH = 'invalid';
      featureFlags.reload();

      expect(shouldUsePrisma(PrismaModule.AUTH)).toBe(false);
    });
  });
});
