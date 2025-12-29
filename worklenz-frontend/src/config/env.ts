/**
 * Environment configuration
 * 
 * Supports multiple deployment modes:
 * - Docker: Uses runtime-injected env-config.js (VITE_API_URL, VITE_SOCKET_URL)
 * - Replit: Uses Vite proxy with relative URLs (empty VITE_API_URL)
 * - Local Dev: Uses Vite proxy with relative URLs
 * 
 * Priority:
 * 1. Runtime-injected (window.VITE_*) - Set by Docker's env-config.js
 * 2. Build-time (import.meta.env.VITE_*) - Set during npm run build
 * 3. Default empty string - Vite proxy handles routing to backend
 */

declare global {
  interface Window {
    VITE_API_URL?: string;
    VITE_SOCKET_URL?: string;
    // Docker detection flag (optional, can be set in env-config.js)
    VITE_USE_DOCKER?: string;
  }
}

/**
 * Check if running in Docker mode
 * Can be detected via explicit flag or non-empty API URL pointing to backend container
 */
export const isDockerMode = (): boolean => {
  // Skip in test environment
  if (typeof window === 'undefined') return false;

  // Explicit Docker flag
  if (window.VITE_USE_DOCKER === 'true' || import.meta.env.VITE_USE_DOCKER === 'true') {
    return true;
  }
  // Docker typically uses explicit backend URLs like http://backend:3000
  const apiUrl = window.VITE_API_URL || import.meta.env.VITE_API_URL || '';
  return apiUrl.includes('backend:') || apiUrl.includes('localhost:3000');
};

/**
 * Get the API base URL
 * Returns empty string for relative URLs (Vite proxy mode)
 */
export const getApiUrl = (): string => {
  // First check runtime-injected environment variables (Docker mode)
  if (typeof window !== 'undefined' && window.VITE_API_URL) {
    return window.VITE_API_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Default for development/Replit - use empty string for relative URLs
  // Vite proxy (dev) or same-origin requests (production) handle routing
  return '';
};

/**
 * Get the WebSocket URL for Socket.io
 * Returns undefined to use current page origin (same-origin WebSocket)
 */
export const getSocketUrl = (): string | undefined => {
  // First check runtime-injected environment variables (Docker mode)
  if (typeof window !== 'undefined' && window.VITE_SOCKET_URL) {
    return window.VITE_SOCKET_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // Derive from API URL if it's explicitly set
  const apiUrl = getApiUrl();
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }

  // Return undefined so Socket.io uses the current page origin
  // This works with Vite proxy in development and same-origin in production
  return undefined;
};

/**
 * Get the current environment mode for debugging
 */
export const getEnvironmentMode = (): 'docker' | 'replit' | 'development' | 'production' | 'test' => {
  // Test environment takes precedence
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return 'test';
  if (isDockerMode()) return 'docker';
  // Replit detection: hostname contains .replit.dev or .repl.co
  if (typeof window !== 'undefined' &&
      (window.location.hostname.includes('.replit.dev') ||
       window.location.hostname.includes('.repl.co') ||
       window.location.hostname.includes('.replit.app'))) {
    return 'replit';
  }
  if (import.meta.env.MODE === 'production') return 'production';
  return 'development';
};

// Log environment on module load (development only, skip in test)
if (import.meta.env.MODE !== 'production' && import.meta.env.MODE !== 'test' && typeof window !== 'undefined') {
  console.log('[ENV] Frontend environment:', getEnvironmentMode());
  console.log('[ENV] API URL:', getApiUrl() || '(relative/proxy)');
  console.log('[ENV] Socket URL:', getSocketUrl() || '(same-origin)');
}

export default {
  apiUrl: getApiUrl(),
  socketUrl: getSocketUrl(),
  isDocker: isDockerMode(),
  mode: getEnvironmentMode(),
};
