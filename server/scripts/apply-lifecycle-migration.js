/**
 * Applies MVP4 lifecycle columns when full sequelize-cli migrate cannot run (partial DB).
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250522000012-pi-sheet-lifecycle');

async function main() {
  const qi = sequelize.getQueryInterface();
  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'pi_sheets'`
  );
  const names = new Set(cols.map((c) => c.column_name));
  if (names.has('batch_number')) {
    console.log('Lifecycle columns already present — skip.');
    process.exit(0);
  }
  await migration.up(qi, Sequelize);
  console.log('Lifecycle migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
