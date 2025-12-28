/**
 * CSV Import Test Fixtures
 * Provides mock CSV data and import results for testing
 */

/**
 * Create mock CSV row data
 */
export function createMockCSVRow(overrides: any = {}): any {
  return {
    name: 'Resistor 10K Ohm',
    sku: 'RES-10K-001',
    description: '10K Ohm 1/4W 5% resistor',
    quantity: '1000',
    unit_price: '0.05',
    reorder_level: '200',
    owner_type: 'supplier',
    owner_identifier: 'SUP-001', // Could be supplier code or location code
    notes: 'Standard component',
    ...overrides,
  };
}

/**
 * Create a list of valid CSV rows
 */
export function createValidCSVRows(): any[] {
  return [
    createMockCSVRow({
      name: 'Resistor 10K Ohm',
      sku: 'RES-10K-001',
      quantity: '1000',
      unit_price: '0.05',
      reorder_level: '200',
      owner_type: 'supplier',
      owner_identifier: 'ACME-001',
    }),
    createMockCSVRow({
      name: 'Capacitor 100uF',
      sku: 'CAP-100UF-001',
      quantity: '500',
      unit_price: '0.15',
      reorder_level: '100',
      owner_type: 'storage_location',
      owner_identifier: 'WH-A-01',
    }),
    createMockCSVRow({
      name: 'LED Red 5mm',
      sku: 'LED-RED-5MM-001',
      quantity: '2000',
      unit_price: '0.10',
      reorder_level: '500',
      owner_type: 'supplier',
      owner_identifier: 'TECH-002',
    }),
  ];
}

/**
 * Create CSV rows with validation errors
 */
export function createInvalidCSVRows(): any[] {
  return [
    // Missing required field (name)
    createMockCSVRow({
      name: '',
      sku: 'INVALID-001',
    }),
    // Missing required field (sku)
    createMockCSVRow({
      name: 'Invalid Component',
      sku: '',
    }),
    // Invalid quantity (non-numeric)
    createMockCSVRow({
      name: 'Bad Quantity Component',
      sku: 'BAD-QTY-001',
      quantity: 'abc',
    }),
    // Invalid unit_price (negative)
    createMockCSVRow({
      name: 'Negative Price Component',
      sku: 'NEG-PRICE-001',
      unit_price: '-5.00',
    }),
    // Invalid owner_type
    createMockCSVRow({
      name: 'Bad Owner Type',
      sku: 'BAD-OWNER-001',
      owner_type: 'invalid_type',
    }),
    // Missing owner_identifier
    createMockCSVRow({
      name: 'Missing Owner',
      sku: 'NO-OWNER-001',
      owner_type: 'supplier',
      owner_identifier: '',
    }),
  ];
}

/**
 * Create CSV rows with mixed valid and invalid data
 */
export function createMixedCSVRows(): any[] {
  return [
    ...createValidCSVRows().slice(0, 2),
    ...createInvalidCSVRows().slice(0, 2),
    ...createValidCSVRows().slice(2),
  ];
}

/**
 * Create mock CSV import result
 */
export function createMockCSVImportResult(overrides: any = {}): any {
  return {
    total_rows: 10,
    imported_count: 8,
    error_count: 2,
    errors: [
      {
        row: 3,
        data: createInvalidCSVRows()[0],
        error: 'Name is required',
      },
      {
        row: 7,
        data: createInvalidCSVRows()[1],
        error: 'SKU is required',
      },
    ],
    ...overrides,
  };
}

/**
 * Create successful import result (no errors)
 */
export function createSuccessfulImportResult(totalRows: number = 10): any {
  return {
    total_rows: totalRows,
    imported_count: totalRows,
    error_count: 0,
    errors: [],
  };
}

/**
 * Create failed import result (all errors)
 */
export function createFailedImportResult(totalRows: number = 10): any {
  const errors = Array.from({ length: totalRows }, (_, i) => ({
    row: i + 1,
    data: createInvalidCSVRows()[i % createInvalidCSVRows().length],
    error: `Validation error on row ${i + 1}`,
  }));

  return {
    total_rows: totalRows,
    imported_count: 0,
    error_count: totalRows,
    errors,
  };
}

/**
 * Create partial import result (some successes, some errors)
 */
export function createPartialImportResult(overrides: any = {}): any {
  return {
    total_rows: 20,
    imported_count: 15,
    error_count: 5,
    errors: [
      {
        row: 5,
        data: createInvalidCSVRows()[0],
        error: 'Missing required field: name',
      },
      {
        row: 8,
        data: createInvalidCSVRows()[1],
        error: 'Missing required field: sku',
      },
      {
        row: 12,
        data: createInvalidCSVRows()[2],
        error: 'Invalid quantity: must be a number',
      },
      {
        row: 15,
        data: createInvalidCSVRows()[3],
        error: 'Invalid unit_price: must be positive',
      },
      {
        row: 18,
        data: createInvalidCSVRows()[4],
        error: 'Invalid owner_type: must be supplier or storage_location',
      },
    ],
    ...overrides,
  };
}

/**
 * Create CSV row with minimal data (only required fields)
 */
