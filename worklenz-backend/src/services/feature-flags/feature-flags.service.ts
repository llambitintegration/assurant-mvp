/**
 * Feature Flags Service
 *
 * Manages feature flags for the Prisma migration process.
 * Allows gradual rollout of Prisma implementations with instant rollback capability.
 *
 * Environment Variables:
 * - USE_PRISMA_ALL: Master switch (overrides all module flags)
 * - USE_PRISMA_<MODULE>: Individual module flags (auth, teams, projects, tasks, etc.)
 * - SHADOW_MODE_ENABLED: Enable shadow comparison globally
 * - SHADOW_COMPARE_<MODULE>: Enable shadow comparison for specific modules
 * - SHADOW_MODE_SAMPLE_RATE: Percentage of requests to compare (0.0-1.0)
 */

export type FeatureFlagModule =
  | 'auth'
  | 'teams'
  | 'projects'
  | 'tasks'
  | 'labels'
  | 'custom_columns'
  | 'resources'
  | 'reports'
  | 'notifications'
  | 'inventory'
  | 'time_tracking'
  | 'dashboard';

export type FeatureFlagContext = 'read' | 'write' | 'all';

export interface ShadowModeConfig {
  enabled: boolean;
  sampleRate: number;
}

export class FeatureFlagsService {
  private static instance: FeatureFlagsService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  /**
   * Check if Prisma is enabled for a given module
   *
   * @param module - The module to check (e.g., 'projects', 'auth')
   * @param context - Optional context (read, write, all). Defaults to 'all'.
   * @returns true if Prisma should be used for this module
   *
   * @example
   * const usePrisma = FeatureFlagsService.getInstance().isEnabled('projects');
   * const usePrismaRead = FeatureFlagsService.getInstance().isEnabled('projects', 'read');
   */
  public isEnabled(module: FeatureFlagModule, context: FeatureFlagContext = 'all'): boolean {
    // Master switch overrides everything
    if (this.getBooleanEnv('USE_PRISMA_ALL', false)) {
      return true;
    }

    // Check module-specific flag
    const moduleFlag = `USE_PRISMA_${module.toUpperCase()}`;
    const moduleEnabled = this.getBooleanEnv(moduleFlag, false);

    // If context is specified (read/write), check context-specific flag
    if (context !== 'all') {
      const contextFlag = `USE_PRISMA_${module.toUpperCase()}_${context.toUpperCase()}`;
      const contextEnabled = this.getBooleanEnv(contextFlag);

      // Context flag takes precedence if set
      if (contextEnabled !== undefined) {
        return contextEnabled;
      }
    }

    return moduleEnabled;
  }

  /**
   * Check if shadow mode is enabled for a given module
   *
   * Shadow mode runs both SQL and Prisma in parallel and compares results
   * without affecting the primary response.
   *
   * @param module - The module to check
   * @returns true if shadow comparison should be performed
   */
  public isShadowModeEnabled(module: FeatureFlagModule): boolean {
    // Global shadow mode must be enabled
    if (!this.getBooleanEnv('SHADOW_MODE_ENABLED', false)) {
      return false;
    }

    // Check module-specific shadow compare flag
    const shadowFlag = `SHADOW_COMPARE_${module.toUpperCase()}`;
    return this.getBooleanEnv(shadowFlag, false);
  }

  /**
   * Get shadow mode configuration for a module
   *
   * @param module - The module to check
   * @returns Shadow mode configuration (enabled, sampleRate)
   */
  public getShadowModeConfig(module: FeatureFlagModule): ShadowModeConfig {
    return {
      enabled: this.isShadowModeEnabled(module),
      sampleRate: this.getFloatEnv('SHADOW_MODE_SAMPLE_RATE', 0.01)
    };
  }

  /**
   * Check if shadow comparison should run for this request
   * Based on sample rate (e.g., 0.01 = 1% of requests)
   *
   * @param module - The module to check
   * @returns true if this request should be shadow compared
   */
  public shouldRunShadowCompare(module: FeatureFlagModule): boolean {
    const config = this.getShadowModeConfig(module);

    if (!config.enabled) {
      return false;
    }

    // Random sampling based on sample rate
    return Math.random() < config.sampleRate;
  }

  /**
   * Get all enabled modules
   *
   * @returns Array of modules that have Prisma enabled
   */
  public getEnabledModules(): FeatureFlagModule[] {
    const modules: FeatureFlagModule[] = [
      'auth',
      'teams',
      'projects',
      'tasks',
      'labels',
      'custom_columns',
      'resources',
      'reports',
      'notifications',
      'inventory',
      'time_tracking',
      'dashboard'
    ];

    return modules.filter(module => this.isEnabled(module));
  }

  /**
   * Get rollback instructions for a module
   *
   * @param module - The module to get rollback instructions for
   * @returns Rollback instructions
   */
  public getRollbackInstructions(module: FeatureFlagModule): string {
    return `
To rollback ${module} to SQL:
1. Set USE_PRISMA_${module.toUpperCase()}=false in .env
2. Restart the server: npm run dev
3. Verify functionality with smoke tests
4. Check logs for any errors

Emergency rollback:
- Set USE_PRISMA_ALL=false to disable all Prisma usage immediately
`;
  }

  /**
   * Get migration status summary
   *
   * @returns Object with migration status for all modules
   */
  public getMigrationStatus(): Record<string, { prisma: boolean; shadow: boolean }> {
    const modules: FeatureFlagModule[] = [
      'auth',
      'teams',
      'projects',
      'tasks',
      'labels',
      'custom_columns',
      'resources',
      'reports',
      'notifications',
      'inventory',
      'time_tracking',
      'dashboard'
    ];

    const status: Record<string, { prisma: boolean; shadow: boolean }> = {};

    for (const module of modules) {
      status[module] = {
        prisma: this.isEnabled(module),
        shadow: this.isShadowModeEnabled(module)
      };
    }

    return status;
  }

  // ===== Private Helper Methods =====

  /**
   * Get boolean environment variable
   *
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set or undefined
   * @returns Boolean value
   */
  private getBooleanEnv(key: string): boolean | undefined;
  private getBooleanEnv(key: string, defaultValue: boolean): boolean;
  private getBooleanEnv(key: string, defaultValue?: boolean): boolean | undefined {
    const value = process.env[key];

    if (value === undefined || value === '') {
      return defaultValue;
    }

    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get float environment variable
   *
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set
   * @returns Float value
   */
  private getFloatEnv(key: string, defaultValue: number): number {
    const value = process.env[key];

    if (value === undefined || value === '') {
      return defaultValue;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}

/**
 * Convenience function to get feature flags instance
 */
export function getFeatureFlags(): FeatureFlagsService {
  return FeatureFlagsService.getInstance();
}
