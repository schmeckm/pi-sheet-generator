/**
 * Applies MVP 5.1 process_graph_edges when full sequelize-cli migrate cannot run.
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250522000014-create-process-graph');

async function main() {
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t));
  if (names.includes('process_graph_edges')) {
    console.log('process_graph_edges already exists — skip.');
    process.exit(0);
  }
  await migration.up(qi, Sequelize);
  console.log('Process graph migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
