/**
 * Migration Test Fixtures
 *
 * Factory functions for generating synthetic test data for migration workflows.
 * Provides builders for TSV data, JSON outputs, and expected results.
 */

import { AllocationPeriod } from '../../../utils/data-migration/extractors/allocation-calculator';
import { generateResourceId, generateTeamId, generateProjectId } from '../../../utils/data-migration/uuid-generation/deterministic-uuid';
import { formatIsoDate } from '../../../utils/data-migration/extractors/date-utils';

// ============================================================================
// SYNTHETIC TSV DATA GENERATORS
// ============================================================================

export interface SyntheticTsvDataParams {
  resourceCount: number;
  weekCount: number;
  avgHoursPerWeek: number;
  variance?: number; // Hour variance (default: 5)
  includeHeaders?: boolean; // Include header row (default: true)
}

/**
 * Generate synthetic TSV data for testing.
 *
 * Creates realistic resource allocation data with randomized hours.
 *
 * @param params - Configuration for synthetic data generation
 * @returns TSV-formatted string with resource allocation data
 *
 * @example
 * ```typescript
 * const tsv = createSyntheticTsvData({
 *   resourceCount: 5,
 *   weekCount: 10,
 *   avgHoursPerWeek: 20
 * });
 * // Returns TSV with 5 resources, 10 weeks, ~20 hours/week
 * ```
 */
export function createSyntheticTsvData(params: SyntheticTsvDataParams): string {
  const {
    resourceCount,
    weekCount,
    avgHoursPerWeek,
    variance = 5,
    includeHeaders = true,
  } = params;

  const rows: string[] = [];

  // Generate headers
  if (includeHeaders) {
    const weekHeaders = Array.from({ length: weekCount }, (_, i) => {
      const date = new Date(2025, 0, 1 + i * 7); // Start Jan 1, 2025
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    });

    rows.push(['First Name', 'Last Name', 'Email', 'Department', ...weekHeaders].join('\t'));
  }

  // Generate resource rows
  for (let i = 0; i < resourceCount; i++) {
    const firstName = `Test${i + 1}`;
    const lastName = `User${i + 1}`;
    const email = `test.user${i + 1}@example.com`;
    const department = `Department ${(i % 3) + 1}`;

    // Generate weekly hours with variance
    const weeklyHours = Array.from({ length: weekCount }, () => {
      const randomVariance = (Math.random() - 0.5) * 2 * variance;
      return Math.max(0, Math.round(avgHoursPerWeek + randomVariance));
    });

    rows.push([firstName, lastName, email, department, ...weeklyHours.map(String)].join('\t'));
  }

  return rows.join('\n');
}

/**
 * Generate synthetic TSV content as 2D array (parsed format).
 *
 * @param params - Configuration for synthetic data generation
 * @returns 2D array of TSV data (same format as parseTsvFile output)
 */
export function createSyntheticTsvArray(params: SyntheticTsvDataParams): string[][] {
  const tsvString = createSyntheticTsvData(params);
  return tsvString.split('\n').map((line) => line.split('\t'));
}

// ============================================================================
// MOCK JSON OUTPUT GENERATORS
// ============================================================================

export type JsonOutputType = 'resources' | 'allocations' | 'tasks' | 'departments';

/**
 * Create mock JSON output for testing.
 *
 * Generates sample JSON output matching the format produced by migration scripts.
 *
 * @param type - Type of output to generate
 * @param count - Number of records to generate (default: 3)
 * @returns Mock JSON output object
 *
 * @example
 * ```typescript
 * const resources = createMockJsonOutput('resources', 5);
 * // Returns { resources: [...5 resources...], _metadata: {...} }
 * ```
 */
export function createMockJsonOutput(type: JsonOutputType, count: number = 3): any {
  switch (type) {
    case 'resources':
      return {
        resources: Array.from({ length: count }, (_, i) => ({
          id: generateResourceId(`test.user${i + 1}@example.com`),
          firstName: `Test${i + 1}`,
          lastName: `User${i + 1}`,
          email: `test.user${i + 1}@example.com`,
          employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
        })),
        _metadata: {
          totalResources: count,
          generatedAt: new Date().toISOString(),
        },
      };

    case 'allocations':
      const resourceId = generateResourceId('test.user1@example.com');
      const projectId = generateProjectId('Test Project');
      return {
        allocations: Array.from({ length: count }, (_, i) => ({
          id: `alloc-${i + 1}`,
          resourceId,
          projectId,
          startDate: formatIsoDate(new Date(2025, 0, 1 + i * 7)),
          endDate: formatIsoDate(new Date(2025, 0, 7 + i * 7)),
          percentAllocation: 50,
          hoursPerWeek: 20,
          notes: '20 hours/week',
        })),
        _metadata: {
          totalAllocations: count,
          totalHours: count * 20,
          generatedAt: new Date().toISOString(),
        },
      };

    case 'departments':
      return {
        departments: Array.from({ length: count }, (_, i) => ({
          id: `dept-${i + 1}`,
          name: `Department ${i + 1}`,
          description: `Test department ${i + 1}`,
        })),
        _metadata: {
          totalDepartments: count,
          generatedAt: new Date().toISOString(),
        },
      };

    case 'tasks':
      return {
        tasks: Array.from({ length: count }, (_, i) => ({
          id: `task-${i + 1}`,
          name: `Task ${i + 1}`,
          description: `Test task ${i + 1}`,
          projectId: generateProjectId('Test Project'),
        })),
        _metadata: {
          totalTasks: count,
          generatedAt: new Date().toISOString(),
        },
      };

    default:
      throw new Error(`Unknown output type: ${type}`);
  }
}

