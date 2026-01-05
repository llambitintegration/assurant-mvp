# Contract Testing Guide for Prisma Migration

## Overview

This directory contains contract tests that validate behavioral parity between SQL and Prisma implementations during the database migration. Contract tests ensure that new Prisma code produces identical results to existing SQL queries.

## Directory Structure

```
src/tests/contract/
├── auth/
│   ├── get-user-by-email.contract.spec.ts
│   ├── user-authentication.contract.spec.ts
│   └── shadow-mode.spec.ts
├── teams/
│   ├── team-member-lookup.contract.spec.ts
│   ├── create-team-member.contract.spec.ts
│   ├── get-team-members-list.contract.spec.ts
│   └── shadow-mode.spec.ts
└── README.md (this file)
```

## Running Tests

### Run all contract tests
```bash
cd /mnt/c/0_repos/assurant-mvp/worklenz-backend
npm test -- src/tests/contract/
```

### Run specific module tests
```bash
# Auth tests only
npm test -- src/tests/contract/auth/

# Teams tests only
npm test -- src/tests/contract/teams/
```

### Run shadow mode tests (performance validation)
```bash
# Auth shadow mode
npm test -- src/tests/contract/auth/shadow-mode.spec.ts

# Teams shadow mode
npm test -- src/tests/contract/teams/shadow-mode.spec.ts
```

## Test Types

### Contract Tests
**Purpose:** Validate that Prisma implementations produce identical results to SQL

**File naming:** `[feature-name].contract.spec.ts`

**Example:**
```typescript
it('should match SQL behavior for valid email lookup', async () => {
  const sqlQuery = async () => {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  };

  const prismaQuery = async () => {
    return await authService.getUserByEmail(email);
  };

  await expectParity(sqlQuery, prismaQuery, {
    removeFields: ['user_no'],
    timestampTolerance: 1000,
    treatNullAsUndefined: true
  });
});
```

### Shadow Mode Tests
**Purpose:** Validate production parity with performance metrics

**File naming:** `shadow-mode.spec.ts`

**Example:**
```typescript
it('should compare SQL vs Prisma with PII redaction', async () => {
  const result = await shadowCompare(
    'auth.getUserByEmail',
    async () => { /* SQL implementation */ },
    async () => { /* Prisma implementation */ },
    {
      enabled: true,
      sampleRate: 1.0,
      logMismatches: true,
      piiFields: ['email', 'password', 'name']
    }
  );

  expect(result.matched).toBe(true);
});
```

## Writing New Contract Tests

### Step 1: Identify SQL Query
Find the SQL query in the controller (e.g., `auth-controller.ts:25-40`)

### Step 2: Create Test File
```typescript
// src/tests/contract/[module]/[feature-name].contract.spec.ts
import { expectParity } from '../../utils/contract-test';
import db from '../../../config/db';
import { [Service] } from '../../../services/[module]/[service]';

describe('Contract Test: [Feature Name]', () => {
  let service: [Service];
  let testData: any;

  beforeAll(async () => {
    service = new [Service]();
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup test data
  });

  it('should match SQL behavior for [scenario]', async () => {
    const sqlQuery = async () => {
      // Exact SQL from controller
      const result = await db.query('...', [params]);
      return result.rows[0] || null;
    };

    const prismaQuery = async () => {
      return await service.method(params);
    };

    await expectParity(sqlQuery, prismaQuery, {
      removeFields: ['auto_increment_fields'],
      timestampTolerance: 1000,
      treatNullAsUndefined: true
    });
  });
});
```

### Step 3: Run Test (Should Fail - RED Phase)
```bash
npm test -- src/tests/contract/[module]/[feature-name].contract.spec.ts
```

### Step 4: Implement Prisma Service (GREEN Phase)
Create/update service in `src/services/[module]/[service].ts`

### Step 5: Verify Test Passes
```bash
npm test -- src/tests/contract/[module]/[feature-name].contract.spec.ts
```

## Common Patterns

### Normalization Options

#### Remove Auto-increment Fields
```typescript
{
  removeFields: ['user_no', 'id'] // Fields that differ between runs
}
```

#### Handle Timestamps
```typescript
{
  timestampTolerance: 1000 // Allow 1 second difference
}
```

#### Null vs Undefined
```typescript
{
  treatNullAsUndefined: true // SQL nulls = Prisma undefined
}
```

#### Sort Arrays
```typescript
{
  sortArraysBy: 'id' // Order-independent array comparison
}
```

### SQL to Prisma Mapping

#### Simple SELECT
**SQL:**
```sql
SELECT id, email, name FROM users WHERE email = $1
```

**Prisma:**
```typescript
await prisma.users.findFirst({
  where: { email },
  select: { id: true, email: true, name: true }
});
```

#### INNER JOIN
**SQL:**
```sql
SELECT tm.*, r.name AS role_name
FROM team_members tm
INNER JOIN roles r ON tm.role_id = r.id
WHERE tm.id = $1
```

**Prisma:**
```typescript
await prisma.team_members.findFirst({
  where: { id },
  include: {
    role: {
      select: { name: true }
    }
  }
});
```

#### Transaction
**SQL:**
```sql
BEGIN;
INSERT INTO team_members (...) VALUES (...);
UPDATE teams SET member_count = member_count + 1;
COMMIT;
```

**Prisma:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.team_members.create({ data: {...} });
  await tx.teams.update({ where: { id }, data: { member_count: { increment: 1 } } });
});
```

## Troubleshooting

### Test Fails: "Field mismatch"
**Cause:** SQL and Prisma return different field names
**Solution:** Add field to `removeFields` or create custom comparator

### Test Fails: "Timestamp difference"
**Cause:** Precision differences between SQL and Prisma
**Solution:** Increase `timestampTolerance` to 1000-5000ms

### Test Fails: "Null vs undefined"
**Cause:** SQL returns `null`, Prisma returns `undefined`
**Solution:** Add `treatNullAsUndefined: true` to options

### Test Passes but Slow
**Cause:** Prisma generating N+1 queries
**Solution:** Use `include` with explicit `select` for relations

## Performance Targets

- **Simple SELECT:** < 20ms p95 latency
- **JOIN queries:** < 30ms p95 latency
- **Transactions:** < 50ms p95 latency
- **Prisma overhead:** < 20% vs SQL

## Best Practices

1. **Test edge cases:** null values, empty arrays, invalid IDs
2. **Clean up test data:** Use `afterAll()` to prevent pollution
3. **Use descriptive names:** `should match SQL behavior for [specific scenario]`
4. **Document SQL source:** Include file and line numbers in comments
5. **Validate in shadow mode:** Run shadow tests before production

## Resources

- Full TDD Pilot Report: `/context/TDD-PILOT-REPORT.md`
- Test Utilities: `/src/tests/utils/contract-test.ts`
- Shadow Compare: `/src/tests/utils/shadow-compare.ts`
- Service Examples: `/src/services/inv/` (reference implementation)

## Support

For questions or issues:
1. Check TDD Pilot Report for patterns
2. Review existing contract tests for examples
3. Consult team lead for complex cases
