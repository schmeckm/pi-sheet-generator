const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LlmUsageDaily = sequelize.define(
    'LlmUsageDaily',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      usage_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      total_tokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      request_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'llm_usage_daily',
      timestamps: true,
      underscored: true,
    }
  );

  return LlmUsageDaily;
};
