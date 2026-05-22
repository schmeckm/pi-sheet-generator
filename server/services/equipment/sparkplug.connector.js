const mqtt = require('mqtt');
const sparkplugbpayload = require('sparkplug-payload/lib/sparkplugbpayload');
const { normalizeFieldName } = require('./normalize');

class SparkplugConnector {
  constructor(config = {}) {
    this.config = config;
    this.broker = config.broker;
    this.groupId = config.groupId || 'Pharma';
    this.edgeNodeId = config.edgeNodeId || config.edgeNode || '';
    this.deviceId = config.deviceId || '';
    this.version = config.version || 'spBv1.0';
    this.client = null;
    this.values = {};
    this.birthMetrics = null;
  }

  get ddataTopic() {
    return `${this.version}/${this.groupId}/DDATA/${this.edgeNodeId}/${this.deviceId}`;
  }

  get dbirthTopic() {
    return `${this.version}/${this.groupId}/DBIRTH/${this.edgeNodeId}/${this.deviceId}`;
  }

  get dcmdTopic() {
    return `${this.version}/${this.groupId}/DCMD/${this.edgeNodeId}/${this.deviceId}`;
  }

  decodePayload(buffer) {
    try {
      return sparkplugbpayload.decodePayload(buffer);
    } catch {
      return null;
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.broker, {
        username: this.config.username || undefined,
        password: this.config.password || undefined,
        clean: true,
        reconnectPeriod: 5000,
      });
      const onConnect = () => {
        this.client.off('error', onError);
        resolve();
      };
      const onError = (err) => {
        this.client.off('connect', onConnect);
        reject(err);
      };
      this.client.once('connect', onConnect);
      this.client.once('error', onError);
    });
  }

  subscribe(callback) {
    const topics = [this.ddataTopic, this.dbirthTopic];
    this.client.subscribe(topics, { qos: 1 });
    this.client.on('message', (topic, message) => {
      const payload = this.decodePayload(message);
      if (!payload?.metrics) return;

      if (topic.includes('/DBIRTH/')) {
        this.birthMetrics = payload.metrics;
      }

      for (const metric of payload.metrics) {
        if (metric.value === undefined || metric.value === null) continue;
        const name = metric.name;
        this.values[name] = metric.value;
        callback(name, metric.value, payload.timestamp || Date.now());
      }
    });
  }

  async tare() {
    const payload = sparkplugbpayload.encodePayload({
      timestamp: Date.now(),
      metrics: [{ name: 'Tare', value: true, type: 'Boolean' }],
    });
    return new Promise((resolve, reject) => {
      this.client.publish(this.dcmdTopic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  async readAllValues() {
    return { ...this.values };
  }

  async getDeviceBirth() {
    return this.birthMetrics || [];
  }

  _matchesQuery(text, query) {
    if (!query) return true;
    return String(text || '').toLowerCase().includes(String(query).toLowerCase());
  }

  async discoverNamespace(options = {}) {
    const { query = null, timeoutMs = 4000 } = options;
    const devices = new Map();
    const metricsByDevice = new Map();

    if (!this.client?.connected) {
      return { devices: [], metrics: this.birthMetrics || [], source: 'uns_sparkplug' };
    }

    const wildcard = `${this.version}/${this.groupId}/#`;

    await new Promise((resolve) => {
      const handler = (topic, message) => {
        const parts = topic.split('/');
        if (parts.length < 5) return;
        const msgType = parts[2];
        const edgeNodeId = parts[3];
        const deviceId = parts[4];
        const key = `${edgeNodeId}/${deviceId}`;
        const label = `${edgeNodeId} ${deviceId} ${topic}`;
        if (!this._matchesQuery(label, query)) return;

        if (msgType.includes('BIRTH') || msgType.includes('DATA')) {
          devices.set(key, {
            edgeNodeId,
            deviceId,
            topic,
            messageType: msgType,
            active: !msgType.includes('DEATH'),
          });
        }

        const payload = this.decodePayload(message);
        if (payload?.metrics?.length) {
          const existing = metricsByDevice.get(key) || [];
          for (const metric of payload.metrics) {
            if (metric.name && this._matchesQuery(metric.name, query)) {
              existing.push({
                name: metric.name,
                type: metric.type,
                value: metric.value,
              });
            }
          }
          if (existing.length) metricsByDevice.set(key, existing);
        }
      };

      this.client.subscribe(wildcard, { qos: 0 });
      this.client.on('message', handler);
      setTimeout(() => {
        this.client.off('message', handler);
        resolve();
      }, timeoutMs);
    });

    const list = [...devices.values()];
    if (this.deviceId && this.edgeNodeId) {
      const ownKey = `${this.edgeNodeId}/${this.deviceId}`;
      if (!list.some((d) => `${d.edgeNodeId}/${d.deviceId}` === ownKey)) {
        list.unshift({
          edgeNodeId: this.edgeNodeId,
          deviceId: this.deviceId,
          topic: this.dbirthTopic,
          messageType: 'configured',
          active: true,
        });
      }
    }

    return {
      groupId: this.groupId,
      version: this.version,
      devices: list,
      birthMetrics: this.birthMetrics || [],
      metricsByDevice: Object.fromEntries(metricsByDevice),
      source: 'uns_sparkplug',
    };
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (!this.client) return resolve();
      this.client.end(false, {}, () => resolve());
    });
  }
}

module.exports = { SparkplugConnector };
