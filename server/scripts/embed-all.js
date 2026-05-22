require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { initializeDatabase } = require('../config/database');
const embeddingService = require('../services/embedding.service');

async function run() {
  await initializeDatabase();
  const result = await embeddingService.embedAllXSteps();
  console.log('Embedding complete:', result);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
