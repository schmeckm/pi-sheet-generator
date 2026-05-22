const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DocumentChunk = sequelize.define(
    'DocumentChunk',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      document_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      chunk_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      page_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: 'document_chunks',
      timestamps: true,
      underscored: true,
    }
  );

  return DocumentChunk;
};
