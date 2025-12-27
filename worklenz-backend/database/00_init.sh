#!/bin/bash
set -e

echo "Starting database initialization..."

# --------------------------------------------
# 📁 Load .env file if available
# --------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Look for .env file in parent directory (worklenz-backend/.env)
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"

if [ -f "$ENV_FILE" ]; then
  echo "📁 Loading environment from: $ENV_FILE"
  # Export all variables from .env file (skip comments and empty lines)
  while IFS= read -r line || [ -n "$line" ]; do
    # Strip Windows carriage returns
    line="${line//$'\r'/}"
    # Skip empty lines and comments
    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
      # Only process lines that look like VAR=value
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        # Remove surrounding quotes if present
        value="${value#\"}"
        value="${value%\"}"
        value="${value#\'}"
        value="${value%\'}"
        # Remove inline comments (but not if # is inside a URL or quoted string)
        # Only strip comments that have a space before #
        if [[ "$value" =~ ^([^#]*[^[:space:]])[[:space:]]+#.*$ ]]; then
          value="${BASH_REMATCH[1]}"
        fi
        # Export the variable
        export "$key=$value"
      fi
    fi
  done < "$ENV_FILE"
else
  echo "ℹ️ No .env file found at $ENV_FILE (this is OK if env vars are already set)"
fi

# --------------------------------------------
# 🔧 Environment Detection & Configuration
# --------------------------------------------

# Detect if we're running in Docker or standalone (e.g., for Neon DB)
if [ -n "$DATABASE_URL" ]; then
  echo "🌐 Detected DATABASE_URL - using Neon/remote PostgreSQL mode"
  DB_MODE="neon"
else
  echo "🐳 No DATABASE_URL - using Docker PostgreSQL mode"
  DB_MODE="docker"
fi

# Set paths based on environment
if [ "$DB_MODE" = "docker" ]; then
  SQL_DIR="/docker-entrypoint-initdb.d/sql"
  MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"
  BACKUP_DIR="/docker-entrypoint-initdb.d/pg_backups"
else
  # For Neon/standalone mode, use paths relative to this script
  SQL_DIR="${SQL_DIR:-$SCRIPT_DIR/sql}"
  MIGRATIONS_DIR="${MIGRATIONS_DIR:-$SCRIPT_DIR/migrations}"
  BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/pg_backups}"
fi

# --------------------------------------------
# 🔗 Database Connection Helper
# --------------------------------------------

# Helper function to run psql commands with proper connection
run_psql() {
  if [ "$DB_MODE" = "neon" ]; then
    psql "$DATABASE_URL" "$@"
  else
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
  fi
}

# Helper function to run psql with ON_ERROR_STOP
run_psql_strict() {
  if [ "$DB_MODE" = "neon" ]; then
    psql -v ON_ERROR_STOP=1 "$DATABASE_URL" "$@"
  else
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
  fi
}

# Optional environment overrides for admin seeding
#   PRESEED_ADMIN_USER   Enable preseed flow when set to "TRUE"
#   ADMIN_USER           Email for the admin (default admin@default.com)
#   ADMIN_PASSWORD       Password for the admin (default Password123!)
#   ADMIN_PASSWORD_HASH  Pre-computed bcrypt hash (overrides ADMIN_PASSWORD if set)
#                        Generate with: node worklenz-backend/scripts/generate-password-hash.js [password]
#                        In docker-compose.yml, escape $ as $$ (e.g., $$2b$$10$$...)
#   ADMIN_NAME           Display name override (default Default Admin)
#   ADMIN_TEAM_NAME      Team name override (default Admin Team)
#   ADMIN_TIMEZONE       Timezone override (default UTC)

preseed_admin_user() {
  local flag="${PRESEED_ADMIN_USER:-false}"
  if [[ "${flag^^}" != "TRUE" ]]; then
    echo "ℹ️ Admin preseed disabled. Set PRESEED_ADMIN_USER=TRUE to enable."
    return
  fi

  local admin_email="${ADMIN_USER:-admin@default.com}"
  local admin_password="${ADMIN_PASSWORD:-Password123!}"
  local admin_name="${ADMIN_NAME:-Default Admin}"
  local admin_team_name="${ADMIN_TEAM_NAME:-Admin Team}"
  local admin_timezone="${ADMIN_TIMEZONE:-UTC}"

  # Use pre-computed hash if provided, otherwise use default hash for "Password123!"
  # Default hash generated with: node scripts/generate-password-hash.js "Password123!"
  # To generate a new hash:
  #   cd worklenz-backend && node scripts/generate-password-hash.js "YourPassword"
  # Then set ADMIN_PASSWORD_HASH environment variable
  local default_hash='$2b$10$6kjqReF6NFrcGmgjgkp0Xe2.hPHquohFFmilGlxzArs2t4MYGV2oS'
  local admin_password_hash="${ADMIN_PASSWORD_HASH:-$default_hash}"

  if [[ -z "$admin_email" ]]; then
    echo "⚠️ PRESEED_ADMIN_USER is TRUE but ADMIN_USER is empty. Skipping admin preseed."
    return
  fi

  if [[ -z "$admin_password_hash" ]]; then
    echo "⚠️ PRESEED_ADMIN_USER is TRUE but ADMIN_PASSWORD_HASH is empty. Skipping admin preseed."
    return
  fi

  echo "👤 Ensuring admin user '$admin_email' exists..."

  run_psql_strict <<SQL
DO \$\$
DECLARE
  _admin_email TEXT := '$admin_email';
  _admin_password_hash TEXT := '$admin_password_hash';
  _admin_name TEXT := COALESCE(NULLIF(TRIM('$admin_name'), ''), 'Default Admin');
  _admin_team_name TEXT := COALESCE(NULLIF(TRIM('$admin_team_name'), ''), 'Admin Team');
  _admin_timezone TEXT := COALESCE(NULLIF(TRIM('$admin_timezone'), ''), 'UTC');
  _hashed_password TEXT;
  _team_name TEXT;
BEGIN
  _hashed_password := _admin_password_hash;
  _team_name := _admin_team_name;

  IF EXISTS (SELECT 1 FROM users WHERE email = _admin_email) THEN
    UPDATE users
    SET password = _hashed_password,
        is_deleted = FALSE,
        deleted_at = NULL
    WHERE email = _admin_email;
    RAISE NOTICE 'Admin user % already exists, password reset applied.', _admin_email;
  ELSE
    IF EXISTS (SELECT 1 FROM teams WHERE LOWER(name) = LOWER(_team_name)) THEN
      _team_name := CONCAT(_team_name, ' ', TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));
      RAISE NOTICE 'Admin team name already in use, switching to %.', _team_name;
    END IF;

    PERFORM register_user(
      json_build_object(
        'name', _admin_name,
        'team_name', _team_name,
        'email', _admin_email,
        'password', _hashed_password,
        'timezone', _admin_timezone
      )
    );
    RAISE NOTICE 'Admin user % was created successfully.', _admin_email;
  END IF;
END
\$\$;
SQL

  echo "✅ Admin preseed finished."
}

# --------------------------------------------
# 🗄️ STEP 1: Attempt to restore latest backup
# --------------------------------------------

if [ -d "$BACKUP_DIR" ]; then
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n 1)
else
  LATEST_BACKUP=""
fi

if [ -f "$LATEST_BACKUP" ]; then
  echo "🗄️ Found latest backup: $LATEST_BACKUP"
  echo "⏳ Restoring from backup..."
  run_psql < "$LATEST_BACKUP"
  echo "✅ Backup restoration complete. Skipping schema and migrations."
  exit 0
else
  echo "ℹ️ No valid backup found. Proceeding with base schema and migrations."
fi

# --------------------------------------------
# 🏗️ STEP 2: Continue with base schema setup
# --------------------------------------------

# Create migrations table if it doesn't exist
run_psql -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT now()
  );
