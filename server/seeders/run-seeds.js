/** @deprecated Use seed-deploy.js — kept for scripts that still call run-seeds */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { seedDeploy } = require('./seed-deploy');
const { sequelize } = require('../config/database');

async function run() {
  try {
    await seedDeploy();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

run();
