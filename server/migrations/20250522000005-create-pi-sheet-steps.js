'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pi_sheet_steps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      pi_sheet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pi_sheets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      step_nr: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      xstep_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      instruction: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      params: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_suggestion: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pi_sheet_steps');
  },
};
