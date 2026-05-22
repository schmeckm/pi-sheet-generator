'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    async function tableExists(tableName) {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        { bind: [tableName] }
      );
      return rows.length > 0;
    }

    async function columnExists(tableName, columnName) {
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        { bind: [tableName, columnName] }
      );
      return rows.length > 0;
    }

    if (!(await tableExists('knowledge_documents'))) {
      await queryInterface.createTable('knowledge_documents', {
        id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      file_path: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      file_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      process_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'processing',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      page_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chunk_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      uploaded_by: {
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
    }

    if (!(await tableExists('document_chunks'))) {
      await queryInterface.createTable('document_chunks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'knowledge_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      chunk_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      page_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
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
    }

    if (!(await columnExists('document_chunks', 'embedding'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE document_chunks ADD COLUMN embedding vector(1536);'
      );
    }

    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS document_chunks_document_id ON document_chunks (document_id);'
    );
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS knowledge_documents_status ON knowledge_documents (status);'
    );
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS knowledge_documents_process_type ON knowledge_documents (process_type);'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_chunks');
    await queryInterface.dropTable('knowledge_documents');
  },
};
