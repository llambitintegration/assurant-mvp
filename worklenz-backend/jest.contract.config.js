/*
 * Jest configuration specifically for Contract Tests
 * Contract tests need real database connections and should not use automocking
 */

module.exports = {
  // Use ts-jest preset to handle TypeScript files
  preset: 'ts-jest',

  // Use Node environment for database testing
  testEnvironment: 'node',

  // Disable automock for contract tests - we need real DB connections
  automock: false,

  // Clear mocks between tests
  clearMocks: true,

  // Disable coverage by default (use --coverage flag to enable)
  collectCoverage: false,

  // Coverage directory
  coverageDirectory: "coverage/contract",

  // Ignore node_modules
  coveragePathIgnorePatterns: [
    "\\\\node_modules\\\\"
  ],

  // No strict coverage thresholds for contract tests (they test integration)
  // Main coverage thresholds are in jest.config.js for unit tests
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Restore mocks between tests
  restoreMocks: true,

  // Test only contract tests
  testMatch: [
    "**/tests/contract/**/*.spec.ts"
  ],

  // Ignore node_modules
  testPathIgnorePatterns: [
    "\\\\node_modules\\\\"
  ],

  // Test environment options
  testEnvironmentOptions: {
    url: "http://localhost:3000"
  },

  // Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    "\\\\node_modules\\\\",
    "\\.pnp\\.[^\\\\]+$"
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // WSL2 compatibility: Disable haste map and use simpler file discovery
  haste: {
    enableSymlinks: false,
  },

  // WSL2 compatibility: Disable watchman (file watcher)
  watchman: false,

  // Increased timeout for database operations
  testTimeout: 30000,

  // Global setup to load environment variables
  globalSetup: '<rootDir>/src/tests/contract/global-setup.js',

  // Setup files for contract tests
  setupFilesAfterEnv: ['<rootDir>/src/tests/contract/setup.ts'],

  // Global teardown to close all connections
  globalTeardown: '<rootDir>/src/tests/contract/global-teardown.js',

  // Force exit after tests complete (acceptable for contract tests with external DB connections)
  forceExit: true,

  // Run tests serially to avoid database conflicts
  maxWorkers: 1
};
