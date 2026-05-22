const { Op } = require('sequelize');
const { sequelize, PISheet, PISheetStep, EquipmentConfig, XStep } = require('../models');
const graphService = require('./graph.service');
const settingsService = require('./settings.service');
const sapService = require('./sap.service');

const DEFAULT_PLANTS = [
  { code: 'CH01', name: 'Basel' },
  { code: 'CH02', name: 'Stein' },
];

const SENSOR_TYPES = new Set(['sensor', 'temperature', 'scanner', 'humidity', 'pressure']);

function normalizePlants(raw) {
  if (!raw) return DEFAULT_PLANTS;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((p) =>
        typeof p === 'string' ? { code: p, name: p } : { code: p.code, name: p.name || p.code }
      );
    }
  } catch {
    /* use defaults */
  }
  return DEFAULT_PLANTS;
}

async function getConfiguredPlants() {
  const raw = await settingsService.get('production_plants').catch(() => null);
  return normalizePlants(raw);
}

function materialKeyFromParam(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('material')) return 'material';
  if (n.includes('charge') || n.includes('batch')) return 'batch';
  if (n.includes('stückliste') || n.includes('bom')) return 'bom';
  return null;
}

function extractMaterialsFromSteps(steps, piSheet) {
  const items = [];
  for (const step of steps || []) {
    for (const p of step.params || []) {
      const kind = materialKeyFromParam(p.name);
      if (!kind && p.type !== 'display') continue;
      const label = p.name || 'Parameter';
      const value = p.value || p.default || null;
      items.push({
        kind: kind || 'parameter',
        key: `${kind || 'param'}:${label}:${value || ''}`,
        label,
        value,
        pi_sheet_id: piSheet.id,
        pi_sheet_title: piSheet.title,
        step_nr: step.step_nr,
        xstep_id: step.xstep_id,
        step_name: step.name,
      });
    }
  }
  return items;
}

