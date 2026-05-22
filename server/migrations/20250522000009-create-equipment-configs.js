'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipment_configs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      equipment_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      equipment_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      connection_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'simulation',
      },
      connection_config: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      scale_config: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      process_parameters: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
    await queryInterface.addIndex('equipment_configs', ['equipment_type']);
    await queryInterface.addIndex('equipment_configs', ['location']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('equipment_configs');
  },
};
