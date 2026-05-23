require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Sequelize } = require('sequelize');
const pgvector = require('pgvector/sequelize');

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://pisheet:pisheet_dev@localhost:7003/pisheet';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
  },
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

pgvector.registerTypes(Sequelize);

/**
 * Ensure pgvector extension is available before vector columns are used.
 */
async function ensurePgVectorExtension() {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
}

/**
 * pgvector column is not always created by Sequelize sync — ensure it exists.
 */
async function ensureEmbeddingColumn(tableName) {
  const [tables] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    { bind: [tableName] }
  );
  if (tables.length === 0) return;

  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'embedding'`,
    { bind: [tableName] }
  );
  if (rows.length === 0) {
    await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN embedding vector(1536);`);
  }
}

async function ensureXStepEmbeddingColumn() {
  return ensureEmbeddingColumn('xsteps');
}

/**
 * XStep model expects sap_system + tags; partial deploys may skip the migration.
 */
async function ensureXStepSapMetadataColumns() {
  const [tables] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'xsteps'`
  );
  if (tables.length === 0) return;

  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'xsteps'
       AND column_name IN ('sap_system', 'tags')`
  );
  const present = new Set(cols.map((r) => r.column_name));
  if (present.has('sap_system') && present.has('tags')) return;

  const migration = require('../migrations/20250523000001-xstep-sap-system-tags');
  const qi = sequelize.getQueryInterface();
  await migration.up(qi, Sequelize);
}


async function ensureDocumentChunkEmbeddingColumn() {
  return ensureEmbeddingColumn('document_chunks');
}

/**
 * graph_edge_suggestions + pi_sheets.graph_snapshot (MVP 5.2 RAG suggestions).
 */
async function ensureGraphRagSchema() {
  const [piSheets] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'pi_sheets'`
  );
  if (!piSheets.length) return;

  const [suggestionsTable] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'graph_edge_suggestions'`
  );
  const [snapshotCol] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pi_sheets' AND column_name = 'graph_snapshot'`
  );
  if (suggestionsTable.length && snapshotCol.length) return;

  const migration = require('../migrations/20250522000015-graph-rag-and-snapshots');
  const qi = sequelize.getQueryInterface();
  await migration.up(qi, Sequelize);
}

/**
 * Daily LLM token usage (GET /api/chat/token-budget); partial deploys may skip migrate.
 */
async function ensureLlmUsageDailyTable() {
  const [tables] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'llm_usage_daily'`
  );
  if (tables.length) return;

  const migration = require('../migrations/20250523000003-create-llm-usage-daily');
  const qi = sequelize.getQueryInterface();
  await migration.up(qi, Sequelize);
}

/**
 * Test connection and initialize pgvector (tables may not exist yet).
 */
async function initializeDatabase() {
  await sequelize.authenticate();
  await ensurePgVectorExtension();
  await ensureXStepSapMetadataColumns();
  await ensureGraphRagSchema();
  await ensureLlmUsageDailyTable();
}

module.exports = {
  sequelize,
  ensurePgVectorExtension,
  ensureXStepEmbeddingColumn,
  ensureXStepSapMetadataColumns,
  ensureGraphRagSchema,
  ensureLlmUsageDailyTable,
  ensureDocumentChunkEmbeddingColumn,
  initializeDatabase,
};
