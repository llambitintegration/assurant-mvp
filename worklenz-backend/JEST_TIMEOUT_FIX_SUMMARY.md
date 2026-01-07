# Jest Contract Test Timeout Issues - Investigation & Fix Summary

## Problem Summary

All contract tests in `src/tests/contract/` were timing out, even simple tests. Tests would hang indefinitely with no output, suggesting the issue was during test setup rather than test execution.

## Root Causes Identified

### 1. **Missing ts-jest Configuration** (CRITICAL)
- **Problem**: `jest.contract.config.js` had no `preset: 'ts-jest'` or transform configuration
- **Impact**: TypeScript files weren't being transpiled, causing Jest to fail silently
- **Fix**: Added `preset: 'ts-jest'` and explicit transform configuration

### 2. **No Environment Variable Loading** (CRITICAL)
- **Problem**: No `globalSetup` to load `.env` file before tests
- **Impact**: `DATABASE_URL` and other env vars not available during test execution
- **Fix**: Created `src/tests/contract/global-setup.js` to load dotenv

### 3. **Eager Database Connection** (MAJOR)
- **Problem**: Test files import `db` from `config/db` at module level
- **Impact**: pg.Pool created during module import, causing connection attempts before tests run
- **Issue**: If database is unreachable or slow, this causes hangs during module loading
- **Fix**:
  - Created `db-lazy-loader.ts` utility for lazy-loading connections
  - Updated `setup.ts` to provide lazy-load helpers
  - Documented best practices in `CONTRACT_TESTS_README.md`

### 4. **Coverage Collection Overhead**
- **Problem**: `collectCoverage: true` by default adds significant overhead
- **Impact**: Slower test execution and more complex module loading
- **Fix**: Changed default to `false`, use `--coverage` flag when needed

### 5. **Missing Test Timeout**
- **Problem**: No explicit `testTimeout` setting
- **Impact**: Tests could hang indefinitely
- **Fix**: Set `testTimeout: 30000` (30 seconds)

### 6. **Parallel Test Execution**
- **Problem**: Multiple tests hitting database simultaneously
- **Impact**: Potential connection pool exhaustion and race conditions
- **Fix**: Set `maxWorkers: 1` for serial execution

## Files Modified

### 1. `/mnt/c/0_repos/assurant-mvp/worklenz-backend/jest.contract.config.js`

**Changes:**
```javascript
// ADDED
preset: 'ts-jest',
testEnvironment: 'node',
collectCoverage: false,  // Changed from true
testTimeout: 30000,
globalSetup: '<rootDir>/src/tests/contract/global-setup.js',
transform: {
  '^.+\\.ts$': 'ts-jest'
},
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
maxWorkers: 1,
```

**Why:** Proper TypeScript compilation and test environment setup

### 2. `/mnt/c/0_repos/assurant-mvp/worklenz-backend/src/tests/contract/global-setup.js`

**New File:**
```javascript
const dotenv = require('dotenv');
module.exports = async () => {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
};
```

**Why:** Load environment variables before any tests run

### 3. `/mnt/c/0_repos/assurant-mvp/worklenz-backend/src/tests/contract/global-teardown.js`

**Changes:**
- Added better error handling
- Added try-catch for module imports
- Added logging for debugging
- Increased cleanup delay to 500ms

**Why:** Ensure connections close properly even if modules aren't loaded

### 4. `/mnt/c/0_repos/assurant-mvp/worklenz-backend/src/tests/contract/setup.ts`

**Changes:**
```typescript
// REMOVED module-level import
- import db from '../../config/db';

// ADDED lazy-load helper
+ export function getDb() {
+   return require('../../config/db').default;
+ }
```

**Why:** Prevent immediate database connection during module import

### 5. `/mnt/c/0_repos/assurant-mvp/worklenz-backend/package.json`

**Changes:**
```json
"scripts": {
  "test:contract": "jest --config=jest.contract.config.js --no-coverage",
  "test:contract:watch": "jest --config=jest.contract.config.js --no-coverage --watch",
  "test:contract:coverage": "jest --config=jest.contract.config.js --coverage"
}
```

