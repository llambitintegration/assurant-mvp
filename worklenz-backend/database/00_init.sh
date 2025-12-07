#!/bin/bash
set -e

echo "Starting database initialization..."

SQL_DIR="/docker-entrypoint-initdb.d/sql"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"
BACKUP_DIR="/docker-entrypoint-initdb.d/pg_backups"

# Optional environment overrides for admin seeding
#   PRESEED_ADMIN_USER   Enable preseed flow when set to "TRUE"
#   ADMIN_USER           Email for the admin (default admin@default.com)
#   ADMIN_PASSWORD       Password for the admin (default Password123!)
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

  if [[ -z "$admin_email" || -z "$admin_password" ]]; then
    echo "⚠️ PRESEED_ADMIN_USER is TRUE but ADMIN_USER or ADMIN_PASSWORD is empty. Skipping admin preseed."
    return
  fi

  echo "👤 Ensuring admin user '$admin_email' exists..."

  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v admin_email="$admin_email" \
    -v admin_password="$admin_password" \
    -v admin_name="$admin_name" \
    -v admin_team_name="$admin_team_name" \
    -v admin_timezone="$admin_timezone" <<'SQL'
DO $$
DECLARE
  _admin_email TEXT := :'admin_email';
  _admin_password TEXT := :'admin_password';
  _admin_name TEXT := COALESCE(NULLIF(TRIM(:'admin_name'), ''), 'Default Admin');
  _admin_team_name TEXT := COALESCE(NULLIF(TRIM(:'admin_team_name'), ''), 'Admin Team');
  _admin_timezone TEXT := COALESCE(NULLIF(TRIM(:'admin_timezone'), ''), 'UTC');
  _hashed_password TEXT;
  _team_name TEXT;
BEGIN
  _hashed_password := crypt(_admin_password, gen_salt('bf', 10));
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
$$;
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
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$LATEST_BACKUP"
  echo "✅ Backup restoration complete. Skipping schema and migrations."
  exit 0
else
  echo "ℹ️ No valid backup found. Proceeding with base schema and migrations."
fi

# --------------------------------------------
# 🏗️ STEP 2: Continue with base schema setup
# --------------------------------------------

# Create migrations table if it doesn't exist
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
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
  "5_database_user.sql"
)

echo "Running base schema SQL files in order..."

for file in "${BASE_SQL_FILES[@]}"; do
  full_path="$SQL_DIR/$file"
  if [ -f "$full_path" ]; then
    echo "Executing $file..."
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$full_path"
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
    if ! psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
      echo "Applying migration: $version"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    else
      echo "Skipping already applied migration: $version"
    fi
  done
else
  echo "No migration files found or directory is empty, skipping migrations."
fi

echo "🎉 Database initialization completed successfully."
