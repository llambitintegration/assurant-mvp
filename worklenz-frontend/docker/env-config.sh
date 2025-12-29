#!/bin/sh
# Update env-config.js with runtime environment variables
# This script runs at container startup and injects environment variables

# Determine API URL - default to localhost for browser access, not container network
API_URL="${VITE_API_URL:-http://localhost:3000}"
SOCKET_URL="${VITE_SOCKET_URL:-ws://localhost:3000}"
USE_DOCKER="${USE_DOCKER:-true}"

echo "Generating env-config.js with:"
echo "  API_URL: $API_URL"
echo "  SOCKET_URL: $SOCKET_URL"
echo "  USE_DOCKER: $USE_DOCKER"

cat > /app/build/env-config.js << EOF
// Runtime environment configuration - Generated at container startup
// DO NOT EDIT - This file is overwritten on each container start
window.VITE_API_URL="${API_URL}";
window.VITE_SOCKET_URL="${SOCKET_URL}";
window.VITE_USE_DOCKER="${USE_DOCKER}";
EOF

echo "env-config.js generated successfully"


