const mqtt = require('mqtt');
const { normalizeFieldName } = require('./normalize');

class MQTTConnector {
  constructor(config = {}) {
    this.config = config;
    this.broker = config.broker;
    this.prefix = (config.topicPrefix || '').replace(/\/$/, '');
    this.qos = config.qos ?? 1;
    this.client = null;
    this.values = {};
    this.discoveredTopics = new Set();
  }

  parseValue(raw) {
    const str = raw.toString().trim();
    if (str === 'true') return true;
    if (str === 'false') return false;
    const num = parseFloat(str);
    return Number.isNaN(num) ? str : num;
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
    const topic = `${this.prefix}/#`;
    this.client.subscribe(topic, { qos: this.qos });
    this.client.on('message', (msgTopic, message) => {
      if (!msgTopic.startsWith(this.prefix)) return;
      const field = msgTopic.slice(this.prefix.length + 1);
      if (field.startsWith('cmd/')) return;
      const value = this.parseValue(message);
      this.values[field] = value;
      this.discoveredTopics.add(field);
      callback(field, value, Date.now(), {
        topic: msgTopic,
        raw: message.toString(),
      });
    });
  }

  async tare() {
    return new Promise((resolve, reject) => {
      this.client.publish(`${this.prefix}/cmd/tare`, '1', { qos: this.qos }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  async readAllValues() {
    return { ...this.values };
  }

  async discoverTopics(options = {}) {
    const { query = null, timeoutMs = 2500 } = options;
    const q = query ? String(query).toLowerCase() : null;
    const collected = new Set(this.discoveredTopics);

    if (this.client?.connected) {
      await new Promise((resolve) => {
        const handler = (msgTopic) => {
          if (!msgTopic.startsWith(this.prefix)) return;
          const field = msgTopic.slice(this.prefix.length + 1);
          if (!field.startsWith('cmd/')) collected.add(field);
        };
        this.client.on('message', handler);
        setTimeout(() => {
          this.client.off('message', handler);
          resolve();
        }, timeoutMs);
      });
    }

    return [...collected]
      .map((name) => ({
        name,
        topic: `${this.prefix}/${name}`,
        source: 'mqtt',
      }))
      .filter((row) => {
        if (!q) return true;
        const hay = `${row.name} ${row.topic}`.toLowerCase();
        return hay.includes(q);
      });
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (!this.client) return resolve();
      this.client.end(false, {}, () => resolve());
    });
  }
}

module.exports = { MQTTConnector };
