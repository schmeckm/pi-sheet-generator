#!/bin/sh
set -e

echo "Running database migrations..."
if ! npx sequelize-cli db:migrate; then
  echo "Migration failed (tables may exist from db:sync). Continuing startup..."
fi

if [ "${AUTO_SEED}" = "true" ]; then
  echo "Seeding database (AUTO_SEED=true)..."
  node seeders/seed-xsteps.js || true
  node seeders/seed-equipment.js || true
fi

echo "Starting API server..."
exec node index.js
