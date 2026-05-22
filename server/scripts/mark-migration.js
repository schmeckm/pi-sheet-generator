/**
 * One-off: mark a migration as applied without re-running earlier migrations.
 * Usage: node scripts/mark-migration.js 20250522000011-create-system-settings.js
 */
const { sequelize } = require('../models');

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/mark-migration.js <migration-filename>');
  process.exit(1);
}

sequelize
  .query('INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING', {
    replacements: { name },
  })
  .then(() => {
    console.log('Marked:', name);
    return sequelize.close();
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
