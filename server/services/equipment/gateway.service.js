const { EquipmentConfig } = require('../../models');
const { withTimeout } = require('../../utils/withTimeout');

const CONNECT_TIMEOUT_MS = 8000;
const { ScaleSimulator, TemperatureSimulator } = require('./simulator.service');
const { OPCUAConnector } = require('./opcua.connector');
const { MQTTConnector } = require('./mqtt.connector');
const { SparkplugConnector } = require('./sparkplug.connector');
const { buildNormalizedPayload, normalizeScaleValues } = require('./normalize');

const DEBUG_LOG_MAX = 200;

class EquipmentGateway {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
    this.reconnectTimers = new Map();
    /** @type {Array<object>} global debug ring for admin panel */
    this.globalDebugLog = [];
  }

  pushDebug(equipmentId, entry) {
    const line = {
      timestamp: new Date().toISOString(),
      equipmentId,
      ...entry,
    };
    this.globalDebugLog.unshift(line);
    if (this.globalDebugLog.length > DEBUG_LOG_MAX) {
      this.globalDebugLog.length = DEBUG_LOG_MAX;
    }
    const session = this.sessions.get(equipmentId);
    if (session) {
      if (!session.debugLog) session.debugLog = [];
      session.debugLog.unshift(line);
      if (session.debugLog.length > 50) session.debugLog.length = 50;
      for (const cb of session.subscribers) {
        try {
          cb({ type: 'debug', equipmentId, entry: line });
        } catch {
          /* ignore */
        }
      }
    }
  }

  getDebugLog({ equipmentId, limit = 80 } = {}) {
    const cap = Math.min(limit, DEBUG_LOG_MAX);
    if (equipmentId) {
      const session = this.sessions.get(equipmentId);
      return (session?.debugLog || []).slice(0, cap);
    }
    return this.globalDebugLog.slice(0, cap);
  }

  async findConfig(equipmentId) {
    return EquipmentConfig.findOne({
      where: { equipment_id: equipmentId, is_active: true },
    });
  }

  async findConfigById(id) {
    if (!id) return null;
    const key = String(id);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
    if (isUuid) {
      const byUuid = await EquipmentConfig.findByPk(key);
      if (byUuid) return byUuid;
    }
    return EquipmentConfig.findOne({ where: { equipment_id: key } });
  }

  _createSimulator(config) {
    const conn = config.connection_config || {};
    const scale = config.scale_config || {};
    if (config.equipment_type === 'temperature') {
      return new TemperatureSimulator(conn);
    }
    return new ScaleSimulator(conn, scale);
  }

  async _startSimulation(session, config) {
    const simulator = this._createSimulator(config);
    session.simulator = simulator;
    session.connector = null;
    session.actualSource = 'simulation';
    session.fallback = session.requestedSource !== 'simulation';

    if (session.tickTimer) clearInterval(session.tickTimer);
    const rate = config.connection_config?.updateRate || 100;
    session.tickTimer = setInterval(() => {
      const values = simulator.tick();
      this._emitData(session, values, 'simulation');
    }, rate);
  }

  async _tryExternalConnector(config) {
    const type = config.connection_type;
    const conn = config.connection_config || {};

    if (type === 'opcua') {
      const connector = new OPCUAConnector(conn);
      await withTimeout(connector.connect(), CONNECT_TIMEOUT_MS, `OPC UA ${config.equipment_id}`);
      return { connector, actualSource: 'opcua' };
    }
    if (type === 'mqtt') {
      const connector = new MQTTConnector(conn);
      await withTimeout(connector.connect(), CONNECT_TIMEOUT_MS, `MQTT ${config.equipment_id}`);
      return { connector, actualSource: 'mqtt' };
    }
    if (type === 'uns_sparkplug') {
      const connector = new SparkplugConnector(conn);
      await withTimeout(
        connector.connect(),
        CONNECT_TIMEOUT_MS,
        `Sparkplug ${config.equipment_id}`
      );
      return { connector, actualSource: 'uns_sparkplug' };
    }
    return null;
  }

  _wireConnector(session, config, connector, source) {
    session.connector = connector;
    session.actualSource = source;
    session.fallback = false;

    const onField = (field, value) => {
      const partial =
        config.equipment_type === 'scale'
          ? { [field]: value }
          : { [field]: value };
      const merged = { ...session.lastValues, ...partial };
      if (config.equipment_type === 'scale') {
        this._emitData(session, normalizeScaleValues(merged), source);
      } else {
        this._emitData(session, merged, source);
      }
    };

    if (source === 'opcua') {
      connector.subscribe((node, value) => {
        this.pushDebug(session.equipmentId, {
          protocol: 'opcua',
          direction: 'in',
          field: node,
          value,
        });
        onField(node, value);
      });
    } else {
      connector.subscribe((field, value, meta) => {
        this.pushDebug(session.equipmentId, {
          protocol: source,
          direction: 'in',
          topic: meta?.topic,
          field,
          value,
          raw: meta?.raw,
        });
        onField(field, value);
      });
    }
  }

  _emitData(session, values, source) {
    const payload = buildNormalizedPayload(
      session.equipmentId,
      session.equipmentType,
      values,
      source
    );
    session.lastValues = payload.values;
    session.lastSeen = payload.timestamp;

    const now = Date.now();
    if (!session.lastDebugAt || now - session.lastDebugAt > 400) {
      session.lastDebugAt = now;
      this.pushDebug(session.equipmentId, {
        protocol: source,
        direction: 'normalized',
        values: payload.values,
      });
    }

    for (const cb of session.subscribers) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[equipment] subscriber error ${session.equipmentId}:`, err.message);
      }
    }

    if (!session.lastDbPing || now - session.lastDbPing > 5000) {
      session.lastDbPing = now;
      EquipmentConfig.update(
        { is_online: true, last_seen: new Date() },
        { where: { equipment_id: session.equipmentId } }
      ).catch(() => {});
    }
  }

  _notifyStatus(session) {
    const statusPayload = {
      type: 'status',
      equipmentId: session.equipmentId,
      online: true,
      connection_type: session.requestedSource,
      actual_source: session.actualSource,
      fallback: session.fallback,
    };
    for (const cb of session.subscribers) {
      try {
        cb(statusPayload);
      } catch {
        /* ignore */
      }
    }
  }

  async connect(equipmentId) {
    if (this.sessions.has(equipmentId)) {
      return { success: true, status: this.getStatus(equipmentId) };
    }

    const config = await this.findConfig(equipmentId);
    if (!config) {
      throw new Error(`Equipment ${equipmentId} not found or inactive`);
    }

    const session = {
      equipmentId,
      equipmentType: config.equipment_type,
      config,
      requestedSource: config.connection_type,
      actualSource: 'simulation',
      fallback: false,
      connector: null,
      simulator: null,
      subscribers: new Set(),
      lastValues: config.equipment_type === 'scale' ? normalizeScaleValues({}) : {},
      lastSeen: null,
      tickTimer: null,
      debugLog: [],
    };

    this.sessions.set(equipmentId, session);

    if (config.connection_type === 'simulation') {
      await this._startSimulation(session, config);
    } else {
      try {
        const external = await this._tryExternalConnector(config);
        this._wireConnector(session, config, external.connector, external.actualSource);
        console.log(`[equipment] ${equipmentId} connected via ${external.actualSource}`);
      } catch (err) {
        console.warn(
          `[equipment] ${equipmentId}: ${config.connection_type} failed (${err.message}), fallback simulation`
        );
        await this._startSimulation(session, config);
      }
    }

    await EquipmentConfig.update(
      { is_online: true, last_seen: new Date() },
      { where: { equipment_id: equipmentId } }
    );

    this._scheduleReconnect(equipmentId);
    this._notifyStatus(session);

    return {
      success: true,
      status: this.getStatus(equipmentId),
    };
  }

  _scheduleReconnect(equipmentId) {
    if (this.reconnectTimers.has(equipmentId)) {
      clearInterval(this.reconnectTimers.get(equipmentId));
    }
    const timer = setInterval(async () => {
      const session = this.sessions.get(equipmentId);
      if (!session || session.requestedSource === 'simulation') return;
      if (!session.fallback) return;

      try {
        await this.disconnect(equipmentId, { silent: true });
        await this.connect(equipmentId);
        console.log(`[equipment] ${equipmentId} reconnected`);
      } catch {
        /* retry later */
      }
    }, 30000);
    this.reconnectTimers.set(equipmentId, timer);
  }

  async disconnect(equipmentId, options = {}) {
    const session = this.sessions.get(equipmentId);
    if (!session) return;

    if (session.tickTimer) clearInterval(session.tickTimer);
    if (this.reconnectTimers.has(equipmentId)) {
      clearInterval(this.reconnectTimers.get(equipmentId));
      this.reconnectTimers.delete(equipmentId);
    }

    try {
      await session.connector?.disconnect();
    } catch {
      /* ignore */
    }

    this.sessions.delete(equipmentId);

    if (!options.silent) {
      await EquipmentConfig.update(
        { is_online: false },
        { where: { equipment_id: equipmentId } }
      );
    }
  }

  subscribe(equipmentId, callback) {
    const session = this.sessions.get(equipmentId);
    if (!session) throw new Error(`Equipment ${equipmentId} is not connected`);

    session.subscribers.add(callback);
    if (session.lastValues && Object.keys(session.lastValues).length) {
      callback(
        buildNormalizedPayload(
          equipmentId,
          session.equipmentType,
          session.lastValues,
          session.actualSource,
          session.lastSeen || Date.now()
        )
      );
    }

    return () => {
      session.subscribers.delete(callback);
    };
  }

  async sendCommand(equipmentId, command, params = {}) {
    const session = this.sessions.get(equipmentId);
    if (!session) throw new Error(`Equipment ${equipmentId} is not connected`);

    const simOnly = ['addWeight', 'reset', 'simulateDrift', 'simulateDisturbance'];

    if (simOnly.includes(command) && !session.simulator) {
      return { success: false, message: 'Command only available in simulation mode' };
    }

    switch (command) {
      case 'tare': {
        let value;
        if (session.simulator?.tare) {
          value = session.simulator.tare();
        } else if (session.connector?.tare) {
          const ok = await session.connector.tare();
          if (!ok) return { success: false, message: 'Tara failed on device' };
          value = session.lastValues?.tareWeight ?? 0;
        }
        return { success: true, message: 'Tara gesetzt', value };
      }
      case 'addWeight':
        session.simulator.addWeight(Number(params.amount) || 0);
        return { success: true, message: 'Materialzugabe simuliert' };
      case 'reset':
        session.simulator.reset();
        return { success: true, message: 'Waage zurückgesetzt' };
      case 'zero':
        if (session.connector?.tare) await session.connector.tare();
        else session.simulator?.reset();
        return { success: true, message: 'Zero ausgeführt' };
      case 'simulateDrift':
        session.simulator.simulateDrift(Number(params.rate) || 0.001);
        return { success: true, message: 'Drift simuliert' };
      case 'simulateDisturbance':
        session.simulator.simulateDisturbance();
        return { success: true, message: 'Störung simuliert' };
      default:
        return { success: false, message: `Unknown command: ${command}` };
    }
  }

  getStatus(equipmentId) {
    const session = this.sessions.get(equipmentId);
    if (!session) {
      return {
        online: false,
        connection_type: null,
        actual_source: null,
        fallback: false,
        lastValues: null,
        lastSeen: null,
      };
    }
    return {
      online: true,
      connection_type: session.requestedSource,
      actual_source: session.actualSource,
      fallback: session.fallback,
      lastValues: session.lastValues,
      lastSeen: session.lastSeen,
    };
  }

  getCurrentValue(equipmentId) {
    const session = this.sessions.get(equipmentId);
    if (!session) return null;
    return {
      values: session.lastValues,
      timestamp: session.lastSeen,
      source: session.actualSource,
    };
  }

  async getEquipmentList(filters = {}) {
    const where = { is_active: true };
    if (filters.type) where.equipment_type = filters.type;
    if (filters.location) where.location = filters.location;

    const rows = await EquipmentConfig.findAll({ where, order: [['equipment_id', 'ASC']] });
    return rows.map((row) => {
      const status = this.getStatus(row.equipment_id);
      return {
        ...row.toJSON(),
        status,
      };
    });
  }

  /** Read-only summary for the global protocol status bar (all authenticated users). */
  async getStatusSummary() {
    const list = await this.getEquipmentList();
    const protocols = {};
    let online = 0;
    let simulation = 0;

    for (const eq of list) {
      if (eq.status?.online) online += 1;
      if (eq.connection_type === 'simulation' || eq.status?.fallback) simulation += 1;

      const type = eq.connection_type;
      if (!type || type === 'simulation') continue;
      if (!protocols[type]) protocols[type] = { total: 0, online: 0 };
      protocols[type].total += 1;
      if (eq.status?.online) protocols[type].online += 1;
    }

    return {
      total: list.length,
      online,
      offline: list.length - online,
      simulation,
      protocols,
      debugLines: this.globalDebugLog.length,
    };
  }

  async getEquipmentParameters(equipmentId) {
    const config = await this.findConfig(equipmentId);
    if (!config) throw new Error('Equipment not found');

    const live = this.getCurrentValue(equipmentId);
    const params = (config.process_parameters || []).map((p) => ({
      ...p,
      currentValue: live?.values?.[p.name] ?? live?.values?.[p.name?.toLowerCase()] ?? null,
    }));

    return {
      equipment_id: equipmentId,
      parameters: params,
      live,
    };
  }

  async getEquipmentByLocation(location) {
    return this.getEquipmentList({ location });
  }

  async getEquipmentByType(type) {
    return this.getEquipmentList({ type });
  }

  async _discoverFromConnector(connector, config, options = {}) {
    const type = config.connection_type;
    const query = options.query || null;

    if (type === 'opcua' && connector.browseParameters) {
      const nodes = await connector.browseParameters({ query, maxResults: options.maxResults });
      return { protocol: 'opcua', query, nodes, count: nodes.length };
    }
    if (type === 'mqtt' && connector.discoverTopics) {
      const topics = await connector.discoverTopics({ query, timeoutMs: options.timeoutMs });
      return { protocol: 'mqtt', query, topics, count: topics.length };
    }
    if (type === 'uns_sparkplug') {
      if (connector.discoverNamespace) {
        const uns = await connector.discoverNamespace({ query, timeoutMs: options.timeoutMs });
        return { protocol: 'uns_sparkplug', query, ...uns };
      }
      const birth = await connector.getDeviceBirth?.();
      return {
        protocol: 'uns_sparkplug',
        query,
        birthMetrics: birth || [],
        devices: config.connection_config?.deviceId
          ? [
              {
                edgeNodeId: config.connection_config.edgeNodeId,
                deviceId: config.connection_config.deviceId,
                active: true,
              },
            ]
          : [],
      };
    }
    if (type === 'simulation') {
      const params = (config.process_parameters || []).filter((p) => {
        if (!query) return true;
        const hay = `${p.name} ${p.description || ''} ${p.unit || ''}`.toLowerCase();
        return hay.includes(String(query).toLowerCase());
      });
      return {
        protocol: 'simulation',
        query,
        note: 'Simulation — keine Live-Namespace-Durchsuchung. Nur konfigurierte Parameter.',
        parameters: params,
      };
    }
    return { protocol: type, query, error: 'Discovery not supported for this connection type' };
  }

  async _withEphemeralConnector(config, fn) {
    const session = this.sessions.get(config.equipment_id);
    if (session?.connector && !session.fallback) {
      return fn(session.connector, { ephemeral: false, actualSource: session.actualSource });
    }
    const external = await this._tryExternalConnector(config);
    try {
      return await fn(external.connector, { ephemeral: true, actualSource: external.actualSource });
    } finally {
      await external.connector.disconnect?.().catch(() => {});
    }
  }

  async discoverNamespace(equipmentId, options = {}) {
    const config = await this.findConfig(equipmentId);
    if (!config) throw new Error('Equipment not found');

    const result = await this._withEphemeralConnector(config, async (connector, meta) => {
      const data = await this._discoverFromConnector(connector, config, options);
      return { equipment_id: equipmentId, ...data, ...meta };
    });
    return result;
  }

  async searchNamespaceAcrossEquipment(options = {}) {
    const { query, connection_types, active_only = true, max_equipment = 8 } = options;
    const where = {};
    if (active_only) where.is_active = true;

    let rows = await EquipmentConfig.findAll({
      where,
      order: [['equipment_id', 'ASC']],
    });

    if (connection_types?.length) {
      rows = rows.filter((r) => connection_types.includes(r.connection_type));
    } else {
      rows = rows.filter((r) => r.connection_type !== 'simulation');
    }

    const targets = rows.slice(0, max_equipment);
    const results = [];

    for (const config of targets) {
      try {
        const hit = await this.discoverNamespace(config.equipment_id, { query });
        const hasHits =
          (hit.nodes?.length || 0) > 0 ||
          (hit.topics?.length || 0) > 0 ||
          (hit.devices?.length || 0) > 0 ||
          (hit.parameters?.length || 0) > 0;
        if (!query || hasHits) {
          results.push(hit);
        }
      } catch (err) {
        results.push({
          equipment_id: config.equipment_id,
          connection_type: config.connection_type,
          error: err.message,
        });
      }
    }

    return { query, scanned: targets.length, results };
  }

  async getLiveSnapshot(equipmentId) {
    const config = await this.findConfig(equipmentId);
    if (!config) throw new Error('Equipment not found');

    const live = this.getCurrentValue(equipmentId);
    const parameters = (config.process_parameters || []).map((p) => ({
      ...p,
      value: live?.values?.[p.name] ?? null,
    }));

    return {
      equipment_id: equipmentId,
      name: config.name,
      equipment_type: config.equipment_type,
      timestamp: live?.timestamp || Date.now(),
      source: live?.source || this.getStatus(equipmentId).actual_source,
      parameters,
      values: live?.values || {},
      status: this.getStatus(equipmentId),
    };
  }

  async runConnectionTest(equipmentId, durationMs = 3000) {
    await this.connect(equipmentId);
    const samples = [];

    return new Promise((resolve) => {
      const unsub = this.subscribe(equipmentId, (payload) => {
        if (payload.type === 'status') return;
        samples.push(payload);
      });

      setTimeout(async () => {
        unsub();
        resolve({
          equipmentId,
          sampleCount: samples.length,
          samples: samples.slice(-10),
          status: this.getStatus(equipmentId),
        });
      }, durationMs);
    });
  }

  async autoConnectActive() {
    const configs = await EquipmentConfig.findAll({ where: { is_active: true } });
    for (const config of configs) {
      try {
        await this.connect(config.equipment_id);
        console.log(`[equipment] Auto-connected ${config.equipment_id}`);
      } catch (err) {
        console.warn(`[equipment] Auto-connect ${config.equipment_id} failed:`, err.message);
      }
    }
  }

  /** Release connectors/timers so node --watch can re-bind the HTTP port. */
  async shutdownAll() {
    for (const timer of this.reconnectTimers.values()) {
      clearInterval(timer);
    }
    this.reconnectTimers.clear();

    const ids = [...this.sessions.keys()];
    for (const equipmentId of ids) {
      await this.disconnect(equipmentId, { silent: true });
    }
  }
}

module.exports = new EquipmentGateway();
