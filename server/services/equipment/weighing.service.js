const { Op } = require('sequelize');
const { WeighingRecord, User } = require('../../models');
const gateway = require('./gateway.service');

const activeSessions = new Map();

class WeighingService {
  async startWeighing(equipmentId, params = {}) {
    await gateway.connect(equipmentId);

    const sessionId = `${equipmentId}-${Date.now()}`;
    const readings = [];
    let stableSince = null;

    const unsubscribe = gateway.subscribe(equipmentId, (payload) => {
      if (payload.type === 'status') return;
      const ts = payload.timestamp || Date.now();
      readings.push({
        timestamp: ts,
        gross: payload.values?.grossWeight,
        net: payload.values?.netWeight,
        tare: payload.values?.tareWeight,
        stable: payload.values?.stable,
      });

      if (payload.values?.stable) {
        if (!stableSince) stableSince = ts;
      } else {
        stableSince = null;
      }
    });

    activeSessions.set(sessionId, {
      equipmentId,
      params,
      readings,
      unsubscribe,
      stableSince,
      startedAt: Date.now(),
    });

    return { sessionId, equipmentId };
  }

  async confirmWeighing(sessionId, userId, override = {}) {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Weighing session not found or expired');

    session.unsubscribe();
    activeSessions.delete(sessionId);

    const live = gateway.getCurrentValue(session.equipmentId);
    const values = live?.values || {};
    const params = { ...session.params, ...override };

    const netWeight = Number(values.netWeight ?? override.net_weight ?? 0);
    const grossWeight = Number(values.grossWeight ?? override.gross_weight ?? netWeight);
    const tareWeight = Number(values.tareWeight ?? override.tare_weight ?? 0);
    const targetWeight = params.targetWeight != null ? Number(params.targetWeight) : null;
    const toleranceAbs =
      params.toleranceAbs != null
        ? Number(params.toleranceAbs)
        : targetWeight && params.tolerancePct
          ? (targetWeight * Number(params.tolerancePct)) / 100
          : null;

    let deviation = null;
    let inTolerance = null;
    if (targetWeight != null) {
      deviation = netWeight - targetWeight;
      if (toleranceAbs != null) {
        inTolerance = Math.abs(deviation) <= toleranceAbs;
      }
    }

    const stabilityDurationMs =
      session.stableSince && session.readings.length
        ? session.readings[session.readings.length - 1].timestamp - session.stableSince
        : null;

    const record = await WeighingRecord.create({
      pi_sheet_id: params.piSheetId || null,
      pi_sheet_step_id: params.piSheetStepId || null,
      equipment_id: session.equipmentId,
      gross_weight: grossWeight,
      tare_weight: tareWeight,
      net_weight: netWeight,
      unit: values.unit || 'kg',
      target_weight: targetWeight,
      tolerance_abs: toleranceAbs,
      tolerance_pct: params.tolerancePct ?? null,
      deviation,
      in_tolerance: inTolerance,
      material_number: params.materialNumber || null,
      material_name: params.materialName || null,
      batch_number: params.batchNumber || null,
      stable_reading: Boolean(values.stable),
      reading_count: session.readings.length,
      stability_duration_ms: stabilityDurationMs,
      weighed_by: userId,
      weighed_at: new Date(),
      raw_readings: session.readings,
      connection_source: live?.source || gateway.getStatus(session.equipmentId).actual_source,
    });

    return record;
  }

  async verifyWeighing(weighingId, verifierId) {
    const record = await WeighingRecord.findByPk(weighingId);
    if (!record) throw new Error('Weighing record not found');
    if (record.verified_by) throw new Error('Already verified');

    await record.update({
      verified_by: verifierId,
      verified_at: new Date(),
    });

    return record;
  }

