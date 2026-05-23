'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prompt_config_versions', {
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
      version_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      system_prompt: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      change_note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
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

    await queryInterface.addIndex('prompt_config_versions', ['prompt_config_id', 'version_number'], {
      unique: true,
      name: 'prompt_config_versions_config_version_uq',
    });
    await queryInterface.addIndex('prompt_config_versions', ['prompt_config_id', 'created_at'], {
      name: 'prompt_config_versions_config_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('prompt_config_versions');
  },
};
