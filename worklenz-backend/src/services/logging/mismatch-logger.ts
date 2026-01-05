/**
 * Mismatch Logger Service
 *
 * Provides structured logging for data mismatches between SQL and Prisma queries
 * during shadow mode validation. Includes PII redaction, rate limiting, and
 * integration with existing logging framework.
 */

import log from '../../utils/logger';
import { migrationMetrics } from '../metrics/migration-metrics';

const logger = log.logger;

export interface MismatchContext {
  module: string;
  queryName: string;
  sqlResult: any;
  prismaResult: any;
  diff?: any;
  additionalContext?: Record<string, any>;
}

interface RateLimitEntry {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Fields that should be redacted from logs to protect PII
 */
const PII_FIELDS = [
  'email',
  'password',
  'password_hash',
  'hashed_password',
  'phone',
  'phone_number',
  'mobile',
  'ssn',
  'social_security',
  'credit_card',
  'card_number',
  'cvv',
  'api_key',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'reset_token',
  'verification_code',
  'otp',
  'street_address',
  'address_line',
  'postal_code',
  'zip_code',
  'ip_address',
  'user_agent',
  'session_id'
];

/**
 * Mismatch Logger
 */
class MismatchLogger {
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly maxLogsPerWindow = 10; // Max 10 logs per minute per unique mismatch
  private readonly cleanupInterval = 300000; // Cleanup every 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);

    // Don't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Log a mismatch between SQL and Prisma results
   */
  logMismatch(context: MismatchContext): void {
    const { module, queryName, sqlResult, prismaResult, diff, additionalContext } = context;

    // Check rate limit
    const rateLimitKey = `${module}:${queryName}`;
    if (this.isRateLimited(rateLimitKey)) {
      return;
    }

    // Record metric
    migrationMetrics.recordMismatch({ module, queryName, field: 'result' });

    // Redact PII from results
    const redactedSql = this.redactPII(sqlResult);
    const redactedPrisma = this.redactPII(prismaResult);
    const redactedDiff = diff ? this.redactPII(diff) : undefined;

    // Log structured mismatch
    logger.warn('Shadow mode mismatch detected', {
      type: 'shadow_mismatch',
      module,
      queryName,
      sqlResult: redactedSql,
      prismaResult: redactedPrisma,
      diff: redactedDiff,
      ...additionalContext,
      timestamp: new Date().toISOString()
    });

    // Update rate limit
    this.updateRateLimit(rateLimitKey);
  }

  /**
   * Log a field-level mismatch
   */
  logFieldMismatch(
    module: string,
    queryName: string,
    field: string,
    sqlValue: any,
    prismaValue: any,
    additionalContext?: Record<string, any>
  ): void {
    // Check rate limit
    const rateLimitKey = `${module}:${queryName}:${field}`;
    if (this.isRateLimited(rateLimitKey)) {
      return;
    }

    // Record metric
    migrationMetrics.recordMismatch({ module, queryName, field });

    // Redact PII if field is sensitive
    const isSensitive = this.isSensitiveField(field);
    const redactedSqlValue = isSensitive ? '[REDACTED]' : sqlValue;
    const redactedPrismaValue = isSensitive ? '[REDACTED]' : prismaValue;

    // Log structured field mismatch
    logger.warn('Shadow mode field mismatch', {
      type: 'shadow_field_mismatch',
      module,
      queryName,
      field,
      sqlValue: redactedSqlValue,
      prismaValue: redactedPrismaValue,
      ...additionalContext,
      timestamp: new Date().toISOString()
    });

    // Update rate limit
    this.updateRateLimit(rateLimitKey);
  }

  /**
   * Log a successful shadow mode comparison
   */
  logSuccess(module: string, queryName: string, additionalContext?: Record<string, any>): void {
    logger.debug('Shadow mode comparison successful', {
      type: 'shadow_success',
      module,
      queryName,
      ...additionalContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log an error during shadow mode comparison
   */
  logError(
    module: string,
    queryName: string,
    source: 'sql' | 'prisma',
    error: Error,
    additionalContext?: Record<string, any>
  ): void {
    logger.error('Shadow mode comparison error', {
      type: 'shadow_error',
      module,
      queryName,
      source,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...additionalContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Redact PII from an object
   */
  private redactPII(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactPII(item));
    }

    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactPII(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Check if a field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return PII_FIELDS.some(piiField => lowerField.includes(piiField));
  }

  /**
   * Check if a mismatch key is rate limited
   */
  private isRateLimited(key: string): boolean {
    const entry = this.rateLimitMap.get(key);
    if (!entry) {
      return false;
    }

    const now = new Date();
    const timeSinceFirst = now.getTime() - entry.firstSeen.getTime();

    // Reset if outside window
    if (timeSinceFirst > this.rateLimitWindow) {
      this.rateLimitMap.delete(key);
      return false;
    }

    // Check if over limit
    return entry.count >= this.maxLogsPerWindow;
  }

  /**
   * Update rate limit for a key
   */
  private updateRateLimit(key: string): void {
    const entry = this.rateLimitMap.get(key);
    const now = new Date();

    if (!entry) {
      this.rateLimitMap.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now
      });
      return;
    }

    const timeSinceFirst = now.getTime() - entry.firstSeen.getTime();

    // Reset if outside window
    if (timeSinceFirst > this.rateLimitWindow) {
      this.rateLimitMap.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now
      });
    } else {
      entry.count++;
      entry.lastSeen = now;
    }
  }

  /**
   * Cleanup old rate limit entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.rateLimitMap.entries()) {
      const timeSinceLast = now.getTime() - entry.lastSeen.getTime();
      if (timeSinceLast > this.rateLimitWindow * 2) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.rateLimitMap.delete(key);
    }
  }

  /**
   * Stop the cleanup timer (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Get rate limit stats (for monitoring)
   */
  getRateLimitStats(): {
    activeKeys: number;
    totalSuppressed: number;
  } {
    let totalSuppressed = 0;
    for (const entry of this.rateLimitMap.values()) {
      if (entry.count > this.maxLogsPerWindow) {
        totalSuppressed += entry.count - this.maxLogsPerWindow;
      }
    }

    return {
      activeKeys: this.rateLimitMap.size,
      totalSuppressed
    };
  }
}

// Singleton instance
export const mismatchLogger = new MismatchLogger();

// Convenience functions
export function logMismatch(context: MismatchContext): void {
  mismatchLogger.logMismatch(context);
}

export function logFieldMismatch(
  module: string,
  queryName: string,
  field: string,
  sqlValue: any,
  prismaValue: any,
  additionalContext?: Record<string, any>
): void {
  mismatchLogger.logFieldMismatch(module, queryName, field, sqlValue, prismaValue, additionalContext);
}

export function logSuccess(module: string, queryName: string, additionalContext?: Record<string, any>): void {
  mismatchLogger.logSuccess(module, queryName, additionalContext);
}

export function logError(
  module: string,
  queryName: string,
  source: 'sql' | 'prisma',
  error: Error,
  additionalContext?: Record<string, any>
): void {
  mismatchLogger.logError(module, queryName, source, error, additionalContext);
}

export default mismatchLogger;
