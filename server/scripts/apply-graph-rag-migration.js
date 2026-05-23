/**
 * Applies MVP 5.2 graph_edge_suggestions + pi_sheets.graph_snapshot.
 */
const { sequelize, ensureGraphRagSchema } = require('../config/database');

async function main() {
  await sequelize.authenticate();
  await ensureGraphRagSchema();
  console.log('Graph RAG schema OK.');
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
