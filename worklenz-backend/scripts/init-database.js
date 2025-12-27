#!/usr/bin/env node

/**
 * Database Initialization Script
 *
 * Initializes a PostgreSQL database with the Worklenz schema and migrations.
 * Designed to work with any PostgreSQL connection, especially cloud databases like Neon DB.
 *
 * Usage:
 *   npm run db:init              - Execute schema and migrations
 *   npm run db:init:dry-run      - Preview what will be executed
 *
 * Environment Variables:
 *   DATABASE_URL                 - PostgreSQL connection string (preferred)
 *   DB_USER, DB_PASSWORD, etc.   - Individual connection parameters (fallback)
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

/**
 * Log with color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Get database configuration from environment
 */
function getDatabaseConfig() {
  // Check for DATABASE_URL first (preferred for cloud databases)
  if (process.env.DATABASE_URL) {
    log('Using DATABASE_URL for connection', colors.cyan);

    // Parse SSL mode from connection string if present
    const sslMode = process.env.DB_SSL_MODE || 'disable';
    let ssl = false;

    if (sslMode === 'require') {
      ssl = { rejectUnauthorized: false };
    } else if (sslMode === 'verify-ca' || sslMode === 'verify-full') {
      ssl = {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA || undefined,
      };
    }

    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
    };
  }

  // Fallback to individual parameters
  log('Using individual DB parameters for connection', colors.cyan);

  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };

  // Add SSL if configured
  const sslMode = process.env.DB_SSL_MODE || 'disable';
  if (sslMode === 'require') {
    config.ssl = { rejectUnauthorized: false };
  } else if (sslMode === 'verify-ca' || sslMode === 'verify-full') {
    config.ssl = {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA || undefined,
    };
  }

  // Validate required parameters
  if (!config.user || !config.password || !config.database) {
    throw new Error('Missing required database configuration. Set DATABASE_URL or DB_USER, DB_PASSWORD, and DB_NAME');
  }

  return config;
}

/**
 * Read SQL file content
 */
function readSQLFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`SQL file not found: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

/**
 * Get all migration files sorted alphabetically
 */
function getMigrationFiles() {
  const migrationsDir = path.resolve(__dirname, '../database/migrations');

  if (!fs.existsSync(migrationsDir)) {
    log('Warning: Migrations directory not found, skipping migrations', colors.yellow);
    return [];
  }

  const files = [];

  // Recursive function to find all .sql files
  function findSQLFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findSQLFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.sql')) {
        files.push(fullPath);
      }
    }
  }

  findSQLFiles(migrationsDir);

  // Sort files alphabetically (this ensures consistent execution order)
  return files.sort();
}

/**
 * Execute SQL file
 */
async function executeSQLFile(client, filePath, description) {
  const relativePath = path.relative(process.cwd(), filePath);

  if (isDryRun) {
    log(`[DRY RUN] Would execute: ${relativePath} - ${description}`, colors.yellow);
    return;
  }

  log(`Executing: ${relativePath} - ${description}`, colors.blue);

  try {
    const sql = readSQLFile(filePath);

    // Execute the SQL
    await client.query(sql);

    log(`  ✓ Success`, colors.green);
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, colors.red);
    throw error;
  }
}

/**
 * Main execution function
 */
async function initializeDatabase() {
  const startTime = Date.now();

  log('\n' + '='.repeat(60), colors.bright);
  log('Worklenz Database Initialization Script', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  if (isDryRun) {
    log('DRY RUN MODE - No changes will be made\n', colors.yellow);
  }

  let client;

  try {
    // Get database configuration
    const config = getDatabaseConfig();

    // Create database client
    client = new Client(config);

    if (!isDryRun) {
      log('Connecting to database...', colors.cyan);
      await client.connect();
      log('Connected successfully\n', colors.green);

      // Test connection
      const result = await client.query('SELECT version()');
      log(`PostgreSQL Version: ${result.rows[0].version}\n`, colors.cyan);
    }

    // Define execution order for schema files
    const schemaFiles = [
      {
        path: path.resolve(__dirname, '../database/sql/0_extensions.sql'),
        description: 'Database extensions',
      },
      {
        path: path.resolve(__dirname, '../database/sql/1_tables.sql'),
        description: 'Table definitions',
      },
      {
        path: path.resolve(__dirname, '../database/sql/indexes.sql'),
        description: 'Database indexes',
      },
      {
        path: path.resolve(__dirname, '../database/sql/4_functions.sql'),
        description: 'Database functions',
      },
      {
        path: path.resolve(__dirname, '../database/sql/triggers.sql'),
        description: 'Database triggers',
      },
      {
        path: path.resolve(__dirname, '../database/sql/3_views.sql'),
        description: 'Database views',
      },
      {
        path: path.resolve(__dirname, '../database/sql/2_dml.sql'),
        description: 'Initial data',
      },
    ];

    // Execute schema files
    log('PHASE 1: Executing Schema Files', colors.bright);
    log('-'.repeat(60), colors.bright);

    for (const file of schemaFiles) {
      // Check if file exists before attempting to execute
      if (!fs.existsSync(file.path)) {
        log(`Warning: File not found, skipping: ${path.relative(process.cwd(), file.path)}`, colors.yellow);
        continue;
      }

      await executeSQLFile(client, file.path, file.description);
    }

    log(''); // Empty line for readability

    // Execute migration files
    log('PHASE 2: Executing Migration Files', colors.bright);
    log('-'.repeat(60), colors.bright);

    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
      log('No migration files found\n', colors.yellow);
    } else {
      log(`Found ${migrationFiles.length} migration file(s)\n`, colors.cyan);

      for (const file of migrationFiles) {
        const fileName = path.basename(file);
        await executeSQLFile(client, file, fileName);
      }
    }

    log(''); // Empty line for readability

    // Execute Prisma migrations
    log('PHASE 3: Executing Prisma Migrations (RCM Schema)', colors.bright);
    log('-'.repeat(60), colors.bright);

    if (isDryRun) {
      log('[DRY RUN] Would execute: prisma migrate deploy', colors.yellow);
    } else {
      try {
        log('Running Prisma migrations...', colors.blue);

        // Run Prisma migrate deploy (production-safe migration)
        execSync('npx prisma migrate deploy', {
          cwd: path.resolve(__dirname, '..'),
          stdio: 'inherit',
          env: process.env
        });

        log('  ✓ Prisma migrations completed successfully', colors.green);
      } catch (error) {
        log(`  ✗ Error running Prisma migrations: ${error.message}`, colors.red);
        log('  Note: If you haven\'t created Prisma migrations yet, this is expected.', colors.yellow);
        // Don't throw - allow initialization to complete even if Prisma migrations fail
      }
    }

    log(''); // Empty line for readability

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('='.repeat(60), colors.bright);
    if (isDryRun) {
      log('DRY RUN COMPLETED', colors.yellow);
      log(`Preview completed in ${duration}s`, colors.cyan);
      log('\nTo execute these changes, run: npm run db:init', colors.cyan);
    } else {
      log('DATABASE INITIALIZATION COMPLETED SUCCESSFULLY', colors.green);
      log(`Completed in ${duration}s`, colors.cyan);
    }
    log('='.repeat(60) + '\n', colors.bright);

  } catch (error) {
    log('\n' + '='.repeat(60), colors.bright);
    log('DATABASE INITIALIZATION FAILED', colors.red);
    log('='.repeat(60), colors.bright);
    log(`\nError: ${error.message}\n`, colors.red);

    if (error.stack) {
      log('Stack trace:', colors.red);
      log(error.stack, colors.red);
    }

    process.exit(1);
  } finally {
    if (client && !isDryRun) {
      await client.end();
      log('Database connection closed\n', colors.cyan);
    }
  }
}

// Run the script
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, getDatabaseConfig };
