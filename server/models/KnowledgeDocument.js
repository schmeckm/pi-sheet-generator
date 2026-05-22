const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const KnowledgeDocument = sequelize.define(
    'KnowledgeDocument',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      file_path: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      file_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      process_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'processing',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      page_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      chunk_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      uploaded_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'knowledge_documents',
      timestamps: true,
      underscored: true,
    }
  );

  return KnowledgeDocument;
};
