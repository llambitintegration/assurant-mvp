# Environment Configuration Guide

This document explains how to configure the Worklenz application for different deployment environments: **Docker**, **Replit**, and **Local Development**.

## Quick Start

### Docker Deployment
```bash
# 1. Copy environment templates
cp docs/env-docker.example worklenz-backend/.env
cp docs/env-frontend.example worklenz-frontend/.env.production

# 2. Edit the .env files with your credentials
# 3. Start with cloud database (NeonDB)
docker-compose up

# OR start with local PostgreSQL
docker-compose --profile local up
```

### Replit Deployment
1. Set environment variables as **Replit Secrets** (not in files)
2. Key secrets: `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `COOKIE_SECRET`
3. Run the application - Replit domains are auto-detected for CORS

### Local Development
```bash
# 1. Copy environment templates
cp docs/env-docker.example worklenz-backend/.env
# Edit .env: set USE_DOCKER=false

# 2. Start backend
cd worklenz-backend && npm run dev

# 3. Start frontend (in another terminal)
cd worklenz-frontend && npm run dev
```

---

## Environment Variables Reference

### Core Environment Variables

| Variable | Description | Docker | Replit | Local |
|----------|-------------|--------|--------|-------|
| `USE_DOCKER` | Enable Docker mode | `true` | (unset) | `false` |
| `NODE_ENV` | Environment mode | `production` | `production` | `development` |
| `PORT` | Backend port | `3000` | `3000` | `3000` |

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full connection string (priority) | `postgresql://user:pass@host/db?sslmode=require` |
| `DB_SSL_MODE` | SSL mode: `disable`, `require`, `verify-full` | `require` |
| `DB_HOST` | Database host (if not using DATABASE_URL) | `db` (Docker) / `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DB_NAME` | Database name | `worklenz_db` |

### CORS Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `SERVER_CORS` | Allowed origins for HTTP (`*` = all) | `*` or `http://localhost:5000` |
| `SOCKET_IO_CORS` | Allowed origins for WebSocket | `*` or `http://localhost:5000` |
| `FRONTEND_URL` | Frontend URL for redirects | `http://localhost:5000` |

### Frontend Configuration (Vite)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (empty = use proxy) | `http://localhost:3000` |
| `VITE_SOCKET_URL` | WebSocket URL (empty = same-origin) | `ws://localhost:3000` |
| `VITE_USE_DOCKER` | Docker mode flag for frontend | `true` |

---

## Environment Detection Logic

### Backend (`worklenz-backend/src/shared/utils.ts`)

The backend automatically detects the environment:

```typescript
// Docker mode - explicit flag
isDocker() → process.env.USE_DOCKER === "true"

// Replit mode - auto-detected
isReplit() → REPLIT_DOMAINS or REPLIT_DEV_DOMAIN exists

// Environment summary
getEnvironmentMode() → 'docker' | 'replit' | 'local' | 'production'
```

### Frontend (`worklenz-frontend/src/config/env.ts`)

The frontend detects environment via:

```typescript
// Docker mode - explicit flag or URL pattern
isDockerMode() → VITE_USE_DOCKER === 'true' or API URL contains 'backend:'

// Replit mode - hostname detection
hostname.includes('.replit.dev') or '.replit.app'
```

---

## CORS Configuration

### How CORS Origins Are Built

**Backend** builds allowed origins from:
1. Default localhost origins (3000, 5000, 5173)
2. Docker container origins (if `USE_DOCKER=true`)
3. Replit domains (auto-detected from `REPLIT_DOMAINS`)
4. Explicit `SERVER_CORS` and `FRONTEND_URL`

**Socket.io** uses similar logic with `SOCKET_IO_CORS`.

### Wildcard CORS

Set `SERVER_CORS=*` to allow all origins (development only, not recommended for production).

---

## Docker-Specific Configuration

### Frontend Runtime Configuration

The Docker frontend uses runtime environment injection via `env-config.js`:

1. At container startup, `/app/env-config.sh` runs
2. It generates `/app/build/env-config.js` with environment variables
3. The HTML loads this script before the app

```javascript
// Generated env-config.js
window.VITE_API_URL="http://localhost:3000";
window.VITE_SOCKET_URL="ws://localhost:3000";
window.VITE_USE_DOCKER="true";
```

### Important: Browser vs Container URLs

The frontend runs in the **browser**, not in Docker. So:
- ✅ Use `http://localhost:3000` (browser can access)
- ❌ Don't use `http://backend:3000` (browser can't resolve container names)

The `docker-compose.yml` sets correct defaults:
```yaml
environment:
  - VITE_API_URL=http://localhost:3000
  - VITE_SOCKET_URL=ws://localhost:3000
```

---

## Replit-Specific Configuration

### Automatic CORS Detection

Replit auto-sets `REPLIT_DOMAINS` with your app's public URL. The backend extracts these for CORS:

```
REPLIT_DOMAINS=your-project-username.replit.app
→ CORS allows https://your-project-username.replit.app
```

### Required Secrets

Set these as **Replit Secrets**:

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
SESSION_SECRET=your-secret
COOKIE_SECRET=your-secret
SERVER_CORS=*
SOCKET_IO_CORS=*
```

### Vite Proxy

In development/Replit, the frontend uses Vite's proxy:
- `/api/*` → `http://localhost:3000`
- `/secure/*` → `http://localhost:3000`
- `/socket/*` → `http://localhost:3000`

This means `VITE_API_URL` should be **empty** (relative URLs).

---

## Troubleshooting

### CORS Errors

1. Check browser console for blocked origin
2. Backend logs show: `[CORS] Blocked origin: ...`
3. Solutions:
   - Set `SERVER_CORS=*` temporarily
   - Add the origin to `FRONTEND_URL`
   - Check `REPLIT_DOMAINS` on Replit

### WebSocket Connection Failed

1. Check `SOCKET_IO_CORS` includes the frontend origin
2. Verify proxy is working (development) or direct URL is correct (Docker)
3. Check backend logs: `[Socket.io] CORS origins: ...`

### Database Connection Failed

1. Check `DATABASE_URL` format
2. Verify `DB_SSL_MODE` matches your database (NeonDB needs `require`)
3. For local Docker DB, use `--profile local`

### Frontend Shows Empty Page

1. Check browser console for errors
2. Verify `env-config.js` is generated (Docker)
3. Check `VITE_API_URL` is correct for your environment

---

## Environment Files Reference

| File | Purpose | Tracked in Git |
|------|---------|----------------|
| `docs/env-docker.example` | Template for Docker backend | ✅ Yes |
| `docs/env-replit.example` | Reference for Replit secrets | ✅ Yes |
| `docs/env-frontend.example` | Template for Docker frontend | ✅ Yes |
| `worklenz-backend/.env` | Actual backend config | ❌ No |
| `worklenz-frontend/.env.production` | Actual frontend config | ❌ No |


