const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EquipmentConfig = sequelize.define(
    'EquipmentConfig',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      equipment_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      equipment_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      plant: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'CH01',
      },
      connection_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'simulation',
      },
      connection_config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      scale_config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      process_parameters: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_online: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_seen: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'equipment_configs',
      timestamps: true,
      underscored: true,
    }
  );

  return EquipmentConfig;
};
