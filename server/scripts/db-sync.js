require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const {
  sequelize,
  initializeDatabase,
  ensureXStepEmbeddingColumn,
  ensureDocumentChunkEmbeddingColumn,
} = require('../config/database');
require('../models');

async function sync() {
  try {
    await initializeDatabase();
    await sequelize.sync({ alter: true });
    await ensureXStepEmbeddingColumn();
    await ensureDocumentChunkEmbeddingColumn();
    console.log('Database synced (tables + pgvector extension).');
    process.exit(0);
  } catch (err) {
    console.error('db:sync failed:', err.message);
    process.exit(1);
  }
}

sync();
