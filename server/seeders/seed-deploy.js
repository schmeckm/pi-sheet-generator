/**
 * Portainer / Docker deploy seed — idempotent DB baseline after migrations.
 *
 * Runs on every API container start (docker-entrypoint.sh).
 *
 * Always: pgvector + schema patches, system settings, process graph, demo equipment.
 * Demo (AUTO_SEED=true, default): users, prompt configs, sample XSteps.
 * Empty DB + AUTO_SEED=false: still bootstraps users/XSteps once (no users yet).
 *
 * Manual: node seeders/seed-deploy.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize, initializeDatabase } = require('../config/database');
const { User } = require('../models');
const { seedSettings } = require('./seed-settings');
const { seedGraph } = require('./seed-graph');
const { seedEquipment } = require('./seed-equipment');
const { seedUsers, seedPromptConfig, seedXSteps } = require('./seed-xsteps');

function isDemoSeedEnabled() {
  const v = String(process.env.AUTO_SEED ?? 'true').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * @param {{ demoData?: boolean }} [options]
 */
async function seedDeploy(options = {}) {
  const demoData = options.demoData ?? isDemoSeedEnabled();

  console.log('=== Deploy seed: preparing database ===');

  await initializeDatabase();
  console.log('[deploy-seed] DB connected, extensions/schema patches OK');

  await seedSettings();
  await seedGraph();
  await seedEquipment();

  const userCount = await User.count();
  const runDemo = demoData || userCount === 0;

  if (runDemo) {
    const admin = await seedUsers();
    await seedPromptConfig(admin.id);
    await seedXSteps(admin.id);
    if (!demoData && userCount === 0) {
      console.log('[deploy-seed] Bootstrap: users/XSteps (empty DB, AUTO_SEED=false)');
    }
  } else {
    console.log('[deploy-seed] Demo users/XSteps skipped (AUTO_SEED=false, users exist)');
  }

  console.log('=== Deploy seed complete ===');
}

async function main() {
  try {
    await seedDeploy();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Deploy seed failed:', err);
    try {
      await sequelize.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDeploy, isDemoSeedEnabled };
