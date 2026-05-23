const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PromptConfigVersion = sequelize.define(
    'PromptConfigVersion',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      prompt_config_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      version_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      system_prompt: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      change_note: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'prompt_config_versions',
      timestamps: true,
      updatedAt: false,
      underscored: true,
    }
  );

  return PromptConfigVersion;
};