function groupMaterials(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = row.kind === 'material' && row.value ? String(row.value) : row.key;
    if (!map.has(id)) {
      map.set(id, {
        id,
        label: row.kind === 'material' && row.value ? row.value : row.label,
        kind: row.kind,
        occurrences: [],
      });
    }
    map.get(id).occurrences.push({
      pi_sheet_id: row.pi_sheet_id,
      pi_sheet_title: row.pi_sheet_title,
      step_nr: row.step_nr,
      xstep_id: row.xstep_id,
      step_name: row.step_name,
      param: row.label,
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

async function loadSapMaterials(plantCode) {
  try {
    const order = await sapService.getProcessOrder('1000234');
    if (!order?.bom_components?.length) return [];
    if (order.plant && order.plant !== plantCode) return [];
    return order.bom_components.map((c) => ({
      id: c.material,
      label: c.material,
      description: c.description,
      quantity: c.quantity,
      unit: c.unit,
      source: 'sap_bom',
      kind: 'material',
      occurrences: [],
    }));
  } catch {
    return [];
  }
}

function equipmentBucket(eq) {
  if (eq.equipment_type === 'scale') return 'scales';
  if (SENSOR_TYPES.has(eq.equipment_type)) return 'sensors';
  return 'other';
}

async function buildProcessViews(plantCode, piSheets) {
  const processTypes = [
    ...new Set(piSheets.map((s) => s.process_type).filter(Boolean)),
  ];
  if (!processTypes.length) processTypes.push('Verpackung');

  const views = [];
  for (const processType of processTypes) {
    const ctx = await graphService.getProcessContext(processType);
    const equipment = await EquipmentConfig.findAll({
      where: { plant: plantCode, is_active: true },
    });

    const graphEquipIds = new Set(
      (ctx.edges || [])
        .filter((e) => e.edge_type === 'USES_EQUIPMENT')
        .map((e) => e.to_ref)
    );
    const linkedEquipment = equipment.filter((e) => graphEquipIds.has(e.equipment_id));

    const xstepIds = ctx.chain?.length
      ? ctx.chain
      : [...new Set((piSheets.filter((s) => s.process_type === processType).flatMap((s) => s.steps || []).map((st) => st.xstep_id).filter(Boolean)))];

    const repoSteps = xstepIds.length
      ? await XStep.findAll({
          where: { xstep_id: { [Op.in]: xstepIds } },
          attributes: ['xstep_id', 'name', 'category', 'sap_transaction', 'gmp_relevant', 'params'],
        })
      : [];

    const byXstep = new Map(repoSteps.map((x) => [x.xstep_id, x]));
    const piForProcess = piSheets.filter((s) => s.process_type === processType);

    const xsteps = xstepIds.map((id, idx) => {
      const repo = byXstep.get(id);
      const sheetStep = piForProcess
        .flatMap((s) => (s.steps || []).map((st) => ({ ...st, pi_sheet_id: s.id, pi_sheet_title: s.title })))
        .find((st) => st.xstep_id === id);
      const equipForStep = (ctx.edges || [])
        .filter((e) => e.edge_type === 'USES_EQUIPMENT' && e.from_ref === id)
        .map((e) => e.to_ref);

      return {
        order: idx + 1,
        xstep_id: id,
        name: sheetStep?.name || repo?.name || id,
        category: sheetStep?.category || repo?.category,
        sap_transaction: repo?.sap_transaction,
        gmp_relevant: repo?.gmp_relevant,
        params: sheetStep?.params || repo?.params || [],
        equipment_ids: equipForStep,
        pi_sheet_refs: piForProcess
          .filter((s) => (s.steps || []).some((st) => st.xstep_id === id))
          .map((s) => ({ id: s.id, title: s.title, status: s.status })),
      };
    });

    const buckets = { scales: [], sensors: [], other: [] };
    for (const eq of linkedEquipment.length ? linkedEquipment : equipment) {
      const bucket = equipmentBucket(eq);
      const entry = {
        equipment_id: eq.equipment_id,
        name: eq.name,
        location: eq.location,
        is_online: eq.is_online,
        process_parameters: eq.process_parameters || [],
      };
      if (buckets[bucket]) buckets[bucket].push(entry);
      else buckets.other.push(entry);
    }

    views.push({
      process_type: processType,
      chain: ctx.chain || [],
      pi_sheet_count: piForProcess.length,
      xsteps,
      equipment: buckets,
    });
  }

  return views;
}

async function getPlantOverview() {
  const plants = await getConfiguredPlants();
  const counts = await PISheet.findAll({
    attributes: ['plant', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['plant'],
    raw: true,
  });
  const countMap = Object.fromEntries(counts.map((r) => [r.plant, Number(r.count)]));

  return plants.map((p) => ({
    code: p.code,
    name: p.name,
    pi_sheet_count: countMap[p.code] || 0,
  }));
}

async function getPlantDetail(plantCode) {
  const plants = await getConfiguredPlants();
  const plant = plants.find((p) => p.code === plantCode);
  if (!plant) {
    const err = new Error('Plant not found');
    err.statusCode = 404;
    throw err;
  }

  const piSheets = await PISheet.findAll({
    where: { plant: plantCode },
    order: [['updated_at', 'DESC']],
    include: [{ association: 'steps', separate: true, order: [['sort_order', 'ASC']] }],
  });

  const materialRows = [];
  for (const sheet of piSheets) {
    materialRows.push(...extractMaterialsFromSteps(sheet.steps, sheet));
  }
  const fromSteps = groupMaterials(materialRows);
  const fromSap = await loadSapMaterials(plantCode);
  const sapIds = new Set(fromSap.map((m) => m.id));
  const materials = [
    ...fromSap,
    ...fromSteps.filter((m) => !sapIds.has(m.id)),
  ];

  const equipmentAll = await EquipmentConfig.findAll({
    where: { plant: plantCode, is_active: true },
    order: [['equipment_id', 'ASC']],
  });

  const processes = await buildProcessViews(plantCode, piSheets);

  return {
    plant: { code: plant.code, name: plant.name },
    summary: {
      pi_sheets: piSheets.length,
      materials: materials.length,
      scales: equipmentAll.filter((e) => e.equipment_type === 'scale').length,
      sensors: equipmentAll.filter((e) => SENSOR_TYPES.has(e.equipment_type)).length,
      processes: processes.length,
    },
    pi_sheets: piSheets.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      process_type: s.process_type,
      order_number: s.order_number,
      batch_number: s.batch_number,
      step_count: s.steps?.length || 0,
      updated_at: s.updated_at,
    })),
    materials,
    processes,
    equipment: {
      scales: equipmentAll.filter((e) => e.equipment_type === 'scale').map((e) => ({
        equipment_id: e.equipment_id,
        name: e.name,
        location: e.location,
        process_parameters: e.process_parameters,
      })),
      sensors: equipmentAll.filter((e) => SENSOR_TYPES.has(e.equipment_type)).map((e) => ({
        equipment_id: e.equipment_id,
        name: e.name,
        equipment_type: e.equipment_type,
        location: e.location,
        process_parameters: e.process_parameters,
      })),
    },
  };
}

module.exports = {
  getPlantOverview,
  getPlantDetail,
  getConfiguredPlants,
  DEFAULT_PLANTS,
};
