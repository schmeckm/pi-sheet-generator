require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { initializeDatabase } = require('../config/database');
const { seedAll } = require('./seed-xsteps');

async function run() {
  try {
    await initializeDatabase();
    console.log('Running database seeds...');
    await seedAll();
    console.log('All seeds completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

run();
