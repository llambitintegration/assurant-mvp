/**
 * TSV Test Fixtures
 *
 * Sample TSV content and row generators for testing TSV parsing functionality.
 * Includes various edge cases and format variations.
 */

// ============================================================================
// BASIC TSV SAMPLES
// ============================================================================

/**
 * Simple 3x3 TSV content (tab-delimited).
 */
export const SIMPLE_TSV_CONTENT = `Name\tEmail\tDepartment
John Doe\tjohn.doe@example.com\tEngineering
Jane Smith\tjane.smith@example.com\tProduct`;

/**
 * Simple 3x3 CSV content (comma-delimited).
 */
export const SIMPLE_CSV_CONTENT = `Name,Email,Department
John Doe,john.doe@example.com,Engineering
Jane Smith,jane.smith@example.com,Product`;

/**
 * TSV with numeric data.
 */
export const NUMERIC_TSV_CONTENT = `Resource\tWeek1\tWeek2\tWeek3
Resource A\t20\t25\t30
Resource B\t40\t35\t32
Resource C\t15\t18\t20`;

/**
 * TSV with mixed data types.
 */
export const MIXED_DATA_TSV_CONTENT = `Name\tAge\tStartDate\tHourlyRate\tActive
Alice\t28\t2025-01-15\t45.50\ttrue
Bob\t35\t2024-06-01\t52.75\tfalse
Charlie\t42\t2023-11-20\t60.00\ttrue`;

// ============================================================================
// EDGE CASE TSV SAMPLES
// ============================================================================

/**
 * Empty TSV content.
 */
export const EMPTY_TSV_CONTENT = '';

/**
 * TSV with only headers (no data rows).
 */
export const HEADERS_ONLY_TSV_CONTENT = `Column1\tColumn2\tColumn3`;

/**
 * TSV with empty lines.
 */
export const TSV_WITH_EMPTY_LINES = `Name\tEmail
John Doe\tjohn@example.com

Jane Smith\tjane@example.com

`;

/**
 * TSV with quoted fields containing delimiters.
 */
export const QUOTED_FIELDS_TSV_CONTENT = `Name\tDescription\tNotes
"Smith, John"\t"Handles A/B testing"\t"Works on team A, team B"
"Doe, Jane"\t"Frontend/Backend dev"\t"Expertise: React, Node"`;

/**
 * TSV with embedded newlines in quoted fields.
 */
export const EMBEDDED_NEWLINES_TSV_CONTENT = `Name\tBio\tEmail
John Doe\t"Software engineer
Loves coding
10 years experience"\tjohn@example.com
Jane Smith\t"Product manager
Background in UX"\tjane@example.com`;

/**
 * TSV with special characters.
 */
export const SPECIAL_CHARS_TSV_CONTENT = `Name\tSymbols\tUnicode
Test User\t!@#$%^&*()\t✓✗✎
Unicode Test\t<>&"'\t你好世界
Emoji Test\t🚀🎉🔥\t😀😃😄`;

/**
 * TSV with Windows line endings (CRLF).
 */
export const WINDOWS_LINE_ENDINGS_TSV_CONTENT = `Name\tEmail\r\nJohn\tjohn@example.com\r\nJane\tjane@example.com\r\n`;

/**
 * TSV with mixed line endings.
 */
export const MIXED_LINE_ENDINGS_TSV_CONTENT = `Name\tEmail\r\nJohn\tjohn@example.com\nJane\tjane@example.com\r\n`;

/**
 * Jagged TSV (rows with different column counts).
 */
export const JAGGED_TSV_CONTENT = `Name\tEmail\tDepartment\tRole
John Doe\tjohn@example.com\tEngineering
Jane Smith\tjane@example.com\tProduct\tManager\tExtra
Bob Jones\tbob@example.com`;

/**
 * TSV with missing values (empty cells).
 */
export const MISSING_VALUES_TSV_CONTENT = `Name\tEmail\tDepartment\tPhone
John Doe\tjohn@example.com\t\t555-1234
Jane Smith\t\tProduct\t
Bob Jones\tbob@example.com\tEngineering\t555-5678`;

/**
 * Very large TSV (100 rows).
 */
export function createLargeTsvContent(rows: number = 100): string {
  const headers = 'ID\tName\tEmail\tDepartment';
  const dataRows = Array.from({ length: rows }, (_, i) => {
    return `${i + 1}\tUser${i + 1}\tuser${i + 1}@example.com\tDept${(i % 5) + 1}`;
  });

  return [headers, ...dataRows].join('\n');
}

