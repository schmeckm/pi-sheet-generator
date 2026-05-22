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

async function ensureDocumentChunkEmbeddingColumn() {
  return ensureEmbeddingColumn('document_chunks');
}

/**
 * Test connection and initialize pgvector (tables may not exist yet).
 */
async function initializeDatabase() {
  await sequelize.authenticate();
  await ensurePgVectorExtension();
}

module.exports = {
  sequelize,
  ensurePgVectorExtension,
  ensureXStepEmbeddingColumn,
  ensureDocumentChunkEmbeddingColumn,
  initializeDatabase,
};
