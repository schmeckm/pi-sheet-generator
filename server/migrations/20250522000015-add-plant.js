'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pi_sheets', 'plant', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'CH01',
    });
    await queryInterface.addColumn('equipment_configs', 'plant', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'CH01',
    });
    await queryInterface.addIndex('pi_sheets', ['plant']);
    await queryInterface.addIndex('equipment_configs', ['plant']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('equipment_configs', ['plant']);
    await queryInterface.removeIndex('pi_sheets', ['plant']);
    await queryInterface.removeColumn('equipment_configs', 'plant');
    await queryInterface.removeColumn('pi_sheets', 'plant');
  },
};