// ============================================================================
// EXPECTED RESULT BUILDERS
// ============================================================================

export interface ExpectedAllocationInput {
  email: string;
  projectName: string;
  weeklyHours: number[];
  startDate?: Date; // Default: Jan 1, 2025
}

/**
 * Build expected allocation results for validation.
 *
 * Creates AllocationPeriod objects from weekly hours data.
 * Does NOT merge consecutive periods - returns raw weekly allocations.
 *
 * @param input - Input parameters with weekly hours
 * @returns Array of AllocationPeriod objects
 *
 * @example
 * ```typescript
 * const expected = createExpectedAllocationResult({
 *   email: 'test@example.com',
 *   projectName: 'P0003C',
 *   weeklyHours: [20, 20, 40, 40, 0]
 * });
 * // Returns 4 AllocationPeriod objects (skips week with 0 hours)
 * ```
 */
export function createExpectedAllocationResult(
  input: ExpectedAllocationInput
): AllocationPeriod[] {
  const { email, projectName, weeklyHours, startDate = new Date(2025, 0, 1) } = input;

  const resourceId = generateResourceId(email);
  const projectId = generateProjectId(projectName);

  const allocations: AllocationPeriod[] = [];

  weeklyHours.forEach((hours, weekIndex) => {
    if (hours === 0) return; // Skip weeks with no hours

    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(startDate.getDate() + weekIndex * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    allocations.push({
      resourceId,
      projectId,
      startDate: formatIsoDate(weekStartDate),
      endDate: formatIsoDate(weekEndDate),
      percentAllocation: Math.round((hours / 40) * 100 * 100) / 100,
      hoursPerWeek: hours,
      notes: `${hours} hours/week`,
    });
  });

  return allocations;
}

// ============================================================================
// DEPARTMENT MAPPING FIXTURES
// ============================================================================

/**
 * Create sample department mapping for testing.
 *
 * Maps TSV department names to canonical department names.
 *
 * @returns Record of TSV name → Canonical name
 *
 * @example
 * ```typescript
 * const mapping = createDepartmentMapping();
 * // Returns { "Project Mgmt/Admin": "Project Management & Administration", ... }
 * ```
 */
export function createDepartmentMapping(): Record<string, string> {
  return {
    'Project Mgmt/Admin': 'Project Management & Administration',
    'Buyer Quoting': 'Buyer - Quoting',
    'Buyer Purchasing': 'Buyer - Purchasing',
    'Project Manager': 'Project Management',
    'QA Testing': 'Quality Assurance - Testing',
    'QA Automation': 'Quality Assurance - Automation',
    'Dev Frontend': 'Development - Frontend',
    'Dev Backend': 'Development - Backend',
    'DevOps/Infra': 'DevOps & Infrastructure',
  };
}

// ============================================================================
// FOUNDATION DATA FIXTURES
// ============================================================================

export interface FoundationFixture {
  systemUserId: string;
  teamId: string;
  projectId: string;
  teamName: string;
  projectName: string;
}

/**
 * Create foundation data fixture for testing.
 *
 * Generates consistent system user, team, and project IDs.
 *
 * @param teamName - Team name (default: "Test Team")
 * @param projectName - Project name (default: "Test Project")
 * @returns Foundation data with deterministic IDs
 *
 * @example
 * ```typescript
 * const foundation = createFoundationFixture('Acme Corp', 'Project XYZ');
 * // Returns { systemUserId: '...', teamId: '...', projectId: '...', ... }
 * ```
 */
export function createFoundationFixture(
  teamName: string = 'Test Team',
  projectName: string = 'Test Project'
): FoundationFixture {
  return {
    systemUserId: generateResourceId('system@worklenz.com'),
    teamId: generateTeamId(teamName),
    projectId: generateProjectId(projectName),
    teamName,
    projectName,
  };
}
