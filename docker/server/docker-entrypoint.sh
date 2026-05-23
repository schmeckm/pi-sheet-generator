#!/bin/sh
set -e

echo "Waiting for database..."
node scripts/wait-for-db.js

echo "Running database migrations..."
if ! npx sequelize-cli db:migrate; then
  echo "Migration failed (tables may exist from db:sync). Applying pending patches..."
  node scripts/apply-pending-migrations.js || true
fi

echo "Deploy seed (settings, graph, equipment, demo data)..."
node seeders/seed-deploy.js

echo "Starting API server..."
exec node index.js
