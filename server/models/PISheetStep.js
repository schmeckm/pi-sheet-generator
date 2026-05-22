const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PISheetStep = sequelize.define(
    'PISheetStep',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pi_sheet_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      step_nr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      xstep_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      instruction: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      params: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_suggestion: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'pi_sheet_steps',
      timestamps: false,
      underscored: true,
    }
  );

  return PISheetStep;
};
