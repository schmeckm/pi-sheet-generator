const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProcessGraphEdge = sequelize.define(
    'ProcessGraphEdge',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      process_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      edge_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      from_kind: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'xstep',
      },
      from_ref: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      to_kind: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'xstep',
      },
      to_ref: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'process_graph_edges',
      timestamps: true,
      underscored: true,
    }
  );

  return ProcessGraphEdge;
};
