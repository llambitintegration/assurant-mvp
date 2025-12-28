# Worklenz Project Management Application

## Overview
Worklenz is a full-stack project management application with a React frontend and Node.js/Express backend.

## Project Structure
- `worklenz-frontend/` - React + Vite + TypeScript frontend application
- `worklenz-backend/` - Express + Prisma + PostgreSQL backend API

## Technology Stack
- **Frontend**: React 18, Vite, TypeScript, Ant Design, TailwindCSS, Redux Toolkit
- **Backend**: Express.js, Prisma ORM, PostgreSQL, Socket.io
- **Database**: PostgreSQL (NeonDB managed)

## Running the Application
The application runs with two workflows:
1. **Frontend** - Vite dev server on port 5000 (public facing)
2. **Backend API** - Express server on port 3000 (internal API)

## Environment Configuration
All environment variables are configured as Replit secrets. Key variables include:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT token signing secret
- `SESSION_SECRET` - Express session secret
- `VITE_API_URL` - Backend API URL for frontend

## Database
- Uses NeonDB via project secret DATABASE_URL
- Schema defined in `worklenz-backend/database/sql/`
- Prisma ORM for additional RCM (Resource Capacity Management) features

## Development Notes
- Frontend runs on 0.0.0.0:5000 with allowedHosts enabled for Replit proxy
- Backend runs on localhost:3000
- Native modules (bcrypt, sharp) are rebuilt during setup
- Segfault handler is optional and fails gracefully if not available

## Login Credentials
- **Email**: admin@llambit.io
- **Password**: Password123!

## API Proxy Configuration
The frontend uses Vite's proxy feature to route API requests to the backend:
- `/secure/*` → Backend (authentication endpoints)
- `/api/*` → Backend (API endpoints)
- `/socket/*` → Backend (WebSocket connections)
- `/csrf-token` → Backend (CSRF token endpoint)

## Recent Changes
- Configured Vite proxy to route API calls from frontend to backend
- Set API base URL to empty string to use relative URLs with proxy
- Reset admin user password to Password123!
- Configured Vite to run on port 5000 with allowedHosts enabled
- Made segfault-handler optional to avoid native module issues
- Excluded data-migration utilities from TypeScript compilation
- Set up deployment configuration for production
