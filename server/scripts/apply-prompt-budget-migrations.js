/**
 * Idempotent apply for prompt_config_versions + llm_usage_daily
 * when sequelize-cli db:migrate is blocked by older partial migrations.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize } = require('../models');

const MIGRATIONS = [
  '20250523000002-create-prompt-config-versions.js',
  '20250523000003-create-llm-usage-daily.js',
];

async function ensureMeta(name) {
  const [rows] = await sequelize.query(
    `SELECT name FROM "SequelizeMeta" WHERE name = :name`,
    { replacements: { name } }
  );
  if (!rows?.length) {
    await sequelize.query(`INSERT INTO "SequelizeMeta" (name) VALUES (:name)`, {
      replacements: { name },
    });
    console.log(`SequelizeMeta: ${name}`);
  }
}

async function main() {
  const qi = sequelize.getQueryInterface();
  const { Sequelize } = require('sequelize');

  const tables = await qi.showAllTables();
  const has = (t) => tables.includes(t) || tables.includes(`public.${t}`);

  if (!has('prompt_config_versions')) {
    await qi.createTable('prompt_config_versions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      prompt_config_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'prompt_configs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      version_number: { type: Sequelize.INTEGER, allowNull: false },
      system_prompt: { type: Sequelize.TEXT, allowNull: false },
      change_note: { type: Sequelize.STRING(500), allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await qi.addIndex('prompt_config_versions', ['prompt_config_id', 'version_number'], {
      unique: true,
      name: 'prompt_config_versions_config_version_uq',
    });
    console.log('Created prompt_config_versions');
  } else {
    console.log('prompt_config_versions already exists');
  }

  if (!has('llm_usage_daily')) {
    await qi.createTable('llm_usage_daily', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      usage_date: { type: Sequelize.DATEONLY, allowNull: false },
      total_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      request_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await qi.addIndex('llm_usage_daily', ['user_id', 'usage_date'], {
      unique: true,
      name: 'llm_usage_daily_user_date_uq',
    });
    console.log('Created llm_usage_daily');
  } else {
    console.log('llm_usage_daily already exists');
  }

  for (const name of MIGRATIONS) {
    await ensureMeta(name);
  }

  await sequelize.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
