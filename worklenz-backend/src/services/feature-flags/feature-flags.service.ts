/**
 * Feature Flags Service for Prisma Migration
 *
 * Provides module-level feature flags to control SQL vs Prisma usage during migration.
 * Enables safe, incremental rollout with easy rollback.
 */

/**
 * Available modules for feature flagging
 */
export enum PrismaModule {
  AUTH = 'AUTH',
  TEAMS = 'TEAMS',
  PROJECTS = 'PROJECTS',
  TASKS = 'TASKS',
  RESOURCES = 'RESOURCES',
  REPORTS = 'REPORTS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  INVENTORY = 'INVENTORY',
  TIME_TRACKING = 'TIME_TRACKING',
  DASHBOARD = 'DASHBOARD',
  ALL = 'ALL' // Master switch
}

/**
 * Feature flag configuration
 */
interface FeatureFlagConfig {
  [PrismaModule.AUTH]: boolean;
  [PrismaModule.TEAMS]: boolean;
  [PrismaModule.PROJECTS]: boolean;
  [PrismaModule.TASKS]: boolean;
  [PrismaModule.RESOURCES]: boolean;
  [PrismaModule.REPORTS]: boolean;
  [PrismaModule.NOTIFICATIONS]: boolean;
  [PrismaModule.INVENTORY]: boolean;
  [PrismaModule.TIME_TRACKING]: boolean;
  [PrismaModule.DASHBOARD]: boolean;
  [PrismaModule.ALL]: boolean;
}

/**
 * Shadow mode configuration (for dual-execution comparison)
 */
interface ShadowModeConfig {
  [PrismaModule.AUTH]: boolean;
  [PrismaModule.TEAMS]: boolean;
  [PrismaModule.PROJECTS]: boolean;
  [PrismaModule.TASKS]: boolean;
  [PrismaModule.RESOURCES]: boolean;
  [PrismaModule.REPORTS]: boolean;
  [PrismaModule.NOTIFICATIONS]: boolean;
  [PrismaModule.INVENTORY]: boolean;
  [PrismaModule.TIME_TRACKING]: boolean;
  [PrismaModule.DASHBOARD]: boolean;
}

/**
 * Feature Flags Service (Singleton)
 */
