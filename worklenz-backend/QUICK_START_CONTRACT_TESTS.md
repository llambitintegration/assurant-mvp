# Quick Start: Contract Tests

## What Was Fixed

The Jest contract test environment had several critical configuration issues:
1. ✅ **Missing TypeScript compilation** - Added `ts-jest` preset
2. ✅ **No environment variables** - Added `global-setup.js` to load `.env`
3. ✅ **Database connection hangs** - Created lazy-loading utilities
4. ✅ **No timeout settings** - Set 30-second timeout
5. ✅ **Coverage overhead** - Disabled by default

## Run Tests Now

### Step 1: Verify Configuration
```bash
npm run test:contract -- --testPathPattern="simple-test"
```

**Expected:** 3 passing tests in < 5 seconds

**If it fails:** Check `JEST_TIMEOUT_FIX_SUMMARY.md` for details

### Step 2: Test Database Connection
```bash
node test-db-connection.js
```

**Expected:** "Database connection is working correctly!"

**If it hangs:** Database connectivity issue - see troubleshooting below

### Step 3: Run One Contract Test
```bash
npm run test:contract -- --testPathPattern="auth/get-user-by-email"
```

**Expected:** Test runs (may hang if db imported at module level)

**If it hangs:** The test needs lazy-loading fix (see below)

### Step 4: Run All Tests
```bash
npm run test:contract
```

## If Tests Still Hang

The existing test files import database at module level, causing immediate connections:

```typescript
// This causes immediate connection (HANGS if DB slow/unreachable):
import db from '../../../config/db';
```

**Fix:** Use lazy-loading pattern:

```typescript
// Option 1: Use utility
import { getDb } from '../../utils/db-lazy-loader';

describe('My Test', () => {
  it('should work', async () => {
    const db = getDb();  // Connects only when called
    await db.query('SELECT 1');
  });
});

// Option 2: Lazy-load in beforeAll
describe('My Test', () => {
  let db: any;

  beforeAll(() => {
    db = require('../../../config/db').default;
  });
});
```

## Database Connectivity Issues

If `test-db-connection.js` hangs:

### Quick Fix 1: Remove channel_binding

In `.env`, change:
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require
```

To:
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

### Quick Fix 2: Use Local Database

```bash
# Install PostgreSQL
sudo apt install postgresql

# Create test database
createdb worklenz_test

# Update .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/worklenz_test

# Run migrations
npm run prisma:deploy

# Run tests
npm run test:contract
```

## Available Commands

```bash
# Run all contract tests
npm run test:contract

# Run specific test
npm run test:contract -- --testPathPattern="teams/create"

# Run with coverage
npm run test:contract:coverage

# Watch mode
npm run test:contract:watch

# List all tests
npx jest --listTests --config=jest.contract.config.js

# Debug open handles
npm run test:contract -- --detectOpenHandles
```

## Files Created/Modified

### New Files:
- `src/tests/contract/global-setup.js` - Loads .env before tests
- `src/tests/contract/simple-test.spec.ts` - Minimal test to verify setup
- `src/tests/utils/db-lazy-loader.ts` - Lazy-loading utilities
- `test-db-connection.js` - Database connectivity test
- `CONTRACT_TESTS_README.md` - Full documentation
- `JEST_TIMEOUT_FIX_SUMMARY.md` - Detailed fix summary

### Modified Files:
- `jest.contract.config.js` - Added ts-jest, timeout, env loading
- `src/tests/contract/setup.ts` - Removed module-level db import
- `src/tests/contract/global-teardown.js` - Better error handling
- `package.json` - Added test:contract scripts

## Need Help?

1. **Configuration issues?** → See `JEST_TIMEOUT_FIX_SUMMARY.md`
2. **Database issues?** → See `CONTRACT_TESTS_README.md`
3. **Test hanging?** → Add lazy-loading (see examples above)

## Success Criteria

- [x] Jest configuration fixed (ts-jest, env loading, timeout)
- [x] Utilities and documentation created
- [ ] Simple test passes ← **Test this first**
- [ ] Database connection works ← **Test this second**
- [ ] One contract test passes ← **May need lazy-loading fix**
- [ ] All contract tests pass ← **Update remaining files**
