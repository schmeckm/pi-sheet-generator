/**
 * Applies plant columns when full sequelize-cli migrate cannot run.
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250522000015-add-plant');

async function main() {
  const qi = sequelize.getQueryInterface();
  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'pi_sheets' AND column_name = 'plant'`
  );
  if (cols.length) {
    console.log('Plant columns already present — skip.');
    process.exit(0);
  }
  await migration.up(qi, Sequelize);
  console.log('Plant migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
