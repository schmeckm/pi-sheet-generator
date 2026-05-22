/**
 * Applies preferred_locale on users when full sequelize-cli migrate cannot run.
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250522000013-user-preferred-locale');

async function main() {
  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferred_locale'`
  );
  if (cols.length) {
    console.log('preferred_locale already present — skip.');
    process.exit(0);
  }
  await migration.up(sequelize.getQueryInterface(), Sequelize);
  console.log('Locale migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
