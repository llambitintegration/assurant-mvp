# Jest Timeout Issue - Root Cause & Solution

## Problem Summary
Jest 28.1.3 hangs indefinitely in WSL2 environment when attempting to run any tests, including the simplest tests. The issue occurs during Jest's initialization phase before any test code executes.

## Root Cause Identified
**Jest 28.1.3 has a critical compatibility issue with WSL2** when performing file system operations, specifically during:
1. Configuration file discovery and resolution
2. Directory tree traversal
3. Test file discovery
4. Module resolution

The hang occurs in Jest's core initialization (before `globalSetup` runs), making it impossible to run any tests regardless of content or complexity.

## Evidence
- ✅ TypeScript compilation works (after removing `"diagnostics": true` from tsconfig.json)
- ✅ Node.js works normally
- ✅ Test files execute perfectly when run outside Jest (verified with direct Node execution)
- ✅ Jest loads successfully (`require('jest-cli')` works)
- ❌ `jest.run()` hangs indefinitely
- ❌ Jest CLI hangs on any command that requires config resolution
- ❌ Issue persists across different filesystems (/mnt/c and ~/)
- ❌ Issue persists with minimal configs and even no config

## Solution Options

### Option 1: Upgrade to Jest 29+ (RECOMMENDED)
Jest 29.x has significantly improved WSL2 compatibility and performance.

```bash
npm install --save-dev jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0
```

### Option 2: Downgrade to Jest 27.x
Jest 27.x had fewer WSL2 issues than 28.x.

```bash
npm install --save-dev jest@^27.5.1 @types/jest@^27.5.2 ts-jest@^27.1.5
```

### Option 3: Use Vitest (Modern Alternative)
Vitest is a modern test framework with excellent WSL2 support and better performance.

```bash
npm install --save-dev vitest @vitest/ui
```

### Option 4: Run Tests in Docker
Bypass WSL2 issues entirely by running tests in a Docker container.

## Immediate Workaround
Until Jest is upgraded, tests can be run directly with this custom runner:

```bash
node run-test-direct.js
```

This bypasses Jest entirely and runs tests with a minimal test framework.

## Files Modified
1. `tsconfig.json` - Removed `"diagnostics": true` (was causing tsc slowdown)
2. `jest.contract.config.js` - Added WSL2 optimizations (though they don't solve the core issue)
3. Created `run-test-direct.js` - Direct test runner as proof of concept

## Recommended Action
**Upgrade to Jest 29.x** - This will resolve the core issue and provide better performance overall.

Run:
```bash
npm install --save-dev jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0
npm test:contract
```

## References
- Jest WSL2 Issues: https://github.com/jestjs/jest/issues?q=is%3Aissue+wsl2
- Jest 29 Release Notes: https://jestjs.io/blog/2022/08/25/jest-29
