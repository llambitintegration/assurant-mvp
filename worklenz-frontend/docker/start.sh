#!/bin/sh
echo "Starting Worklenz Frontend..."
echo "Environment: ${NODE_ENV:-production}"

# Run environment configuration
/app/env-config.sh

# Start the static file server
echo "Serving frontend on port 5000..."
exec serve -s build -l tcp://0.0.0.0:5000