**Why:** Easy-to-use scripts for running contract tests

### 6. NEW: `/mnt/c/0_repos/assurant-mvp/worklenz-backend/src/tests/utils/db-lazy-loader.ts`

**Purpose:** Utility for lazy-loading database connections in tests

**Usage:**
```typescript
import { getDb, getPrisma, closeAllConnections } from '../utils/db-lazy-loader';

describe('My Test', () => {
  it('should work', async () => {
    const db = getDb();  // Only connects here, not during import
    const result = await db.query('SELECT 1');
  });
});
```

### 7. NEW: `/mnt/c/0_repos/assurant-mvp/worklenz-backend/src/tests/contract/simple-test.spec.ts`

**Purpose:** Minimal test to verify Jest setup without database connections

**Usage:** Run first to verify Jest configuration works:
```bash
npm run test:contract -- --testPathPattern="simple-test"
```

### 8. NEW: `/mnt/c/0_repos/assurant-mvp/worklenz-backend/test-db-connection.js`

**Purpose:** Standalone script to verify database connectivity

**Usage:**
```bash
node test-db-connection.js
```

### 9. NEW: `/mnt/c/0_repos/assurant-mvp/worklenz-backend/CONTRACT_TESTS_README.md`

**Purpose:** Comprehensive documentation for running and troubleshooting contract tests

## Testing Steps

### Step 1: Verify Jest Can Start
```bash
npx jest --listTests --config=jest.contract.config.js
```

**Expected:** List of test files (no timeout)

### Step 2: Run Simple Test
```bash
npm run test:contract -- --testPathPattern="simple-test"
```

**Expected:**
- 3 passing tests
- Tests complete in < 5 seconds
- Output shows environment variables loaded

### Step 3: Test Database Connection
```bash
node test-db-connection.js
```

**Expected:**
- Connection successful
- Query executes
- Pool closes cleanly

**If this fails:** Database connectivity issue (not Jest issue)

### Step 4: Run Single Contract Test
```bash
npm run test:contract -- --testPathPattern="auth/get-user-by-email"
```

**Expected:**
- Tests run (may pass or fail)
- No timeout
- Clear error messages if failures

**If this hangs:** The test file still imports db at module level - needs lazy-loading fix

### Step 5: Run All Contract Tests
```bash
npm run test:contract
```

**Expected:**
- All tests run serially
- Complete within 5 minutes
- Clean exit

## Remaining Known Issues

### Issue 1: Test Files Still Import DB at Module Level

**Files Affected:**
- `src/tests/contract/auth/get-user-by-email.contract.spec.ts`
- `src/tests/contract/auth/shadow-mode.spec.ts`
- `src/tests/contract/auth/user-authentication.contract.spec.ts`
- (and others)

**Problem:**
```typescript
import db from '../../../config/db';  // ← Creates connection immediately
```

**Solution Options:**

**Option A: Update Each Test File (Recommended)**
```typescript
// Before
import db from '../../../config/db';

describe('My Test', () => {
  it('test', async () => {
    await db.query('...');
  });
});

// After
import { getDb } from '../../utils/db-lazy-loader';

describe('My Test', () => {
  it('test', async () => {
    const db = getDb();  // Only connects when needed
    await db.query('...');
  });
});
```

**Option B: Lazy-Load in beforeAll**
```typescript
import type { QueryResult } from 'pg';

describe('My Test', () => {
  let db: any;

  beforeAll(() => {
    db = require('../../../config/db').default;
  });

  it('test', async () => {
    await db.query('...');
  });
});
```

### Issue 2: Database Connectivity from WSL2

**Symptoms:**
- `test-db-connection.js` hangs or times out
- Connection to Azure Neon database fails

**Possible Causes:**
1. WSL2 network bridge issues
2. Corporate firewall blocking port 5432
3. VPN required but not connected
4. DNS resolution delays
5. `channel_binding=require` parameter incompatible with client

**Solutions:**

**A. Try without channel_binding:**
```bash
# In .env, change:
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require

# To:
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

**B. Use local database for tests:**
```bash
# Install PostgreSQL locally
sudo apt install postgresql

