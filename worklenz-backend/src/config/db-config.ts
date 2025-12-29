/**
 * Helper function to determine SSL configuration based on DB_SSL_MODE
 */
function getSSLConfig() {
  const sslMode = process.env.DB_SSL_MODE || 'disable';

  switch (sslMode) {
    case 'disable':
      return false;
    case 'require':
      // Encrypted but don't verify certificate
      return { rejectUnauthorized: false };
    case 'verify-ca':
    case 'verify-full':
      // Full SSL verification with CA certificate
      return {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA || undefined, // Optional CA cert path/content
      };
    default:
      return false;
  }
}

/**
 * Database configuration
 * Supports both connection strings (DATABASE_URL) and individual parameters
 * Prioritizes DATABASE_URL if present, otherwise uses individual params
 */
const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: getSSLConfig(),
      max: +(process.env.DB_MAX_CLIENTS || '50'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Add keepalive for NeonDB cloud connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || '5432'),
      ssl: getSSLConfig(),
      max: +(process.env.DB_MAX_CLIENTS || '50'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Add keepalive for database connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

export default config;
