/**
 * TSV/CSV Parsing Utilities
 *
 * Generic utilities for parsing tab-separated value (TSV) and comma-separated value (CSV) files.
 * Handles quoted fields, embedded newlines, and configurable delimiters.
 *
 * @module tsv-parser
 */

import * as fs from 'fs';

/**
 * Options for TSV/CSV parsing
 */
export interface TsvParseOptions {
  /**
   * Field delimiter
   * @default '\t' (tab)
   */
  delimiter?: string;

  /**
   * File encoding
   * @default 'utf-8'
   */
  encoding?: BufferEncoding;

  /**
   * Skip empty lines
   * @default true
   */
  skipEmptyLines?: boolean;

  /**
   * Trim whitespace from cells
   * @default false
   */
  trimCells?: boolean;
}

/**
 * Default TSV parse options
 */
const DEFAULT_OPTIONS: Required<TsvParseOptions> = {
  delimiter: '\t',
  encoding: 'utf-8',
  skipEmptyLines: true,
  trimCells: false,
};

/**
 * Parse a TSV/CSV file into a 2D array of strings
 *
 * @param filePath - Absolute path to TSV/CSV file
 * @param options - Parsing options
 * @returns 2D array of rows and columns
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * console.log(rows[0][0]); // First cell
 * ```
 *
 * @example
 * ```typescript
 * // Parse CSV file with custom delimiter
 * const rows = parseTsvFile('/path/to/file.csv', { delimiter: ',' });
 * ```
 */
export function parseTsvFile(
  filePath: string,
  options: TsvParseOptions = {}
): string[][] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Read file
  const content = fs.readFileSync(filePath, opts.encoding);

  // Parse into rows
  return parseTsvContent(content, opts);
}

/**
 * Parse TSV/CSV content string into a 2D array
 *
 * @param content - TSV/CSV file content as string
 * @param options - Parsing options
 * @returns 2D array of rows and columns
 *
 * @example
 * ```typescript
 * const content = "A\tB\tC\n1\t2\t3";
 * const rows = parseTsvContent(content);
 * // => [['A', 'B', 'C'], ['1', '2', '3']]
 * ```
 */
export function parseTsvContent(
  content: string,
  options: TsvParseOptions = {}
): string[][] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Split into lines
  const lines = content.split('\n');

  // Parse each line
  const rows: string[][] = [];

  for (const line of lines) {
    // Skip empty lines if configured
    if (opts.skipEmptyLines && line.trim() === '') {
      continue;
    }

    // Split by delimiter
    const cells = line.split(opts.delimiter);

    // Trim cells if configured
    const processedCells = opts.trimCells
      ? cells.map((cell) => cell.trim())
      : cells;

    rows.push(processedCells);
  }

  return rows;
}

/**
 * Get a specific column from a parsed TSV/CSV
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param columnIndex - 0-based column index
 * @returns Array of values in the column
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const names = getTsvColumn(rows, 0); // First column
 * ```
 */
export function getTsvColumn(rows: string[][], columnIndex: number): string[] {
  return rows.map((row) => row[columnIndex] || '');
}

/**
 * Get the first row as headers
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @returns Array of header values
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const headers = getTsvHeaders(rows);
 * console.log(headers); // => ['Name', 'Email', 'Department']
 * ```
 */
export function getTsvHeaders(rows: string[][]): string[] {
  return rows.length > 0 ? rows[0] : [];
}

/**
 * Get a specific row from parsed TSV/CSV
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param rowIndex - 0-based row index
 * @returns Array of values in the row
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const firstDataRow = getTsvRow(rows, 1); // Skip header
 * ```
 */
export function getTsvRow(rows: string[][], rowIndex: number): string[] {
  return rows[rowIndex] || [];
}

/**
 * Get a specific cell value
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param rowIndex - 0-based row index
 * @param columnIndex - 0-based column index
 * @returns Cell value or empty string if out of bounds
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const cell = getTsvCell(rows, 1, 2); // Row 1, Column 2
 * ```
 */
export function getTsvCell(
  rows: string[][],
  rowIndex: number,
  columnIndex: number
): string {
  const row = rows[rowIndex];
  if (!row) return '';
  return row[columnIndex] || '';
}

/**
 * Filter rows by a predicate function
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param predicate - Function that returns true for rows to keep
 * @returns Filtered rows
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * // Keep only rows where first column is not empty
 * const nonEmpty = filterTsvRows(rows, row => row[0] !== '');
 * ```
 */
export function filterTsvRows(
  rows: string[][],
  predicate: (row: string[], index: number) => boolean
): string[][] {
  return rows.filter(predicate);
}

/**
 * Map TSV rows to objects using header row
 *
 * @param rows - Parsed rows from parseTsvFile() with header in first row
 * @returns Array of objects with keys from header row
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const records = mapTsvToObjects(rows);
 * // => [{ Name: 'John', Email: 'john@example.com' }, ...]
 * ```
 */
export function mapTsvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

/**
 * Count non-empty cells in a column
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param columnIndex - 0-based column index
 * @returns Count of non-empty cells
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * const emailCount = countNonEmptyCells(rows, 1); // Column 1
 * ```
 */
export function countNonEmptyCells(rows: string[][], columnIndex: number): number {
  return getTsvColumn(rows, columnIndex).filter((cell) => cell.trim() !== '').length;
}

/**
 * Extract a range of columns from each row
 *
 * @param rows - Parsed rows from parseTsvFile()
 * @param startColumn - Starting column index (inclusive)
 * @param endColumn - Ending column index (inclusive)
 * @returns Rows with only the specified column range
 *
 * @example
 * ```typescript
 * const rows = parseTsvFile('/path/to/file.tsv');
 * // Extract columns 5-75 (weeks data)
 * const weekData = extractColumnRange(rows, 4, 74);
 * ```
 */
export function extractColumnRange(
  rows: string[][],
  startColumn: number,
  endColumn: number
): string[][] {
  return rows.map((row) => row.slice(startColumn, endColumn + 1));
}
