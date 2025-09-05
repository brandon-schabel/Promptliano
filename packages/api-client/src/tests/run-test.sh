#!/bin/bash

# Run a single test file with proper database initialization
# This script ensures the database is properly set up before running tests

# Set environment variables for test mode
export NODE_ENV=production  # Don't use 'test' to avoid singleton :memory: database
export DATABASE_PATH=/tmp/test-promptliano-$$.db
export PROMPTLIANO_DB_PATH=$DATABASE_PATH
export RATE_LIMIT_ENABLED=false
export LOG_LEVEL=silent

# Clean up on exit
trap "rm -f $DATABASE_PATH $DATABASE_PATH-wal $DATABASE_PATH-shm" EXIT

# Run the test
bun test "$@"