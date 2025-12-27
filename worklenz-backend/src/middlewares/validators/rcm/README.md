# RCM Validators

This directory contains Express validator middleware for RCM API endpoints.

## Pattern

All RCM validators follow these conventions:

- Use `express-validator` library
- Validate request body, params, and query strings
- Export validator arrays
- Apply before controller in route definitions

## Planned Validators

- `resource-validator.ts` - Resource CRUD validation
- `department-validator.ts` - Department CRUD validation
- `skill-validator.ts` - Skill CRUD validation
- `allocation-validator.ts` - Allocation CRUD validation
- `availability-validator.ts` - Availability CRUD validation
