'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'preferred_locale', {
      type: Sequelize.STRING(5),
      allowNull: false,
      defaultValue: 'de',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'preferred_locale');
  },
};
