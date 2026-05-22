'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('xsteps')) {
      const desc = await queryInterface.describeTable('xsteps');
      if (!desc.embedding) {
        await queryInterface.sequelize.query(
          'ALTER TABLE xsteps ADD COLUMN IF NOT EXISTS embedding vector(1536);'
        );
      }
      return;
    }

    await queryInterface.createTable('xsteps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      xstep_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      process_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      instruction_template: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      params: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      sap_transaction: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      movement_type: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      gmp_relevant: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      signature_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.sequelize.query(
      'ALTER TABLE xsteps ADD COLUMN embedding vector(1536);'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('xsteps');
  },
};