  async getWeighingHistory(filters = {}) {
    const where = {};
    if (filters.piSheetId) where.pi_sheet_id = filters.piSheetId;
    if (filters.equipmentId) where.equipment_id = filters.equipmentId;
    if (filters.inTolerance !== undefined) where.in_tolerance = filters.inTolerance;
    if (filters.from || filters.to) {
      where.weighed_at = {};
      if (filters.from) where.weighed_at[Op.gte] = new Date(filters.from);
      if (filters.to) where.weighed_at[Op.lte] = new Date(filters.to);
    }

    const rows = await WeighingRecord.findAll({
      where,
      order: [['weighed_at', 'DESC']],
      limit: filters.limit || 50,
      attributes: {
        exclude: ['raw_readings'],
      },
      include: [
        { model: User, as: 'weighedBy', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'verifiedBy', attributes: ['id', 'name', 'email'] },
      ],
    });

    return rows.map((r) => {
      const json = r.toJSON();
      json.raw_readings_count = Array.isArray(r.raw_readings) ? r.raw_readings.length : 0;
      return json;
    });
  }

  async getWeighingAudit(weighingId) {
    const record = await WeighingRecord.findByPk(weighingId, {
      include: [
        { model: User, as: 'weighedBy', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'verifiedBy', attributes: ['id', 'name', 'email'] },
      ],
    });
    if (!record) throw new Error('Weighing record not found');
    return record;
  }

  async getStats(filters = {}) {
    const where = {};
    if (filters.equipmentId) where.equipment_id = filters.equipmentId;

    const records = await WeighingRecord.findAll({
      where,
      attributes: ['equipment_id', 'deviation', 'in_tolerance', 'net_weight', 'target_weight'],
    });

    const total = records.length;
    const inTol = records.filter((r) => r.in_tolerance === true).length;
    const deviations = records
      .map((r) => Number(r.deviation))
      .filter((d) => !Number.isNaN(d));

    const byEquipment = {};
    for (const r of records) {
      byEquipment[r.equipment_id] = (byEquipment[r.equipment_id] || 0) + 1;
    }

    return {
      total,
      in_tolerance_count: inTol,
      in_tolerance_pct: total ? Math.round((inTol / total) * 1000) / 10 : 0,
      avg_deviation:
        deviations.length
          ? deviations.reduce((a, b) => a + b, 0) / deviations.length
          : null,
      by_equipment: byEquipment,
    };
  }

  async createRecord(data, userId) {
    const live = gateway.getCurrentValue(data.equipment_id);
    const values = data.values || live?.values || {};

    const netWeight = Number(data.net_weight ?? values.netWeight ?? 0);
    const targetWeight = data.target_weight != null ? Number(data.target_weight) : null;
    const toleranceAbs = data.tolerance_abs != null ? Number(data.tolerance_abs) : null;
    let deviation = null;
    let inTolerance = data.in_tolerance;

    if (targetWeight != null) {
      deviation = netWeight - targetWeight;
      if (toleranceAbs != null) inTolerance = Math.abs(deviation) <= toleranceAbs;
    }

    return WeighingRecord.create({
      pi_sheet_id: data.pi_sheet_id || null,
      pi_sheet_step_id: data.pi_sheet_step_id || null,
      equipment_id: data.equipment_id,
      gross_weight: data.gross_weight ?? values.grossWeight,
      tare_weight: data.tare_weight ?? values.tareWeight,
      net_weight: netWeight,
      unit: data.unit || values.unit || 'kg',
      target_weight: targetWeight,
      tolerance_abs: toleranceAbs,
      tolerance_pct: data.tolerance_pct,
      deviation,
      in_tolerance: inTolerance,
      material_number: data.material_number,
      material_name: data.material_name,
      batch_number: data.batch_number,
      stable_reading: data.stable_reading ?? values.stable ?? true,
      reading_count: data.reading_count,
      stability_duration_ms: data.stability_duration_ms,
      weighed_by: userId,
      raw_readings: data.raw_readings || [],
      connection_source: data.connection_source || live?.source,
    });
  }
}

module.exports = new WeighingService();
