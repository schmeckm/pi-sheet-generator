const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const XStep = sequelize.define(
    'XStep',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      xstep_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      process_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      instruction_template: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      params: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      sap_transaction: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      movement_type: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      gmp_relevant: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      signature_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'xsteps',
      timestamps: true,
      underscored: true,
    }
  );

  return XStep;
};
