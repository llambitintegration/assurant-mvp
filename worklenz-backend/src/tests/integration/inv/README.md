# Inventory Management Integration Tests

This directory contains comprehensive integration tests for the Inventory Management feature.

## Overview

These tests use SuperTest to test actual HTTP endpoints with a real database connection, providing end-to-end validation of the inventory management API.

## Prerequisites

Before running the integration tests, ensure you have:

1. **SuperTest packages installed**:
   ```bash
   npm install --save-dev supertest @types/supertest
   ```

2. **Database configured**: The tests use the `DATABASE_URL` environment variable from `.env`

3. **Test data**: Tests use the existing admin team and user from the database

## Test Structure

### Infrastructure Files

- **setup.ts** (243 lines): Database connection utilities, test setup/teardown, cleanup functions
- **helpers.ts** (335 lines): Auth token generation, request builders, assertion helpers, validators
- **fixtures.ts** (464 lines): Test data factories for creating suppliers, locations, components, transactions

### Integration Test Files

1. **components.integration.spec.ts** (585 lines, ~40 test cases)
   - Component CRUD operations
   - Search and filtering
   - Low stock alerts
   - QR code generation
   - Team isolation

2. **suppliers.integration.spec.ts** (388 lines, ~20 test cases)
   - Supplier CRUD operations
   - Duplicate name validation
   - Email validation
   - Team isolation

3. **storage-locations.integration.spec.ts** (492 lines, ~25 test cases)
   - Location CRUD operations
   - Hierarchical relationships
   - Circular reference prevention
   - Location code uniqueness

4. **transactions.integration.spec.ts** (519 lines, ~30 test cases)
   - IN/OUT/ADJUST transaction types
   - Quantity validation
   - Atomic updates
   - Component history
   - Negative stock prevention

5. **dashboard.integration.spec.ts** (412 lines, ~15 test cases)
   - Dashboard statistics
   - Low stock alerts
   - Inventory value calculations
   - Empty inventory scenarios

6. **csv-import.integration.spec.ts** (415 lines, ~20 test cases)
   - Valid CSV import
   - Invalid data handling
   - Partial failure scenarios
   - Large file processing

## Running Tests

### Run All Inventory Integration Tests
```bash
npm run test:integration:inv
```

### Run All Inventory Unit Tests
```bash
npm run test:unit:inv
```

### Run Specific Test File
```bash
npx jest src/tests/integration/inv/components.integration.spec.ts --runInBand
```

### Run Tests with Coverage
```bash
npx jest --testPathPattern=tests/integration/inv --coverage --runInBand
```

## Test Isolation

Each test suite follows these patterns:

1. **beforeAll**: Set up test session and database connection
2. **beforeEach**: Create fresh test data for each test
3. **afterEach**: Clean up test data to ensure isolation
4. **afterAll**: Disconnect from database

## Database Cleanup

The tests use the `cleanAfterEach()` function to remove all test data after each test, ensuring:
- No test pollution
- Consistent starting state
- Proper foreign key handling

## Key Features

### Authentication
Tests use JWT tokens generated via `generateAuthToken()` helper to simulate authenticated requests.

### Request Helpers
- `getRequest()` - Authenticated GET request
- `postRequest()` - Authenticated POST request
- `putRequest()` - Authenticated PUT request
- `deleteRequest()` - Authenticated DELETE request
- `uploadRequest()` - File upload request for CSV import

### Assertion Helpers
- `expectSuccess()` - Assert 200 OK response
- `expectError()` - Assert error response with status code
- `expectPaginatedList()` - Assert paginated list structure
- `validateComponentStructure()` - Validate component data structure

### Data Fixtures
- `createSupplier()` - Create test supplier
- `createComponent()` - Create test component
- `createLocation()` - Create test storage location
- `createTransaction()` - Create test transaction
- `createLocationHierarchy()` - Create parent/child locations

## Test Statistics

- **Total Test Files**: 6 integration test files + 3 infrastructure files
- **Total Lines of Code**: ~3,853 lines
- **Total Test Cases**: 137 individual tests
- **Test Suites**: 31 describe blocks

## Notes

- Tests run with `--runInBand` flag to ensure sequential execution
- Each test is fully isolated with its own data
- Tests validate both success and error scenarios
- Team isolation is tested throughout
- Tests use real database (not mocked)