class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private flags: FeatureFlagConfig;
  private shadowMode: ShadowModeConfig;
  private shadowSampleRate: number;
  private overrides: Map<string, boolean>;

  private constructor() {
    this.flags = this.loadFlags();
    this.shadowMode = this.loadShadowMode();
    this.shadowSampleRate = this.loadShadowSampleRate();
    this.overrides = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  /**
   * Load feature flags from environment variables
   */
  private loadFlags(): FeatureFlagConfig {
    return {
      [PrismaModule.AUTH]: this.parseBool(process.env.USE_PRISMA_AUTH, false),
      [PrismaModule.TEAMS]: this.parseBool(process.env.USE_PRISMA_TEAMS, false),
      [PrismaModule.PROJECTS]: this.parseBool(process.env.USE_PRISMA_PROJECTS, false),
      [PrismaModule.TASKS]: this.parseBool(process.env.USE_PRISMA_TASKS, false),
      [PrismaModule.RESOURCES]: this.parseBool(process.env.USE_PRISMA_RESOURCES, false),
      [PrismaModule.REPORTS]: this.parseBool(process.env.USE_PRISMA_REPORTS, false),
      [PrismaModule.NOTIFICATIONS]: this.parseBool(process.env.USE_PRISMA_NOTIFICATIONS, false),
      [PrismaModule.INVENTORY]: this.parseBool(process.env.USE_PRISMA_INVENTORY, false),
      [PrismaModule.TIME_TRACKING]: this.parseBool(process.env.USE_PRISMA_TIME_TRACKING, false),
      [PrismaModule.DASHBOARD]: this.parseBool(process.env.USE_PRISMA_DASHBOARD, false),
      [PrismaModule.ALL]: this.parseBool(process.env.USE_PRISMA_ALL, false)
    };
  }

  /**
   * Load shadow mode flags from environment variables
   */
  private loadShadowMode(): ShadowModeConfig {
    return {
      [PrismaModule.AUTH]: this.parseBool(process.env.SHADOW_COMPARE_AUTH, false),
      [PrismaModule.TEAMS]: this.parseBool(process.env.SHADOW_COMPARE_TEAMS, false),
      [PrismaModule.PROJECTS]: this.parseBool(process.env.SHADOW_COMPARE_PROJECTS, false),
      [PrismaModule.TASKS]: this.parseBool(process.env.SHADOW_COMPARE_TASKS, false),
      [PrismaModule.RESOURCES]: this.parseBool(process.env.SHADOW_COMPARE_RESOURCES, false),
      [PrismaModule.REPORTS]: this.parseBool(process.env.SHADOW_COMPARE_REPORTS, false),
      [PrismaModule.NOTIFICATIONS]: this.parseBool(process.env.SHADOW_COMPARE_NOTIFICATIONS, false),
      [PrismaModule.INVENTORY]: this.parseBool(process.env.SHADOW_COMPARE_INVENTORY, false),
      [PrismaModule.TIME_TRACKING]: this.parseBool(process.env.SHADOW_COMPARE_TIME_TRACKING, false),
      [PrismaModule.DASHBOARD]: this.parseBool(process.env.SHADOW_COMPARE_DASHBOARD, false)
    };
  }

  /**
   * Load shadow mode sample rate from environment
   */
  private loadShadowSampleRate(): number {
    const rate = parseFloat(process.env.SHADOW_MODE_SAMPLE_RATE || '0.01');
    return Math.max(0, Math.min(1, rate)); // Clamp between 0 and 1
  }

  /**
   * Parse boolean from environment variable
   */
  private parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;

    const normalized = value.toLowerCase().trim();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }

    return defaultValue;
  }

  /**
   * Check if Prisma should be used for a specific module
   */
  shouldUsePrisma(module: PrismaModule): boolean {
    // Check for override
    const overrideKey = `${module}`;
    if (this.overrides.has(overrideKey)) {
      return this.overrides.get(overrideKey)!;
    }

    // Check master switch
    if (this.flags[PrismaModule.ALL]) {
      return true;
    }

    // Check module-specific flag
    return this.flags[module] || false;
  }

  /**
   * Check if shadow mode is enabled for a module
   */
  isShadowModeEnabled(module: PrismaModule): boolean {
    return this.shadowMode[module] || false;
  }

  /**
   * Get shadow mode sample rate
   */
  getShadowSampleRate(): number {
    return this.shadowSampleRate;
  }

  /**
   * Set a runtime override for a module (useful for testing)
   */
  setOverride(module: PrismaModule, value: boolean): void {
    this.overrides.set(`${module}`, value);
  }

  /**
   * Clear a runtime override
   */
  clearOverride(module: PrismaModule): void {
    this.overrides.delete(`${module}`);
  }

  /**
   * Clear all runtime overrides
   */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Get all flags (for debugging/monitoring)
   */
  getAllFlags(): FeatureFlagConfig {
    return { ...this.flags };
  }

  /**
   * Get all shadow mode flags
   */
  getAllShadowFlags(): ShadowModeConfig {
    return { ...this.shadowMode };
  }

  /**
   * Reload flags from environment (useful after config changes)
   */
  reload(): void {
    this.flags = this.loadFlags();
    this.shadowMode = this.loadShadowMode();
    this.shadowSampleRate = this.loadShadowSampleRate();
  }

  /**
   * Get summary of current configuration
   */
  getSummary(): {
    usePrisma: string[];
    useSql: string[];
    shadowMode: string[];
    shadowSampleRate: number;
  } {
    const modules = Object.values(PrismaModule).filter(m => m !== PrismaModule.ALL);

    const usePrisma: string[] = [];
    const useSql: string[] = [];
    const shadowMode: string[] = [];

    for (const module of modules) {
      if (this.shouldUsePrisma(module)) {
        usePrisma.push(module);
      } else {
        useSql.push(module);
      }

      if (this.isShadowModeEnabled(module)) {
        shadowMode.push(module);
      }
    }

    return {
      usePrisma,
      useSql,
      shadowMode,
      shadowSampleRate: this.shadowSampleRate
    };
  }
}