"

# List of base schema files to execute in order
BASE_SQL_FILES=(
  "0_extensions.sql"
  "1_tables.sql"
  "indexes.sql"
  "4_functions.sql"
  "triggers.sql"
  "3_views.sql"
  "2_dml.sql"
)

# Add database user setup only for Docker mode (Neon manages its own permissions)
if [ "$DB_MODE" = "docker" ]; then
  BASE_SQL_FILES+=("5_database_user.sql")
else
  echo "ℹ️ Skipping 5_database_user.sql (not needed for Neon/cloud PostgreSQL)"
fi

echo "Running base schema SQL files in order..."

for file in "${BASE_SQL_FILES[@]}"; do
  full_path="$SQL_DIR/$file"
  if [ -f "$full_path" ]; then
    echo "Executing $file..."
    run_psql_strict -f "$full_path"
  else
    echo "WARNING: $file not found, skipping."
  fi
done

echo "✅ Base schema SQL execution complete."

# --------------------------------------------
# 👤 STEP 2b: Seed admin user when requested
# --------------------------------------------

preseed_admin_user

# --------------------------------------------
# 🚀 STEP 3: Apply SQL migrations
# --------------------------------------------

if [ -d "$MIGRATIONS_DIR" ] && compgen -G "$MIGRATIONS_DIR/*.sql" > /dev/null; then
  echo "Applying migrations..."
  for f in "$MIGRATIONS_DIR"/*.sql; do
    version=$(basename "$f")
    if ! run_psql -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
      echo "Applying migration: $version"
      run_psql -f "$f"
      run_psql -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    else
      echo "Skipping already applied migration: $version"
    fi
  done
else
  echo "No migration files found or directory is empty, skipping migrations."
fi

echo "🎉 Database initialization completed successfully."
