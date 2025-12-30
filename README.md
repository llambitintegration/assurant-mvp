# Assurant MVP

An operations and work management platform designed for enterprise asset tracking, resource capacity management, and project coordination.

## Overview

Assurant MVP is a comprehensive work management solution that combines project management, inventory tracking, and resource capacity planning into a unified platform. Built for organizations that need to coordinate projects, track physical inventory, and manage personnel and equipment resources effectively.

## Key Features

### Inventory Management System
A complete inventory tracking module for managing physical components, suppliers, and storage locations:
- **Component Tracking**: Track parts with supplier and internal part numbers, quantities, and pricing
- **QR Code Generation**: Auto-generated QR codes for each component enabling future barcode scanning integration
- **CSV Bulk Import**: Import large datasets via CSV with validation and error reporting
- **Transaction Audit Trail**: Full history of stock in/out/adjustments with user attribution
- **Low Stock Monitoring**: Automatic alerts when inventory falls below minimum thresholds
- **Multi-owner Support**: Categorize components by owner type (mechanical/electrical)

### Resource Capacity Management (RCM)
Manage personnel and equipment resources across your organization:
- **Resource Registry**: Track personnel (employees) and equipment with detailed profiles
- **Skills & Proficiency**: Assign skills with proficiency levels (beginner to expert)
- **Department Assignments**: Organize resources into hierarchical departments
- **Availability Tracking**: Define work hours and availability windows
- **Unavailability Periods**: Track vacation, sick leave, training, and maintenance
- **Project Allocations**: Allocate resources to projects with percentage-based scheduling

### Enhanced Task Management
Modern task organization with advanced productivity features:
- **Dynamic Grouping**: Group tasks by Status, Priority, or Phase
- **Drag-and-Drop**: Intuitive task reordering and status changes
- **Bulk Operations**: Update multiple tasks simultaneously
- **Progress Tracking**: Multiple progress calculation modes (manual, weighted, time-based)
- **Recurring Tasks**: Schedule tasks to repeat on daily, weekly, monthly, or custom intervals

### Core Project Management
Built on proven project management fundamentals:
- **Project Planning**: Create and organize projects with phases and milestones
- **Task Management**: Break down projects into tasks with priorities, due dates, and assignments
- **Team Collaboration**: Share files, comments, and real-time updates
- **Time Tracking**: Monitor time spent on tasks for resource planning and reporting
- **Reporting & Analytics**: Generate insights on project status and team performance

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Ant Design |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL with Prisma ORM (hybrid schema) |
| Real-time | Socket.io for WebSocket communication |
| Storage | S3-compatible (MinIO for local development) |
| Containerization | Docker, Docker Compose |

## Requirements

- Node.js v18 or newer
- PostgreSQL v15 or newer
- Docker and Docker Compose (for containerized setup)

## Getting Started

### Quick Start (Docker - Recommended)

The fastest way to get the application running with all dependencies:

1. Clone the repository:
```bash
git clone <repository-url>
cd assurant-mvp
```

2. Start the Docker containers:
```bash
docker-compose up -d
```

3. Access the application:
   - **Frontend**: http://localhost:5000
   - **Backend API**: http://localhost:3000
   - **MinIO Console**: http://localhost:9001 (login: minioadmin/minioadmin)

4. To stop the services:
```bash
docker-compose down
```

### Manual Installation (For Development)

For developers who want to run services individually:

1. Clone the repository and set up environment:
```bash
git clone <repository-url>
cd assurant-mvp
cp worklenz-backend/.env.template worklenz-backend/.env
# Update .env with your configuration
```

2. Install dependencies:
```bash
# Backend
cd worklenz-backend
npm install

# Frontend
cd ../worklenz-frontend
npm install
```

3. Set up the database:
```bash
cd worklenz-backend

# Execute SQL setup files in order
psql -U your_username -d worklenz_db -f database/sql/0_extensions.sql
psql -U your_username -d worklenz_db -f database/sql/1_tables.sql
psql -U your_username -d worklenz_db -f database/sql/indexes.sql
psql -U your_username -d worklenz_db -f database/sql/4_functions.sql
psql -U your_username -d worklenz_db -f database/sql/triggers.sql
psql -U your_username -d worklenz_db -f database/sql/3_views.sql
psql -U your_username -d worklenz_db -f database/sql/2_dml.sql
psql -U your_username -d worklenz_db -f database/sql/5_database_user.sql

# Run Prisma migrations for RCM and Inventory tables
npx prisma migrate deploy
```

4. Start development servers:
```bash
# Backend
cd worklenz-backend
npm run dev:all

# Frontend (in another terminal)
cd worklenz-frontend
npm run dev
```

5. Access the application at http://localhost:5000

## Configuration

### Database Options

The application supports two database deployment modes:

**Local PostgreSQL (Docker)**
```bash
docker-compose --profile local up -d
```

**Cloud PostgreSQL (NeonDB)**
```bash
# Set DATABASE_URL in worklenz-backend/.env
docker-compose up -d
```

See [Environment Configuration Guide](environment-configuration.md) for detailed setup instructions.

### Environment Variables

Key configuration options:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL_MODE` | SSL mode: `disable`, `require`, `verify-full` |
| `JWT_SECRET` | Secret for JWT token signing |
| `SESSION_SECRET` | Express session secret |
| `SERVER_CORS` | Allowed CORS origins |
| `VITE_API_URL` | Backend API URL for frontend |

## Project Documentation

| Document | Description |
|----------|-------------|
| [Environment Configuration](environment-configuration.md) | Docker, Replit, and local dev setup |
| [Inventory System PRD](context/inventory-system-prd.md) | Product requirements for inventory module |
| [Enhanced Task Management Guide](docs/enhanced-task-management-user-guide.md) | User guide for task features |
| [Recurring Tasks Guide](docs/recurring-tasks-user-guide.md) | How to set up recurring tasks |
| [Database Schema](worklenz-backend/database/README.md) | Database architecture and Prisma migration guide |

## Database Architecture

The application uses a hybrid schema approach:

- **Legacy SQL Schema**: Core Worklenz tables managed via raw SQL files
- **Prisma ORM**: New modules (RCM, Inventory) managed via Prisma migrations

ERD diagrams are available in `worklenz-backend/database/`:
- `worklenz_db_revision_1.svg` - Core schema
- `worklenz_db_revision_2.svg` - Extended schema

See the [Database README](worklenz-backend/database/README.md) for full schema documentation and migration roadmap.

## Security

- All inventory and RCM data is isolated by team (multi-tenancy)
- Role-based access control (Admin/Owner required for inventory features)
- JWT-based authentication with session management
- HTTPS recommended for production deployments

For security concerns, contact the development team.

## License

This project is licensed under the [GNU Affero General Public License Version 3 (AGPLv3)](LICENSE).

---

<p align="center">
  <sub>Built on the <a href="https://worklenz.com">Worklenz</a> open-source framework</sub>
</p>
