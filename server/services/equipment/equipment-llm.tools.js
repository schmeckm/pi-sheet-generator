const gateway = require('./gateway.service');
const { EquipmentConfig } = require('../../models');
const { withTimeout } = require('../../utils/withTimeout');

const SLOW_TOOL_TIMEOUT_MS = 15000;
const FAST_TOOLS = new Set(['list_equipment', 'get_equipment_config']);

const EQUIPMENT_TOOL_DEFINITIONS = [
  {
    name: 'list_equipment',
    description:
      'List configured production equipment (scales, sensors, scanners) with optional filters.',
    input_schema: {
      type: 'object',
      properties: {
        equipment_type: {
          type: 'string',
          enum: ['scale', 'temperature', 'barcode', 'ph_meter', 'timer', 'all'],
          description: 'Filter by equipment type',
        },
        location: {
          type: 'string',
          description: "Filter by location or line, e.g. 'VP-03' or 'Gebäude 42'",
        },
        online_only: {
          type: 'boolean',
          description: 'Only return currently online/connected equipment',
        },
        active_only: {
          type: 'boolean',
          description: 'Only return equipment marked active in configuration (default true)',
        },
        query: {
          type: 'string',
          description: "Filter by ID, name, or location, e.g. 'Waggon' or 'VP-03'",
        },
      },
    },
  },
  {
    name: 'discover_equipment_parameters',
    description:
      'Discover available parameters/nodes/topics from the live OPC UA, MQTT, or UNS (Sparkplug) connection for one equipment. Use before mapping new process parameters.',
    input_schema: {
      type: 'object',
      properties: {
        equipment_id: { type: 'string', description: "Equipment ID, e.g. 'W-GR-04'" },
        query: {
          type: 'string',
          description: "Optional filter, e.g. 'Waggon', 'Weight', 'Active'",
        },
      },
      required: ['equipment_id'],
    },
  },
  {
    name: 'search_industrial_namespace',
    description:
      'Search the OPC UA address space, UNS/Sparkplug namespace, or MQTT topic tree for nodes/devices matching a query (e.g. active wagons/Waggen, scale IDs). Omit equipment_id to scan all active non-simulation connections.',
    input_schema: {
      type: 'object',
      properties: {
        equipment_id: {
          type: 'string',
          description: 'Single equipment to search; omit to scan multiple configured connections',
        },
        query: {
          type: 'string',
          description:
            "Search text, e.g. 'Waggon', 'Wagen', 'aktiv', 'Scale', 'VP-03'. German/English synonyms work.",
        },
        connection_types: {
          type: 'array',
          items: { type: 'string', enum: ['opcua', 'mqtt', 'uns_sparkplug'] },
          description: 'Limit scan to these protocols when equipment_id is omitted',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_equipment_parameters',
    description:
      'Get process parameters for equipment including current live values where available.',
    input_schema: {
      type: 'object',
      properties: {
        equipment_id: { type: 'string', description: "Equipment ID, e.g. 'W-GR-04'" },
      },
      required: ['equipment_id'],
    },
  },
  {
    name: 'read_equipment_value',
    description: 'Read current live values from equipment (e.g. scale weight, stability).',
    input_schema: {
      type: 'object',
      properties: {
        equipment_id: { type: 'string' },
        parameter_name: {
          type: 'string',
          description: "Optional parameter, e.g. 'NetWeight', 'GrossWeight', 'Stable'",
        },
      },
      required: ['equipment_id'],
    },
  },
  {
    name: 'get_equipment_config',
    description:
      'Get equipment configuration (connection type, capacity, calibration) without secrets.',
    input_schema: {
      type: 'object',
      properties: {
        equipment_id: { type: 'string' },
      },
      required: ['equipment_id'],
    },
  },
];

function sanitizeConnectionConfig(config = {}) {
  const copy = { ...config };
  delete copy.password;
  delete copy.username;
  return copy;
}

async function getEquipmentConfigSafe(equipmentId) {
  const config = await gateway.findConfig(equipmentId);
  if (!config) return { error: `Equipment ${equipmentId} not found` };
  const status = gateway.getStatus(equipmentId);
  return {
    equipment_id: config.equipment_id,
    name: config.name,
    equipment_type: config.equipment_type,
    location: config.location,
    connection_type: config.connection_type,
    connection_config: sanitizeConnectionConfig(config.connection_config),
    scale_config: config.scale_config,
    process_parameters: config.process_parameters,
    is_active: config.is_active,
    status,
  };
}

async function executeEquipmentTool(name, input = {}) {
  switch (name) {
    case 'list_equipment': {
      const activeOnly = input.active_only !== false;
      const where = {};
      if (activeOnly) where.is_active = true;
      if (input.equipment_type && input.equipment_type !== 'all') {
        where.equipment_type = input.equipment_type;
      }
      const rows = await EquipmentConfig.findAll({
        where,
        order: [['equipment_id', 'ASC']],
      });
      let list = rows.map((row) => ({
        ...row.toJSON(),
        status: gateway.getStatus(row.equipment_id),
      }));
      if (input.location) {
        const loc = String(input.location).toLowerCase();
        list = list.filter((e) => (e.location || '').toLowerCase().includes(loc));
      }
      if (input.online_only) {
        list = list.filter((e) => e.status?.online);
      }
      if (input.query) {
        const q = String(input.query).toLowerCase();
        list = list.filter((e) => {
          const hay = `${e.equipment_id} ${e.name} ${e.location || ''}`.toLowerCase();
          return hay.includes(q);
        });
      }
      return list.map((e) => ({
        equipment_id: e.equipment_id,
        name: e.name,
        equipment_type: e.equipment_type,
        location: e.location,
        connection_type: e.connection_type,
        is_active: e.is_active,
        online: e.status?.online,
        source: e.status?.actual_source,
        fallback: e.status?.fallback,
      }));
    }
    case 'discover_equipment_parameters':
      return gateway.discoverNamespace(input.equipment_id, { query: input.query });
    case 'search_industrial_namespace': {
      if (input.equipment_id) {
        return gateway.discoverNamespace(input.equipment_id, { query: input.query });
      }
      return gateway.searchNamespaceAcrossEquipment({
        query: input.query,
        connection_types: input.connection_types,
      });
    }
    case 'get_equipment_parameters': {
      const id = input.equipment_id;
      if (!gateway.getStatus(id).online) {
        await gateway.connect(id).catch(() => {});
      }
      return gateway.getEquipmentParameters(id);
    }
    case 'read_equipment_value': {
      const id = input.equipment_id;
      if (!gateway.getStatus(id).online) {
        await gateway.connect(id).catch(() => {});
      }
      const live = gateway.getCurrentValue(id);
      if (!live) return { error: 'No live data', equipment_id: id };
      if (input.parameter_name) {
        const key = input.parameter_name;
        const val =
          live.values?.[key] ??
          live.values?.[key.charAt(0).toLowerCase() + key.slice(1)];
        return { equipment_id: id, parameter: key, value: val, unit: live.values?.unit };
      }
      return { equipment_id: id, values: live.values, timestamp: live.timestamp, source: live.source };
    }
    case 'get_equipment_config':
      return getEquipmentConfigSafe(input.equipment_id);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function executeEquipmentToolSafe(name, input = {}) {
  const run = () => executeEquipmentTool(name, input);
  if (FAST_TOOLS.has(name)) return run();
  try {
    return await withTimeout(run(), SLOW_TOOL_TIMEOUT_MS, `Tool ${name}`);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  EQUIPMENT_TOOL_DEFINITIONS,
  executeEquipmentTool,
  executeEquipmentToolSafe,
  getEquipmentConfigSafe,
};
