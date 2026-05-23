'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('llm_usage_daily', {
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
      usage_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      total_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      request_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
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

    await queryInterface.addIndex('llm_usage_daily', ['user_id', 'usage_date'], {
      unique: true,
      name: 'llm_usage_daily_user_date_uq',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('llm_usage_daily');
  },
};
