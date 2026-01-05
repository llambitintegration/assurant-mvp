/**
 * Migration Progress Tracker
 *
 * Tracks real-time progress of the Prisma migration effort.
 * Monitors total queries, migrated queries, and progress by module.
 */

import fs from 'fs';
import path from 'path';

export interface ModuleProgress {
  module: string;
  totalQueries: number;
  migrated: number;
  inProgress: number;
  remaining: number;
  percentComplete: number;
  status: 'not_started' | 'in_progress' | 'completed';
  startDate?: Date;
  completedDate?: Date;
}

export interface MigrationProgress {
  totalQueries: number;
  migrated: number;
  inProgress: number;
  remaining: number;
  percentComplete: number;
  moduleProgress: ModuleProgress[];
  modulesComplete: string[];
  modulesInProgress: string[];
  lastUpdated: Date;
}

/**
 * Module query counts from inventory
 * Based on /mnt/c/0_repos/assurant-mvp/context/prisma-migration-inventory.md
 */
const MODULE_QUERY_COUNTS: Record<string, number> = {
  'auth': 9,
  'teams': 7,
  'team-members': 23,
  'projects': 24,
  'tasks': 64, // tasks-controller.ts (31) + tasks-controller-v2.ts (33)
  'reporting': 35,
  'admin-center': 37,
  'task-comments': 19,
  'project-insights': 14,
  'workload-gantt': 12,
  'schedule': 22, // schedule-controller.ts (12) + schedule-v2-controller.ts (10)
  'task-statuses': 11,
  'reporting-allocation': 9,
  'survey': 8,
  'task-phases': 8,
  'pt-task-statuses': 8,
  'project-templates': 33,
  'reporting-overview': 20,
  'other': 282 // Remaining queries from various controllers
};

/**
 * Total queries from inventory: 685
 */
const TOTAL_QUERIES = Object.values(MODULE_QUERY_COUNTS).reduce((a, b) => a + b, 0);

class ProgressTracker {
  private moduleProgress: Map<string, ModuleProgress> = new Map();
  private persistPath: string;

  constructor() {
    // Default persist path (can be overridden via env var)
    this.persistPath = process.env.MIGRATION_PROGRESS_PATH ||
      path.join(__dirname, '../../../data/migration-progress.json');

    // Initialize module progress
    this.initializeModules();

    // Load persisted progress if available
    this.load();
  }

  /**
   * Initialize all modules with default progress
   */
  private initializeModules(): void {
    for (const [module, totalQueries] of Object.entries(MODULE_QUERY_COUNTS)) {
      this.moduleProgress.set(module, {
        module,
        totalQueries,
        migrated: 0,
        inProgress: 0,
        remaining: totalQueries,
        percentComplete: 0,
        status: 'not_started'
      });
    }
  }

  /**
   * Mark queries as migrated for a module
   */
  markMigrated(module: string, count: number): void {
    const progress = this.moduleProgress.get(module);
    if (!progress) {
      console.warn(`Module ${module} not found in progress tracker`);
      return;
    }

    progress.migrated = Math.min(count, progress.totalQueries);
    progress.remaining = progress.totalQueries - progress.migrated - progress.inProgress;
    progress.percentComplete = (progress.migrated / progress.totalQueries) * 100;

    if (progress.migrated === progress.totalQueries) {
      progress.status = 'completed';
      progress.completedDate = new Date();
    } else if (progress.migrated > 0 || progress.inProgress > 0) {
      progress.status = 'in_progress';
      if (!progress.startDate) {
        progress.startDate = new Date();
      }
    }

    this.persist();
  }

  /**
   * Mark queries as in progress for a module
   */
  markInProgress(module: string, count: number): void {
    const progress = this.moduleProgress.get(module);
    if (!progress) {
      console.warn(`Module ${module} not found in progress tracker`);
      return;
    }

    progress.inProgress = Math.min(count, progress.totalQueries - progress.migrated);
    progress.remaining = progress.totalQueries - progress.migrated - progress.inProgress;

    if (progress.inProgress > 0 || progress.migrated > 0) {
      progress.status = 'in_progress';
      if (!progress.startDate) {
        progress.startDate = new Date();
      }
    }

    this.persist();
  }

  /**
   * Complete an entire module migration
   */
  completeModule(module: string): void {
    const progress = this.moduleProgress.get(module);
    if (!progress) {
      console.warn(`Module ${module} not found in progress tracker`);
      return;
    }

    progress.migrated = progress.totalQueries;
    progress.inProgress = 0;
    progress.remaining = 0;
    progress.percentComplete = 100;
    progress.status = 'completed';
    progress.completedDate = new Date();

    this.persist();
  }

  /**
   * Reset module progress (for rollbacks)
   */
  resetModule(module: string): void {
    const progress = this.moduleProgress.get(module);
    if (!progress) {
      console.warn(`Module ${module} not found in progress tracker`);
      return;
    }

    const totalQueries = progress.totalQueries;
    this.moduleProgress.set(module, {
      module,
      totalQueries,
      migrated: 0,
      inProgress: 0,
      remaining: totalQueries,
      percentComplete: 0,
      status: 'not_started'
    });

    this.persist();
  }

