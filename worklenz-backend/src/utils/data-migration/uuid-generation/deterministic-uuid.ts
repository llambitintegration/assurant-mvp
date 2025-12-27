/**
 * Deterministic UUID Generation Utilities
 *
 * Provides UUID v5 generation for consistent, reproducible entity IDs across migrations.
 * Based on RFC 4122 - UUID v5 uses SHA-1 hashing with namespace + name.
 *
 * @module deterministic-uuid
 */

import * as crypto from 'crypto';

/**
 * Standard UUID v5 DNS namespace
 * As defined in RFC 4122 Appendix C
 */
export const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Worklenz-specific namespace for entity UUID generation
 * Format: dns:worklenz.com
 */
export const WORKLENZ_NAMESPACE = DNS_NAMESPACE;

/**
 * Generate a deterministic UUID v5 from a namespace and name
 *
 * @param name - The name to hash (e.g., email, project name)
 * @param namespace - UUID v5 namespace (defaults to DNS namespace)
 * @returns UUID v5 string in canonical format (8-4-4-4-12)
 *
 * @example
 * ```typescript
 * const userId = generateUuidV5('user@example.com');
 * // => '74be27de-1e4e-593a-8b4e-7869e4a56af4'
 * ```
 */
export function generateUuidV5(name: string, namespace: string = DNS_NAMESPACE): string {
  const hash = crypto.createHash('sha1');

  // Convert namespace UUID to buffer (remove hyphens)
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');

  // Hash namespace + name
  hash.update(namespaceBytes);
  hash.update(name, 'utf8');

  const digest = hash.digest();

  // Set version (5) and variant bits per RFC 4122
  digest[6] = (digest[6] & 0x0f) | 0x50; // Version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // Variant 10

  // Format as UUID string (8-4-4-4-12)
  return [
    digest.slice(0, 4).toString('hex'),
    digest.slice(4, 6).toString('hex'),
    digest.slice(6, 8).toString('hex'),
    digest.slice(8, 10).toString('hex'),
    digest.slice(10, 16).toString('hex'),
  ].join('-');
}

/**
 * Generate deterministic resource/user ID from email address
 *
 * @param email - User email address
 * @returns UUID v5 for the user
 *
 * @example
 * ```typescript
 * const userId = generateResourceId('john.doe@company.com');
 * ```
 */
export function generateResourceId(email: string): string {
  return generateUuidV5(email, WORKLENZ_NAMESPACE);
}

/**
 * Generate deterministic team ID from team name
 *
 * @param teamName - Team name (e.g., "Assurant P0003C")
 * @returns UUID v5 for the team
 *
 * @example
 * ```typescript
 * const teamId = generateTeamId('Engineering Team');
 * ```
 */
export function generateTeamId(teamName: string): string {
  return generateUuidV5(teamName, WORKLENZ_NAMESPACE);
}

/**
 * Generate deterministic project ID from project name
 *
 * @param projectName - Project name or identifier (e.g., "P0003C")
 * @returns UUID v5 for the project
 *
 * @example
 * ```typescript
 * const projectId = generateProjectId('P0003C');
 * ```
 */
export function generateProjectId(projectName: string): string {
  return generateUuidV5(projectName, WORKLENZ_NAMESPACE);
}

/**
 * Generate deterministic department ID from department name
 *
 * @param departmentName - Department name
 * @returns UUID v5 for the department
 *
 * @example
 * ```typescript
 * const deptId = generateDepartmentId('Engineering');
 * ```
 */
export function generateDepartmentId(departmentName: string): string {
  return generateUuidV5(departmentName, WORKLENZ_NAMESPACE);
}

/**
 * Generate deterministic task ID from task name and project context
 *
 * @param taskName - Task name
 * @param projectName - Project name for uniqueness
 * @returns UUID v5 for the task
 *
 * @example
 * ```typescript
 * const taskId = generateTaskId('Architecture Phase', 'P0003C');
 * ```
 */
export function generateTaskId(taskName: string, projectName: string): string {
  return generateUuidV5(`${projectName}:${taskName}`, WORKLENZ_NAMESPACE);
}

/**
 * Validate UUID format (v4 or v5)
 *
 * @param uuid - UUID string to validate
 * @returns true if valid UUID format
 *
 * @example
 * ```typescript
 * isValidUuid('74be27de-1e4e-593a-8b4e-7869e4a56af4'); // => true
 * isValidUuid('invalid-uuid'); // => false
 * ```
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
