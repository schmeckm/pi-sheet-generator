/**
 * Applies xstep sap_system/tags columns when full sequelize-cli migrate cannot run.
 */
const Sequelize = require('sequelize');
const { sequelize } = require('../models');
const migration = require('../migrations/20250523000001-xstep-sap-system-tags');

const MIGRATION_NAME = '20250523000001-xstep-sap-system-tags.js';

async function main() {
  const qi = sequelize.getQueryInterface();
  let desc;
  try {
    desc = await qi.describeTable('xsteps');
  } catch {
    console.log('xsteps table missing — skip.');
    process.exit(0);
  }

  if (desc.sap_system && desc.tags) {
    console.log('SAP metadata columns already present — skip.');
    process.exit(0);
  }

  await migration.up(qi, Sequelize);

  const [existing] = await sequelize.query(
    `SELECT name FROM "SequelizeMeta" WHERE name = :name`,
    { replacements: { name: MIGRATION_NAME } }
  );
  if (!existing.length) {
    await sequelize.query(`INSERT INTO "SequelizeMeta" (name) VALUES (:name)`, {
      replacements: { name: MIGRATION_NAME },
    });
  }

  console.log('SAP metadata migration applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
