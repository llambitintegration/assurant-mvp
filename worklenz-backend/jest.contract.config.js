/*
 * Jest configuration specifically for Contract Tests
 * Contract tests need real database connections and should not use automocking
 */

module.exports = {
  // Disable automock for contract tests - we need real DB connections
  automock: false,

  // Clear mocks between tests
  clearMocks: true,

  // Collect coverage
  collectCoverage: true,

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

  // Test environment
  testEnvironmentOptions: {
    url: "http://localhost:3000"
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    "\\\\node_modules\\\\",
    "\\.pnp\\.[^\\\\]+$"
  ],

  // Increased timeout for database operations
  testTimeout: 30000,

  // Setup files for contract tests
  setupFilesAfterEnv: ['<rootDir>/src/tests/contract/setup.ts']
};
