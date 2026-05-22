const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PromptConfig = sequelize.define(
    'PromptConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      system_prompt: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'prompt_configs',
      timestamps: true,
      underscored: true,
    }
  );

  return PromptConfig;
};
