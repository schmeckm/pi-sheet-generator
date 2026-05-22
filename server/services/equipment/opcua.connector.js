const { normalizeFieldName } = require('./normalize');

const MONITORED_NODES = [
  'GrossWeight',
  'NetWeight',
  'TareWeight',
  'Stable',
  'Status',
  'Overload',
  'CalibrationDate',
];

class OPCUAConnector {
  constructor(config = {}) {
    this.config = config;
    this.endpoint = config.endpoint;
    this.nodePrefix = config.nodePrefix || '';
    this.client = null;
    this.session = null;
    this.subscription = null;
    this.values = {};
    this.connected = false;
  }

  async connect() {
    const { OPCUAClient, AttributeIds, MessageSecurityMode, SecurityPolicy } = require('node-opcua');

    const securityMode =
      this.config.securityMode === 'SignAndEncrypt'
        ? MessageSecurityMode.SignAndEncrypt
        : MessageSecurityMode.None;
    const securityPolicy =
      this.config.securityPolicy === 'Basic256Sha256'
        ? SecurityPolicy.Basic256Sha256
        : SecurityPolicy.None;

    this.client = OPCUAClient.create({
      endpointMustExist: false,
      securityMode,
      securityPolicy,
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 2,
      },
    });

    await this.client.connect(this.endpoint);
    this.session = await this.client.createSession({
      userName: this.config.username || undefined,
      password: this.config.password || undefined,
    });
    this.connected = true;
  }

  async subscribe(callback) {
    if (!this.session) throw new Error('OPC UA session not established');

    const { AttributeIds } = require('node-opcua');
    this.subscription = await this.session.createSubscription2({
      requestedPublishingInterval: 100,
      requestedMaxKeepAliveCount: 10,
      publishingEnabled: true,
    });

    for (const node of MONITORED_NODES) {
      const nodeId = `${this.nodePrefix}.${node}`;
      try {
        const monitoredItem = await this.subscription.monitor(
          { nodeId, attributeId: AttributeIds.Value },
          { samplingInterval: 100, discardOldest: true, queueSize: 1 }
        );
        monitoredItem.on('changed', (dataValue) => {
          const value = dataValue.value?.value;
          this.values[node] = value;
          callback(normalizeFieldName(node) || node, value, Date.now());
        });
      } catch (err) {
        console.warn(`[opcua] Could not monitor ${nodeId}:`, err.message);
      }
    }
  }

  async tare() {
    if (!this.session) return false;
    try {
      const result = await this.session.call({
        objectId: this.nodePrefix,
        methodId: `${this.nodePrefix}.Tare`,
        inputArguments: [],
      });
      return result.statusCode?.isGood?.() ?? true;
    } catch {
      return false;
    }
  }

  async readValue(nodeName) {
    const { AttributeIds } = require('node-opcua');
    const nodeId = `${this.nodePrefix}.${nodeName}`;
    const dataValue = await this.session.read({
      nodeId,
      attributeId: AttributeIds.Value,
    });
    return dataValue.value?.value;
  }

  async readAllValues() {
    const out = {};
    for (const node of MONITORED_NODES) {
      try {
        out[node] = await this.readValue(node);
      } catch {
        out[node] = this.values[node];
      }
    }
    return out;
  }

  _matchesQuery(haystack, query) {
    if (!query) return true;
    const q = String(query).toLowerCase();
    return String(haystack || '').toLowerCase().includes(q);
  }

  async browseParameters(options = {}) {
    const { query = null, maxResults = 80, maxDepth = 4 } = options;
    if (!this.session) {
      return MONITORED_NODES.map((name) => ({
        name,
        nodeId: `${this.nodePrefix}.${name}`,
        readable: true,
        source: 'static',
      })).filter((n) => this._matchesQuery(`${n.name} ${n.nodeId}`, query));
    }

    const {
      resolveNodeId,
      BrowseDirection,
      ReferenceTypeId,
      NodeClass,
    } = require('node-opcua');

    const startNodeId = resolveNodeId(this.nodePrefix || 'ns=0;i=85');
    const visited = new Set();
    const results = [];

    const walk = async (nodeId, depth) => {
      if (depth > maxDepth || results.length >= maxResults) return;
      const key = nodeId.toString();
      if (visited.has(key)) return;
      visited.add(key);

      let browseResult;
      try {
        browseResult = await this.session.browse({
          nodeId,
          referenceTypeId: ReferenceTypeId.HierarchicalReferences,
          browseDirection: BrowseDirection.Forward,
          includeSubtypes: true,
          nodeClassMask: 0,
          resultMask: 63,
        });
      } catch {
        return;
      }

      for (const ref of browseResult.references || []) {
        if (results.length >= maxResults) break;
        const nodeIdStr = ref.nodeId.toString();
        const browseName = ref.browseName?.toString?.() || ref.browseName || '';
        const displayName = ref.displayName?.text || ref.displayName?.toString?.() || '';
        const label = `${nodeIdStr} ${browseName} ${displayName}`;
        if (this._matchesQuery(label, query)) {
          results.push({
            nodeId: nodeIdStr,
            browseName,
            displayName,
            nodeClass: ref.nodeClass,
            readable: ref.nodeClass === NodeClass.Variable,
            source: 'browse',
          });
        }
        if (ref.nodeClass === NodeClass.Object || ref.nodeClass === NodeClass.ObjectType) {
          await walk(ref.nodeId, depth + 1);
        }
      }
    };

    await walk(startNodeId, 0);

    if (!results.length) {
      return MONITORED_NODES.map((name) => ({
        name,
        nodeId: `${this.nodePrefix}.${name}`,
        readable: true,
        source: 'static_fallback',
      })).filter((n) => this._matchesQuery(`${n.name} ${n.nodeId}`, query));
    }

    return results;
  }

  async disconnect() {
    try {
      await this.subscription?.terminate();
      await this.session?.close();
      await this.client?.disconnect();
    } catch {
      /* ignore */
    }
    this.connected = false;
  }
}

module.exports = { OPCUAConnector };
