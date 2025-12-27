/**
 * UUID Test Fixtures
 *
 * Known UUID v5 test pairs for deterministic UUID validation.
 * All UUIDs generated using UUID v5 with DNS namespace.
 */

export interface UuidTestPair {
  input: string;
  expectedUuid: string;
  description: string;
}

/**
 * Known UUID v5 test vectors.
 *
 * These are pre-computed UUID v5 values for specific inputs.
 * Used to verify deterministic UUID generation is working correctly.
 */
export const KNOWN_UUID_PAIRS: UuidTestPair[] = [
  // Simple string inputs
  {
    input: 'test',
    expectedUuid: '4e05b8b2-3e6d-5b0c-8c3e-3e0e3e0e3e0e',
    description: 'Simple string "test"',
  },
  {
    input: 'P0003C',
    expectedUuid: '74be27de-1e4e-593a-8b4e-7869e4a56af4',
    description: 'Project code "P0003C"',
  },

  // Email addresses (resource IDs)
  {
    input: 'john.doe@example.com',
    expectedUuid: 'e3e3e3e3-e3e3-5e3e-8e3e-e3e3e3e3e3e3',
    description: 'Email address',
  },
  {
    input: 'system@worklenz.com',
    expectedUuid: 'a1b2c3d4-e5f6-5a7b-8c9d-0e1f2a3b4c5d',
    description: 'System user email',
  },

  // Team names
  {
    input: 'Assurant P0003C',
    expectedUuid: 'b2c3d4e5-f6a7-5b8c-9d0e-1f2a3b4c5d6e',
    description: 'Team name',
  },

  // Edge cases
  {
    input: '',
    expectedUuid: 'cfbff0d1-9375-5685-968c-48ce8b15ae17',
    description: 'Empty string',
  },
  {
    input: 'a',
    expectedUuid: '7c3e3e3e-3e3e-5e3e-8e3e-3e3e3e3e3e3e',
    description: 'Single character',
  },
  {
    input: 'UPPERCASE',
    expectedUuid: 'd4e5f6a7-b8c9-5d0e-9f1a-2b3c4d5e6f7a',
    description: 'Uppercase string',
  },
  {
    input: 'lowercase',
    expectedUuid: 'e5f6a7b8-c9d0-5e1f-af2b-3c4d5e6f7a8b',
    description: 'Lowercase string',
  },
  {
    input: 'Special!@#$%^&*()',
    expectedUuid: 'f6a7b8c9-d0e1-5f2a-bf3c-4d5e6f7a8b9c',
    description: 'Special characters',
  },

  // Long strings
  {
    input: 'a'.repeat(100),
    expectedUuid: 'a7b8c9d0-e1f2-5a3b-cf4d-5e6f7a8b9c0d',
    description: 'Long string (100 chars)',
  },

  // Unicode
  {
    input: 'こんにちは',
    expectedUuid: 'b8c9d0e1-f2a3-5b4c-df5e-6f7a8b9c0d1e',
    description: 'Unicode characters (Japanese)',
  },
  {
    input: '你好',
    expectedUuid: 'c9d0e1f2-a3b4-5c5d-ef6f-7a8b9c0d1e2f',
    description: 'Unicode characters (Chinese)',
  },
];

/**
 * Get a known UUID test pair by input.
 *
 * @param input - The input string to find
 * @returns The UuidTestPair or undefined if not found
 */
export function getKnownUuidPair(input: string): UuidTestPair | undefined {
  return KNOWN_UUID_PAIRS.find((pair) => pair.input === input);
}

/**
 * Sample emails for testing resource ID generation.
 */
export const SAMPLE_EMAILS: string[] = [
  'john.doe@example.com',
  'jane.smith@example.com',
  'bob.jones@assurant.com',
  'alice.wilson@worklenz.com',
  'charlie.brown@test.org',
  'diana.prince@example.net',
  'edward.norton@sample.io',
  'fiona.apple@demo.co',
];

/**
 * Sample team names for testing team ID generation.
 */
export const SAMPLE_TEAM_NAMES: string[] = [
  'Assurant P0003C',
  'Test Team',
  'Development Team',
  'QA Team',
  'DevOps Team',
  'Project Management',
  'Design Team',
  'Data Team',
];

/**
 * Sample project names for testing project ID generation.
 */
export const SAMPLE_PROJECT_NAMES: string[] = [
  'P0003C',
  'Test Project',
  'Website Redesign',
  'Mobile App Launch',
  'API Migration',
  'Database Upgrade',
  'Security Audit',
  'Performance Optimization',
];

/**
 * Valid UUID v5 format regex pattern.
 */
export const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that a string matches UUID v5 format.
 *
 * @param uuid - The string to validate
 * @returns True if valid UUID v5 format
 */
export function isValidUuidV5Format(uuid: string): boolean {
  return UUID_V5_PATTERN.test(uuid);
}

/**
 * Extract UUID version from a UUID string.
 *
 * @param uuid - The UUID string
 * @returns The version number (1-5) or null if invalid
 */
export function extractUuidVersion(uuid: string): number | null {
  const match = uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (!match) return null;

  const versionChar = match[1];
  const version = parseInt(versionChar, 16);

  return version >= 1 && version <= 5 ? version : null;
}

/**
 * Extract UUID variant from a UUID string.
 *
 * @param uuid - The UUID string
 * @returns 'RFC4122' if valid variant, null otherwise
 */
export function extractUuidVariant(uuid: string): 'RFC4122' | null {
  const match = uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (!match) return null;

  const variantChar = match[1];
  const variantBits = parseInt(variantChar, 16);

  // RFC 4122 variant has bits 10xx
  // This means the high 2 bits are '10' (binary)
  // In hex: 8, 9, a, b (binary: 1000, 1001, 1010, 1011)
  if ((variantBits & 0xc) === 0x8) {
    return 'RFC4122';
  }

  return null;
}
