'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pi_sheets', 'batch_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('pi_sheets', 'order_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('pi_sheets', 'submitted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('pi_sheets', 'submitted_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('pi_sheets', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('pi_sheets', 'approved_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('pi_sheets', 'review_comment', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pi_sheets', 'review_comment');
    await queryInterface.removeColumn('pi_sheets', 'approved_by');
    await queryInterface.removeColumn('pi_sheets', 'approved_at');
    await queryInterface.removeColumn('pi_sheets', 'submitted_by');
    await queryInterface.removeColumn('pi_sheets', 'submitted_at');
    await queryInterface.removeColumn('pi_sheets', 'order_number');
    await queryInterface.removeColumn('pi_sheets', 'batch_number');
  },
};
