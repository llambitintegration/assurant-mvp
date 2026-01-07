/**
 * Global Setup for Contract Tests
 *
 * This file is called once before all tests run.
 * It ensures environment variables are loaded before any tests execute.
 */

const dotenv = require('dotenv');
const path = require('path');

module.exports = async () => {
  // Load environment variables from .env file
  const envPath = path.resolve(__dirname, '../../../.env');
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.warn('[GLOBAL SETUP] Warning: .env file not found or error loading:', result.error.message);
    console.warn('[GLOBAL SETUP] Attempting to load from default location...');
    dotenv.config();
  }

  // Verify critical environment variables
  if (!process.env.DATABASE_URL) {
    throw new Error('[GLOBAL SETUP] DATABASE_URL is not set. Please configure your .env file.');
  }

  console.log('[GLOBAL SETUP] Environment variables loaded');
  console.log('[GLOBAL SETUP] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('[GLOBAL SETUP] Test timeout:', 30000, 'ms');
};
