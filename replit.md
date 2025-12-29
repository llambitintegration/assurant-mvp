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
- **Inventory Layout Refactor (Dec 2025)** - Synced inventory layout styling with Reports tab:
  - InventoryLayout now matches ReportingLayout (theme support, fixed header with navbar, collapsible sidebar)
  - Added InventoryCollapsedButton component for sidebar toggle
  - Updated inventory-sider with theme-aware ConfigProvider and custom CSS class
  - Added custom-inventory-sider CSS styles to match reporting sidebar pattern
  - Fixed navigation paths to use correct /worklenz/inventory/ prefix
- **Inventory Data Rendering Fix (Dec 2025)** - Fixed inventory data not displaying on frontend:
  - Fixed Redux state key mismatch in inventory slices (componentsReducer/transactionsReducer → inventoryComponents/inventoryTransactions)
  - Added proper type conversion in backend services for query parameters (strings → integers/booleans)
  - Updated components-service.ts, suppliers-service.ts, locations-service.ts, and transactions-service.ts to parse page, size, and is_active parameters correctly for Prisma
- **Socket.io Connection Fix (Dec 2025)** - Fixed WebSocket connection errors:
  - Backend Socket.io now supports both polling and websocket transports with credentials
  - Frontend socket config returns undefined (not empty string) so Socket.io uses current page origin
  - Changed transport order to prefer polling first for better compatibility with Replit proxy
  - Added HMR cleanup to disconnect old socket connections on module hot reload
- **Inventory Layout Duplicate Header Fix (Dec 2025)** - Fixed duplicate header/ribbon rendering:
  - Moved inventory routes from nested MainLayout children to top-level routes (like reporting)
  - Changed inventory route path from relative 'inventory' to absolute 'worklenz/inventory'
  - Removed inventory routes from main-routes.tsx, registered directly in index.tsx
  - InventoryLayout now renders as standalone layout without MainLayout wrapper
  - Fixed dashboardSlice to use response.body instead of response.data with null-safety checks