// ============================================================================
// RESOURCE ALLOCATION TSV SAMPLES
// ============================================================================

/**
 * P0003C-style resource allocation TSV (simplified).
 */
export const RESOURCE_ALLOCATION_TSV_CONTENT = `First Name\tLast Name\tEmail\tDepartment\t6/17/2025\t6/24/2025\t7/1/2025\t7/8/2025
John\tDoe\tjohn.doe@assurant.com\tEngineering\t20\t25\t30\t20
Jane\tSmith\tjane.smith@assurant.com\tProduct\t40\t40\t35\t40
Bob\tJones\tbob.jones@assurant.com\tQA\t15\t20\t15\t10`;

/**
 * Multi-week allocation TSV (10 weeks).
 */
export function createMultiWeekAllocationTsv(weeks: number = 10): string {
  const startDate = new Date(2025, 0, 1); // Jan 1, 2025
  const weekHeaders = Array.from({ length: weeks }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i * 7);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  const headers = ['First Name', 'Last Name', 'Email', 'Department', ...weekHeaders].join('\t');

  const resources = [
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      department: 'Engineering',
      hours: Array.from({ length: weeks }, () => 20 + Math.floor(Math.random() * 20)),
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      department: 'Product',
      hours: Array.from({ length: weeks }, () => 30 + Math.floor(Math.random() * 10)),
    },
    {
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob.jones@example.com',
      department: 'QA',
      hours: Array.from({ length: weeks }, () => 10 + Math.floor(Math.random() * 15)),
    },
  ];

  const dataRows = resources.map((r) => {
    return [r.firstName, r.lastName, r.email, r.department, ...r.hours.map(String)].join('\t');
  });

  return [headers, ...dataRows].join('\n');
}

// ============================================================================
// PARSED TSV ARRAYS (2D Arrays)
// ============================================================================

/**
 * Simple TSV as 2D array.
 */
export const SIMPLE_TSV_ARRAY: string[][] = [
  ['Name', 'Email', 'Department'],
  ['John Doe', 'john.doe@example.com', 'Engineering'],
  ['Jane Smith', 'jane.smith@example.com', 'Product'],
];

/**
 * Numeric TSV as 2D array.
 */
export const NUMERIC_TSV_ARRAY: string[][] = [
  ['Resource', 'Week1', 'Week2', 'Week3'],
  ['Resource A', '20', '25', '30'],
  ['Resource B', '40', '35', '32'],
  ['Resource C', '15', '18', '20'],
];

/**
 * Empty TSV as 2D array.
 */
export const EMPTY_TSV_ARRAY: string[][] = [];

/**
 * Headers only TSV as 2D array.
 */
export const HEADERS_ONLY_TSV_ARRAY: string[][] = [['Column1', 'Column2', 'Column3']];

/**
 * Jagged TSV as 2D array.
 */
export const JAGGED_TSV_ARRAY: string[][] = [
  ['Name', 'Email', 'Department', 'Role'],
  ['John Doe', 'john@example.com', 'Engineering'], // Missing Role
  ['Jane Smith', 'jane@example.com', 'Product', 'Manager', 'Extra'], // Extra column
  ['Bob Jones', 'bob@example.com'], // Missing Department and Role
];

// ============================================================================
// TSV ROW GENERATORS
// ============================================================================

/**
 * Generate a TSV row from values.
 *
 * @param values - Array of values
 * @param delimiter - Delimiter character (default: tab)
 * @returns TSV row string
 */
export function createTsvRow(values: (string | number | boolean)[], delimiter: string = '\t'): string {
  return values.map(String).join(delimiter);
}

/**
 * Generate multiple TSV rows.
 *
 * @param rows - Array of value arrays
 * @param delimiter - Delimiter character (default: tab)
 * @returns TSV content string
 */
export function createTsvContent(rows: (string | number | boolean)[][], delimiter: string = '\t'): string {
  return rows.map((row) => createTsvRow(row, delimiter)).join('\n');
}

/**
 * Generate resource allocation row.
 *
 * @param resource - Resource data
 * @returns TSV row string
 */
export interface ResourceData {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  weeklyHours: number[];
}

export function createResourceRow(resource: ResourceData): string {
  return createTsvRow([
    resource.firstName,
    resource.lastName,
    resource.email,
    resource.department,
    ...resource.weeklyHours,
  ]);
}
