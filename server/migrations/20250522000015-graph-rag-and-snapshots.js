'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pi_sheets', 'graph_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.createTable('graph_edge_suggestions', {
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
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'knowledge_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      chunk_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'document_chunks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      source_excerpt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('graph_edge_suggestions', ['status']);
    await queryInterface.addIndex('graph_edge_suggestions', ['document_id']);
    await queryInterface.addIndex(
      'graph_edge_suggestions',
      ['process_type', 'edge_type', 'from_ref', 'to_ref', 'status'],
      { name: 'graph_edge_suggestions_dedupe' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('graph_edge_suggestions');
    await queryInterface.removeColumn('pi_sheets', 'graph_snapshot');
  },
};
