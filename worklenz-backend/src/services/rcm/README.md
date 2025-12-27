# RCM Services

This directory contains business logic service classes for Resource Capacity Management (RCM).

## Pattern

All RCM services use Prisma client for database operations and follow these conventions:

- Import `prisma` from `../../config/prisma`
- Implement business logic and validation
- Use TypeScript interfaces from `../../interfaces/rcm`
- Validate team_id for multi-tenancy isolation

## Planned Services

- `resources-service.ts` - Resource management logic
- `departments-service.ts` - Department management logic
- `skills-service.ts` - Skills management logic
- `allocations-service.ts` - Allocation management logic
- `availability-service.ts` - Availability management logic