export function createMinimalCSVRow(overrides: any = {}): any {
  return {
    name: 'Minimal Component',
    sku: 'MIN-001',
    description: '',
    quantity: '10',
    unit_price: '1.00',
    reorder_level: '5',
    owner_type: 'supplier',
    owner_identifier: 'SUP-001',
    notes: '',
    ...overrides,
  };
}

/**
 * Create CSV row with complete data (all fields populated)
 */
export function createCompleteCSVRow(overrides: any = {}): any {
  return createMockCSVRow({
    name: 'Arduino Uno R3',
    sku: 'ARD-UNO-R3-001',
    description: 'Arduino Uno R3 microcontroller board with ATmega328P',
    quantity: '75',
    unit_price: '22.50',
    reorder_level: '25',
    owner_type: 'supplier',
    owner_identifier: 'ARDUINO-STORE',
    notes: 'Popular board for beginners',
    ...overrides,
  });
}

/**
 * Create CSV rows with duplicate SKUs
 */
export function createDuplicateSKURows(): any[] {
  return [
    createMockCSVRow({
      name: 'Component A',
      sku: 'DUP-SKU-001',
    }),
    createMockCSVRow({
      name: 'Component B',
      sku: 'DUP-SKU-001', // Duplicate SKU
    }),
  ];
}

/**
 * Create CSV rows for bulk import test
 */
export function createBulkCSVRows(count: number): any[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockCSVRow({
      name: `Bulk Component ${i + 1}`,
      sku: `BULK-${String(i + 1).padStart(5, '0')}`,
      quantity: String((i + 1) * 100),
      unit_price: String((0.5 + i * 0.1).toFixed(2)),
      reorder_level: String((i + 1) * 20),
      owner_type: i % 2 === 0 ? 'supplier' : 'storage_location',
      owner_identifier: i % 2 === 0 ? `SUP-${String((i % 5) + 1).padStart(3, '0')}` : `LOC-${String((i % 3) + 1).padStart(3, '0')}`,
    });
  });
}

/**
 * Create mock CSV import error
 */
export function createMockCSVImportError(overrides: any = {}): any {
  return {
    row: 5,
    data: createInvalidCSVRows()[0],
    error: 'Validation failed: Name is required',
    ...overrides,
  };
}

/**
 * Create import errors for different validation failures
 */
export function createVariousImportErrors(): any[] {
  return [
    createMockCSVImportError({
      row: 2,
      error: 'Missing required field: name',
    }),
    createMockCSVImportError({
      row: 5,
      error: 'Missing required field: sku',
    }),
    createMockCSVImportError({
      row: 8,
      error: 'Invalid quantity: must be a positive number',
    }),
    createMockCSVImportError({
      row: 12,
      error: 'Invalid unit_price: must be a positive number',
    }),
    createMockCSVImportError({
      row: 15,
      error: 'Invalid owner_type: must be "supplier" or "storage_location"',
    }),
    createMockCSVImportError({
      row: 18,
      error: 'Owner not found: SUP-999',
    }),
    createMockCSVImportError({
      row: 22,
      error: 'Duplicate SKU: SKU-001 already exists',
    }),
  ];
}

/**
 * Create CSV content as string (for file upload testing)
 */
export function createCSVFileContent(rows: any[]): string {
  const headers = [
    'name',
    'sku',
    'description',
    'quantity',
    'unit_price',
    'reorder_level',
    'owner_type',
    'owner_identifier',
    'notes',
  ];

  const csvLines = [headers.join(',')];

  rows.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header] || '';
      // Escape values with commas or quotes
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}

/**
 * Create large CSV file content for performance testing
 */
export function createLargeCSVFileContent(rowCount: number = 1000): string {
  const rows = createBulkCSVRows(rowCount);
  return createCSVFileContent(rows);
}

/**
 * Create CSV rows with special characters (testing data sanitization)
 */
export function createCSVRowsWithSpecialCharacters(): any[] {
  return [
    createMockCSVRow({
      name: 'Component with "quotes"',
      sku: 'QUOTE-001',
      description: 'Description with, commas, and "quotes"',
    }),
    createMockCSVRow({
      name: "Component with 'apostrophes'",
      sku: 'APOS-001',
      description: "It's a component with apostrophes",
    }),
    createMockCSVRow({
      name: 'Component with newline',
      sku: 'NEWLINE-001',
      description: 'Line 1\nLine 2',
    }),
  ];
}

/**
 * Create import result with owner lookup errors
 */
export function createOwnerLookupErrorResult(): any {
  return {
    total_rows: 5,
    imported_count: 2,
    error_count: 3,
    errors: [
      {
        row: 2,
        data: createMockCSVRow({ owner_identifier: 'NON-EXISTENT-SUP' }),
        error: 'Supplier not found: NON-EXISTENT-SUP',
      },
      {
        row: 3,
        data: createMockCSVRow({ owner_type: 'storage_location', owner_identifier: 'NON-EXISTENT-LOC' }),
        error: 'Storage location not found: NON-EXISTENT-LOC',
      },
      {
        row: 5,
        data: createMockCSVRow({ owner_identifier: 'INACTIVE-SUP' }),
        error: 'Supplier is inactive: INACTIVE-SUP',
      },
    ],
  };
}
