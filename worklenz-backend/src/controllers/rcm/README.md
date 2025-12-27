# RCM Controllers

This directory contains controller classes for Resource Capacity Management (RCM) API endpoints.

## Pattern

All RCM controllers extend `WorklenzControllerBase` and follow these conventions:

- Use `@HandleExceptions()` decorator for error handling
- Static methods for each endpoint handler
- Return `ServerResponse` instances
- Accept `IWorkLenzRequest` and `IWorkLenzResponse` parameters

## Planned Controllers

- `rcm-resources-controller.ts` - Resource CRUD operations
- `rcm-departments-controller.ts` - Department CRUD operations
- `rcm-skills-controller.ts` - Skills CRUD operations
- `rcm-allocations-controller.ts` - Allocation CRUD operations
- `rcm-availability-controller.ts` - Availability CRUD operations
