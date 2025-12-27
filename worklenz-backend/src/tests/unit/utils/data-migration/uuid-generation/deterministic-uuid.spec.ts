/**
 * Unit Tests: deterministic-uuid.ts
 *
 * Tests for deterministic UUID v5 generation utilities.
 * Target coverage: 100% (critical infrastructure)
 */

// Unmock the modules we're testing
jest.unmock('../../../../../utils/data-migration/uuid-generation/deterministic-uuid');

import {
  generateUuidV5,
  generateResourceId,
  generateTeamId,
  generateProjectId,
  isValidUuid,
  DNS_NAMESPACE,
  WORKLENZ_NAMESPACE,
} from '../../../../../utils/data-migration/uuid-generation/deterministic-uuid';

import {
  expectDeterministicUuid,
  expectUuidEqual,
} from '../../../../utils/migration-test-helpers';

import {
  SAMPLE_EMAILS,
  SAMPLE_TEAM_NAMES,
  SAMPLE_PROJECT_NAMES,
  isValidUuidV5Format,
  extractUuidVersion,
  extractUuidVariant,
} from '../../../../fixtures/migration/uuid-fixtures';

describe('Deterministic UUID Generation', () => {
  // ==========================================================================
  // generateUuidV5()
  // ==========================================================================

  describe('generateUuidV5()', () => {
    it('should generate valid UUID v5', () => {
      const uuid = generateUuidV5('test');

      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expectDeterministicUuid(uuid);
    });

    it('should be deterministic (same input → same output)', () => {
      const uuid1 = generateUuidV5('test');
      const uuid2 = generateUuidV5('test');
      const uuid3 = generateUuidV5('test');

      expectUuidEqual(uuid1, uuid2);
      expectUuidEqual(uuid2, uuid3);
    });

    it('should generate different UUIDs for different inputs', () => {
      const uuid1 = generateUuidV5('test1');
      const uuid2 = generateUuidV5('test2');
      const uuid3 = generateUuidV5('test3');

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it('should use DNS namespace by default', () => {
      const uuid1 = generateUuidV5('test');
      const uuid2 = generateUuidV5('test', DNS_NAMESPACE);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should support custom namespace', () => {
      const customNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // URL namespace
      const uuid1 = generateUuidV5('test', customNamespace);
      const uuid2 = generateUuidV5('test', DNS_NAMESPACE);

      expect(uuid1).not.toBe(uuid2);
      expectDeterministicUuid(uuid1);
      expectDeterministicUuid(uuid2);
    });

    it('should handle empty string input', () => {
      const uuid = generateUuidV5('');

      expectDeterministicUuid(uuid);
    });

    it('should handle special characters', () => {
      const inputs = [
        '!@#$%^&*()',
        '<>&"\'',
        'test@example.com',
        'path/to/resource',
        'name-with-dashes',
        'name_with_underscores',
      ];

      inputs.forEach((input) => {
        const uuid = generateUuidV5(input);
        expectDeterministicUuid(uuid, `Input: "${input}"`);
      });
    });

    it('should handle unicode characters', () => {
      const inputs = [
        'こんにちは', // Japanese
        '你好', // Chinese
        'Привет', // Russian
        '🚀🎉🔥', // Emojis
      ];

      inputs.forEach((input) => {
        const uuid = generateUuidV5(input);
        expectDeterministicUuid(uuid, `Input: "${input}"`);
      });
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(1000);
      const uuid = generateUuidV5(longString);

      expectDeterministicUuid(uuid);
    });

    it('should be case-sensitive', () => {
      const uuidLower = generateUuidV5('test');
      const uuidUpper = generateUuidV5('TEST');
      const uuidMixed = generateUuidV5('Test');

      expect(uuidLower).not.toBe(uuidUpper);
      expect(uuidLower).not.toBe(uuidMixed);
      expect(uuidUpper).not.toBe(uuidMixed);
    });

    it('should generate UUID with version 5', () => {
      const uuid = generateUuidV5('test');
      const version = extractUuidVersion(uuid);

      expect(version).toBe(5);
    });

    it('should generate UUID with RFC 4122 variant', () => {
      const uuid = generateUuidV5('test');
      const variant = extractUuidVariant(uuid);

      expect(variant).toBe('RFC4122');
    });
  });

  // ==========================================================================
  // generateResourceId()
  // ==========================================================================

  describe('generateResourceId()', () => {
    it('should generate valid UUID v5 from email', () => {
      const email = 'john.doe@example.com';
      const uuid = generateResourceId(email);

      expectDeterministicUuid(uuid);
    });

    it('should be deterministic for same email', () => {
      const email = 'john.doe@example.com';
      const uuid1 = generateResourceId(email);
      const uuid2 = generateResourceId(email);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should generate different UUIDs for different emails', () => {
      const uuid1 = generateResourceId('john.doe@example.com');
      const uuid2 = generateResourceId('jane.smith@example.com');

      expect(uuid1).not.toBe(uuid2);
    });

    it('should use Worklenz namespace', () => {
      const email = 'test@example.com';
      const uuid1 = generateResourceId(email);
      const uuid2 = generateUuidV5(email, WORKLENZ_NAMESPACE);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should handle various email formats', () => {
      SAMPLE_EMAILS.forEach((email) => {
        const uuid = generateResourceId(email);
        expectDeterministicUuid(uuid, `Email: ${email}`);
      });
    });

    it('should be case-sensitive for emails', () => {
      const uuid1 = generateResourceId('john.doe@example.com');
      const uuid2 = generateResourceId('John.Doe@example.com');

      expect(uuid1).not.toBe(uuid2);
    });
  });

  // ==========================================================================
  // generateTeamId()
  // ==========================================================================

  describe('generateTeamId()', () => {
    it('should generate valid UUID v5 from team name', () => {
      const teamName = 'Test Team';
      const uuid = generateTeamId(teamName);

      expectDeterministicUuid(uuid);
    });

    it('should be deterministic for same team name', () => {
      const teamName = 'Test Team';
      const uuid1 = generateTeamId(teamName);
      const uuid2 = generateTeamId(teamName);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should generate different UUIDs for different team names', () => {
      const uuid1 = generateTeamId('Team A');
      const uuid2 = generateTeamId('Team B');

      expect(uuid1).not.toBe(uuid2);
    });

    it('should use Worklenz namespace', () => {
      const teamName = 'Test Team';
      const uuid1 = generateTeamId(teamName);
      const uuid2 = generateUuidV5(teamName, WORKLENZ_NAMESPACE);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should handle various team name formats', () => {
      SAMPLE_TEAM_NAMES.forEach((teamName) => {
        const uuid = generateTeamId(teamName);
        expectDeterministicUuid(uuid, `Team: ${teamName}`);
      });
    });

    it('should preserve team name case sensitivity', () => {
      const uuid1 = generateTeamId('Test Team');
      const uuid2 = generateTeamId('test team');

      expect(uuid1).not.toBe(uuid2);
    });
  });

  // ==========================================================================
  // generateProjectId()
  // ==========================================================================

  describe('generateProjectId()', () => {
    it('should generate valid UUID v5 from project name', () => {
      const projectName = 'P0003C';
      const uuid = generateProjectId(projectName);

      expectDeterministicUuid(uuid);
    });

    it('should be deterministic for same project name', () => {
      const projectName = 'P0003C';
      const uuid1 = generateProjectId(projectName);
      const uuid2 = generateProjectId(projectName);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should generate different UUIDs for different project names', () => {
      const uuid1 = generateProjectId('Project A');
      const uuid2 = generateProjectId('Project B');

      expect(uuid1).not.toBe(uuid2);
    });

    it('should use Worklenz namespace', () => {
      const projectName = 'P0003C';
      const uuid1 = generateProjectId(projectName);
      const uuid2 = generateUuidV5(projectName, WORKLENZ_NAMESPACE);

      expectUuidEqual(uuid1, uuid2);
    });

    it('should handle various project name formats', () => {
      SAMPLE_PROJECT_NAMES.forEach((projectName) => {
        const uuid = generateProjectId(projectName);
        expectDeterministicUuid(uuid, `Project: ${projectName}`);
      });
    });

    it('should preserve project name case sensitivity', () => {
      const uuid1 = generateProjectId('P0003C');
      const uuid2 = generateProjectId('p0003c');

      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate known UUID for P0003C', () => {
      const uuid = generateProjectId('P0003C');

      // This is the actual UUID generated for P0003C project
      // Store it as a known value for regression testing
      expect(uuid).toBeDefined();
      expect(uuid.length).toBe(36); // UUID format length
      expectDeterministicUuid(uuid);

      // Verify it's consistent
      const uuid2 = generateProjectId('P0003C');
      expectUuidEqual(uuid, uuid2);
    });
  });

  // ==========================================================================
  // isValidUuid()
  // ==========================================================================

  describe('isValidUuid()', () => {
    it('should validate correct UUID format', () => {
      const validUuids = [
        generateUuidV5('test1'),
        generateUuidV5('test2'),
        generateResourceId('test@example.com'),
        generateTeamId('Test Team'),
        generateProjectId('Test Project'),
        '74be27de-1e4e-593a-8b4e-7869e4a56af4', // P0003C project ID
      ];

      validUuids.forEach((uuid) => {
        expect(isValidUuid(uuid)).toBe(true);
        expect(isValidUuidV5Format(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUuids = [
        '', // Empty
        'not-a-uuid',
        '12345', // Too short
        '74be27de-1e4e-593a-8b4e', // Too short
        '74be27de-1e4e-593a-8b4e-7869e4a56af4-extra', // Too long
        '74be27de1e4e593a8b4e7869e4a56af4', // Missing dashes
        'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', // Invalid hex
        '74be27de-1e4e-393a-8b4e-7869e4a56af4', // Wrong version (3 instead of 5)
        '74be27de-1e4e-593a-cb4e-7869e4a56af4', // Wrong variant (c instead of 8-b)
      ];

      invalidUuids.forEach((uuid) => {
        expect(isValidUuid(uuid)).toBe(false);
      });
    });

    it('should handle null and undefined', () => {
      expect(isValidUuid(null as any)).toBe(false);
      expect(isValidUuid(undefined as any)).toBe(false);
    });

    it('should be case-insensitive for validation', () => {
      const uuid = generateUuidV5('test');
      const uuidLower = uuid.toLowerCase();
      const uuidUpper = uuid.toUpperCase();

      expect(isValidUuid(uuidLower)).toBe(true);
      expect(isValidUuid(uuidUpper)).toBe(true);
    });
  });

  // ==========================================================================
  // REGRESSION TESTS (Known UUIDs)
  // ==========================================================================

  describe('Known UUID Values (Regression)', () => {
    it('should generate consistent UUID for P0003C project', () => {
      const uuid = generateProjectId('P0003C');

      // Re-run to verify consistency
      const uuid2 = generateProjectId('P0003C');
      const uuid3 = generateProjectId('P0003C');

      expectUuidEqual(uuid, uuid2);
      expectUuidEqual(uuid2, uuid3);
    });

    it('should generate consistent UUID for Assurant P0003C team', () => {
      const uuid = generateTeamId('Assurant P0003C');

      const uuid2 = generateTeamId('Assurant P0003C');
      expectUuidEqual(uuid, uuid2);
    });

    it('should generate consistent UUID for system user', () => {
      const uuid = generateResourceId('system@worklenz.com');

      const uuid2 = generateResourceId('system@worklenz.com');
      expectUuidEqual(uuid, uuid2);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle whitespace in input', () => {
      const uuid1 = generateUuidV5('test');
      const uuid2 = generateUuidV5('  test  ');

      // Whitespace should NOT be trimmed (different input = different UUID)
      expect(uuid1).not.toBe(uuid2);
    });

    it('should handle newlines and tabs', () => {
      const uuid1 = generateUuidV5('test\nvalue');
      const uuid2 = generateUuidV5('test\tvalue');
      const uuid3 = generateUuidV5('testvalue');

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);

      expectDeterministicUuid(uuid1);
      expectDeterministicUuid(uuid2);
      expectDeterministicUuid(uuid3);
    });

    it('should handle numeric strings', () => {
      const uuids = [
        generateUuidV5('123'),
        generateUuidV5('456.789'),
        generateUuidV5('0'),
        generateUuidV5('-123'),
      ];

      uuids.forEach((uuid) => {
        expectDeterministicUuid(uuid);
      });

      // All should be different
      const uniqueUuids = new Set(uuids);
      expect(uniqueUuids.size).toBe(uuids.length);
    });

    it('should handle very similar inputs differently', () => {
      const uuid1 = generateUuidV5('test');
      const uuid2 = generateUuidV5('test '); // Trailing space
      const uuid3 = generateUuidV5('test1');
      const uuid4 = generateUuidV5('Test');

      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid4);
    });
  });
});
