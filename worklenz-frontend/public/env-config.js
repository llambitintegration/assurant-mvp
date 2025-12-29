/**
 * Environment Configuration for Worklenz Frontend
 * 
 * This file provides runtime configuration for the application.
 * 
 * ENVIRONMENTS:
 * - Development/Replit: Keep values as undefined to use Vite proxy (relative URLs)
 * - Docker: Values are injected at container startup via env-config.sh
 * - Production: Set explicit URLs to your backend
 * 
 * HOW IT WORKS:
 * 1. This file is loaded via <script> in index.html before the app
 * 2. Values are available on the window object
 * 3. src/config/env.ts reads from window first, then import.meta.env
 * 
 * PRIORITY: window.VITE_* > import.meta.env.VITE_* > defaults
 */

// For local development and Replit: use undefined to enable Vite proxy
// The proxy in vite.config.mts routes /api, /secure, /socket to localhost:3000
window.VITE_API_URL = undefined;
window.VITE_SOCKET_URL = undefined;
window.VITE_USE_DOCKER = undefined;

// For Docker: uncomment and set these (or let env-config.sh generate them)
// window.VITE_API_URL = 'http://localhost:3000';
// window.VITE_SOCKET_URL = 'ws://localhost:3000';
// window.VITE_USE_DOCKER = 'true';
