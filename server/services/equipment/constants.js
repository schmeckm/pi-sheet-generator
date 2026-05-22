const SCALE_PROCESS_PARAMETERS = [
  { name: 'GrossWeight', dataType: 'Float', unit: 'kg', description: 'Brutto-Gewicht', readable: true, writable: false },
  { name: 'NetWeight', dataType: 'Float', unit: 'kg', description: 'Netto-Gewicht nach Tara', readable: true, writable: false },
  { name: 'TareWeight', dataType: 'Float', unit: 'kg', description: 'Tara-Gewicht', readable: true, writable: false },
  { name: 'Stable', dataType: 'Boolean', unit: '', description: 'Messwert ist stabil', readable: true, writable: false },
  { name: 'Unit', dataType: 'String', unit: '', description: 'Aktuelle Einheit', readable: true, writable: false },
  { name: 'Overload', dataType: 'Boolean', unit: '', description: 'Überlast-Warnung', readable: true, writable: false },
  { name: 'Status', dataType: 'Int', unit: '', description: '0=OK, 1=Error, 2=Calibrating', readable: true, writable: false },
  { name: 'CalibrationDate', dataType: 'DateTime', unit: '', description: 'Letzte Kalibrierung', readable: true, writable: false },
];

const TEMPERATURE_PROCESS_PARAMETERS = [
  { name: 'Temperature', dataType: 'Float', unit: '°C', description: 'Prozesstemperatur', readable: true, writable: false },
  { name: 'Stable', dataType: 'Boolean', unit: '', description: 'Messwert ist stabil', readable: true, writable: false },
  { name: 'Unit', dataType: 'String', unit: '', description: 'Einheit', readable: true, writable: false },
  { name: 'Status', dataType: 'Int', unit: '', description: '0=OK, 1=Error', readable: true, writable: false },
];

const EQUIPMENT_TYPES = ['scale', 'temperature', 'barcode', 'ph_meter', 'timer'];
const CONNECTION_TYPES = ['simulation', 'opcua', 'mqtt', 'uns_sparkplug'];

const FIELD_ALIASES = {
  grossweight: 'grossWeight',
  brutto: 'grossWeight',
  netweight: 'netWeight',
  netto: 'netWeight',
  tareweight: 'tareWeight',
  tara: 'tareWeight',
  stable: 'stable',
  unit: 'unit',
  overload: 'overload',
  status: 'status',
  calibrationdate: 'calibrationDate',
  temperature: 'temperature',
};

module.exports = {
  SCALE_PROCESS_PARAMETERS,
  TEMPERATURE_PROCESS_PARAMETERS,
  EQUIPMENT_TYPES,
  CONNECTION_TYPES,
  FIELD_ALIASES,
};
