const { FIELD_ALIASES } = require('./constants');

function normalizeFieldName(name) {
  if (!name) return null;
  const key = String(name).replace(/[_\s-]/g, '').toLowerCase();
  return FIELD_ALIASES[key] || name;
}

function normalizeScaleValues(raw = {}) {
  const values = {
    grossWeight: 0,
    netWeight: 0,
    tareWeight: 0,
    stable: false,
    unit: 'kg',
    overload: false,
    status: 0,
    calibrationDate: null,
  };

  for (const [key, val] of Object.entries(raw)) {
    const field = normalizeFieldName(key);
    if (field && Object.prototype.hasOwnProperty.call(values, field)) {
      values[field] = val;
    }
  }

  if (values.grossWeight == null && values.netWeight != null && values.tareWeight != null) {
    values.grossWeight = Number(values.netWeight) + Number(values.tareWeight);
  }

  return values;
}

function buildNormalizedPayload(equipmentId, equipmentType, values, source, timestamp = Date.now()) {
  return {
    equipmentId,
    equipmentType,
    timestamp,
    values: equipmentType === 'scale' ? normalizeScaleValues(values) : values,
    source,
  };
}

module.exports = { normalizeFieldName, normalizeScaleValues, buildNormalizedPayload };
