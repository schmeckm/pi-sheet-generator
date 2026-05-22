const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PISheet = sequelize.define(
    'PISheet',
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
      process_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      user_prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      llm_response: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'draft',
      },
      notes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      warnings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      batch_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      order_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      submitted_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      review_comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      graph_snapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: 'pi_sheets',
      timestamps: true,
      underscored: true,
    }
  );

  return PISheet;
};