  /**
   * Get overall migration progress
   */
  getProgress(): MigrationProgress {
    let totalMigrated = 0;
    let totalInProgress = 0;
    const modulesComplete: string[] = [];
    const modulesInProgress: string[] = [];
    const moduleProgressArray: ModuleProgress[] = [];

    for (const progress of this.moduleProgress.values()) {
      totalMigrated += progress.migrated;
      totalInProgress += progress.inProgress;

      if (progress.status === 'completed') {
        modulesComplete.push(progress.module);
      } else if (progress.status === 'in_progress') {
        modulesInProgress.push(progress.module);
      }

      moduleProgressArray.push({ ...progress });
    }

    const totalRemaining = TOTAL_QUERIES - totalMigrated - totalInProgress;
    const percentComplete = (totalMigrated / TOTAL_QUERIES) * 100;

    return {
      totalQueries: TOTAL_QUERIES,
      migrated: totalMigrated,
      inProgress: totalInProgress,
      remaining: totalRemaining,
      percentComplete: Math.round(percentComplete * 100) / 100, // Round to 2 decimal places
      moduleProgress: moduleProgressArray.sort((a, b) => b.percentComplete - a.percentComplete),
      modulesComplete,
      modulesInProgress,
      lastUpdated: new Date()
    };
  }

  /**
   * Get progress for a specific module
   */
  getModuleProgress(module: string): ModuleProgress | null {
    const progress = this.moduleProgress.get(module);
    return progress ? { ...progress } : null;
  }

  /**
   * Export progress to JSON for reporting
   */
  exportJSON(): string {
    const progress = this.getProgress();
    return JSON.stringify(progress, null, 2);
  }

  /**
   * Export progress to CSV
   */
  exportCSV(): string {
    const progress = this.getProgress();
    let csv = 'Module,Total Queries,Migrated,In Progress,Remaining,Percent Complete,Status,Start Date,Completed Date\n';

    for (const module of progress.moduleProgress) {
      csv += [
        module.module,
        module.totalQueries,
        module.migrated,
        module.inProgress,
        module.remaining,
        module.percentComplete.toFixed(2),
        module.status,
        module.startDate ? module.startDate.toISOString() : '',
        module.completedDate ? module.completedDate.toISOString() : ''
      ].join(',') + '\n';
    }

    csv += `\nTotal,${progress.totalQueries},${progress.migrated},${progress.inProgress},${progress.remaining},${progress.percentComplete.toFixed(2)}\n`;

    return csv;
  }

  /**
   * Export progress to Markdown table
   */
  exportMarkdown(): string {
    const progress = this.getProgress();
    let md = '# Prisma Migration Progress\n\n';
    md += `**Last Updated:** ${progress.lastUpdated.toISOString()}\n\n`;
    md += `**Overall Progress:** ${progress.migrated}/${progress.totalQueries} (${progress.percentComplete.toFixed(2)}%)\n\n`;

    md += '## Summary\n\n';
    md += `- Total Queries: ${progress.totalQueries}\n`;
    md += `- Migrated: ${progress.migrated}\n`;
    md += `- In Progress: ${progress.inProgress}\n`;
    md += `- Remaining: ${progress.remaining}\n`;
    md += `- Modules Complete: ${progress.modulesComplete.length}\n`;
    md += `- Modules In Progress: ${progress.modulesInProgress.length}\n\n`;

    md += '## Module Breakdown\n\n';
    md += '| Module | Total | Migrated | In Progress | Remaining | % Complete | Status |\n';
    md += '|--------|-------|----------|-------------|-----------|------------|--------|\n';

    for (const module of progress.moduleProgress) {
      const statusEmoji = module.status === 'completed' ? '✅' :
                         module.status === 'in_progress' ? '🔄' : '⏸️';
      md += `| ${module.module} | ${module.totalQueries} | ${module.migrated} | ${module.inProgress} | ${module.remaining} | ${module.percentComplete.toFixed(2)}% | ${statusEmoji} ${module.status} |\n`;
    }

    md += '\n## Progress Bar\n\n';
    const barLength = 50;
    const filledLength = Math.round((progress.percentComplete / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    md += `\`${bar}\` ${progress.percentComplete.toFixed(2)}%\n`;

    return md;
  }

  /**
   * Persist progress to disk
   */
  private persist(): void {
    try {
      const progress = this.getProgress();
      const dir = path.dirname(this.persistPath);

      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.persistPath, JSON.stringify(progress, null, 2));
    } catch (error) {
      console.error('Failed to persist migration progress:', error);
    }
  }

  /**
   * Load persisted progress from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, 'utf-8');
        const progress: MigrationProgress = JSON.parse(data);

        // Restore module progress
        for (const module of progress.moduleProgress) {
          this.moduleProgress.set(module.module, {
            ...module,
            startDate: module.startDate ? new Date(module.startDate) : undefined,
            completedDate: module.completedDate ? new Date(module.completedDate) : undefined
          });
        }
      }
    } catch (error) {
      console.error('Failed to load migration progress:', error);
      // Continue with default initialization
    }
  }

  /**
   * Reset all progress (for testing)
   */
  reset(): void {
    this.initializeModules();
    this.persist();
  }

  /**
   * Get estimated completion date based on current velocity
   */
  getEstimatedCompletion(): {
    estimatedDate: Date | null;
    daysRemaining: number | null;
    queriesPerDay: number;
  } {
    const progress = this.getProgress();

    // Find earliest start date
    let earliestStart: Date | null = null;
    for (const module of progress.moduleProgress) {
      if (module.startDate) {
        if (!earliestStart || module.startDate < earliestStart) {
          earliestStart = module.startDate;
        }
      }
    }

    if (!earliestStart || progress.migrated === 0) {
      return {
        estimatedDate: null,
        daysRemaining: null,
        queriesPerDay: 0
      };
    }

    const now = new Date();
    const daysSinceStart = (now.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24);
    const queriesPerDay = progress.migrated / daysSinceStart;
    const daysRemaining = progress.remaining / queriesPerDay;
    const estimatedDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

    return {
      estimatedDate,
      daysRemaining: Math.ceil(daysRemaining),
      queriesPerDay: Math.round(queriesPerDay)
    };
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();

export default progressTracker;
