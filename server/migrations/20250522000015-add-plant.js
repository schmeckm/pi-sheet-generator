'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    async function columnExists(tableName, columnName) {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        { bind: [tableName, columnName] }
      );
      return rows.length > 0;
    }

    if (!(await columnExists('pi_sheets', 'plant'))) {
      await queryInterface.addColumn('pi_sheets', 'plant', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'CH01',
      });
    }
    if (!(await columnExists('equipment_configs', 'plant'))) {
      await queryInterface.addColumn('equipment_configs', 'plant', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'CH01',
      });
    }
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS pi_sheets_plant ON pi_sheets (plant);'
    );
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS equipment_configs_plant ON equipment_configs (plant);'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('equipment_configs', ['plant']);
    await queryInterface.removeIndex('pi_sheets', ['plant']);
    await queryInterface.removeColumn('equipment_configs', 'plant');
    await queryInterface.removeColumn('pi_sheets', 'plant');
  },
};