/**
 * Export singleton instance
 */
export const featureFlags = FeatureFlagsService.getInstance();

/**
 * Convenience function to check if Prisma should be used
 */
export function shouldUsePrisma(module: PrismaModule): boolean {
  return featureFlags.shouldUsePrisma(module);
}

/**
 * Convenience function to check if shadow mode is enabled
 */
export function isShadowModeEnabled(module: PrismaModule): boolean {
  return featureFlags.isShadowModeEnabled(module);
}

/**
 * Middleware for easy service-layer branching
 * Usage in services:
 *
 * async getUserById(id: string) {
 *   return usePrismaOr(
 *     PrismaModule.AUTH,
 *     () => this.getUserByIdPrisma(id),
 *     () => this.getUserByIdSQL(id)
 *   );
 * }
 */
export async function usePrismaOr<T>(
  module: PrismaModule,
  prismaFn: () => Promise<T>,
  sqlFn: () => Promise<T>
): Promise<T> {
  if (shouldUsePrisma(module)) {
    return await prismaFn();
  } else {
    return await sqlFn();
  }
}

/**
 * Synchronous version of usePrismaOr
 */
export function usePrismaOrSync<T>(
  module: PrismaModule,
  prismaFn: () => T,
  sqlFn: () => T
): T {
  if (shouldUsePrisma(module)) {
    return prismaFn();
  } else {
    return sqlFn();
  }
}

/**
 * Helper to execute with shadow mode comparison
 * Usage:
 *
 * return withShadowCompare(
 *   'getUserById',
 *   PrismaModule.AUTH,
 *   () => this.getUserByIdPrisma(id),
 *   () => this.getUserByIdSQL(id)
 * );
 */
export async function withShadowCompare<T>(
  name: string,
  module: PrismaModule,
  prismaFn: () => Promise<T>,
  sqlFn: () => Promise<T>
): Promise<T> {
  const usePrisma = shouldUsePrisma(module);
  const shadowEnabled = isShadowModeEnabled(module);

  if (!shadowEnabled) {
    // No shadow mode, just use the selected implementation
    return usePrisma ? await prismaFn() : await sqlFn();
  }

  // Shadow mode enabled - import shadow compare utility
  const { shadowCompare } = await import('../tests/utils/shadow-compare');

  if (usePrisma) {
    // Prisma is primary, SQL is shadow
    const result = await shadowCompare(
      `${module}:${name}`,
      prismaFn,
      sqlFn,
      {
        enabled: true,
        sampleRate: featureFlags.getShadowSampleRate()
      }
    );
    return result.primaryResult;
  } else {
    // SQL is primary, Prisma is shadow
    const result = await shadowCompare(
      `${module}:${name}`,
      sqlFn,
      prismaFn,
      {
        enabled: true,
        sampleRate: featureFlags.getShadowSampleRate()
      }
    );
    return result.primaryResult;
  }
}

/**
 * Decorator for class methods to automatically use feature flags
 * Usage:
 *
 * @UsePrismaOr(PrismaModule.AUTH, 'getUserByIdSQL')
 * async getUserByIdPrisma(id: string) { ... }
 */
export function UsePrismaOr(module: PrismaModule, sqlMethodName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const prismaMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (shouldUsePrisma(module)) {
        return await prismaMethod.apply(this, args);
      } else {
        const sqlMethod = this[sqlMethodName];
        if (!sqlMethod) {
          throw new Error(`SQL method ${sqlMethodName} not found on ${target.constructor.name}`);
        }
        return await sqlMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
