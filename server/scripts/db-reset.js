require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize, initializeDatabase } = require('../config/database');
require('../models');
const { seedAll } = require('../seeders/seed-xsteps');

async function reset() {
  try {
    await initializeDatabase();
    await sequelize.drop();
    await sequelize.sync();
    const { ensureXStepEmbeddingColumn } = require('../config/database');
    await ensureXStepEmbeddingColumn();
    console.log('Database dropped and recreated.');
    await seedAll();
    console.log('db:reset completed.');
    process.exit(0);
  } catch (err) {
    console.error('db:reset failed:', err.message);
    process.exit(1);
  }
}

reset();
