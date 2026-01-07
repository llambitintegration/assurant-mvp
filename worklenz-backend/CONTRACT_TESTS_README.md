# Contract Tests - Setup and Troubleshooting

## Overview

Contract tests verify that the Prisma implementation matches the existing SQL behavior. These tests require a real database connection.

## Configuration

The Jest configuration for contract tests is in `jest.contract.config.js`:

- **TypeScript Support**: Uses `ts-jest` preset
- **No Automocking**: Real database connections are used
- **Timeout**: 30 seconds per test
- **Serial Execution**: Tests run one at a time (`maxWorkers: 1`)
- **Coverage**: Disabled by default (use `--coverage` flag to enable)

## Running Tests

```bash
# Run all contract tests
npm run test:contract

# Run specific test file
npm run test:contract -- --testPathPattern="auth/get-user-by-email"

# Run with coverage
npm run test:contract:coverage

# Run in watch mode
npm run test:contract:watch
```

## Known Issues and Solutions

### Issue 1: Tests Timeout / Hang During Setup

**Symptoms:**
- Tests timeout after 10-60 seconds
- No console output from tests
- Process doesn't exit cleanly

**Root Cause:**
- Database connection hanging during module import
- All test files import `db` from `config/db` at module level
- The pg.Pool is created immediately, causing connection attempts before tests run

**Potential Causes:**
1. **Network Connectivity**: WSL2 → Azure Neon Database connection issues
2. **SSL/TLS**: The `channel_binding=require` parameter in DATABASE_URL might cause handshake issues
3. **DNS Resolution**: Hostname resolution delays in test environment
4. **Firewall**: Corporate/local firewall blocking PostgreSQL port (5432)

**Solutions:**

#### Solution 1: Test Database Connection First

Run the database connection test to verify connectivity:

```bash
node test-db-connection.js
```

If this fails, the issue is with database connectivity, not Jest:
- Check network connection
- Verify DATABASE_URL is correct
- Try removing `channel_binding=require` from DATABASE_URL
- Check if VPN is required
- Verify firewall allows port 5432

#### Solution 2: Use Local Database

For faster, more reliable tests, use a local PostgreSQL instance:

1. Update `.env`:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/worklenz_test
```

2. Create test database:
```bash
createdb worklenz_test
npm run prisma:deploy
```

#### Solution 3: Modify Test Files to Lazy-Load DB

Instead of importing `db` at module level:

```typescript
// DON'T DO THIS (causes immediate connection attempt)
import db from '../../../config/db';

// DO THIS INSTEAD (lazy-load when needed)
function getDb() {
  return require('../../../config/db').default;
}

// Or use in your test
beforeAll(async () => {
  const db = require('../../../config/db').default;
  // ...
});
```

### Issue 2: "Cannot find module" Errors

**Solution:**
Ensure ts-jest is properly configured:
```bash
npm install --save-dev ts-jest @types/jest
```

### Issue 3: Tests Pass But Process Doesn't Exit

**Solution:**
The `forceExit: true` setting in `jest.contract.config.js` should handle this. If it persists:
- Check `global-teardown.js` is running
- Verify all database connections are closed
- Use `--detectOpenHandles` flag to identify leaks:
  ```bash
  npm run test:contract -- --detectOpenHandles
  ```

## Environment Variables

Required in `.env`:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_SSL_MODE=require  # or 'disable' for local DB
```

## Test Structure

Contract tests follow this pattern:

```typescript
import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';  // Consider lazy-loading
import prisma from '../../../config/prisma';

describe('Contract Test: Feature Name', () => {
  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup test data
  });

  it('should match SQL behavior', async () => {
    const sqlQuery = async () => {
      // SQL implementation
    };

    const prismaQuery = async () => {
      // Prisma implementation
    };

    await expectParity(sqlQuery, prismaQuery);
  });
});
```

## Debugging

Enable query logging:

```bash
LOG_QUERIES=true npm run test:contract
```

Enable Jest verbose output:

```bash
npm run test:contract -- --verbose
```

Check for open handles:

```bash
npm run test:contract -- --detectOpenHandles
```

## Next Steps

1. **Verify Database Connectivity**: Run `node test-db-connection.js`
2. **Fix Connection Issues**: Follow solutions above
3. **Update Test Files**: Consider lazy-loading db connections
4. **Run Simple Test First**: `npm run test:contract -- --testPathPattern="simple-test"`
5. **Gradually Add Tests**: Once simple test passes, run full suite
