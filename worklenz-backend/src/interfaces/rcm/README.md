# RCM Interfaces

This directory contains TypeScript interfaces and types for RCM data structures.

## Pattern

All RCM interfaces follow these conventions:

- Use TypeScript `interface` keyword
- Match Prisma schema types
- Separate DTOs (Data Transfer Objects) from database models
- Export all interfaces individually

## Planned Interfaces

- Request DTOs (CreateResourceDto, UpdateResourceDto, etc.)
- Response types
- Filter/query interfaces
- Business logic types
