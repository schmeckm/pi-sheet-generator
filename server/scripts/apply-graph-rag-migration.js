/**
 * Applies MVP 5.2 graph_edge_suggestions + pi_sheets.graph_snapshot.
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250522000015-graph-rag-and-snapshots');

async function main() {
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t));

  if (names.includes('graph_edge_suggestions')) {
    const [cols] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'pi_sheets' AND column_name = 'graph_snapshot'`
    );
    if (cols.length) {
      console.log('Graph RAG schema already present — skip.');
      process.exit(0);
    }
    await qi.addColumn('pi_sheets', 'graph_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    console.log('Added pi_sheets.graph_snapshot only.');
    process.exit(0);
  }

  await migration.up(qi, Sequelize);
  console.log('Graph RAG migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
