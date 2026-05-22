'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('process_graph_edges', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      process_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      edge_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      from_kind: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'xstep',
      },
      from_ref: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      to_kind: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'xstep',
      },
      to_ref: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
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
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('process_graph_edges', ['process_type']);
    await queryInterface.addIndex('process_graph_edges', ['edge_type']);
    await queryInterface.addIndex('process_graph_edges', ['from_ref', 'to_ref']);
    await queryInterface.addIndex(
      'process_graph_edges',
      ['process_type', 'edge_type', 'from_ref', 'to_ref'],
      { unique: true, name: 'process_graph_edges_unique_edge' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('process_graph_edges');
  },
};
