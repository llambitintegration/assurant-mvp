# RCM API Routes

This directory contains Express router definitions for RCM API endpoints.

## Pattern

All RCM routers follow these conventions:

- Use `express.Router()`
- Wire validators and controllers via `safeControllerFunction`
- Register routes with appropriate HTTP methods
- Export router as default

## Planned Routers

- `resources-api-router.ts` - `/api/rcm/resources` endpoints
- `departments-api-router.ts` - `/api/rcm/departments` endpoints
- `skills-api-router.ts` - `/api/rcm/skills` endpoints
- `allocations-api-router.ts` - `/api/rcm/allocations` endpoints
- `availability-api-router.ts` - `/api/rcm/availability` endpoints
- `index.ts` - Consolidates all RCM routes
