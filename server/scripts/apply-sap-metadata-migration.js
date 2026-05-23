/**
 * One-off: apply 20250523000001-xstep-sap-system-tags when full db:migrate is blocked.
 * Usage: node scripts/apply-sap-metadata-migration.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Sequelize } = require('sequelize');
const migration = require('../migrations/20250523000001-xstep-sap-system-tags');
const config = require('../config/sequelize-cli').development;

const MIGRATION_NAME = '20250523000001-xstep-sap-system-tags.js';

async function main() {
  const sequelize = config.url
    ? new Sequelize(config.url, { logging: console.log })
    : new Sequelize(config.database, config.username, config.password, {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: console.log,
      });

  const qi = sequelize.getQueryInterface();
  const [existing] = await sequelize.query(
    `SELECT name FROM "SequelizeMeta" WHERE name = :name`,
    { replacements: { name: MIGRATION_NAME } }
  );
  if (existing.length) {
    console.log(`Already applied: ${MIGRATION_NAME}`);
    await sequelize.close();
    return;
  }

  await migration.up(qi, Sequelize);
  await sequelize.query(`INSERT INTO "SequelizeMeta" (name) VALUES (:name)`, {
    replacements: { name: MIGRATION_NAME },
  });
  console.log(`Applied: ${MIGRATION_NAME}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
