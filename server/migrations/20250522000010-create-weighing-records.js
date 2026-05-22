'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weighing_records', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      pi_sheet_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'pi_sheets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      pi_sheet_step_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'pi_sheet_steps', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      equipment_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        references: { model: 'equipment_configs', key: 'equipment_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      gross_weight: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      tare_weight: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      net_weight: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      unit: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'kg',
      },
      target_weight: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      tolerance_abs: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      tolerance_pct: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      deviation: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      in_tolerance: { type: Sequelize.BOOLEAN, allowNull: true },
      material_number: { type: Sequelize.STRING(50), allowNull: true },
      material_name: { type: Sequelize.STRING(255), allowNull: true },
      batch_number: { type: Sequelize.STRING(50), allowNull: true },
      stable_reading: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      reading_count: { type: Sequelize.INTEGER, allowNull: true },
      stability_duration_ms: { type: Sequelize.INTEGER, allowNull: true },
      weighed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      verified_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      weighed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      raw_readings: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      connection_source: {
        type: Sequelize.STRING(50),
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
    await queryInterface.addIndex('weighing_records', ['equipment_id']);
    await queryInterface.addIndex('weighing_records', ['pi_sheet_id']);
    await queryInterface.addIndex('weighing_records', ['weighed_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('weighing_records');
  },
};
