const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WeighingRecord = sequelize.define(
    'WeighingRecord',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pi_sheet_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      pi_sheet_step_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      equipment_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      gross_weight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      tare_weight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      net_weight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      unit: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'kg',
      },
      target_weight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      tolerance_abs: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      tolerance_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      deviation: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      in_tolerance: { type: DataTypes.BOOLEAN, allowNull: true },
      material_number: { type: DataTypes.STRING(50), allowNull: true },
      material_name: { type: DataTypes.STRING(255), allowNull: true },
      batch_number: { type: DataTypes.STRING(50), allowNull: true },
      stable_reading: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      reading_count: { type: DataTypes.INTEGER, allowNull: true },
      stability_duration_ms: { type: DataTypes.INTEGER, allowNull: true },
      weighed_by: { type: DataTypes.UUID, allowNull: true },
      verified_by: { type: DataTypes.UUID, allowNull: true },
      weighed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      verified_at: { type: DataTypes.DATE, allowNull: true },
      raw_readings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      connection_source: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: 'weighing_records',
      timestamps: true,
      underscored: true,
    }
  );

  return WeighingRecord;
};
