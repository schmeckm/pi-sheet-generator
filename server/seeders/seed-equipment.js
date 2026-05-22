/**
 * Runnable seed: node seeders/seed-equipment.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize, initializeDatabase } = require('../config/database');
const { EquipmentConfig } = require('../models');
const {
  SCALE_PROCESS_PARAMETERS,
  TEMPERATURE_PROCESS_PARAMETERS,
} = require('../services/equipment/constants');

const EQUIPMENT = [
  {
    equipment_id: 'W-GR-04',
    name: 'Mettler Toledo ICS689',
    equipment_type: 'scale',
    location: 'Gebäude 42, Linie VP-03',
    connection_type: 'simulation',
    connection_config: { updateRate: 100, noise: 0.002, maxWeight: 50.0, resolution: 0.001 },
    scale_config: {
      maxCapacity: 50.0,
      resolution: 0.001,
      unit: 'kg',
      calibrationInterval: 365,
      lastCalibration: '2025-12-01',
    },
    process_parameters: SCALE_PROCESS_PARAMETERS,
    is_active: true,
  },
  {
    equipment_id: 'W-GR-05',
    name: 'Sartorius Entris II',
    equipment_type: 'scale',
    location: 'Gebäude 42, Linie VP-03',
    connection_type: 'simulation',
    connection_config: { updateRate: 100, noise: 0.0005, maxWeight: 10.0, resolution: 0.00001 },
    scale_config: {
      maxCapacity: 10.0,
      resolution: 0.00001,
      unit: 'kg',
      calibrationInterval: 365,
      lastCalibration: '2026-01-15',
    },
    process_parameters: SCALE_PROCESS_PARAMETERS,
    is_active: true,
  },
  {
    equipment_id: 'T-GR-01',
    name: 'Endress+Hauser TMP-01',
    equipment_type: 'temperature',
    location: 'Gebäude 42, Granulation',
    connection_type: 'simulation',
    connection_config: { updateRate: 1000, initialTemp: 22.5 },
    scale_config: {},
    process_parameters: TEMPERATURE_PROCESS_PARAMETERS,
    is_active: true,
  },
];

async function main() {
  await initializeDatabase();
  for (const row of EQUIPMENT) {
    const [record, created] = await EquipmentConfig.findOrCreate({
      where: { equipment_id: row.equipment_id },
      defaults: row,
    });
    if (!created) {
      await record.update(row);
    }
    console.log(`${created ? 'Created' : 'Updated'} equipment ${row.equipment_id}`);
  }
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
