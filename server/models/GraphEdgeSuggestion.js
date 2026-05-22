const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GraphEdgeSuggestion = sequelize.define(
    'GraphEdgeSuggestion',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      process_type: { type: DataTypes.STRING(100), allowNull: false },
      edge_type: { type: DataTypes.STRING(50), allowNull: false },
      from_kind: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'xstep' },
      from_ref: { type: DataTypes.STRING(100), allowNull: false },
      to_kind: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'xstep' },
      to_ref: { type: DataTypes.STRING(100), allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
      document_id: { type: DataTypes.UUID, allowNull: true },
      chunk_id: { type: DataTypes.UUID, allowNull: true },
      source_excerpt: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      reviewed_by: { type: DataTypes.UUID, allowNull: true },
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'graph_edge_suggestions',
      timestamps: true,
      underscored: true,
    }
  );

  return GraphEdgeSuggestion;
};