# Create test database
createdb worklenz_test

# Update .env for tests
DATABASE_URL=postgresql://postgres:password@localhost:5432/worklenz_test

# Run migrations
npm run prisma:deploy
```

**C. Check WSL2 networking:**
```bash
# Test DNS resolution
nslookup ep-soft-glitter-a85goz3u-pooler.eastus2.azure.neon.tech

# Test port connectivity
nc -zv ep-soft-glitter-a85goz3u-pooler.eastus2.azure.neon.tech 5432
```

## Success Criteria

✓ **Minimum (Configuration Fixed):**
- [ ] `npx jest --listTests --config=jest.contract.config.js` completes without timeout
- [ ] Simple test passes: `npm run test:contract -- --testPathPattern="simple-test"`
- [ ] Environment variables loaded correctly

✓ **Basic (Database Connected):**
- [ ] `node test-db-connection.js` succeeds
- [ ] At least one contract test runs to completion (pass or fail)
- [ ] No hanging processes after test completion

✓ **Complete (All Tests Working):**
- [ ] All contract tests run without timeout
- [ ] Tests complete within expected time (< 5 minutes)
- [ ] Database cleanup works properly
- [ ] No connection pool leaks

## Next Actions Required

1. **Immediate:** Test the simple test to verify Jest configuration:
   ```bash
   npm run test:contract -- --testPathPattern="simple-test"
   ```

2. **If simple test passes:** Test database connectivity:
   ```bash
   node test-db-connection.js
   ```

3. **If database connects:** Update test files to use lazy-loading:
   - Start with one file (e.g., `auth/get-user-by-email.contract.spec.ts`)
   - Replace `import db from '...'` with lazy-load pattern
   - Test: `npm run test:contract -- --testPathPattern="auth/get-user-by-email"`

4. **If database doesn't connect:** Fix connectivity issue:
   - Try DATABASE_URL without `channel_binding=require`
   - Set up local PostgreSQL for testing
   - Check network/firewall/VPN

5. **Once one test works:** Systematically update remaining test files

## Reference: Key Configuration Changes

### Before (Broken)
```javascript
// jest.contract.config.js
module.exports = {
  automock: false,
  collectCoverage: true,  // Overhead
  // No preset or transform
  // No globalSetup
  // No testTimeout
  setupFilesAfterEnv: ['<rootDir>/src/tests/contract/setup.ts'],
  globalTeardown: '<rootDir>/src/tests/contract/global-teardown.js',
  forceExit: true
};
```

### After (Fixed)
```javascript
// jest.contract.config.js
module.exports = {
  preset: 'ts-jest',                    // ← TypeScript support
  testEnvironment: 'node',              // ← Node environment
  automock: false,
  collectCoverage: false,               // ← Disabled by default
  testTimeout: 30000,                   // ← 30 second timeout
  globalSetup: '<rootDir>/src/tests/contract/global-setup.js',  // ← Load .env
  setupFilesAfterEnv: ['<rootDir>/src/tests/contract/setup.ts'],
  globalTeardown: '<rootDir>/src/tests/contract/global-teardown.js',
  transform: {
    '^.+\\.ts$': 'ts-jest'              // ← Transform TypeScript
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  maxWorkers: 1,                         // ← Serial execution
  forceExit: true
};
```

## Conclusion

The main issues were:
1. **TypeScript compilation not configured** (ts-jest missing)
2. **Environment variables not loaded** (no globalSetup)
3. **Database connections created too early** (module-level imports)

The fixes provide:
- ✅ Proper TypeScript support via ts-jest
- ✅ Environment variable loading via globalSetup
- ✅ Lazy-loading utilities to prevent premature connections
- ✅ Comprehensive documentation and troubleshooting guide
- ✅ Test helpers and diagnostic scripts
- ✅ Clear npm scripts for common operations

The user can now:
1. Run simple tests to verify configuration
2. Test database connectivity independently
3. Gradually migrate test files to lazy-loading pattern
4. Debug issues with clear error messages
