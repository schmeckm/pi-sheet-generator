#!/bin/sh
set -e

echo "Waiting for database..."
node scripts/wait-for-db.js

echo "Running database migrations..."
if ! npx sequelize-cli db:migrate; then
  echo "Migration failed (tables may exist from db:sync). Applying pending patches..."
  node scripts/apply-pending-migrations.js || true
fi

if [ "${AUTO_SEED}" = "true" ]; then
  echo "Seeding database (AUTO_SEED=true)..."
  node seeders/seed-xsteps.js || true
  node seeders/seed-equipment.js || true
  node seeders/seed-graph.js || true
fi

echo "Starting API server..."
exec node index.js
