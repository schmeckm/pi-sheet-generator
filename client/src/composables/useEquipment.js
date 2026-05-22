import { ref, readonly } from 'vue';
import { useAuthStore } from '@/stores/auth';

const connectionStatus = ref('disconnected');
let ws = null;
let reconnectTimer = null;
const equipmentRefs = new Map();
let commandWaiter = null;

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/equipment`;
}

function send(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function handleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  if (msg.type === 'command_result' && commandWaiter) {
    commandWaiter.resolve(msg);
    commandWaiter = null;
    return;
  }

  if (msg.type === 'error') {
    const err = new Error(msg.message || 'Equipment error');
    if (commandWaiter) {
      commandWaiter.reject(err);
      commandWaiter = null;
    }
    if (listWaiter) {
      listWaiter.reject(err);
      listWaiter = null;
    }
    if (snapshotWaiter) {
      snapshotWaiter.reject(err);
      snapshotWaiter = null;
    }
    return;
  }

  if (msg.type === 'data' && msg.equipmentId && equipmentRefs.has(msg.equipmentId)) {
    const entry = equipmentRefs.get(msg.equipmentId);
    entry.data.value = {
      grossWeight: msg.values?.grossWeight ?? 0,
      netWeight: msg.values?.netWeight ?? 0,
      tareWeight: msg.values?.tareWeight ?? 0,
      stable: Boolean(msg.values?.stable),
      unit: msg.values?.unit || 'kg',
      overload: Boolean(msg.values?.overload),
      status: msg.values?.status ?? 0,
      timestamp: msg.timestamp,
      source: msg.source,
      fallback: Boolean(msg.fallback),
    };
    entry.tickCount.value += 1;
    return;
  }

  if (msg.type === 'status' && msg.equipmentId && equipmentRefs.has(msg.equipmentId)) {
    const entry = equipmentRefs.get(msg.equipmentId);
    entry.status.value = {
      online: msg.online,
      source: msg.source,
      connection_type: msg.connection_type,
      fallback: msg.fallback,
    };
  }

  if (msg.type === 'equipment_list' && listWaiter) {
    listWaiter.resolve(msg.equipment || []);
    listWaiter = null;
  }

  if (msg.type === 'snapshot' && snapshotWaiter) {
    snapshotWaiter.resolve(msg);
    snapshotWaiter = null;
  }
}

let listWaiter = null;
let snapshotWaiter = null;
/** Set by useEquipment() — used by scheduleReconnect at module scope */
let connectWebSocket = () => Promise.resolve();

function scheduleReconnect() {
  if (reconnectTimer) return;
  connectionStatus.value = 'disconnected';
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 3000);
}

export function useEquipment() {
  function connect() {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
      return Promise.resolve();
    }

    const auth = useAuthStore();
    if (!auth.token) return Promise.reject(new Error('Not authenticated'));

    connectionStatus.value = 'connecting';

    return new Promise((resolve, reject) => {
      const url = `${wsUrl()}?token=${encodeURIComponent(auth.token)}`;
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(openTimer);
        connectionStatus.value = 'disconnected';
        reject(err);
      };

      const openTimer = setTimeout(() => {
        fail(new Error('WebSocket connection timeout'));
      }, 12000);

      ws = new WebSocket(url);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(openTimer);
        connectionStatus.value = 'connected';
        for (const [equipmentId] of equipmentRefs) {
          send({ action: 'subscribe', equipmentId });
        }
        resolve();
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        if (!settled) fail(new Error('WebSocket closed'));
        else scheduleReconnect();
      };

      ws.onerror = () => {
        if (!settled) fail(new Error('WebSocket connection failed'));
      };
    }).catch(() => {
      /* reconnect will retry */
    });
  }

  connectWebSocket = connect;

  function subscribe(equipmentId) {
    if (!equipmentRefs.has(equipmentId)) {
      equipmentRefs.set(equipmentId, {
        data: ref({
          grossWeight: 0,
          netWeight: 0,
          tareWeight: 0,
          stable: false,
          unit: 'kg',
          overload: false,
          status: 0,
          timestamp: null,
          source: 'simulation',
          fallback: false,
        }),
        status: ref({ online: false, source: null, connection_type: null, fallback: false }),
        tickCount: ref(0),
      });
    }

    connect().then(() => {
      send({ action: 'subscribe', equipmentId });
    });

    const entry = equipmentRefs.get(equipmentId);
    return {
      live: entry.data,
      status: entry.status,
      tickCount: entry.tickCount,
      unsubscribe: () => {
        send({ action: 'unsubscribe', equipmentId });
        equipmentRefs.delete(equipmentId);
      },
    };
  }

  function unsubscribe(equipmentId) {
    send({ action: 'unsubscribe', equipmentId });
    equipmentRefs.delete(equipmentId);
  }

  function sendCommand(equipmentId, command, params = {}) {
    return new Promise((resolve, reject) => {
      if (commandWaiter) {
        reject(new Error('Another equipment command is in progress'));
        return;
      }
      connect()
        .then(() => {
          if (ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not connected'));
            return;
          }
          send({ action: 'subscribe', equipmentId });
          commandWaiter = { resolve, reject };
          send({ action: 'command', equipmentId, command, params });
          setTimeout(() => {
            if (commandWaiter) {
              commandWaiter.reject(
                new Error(
                  'Command timeout — check WebSocket (/ws/equipment) and NPM proxy "Websockets Support"'
                )
              );
              commandWaiter = null;
            }
          }, 15000);
        })
        .catch(reject);
    });
  }

  function getEquipmentList() {
    return new Promise((resolve, reject) => {
      connect()
        .then(() => {
          listWaiter = { resolve, reject };
          send({ action: 'list' });
          setTimeout(() => {
            if (listWaiter) {
              listWaiter.reject(new Error('List timeout'));
              listWaiter = null;
            }
          }, 5000);
        })
        .catch(reject);
    });
  }

  function getSnapshot(equipmentId) {
    return new Promise((resolve, reject) => {
      connect()
        .then(() => {
          snapshotWaiter = { resolve, reject };
          send({ action: 'snapshot', equipmentId });
          setTimeout(() => {
            if (snapshotWaiter) {
              snapshotWaiter.reject(new Error('Snapshot timeout'));
              snapshotWaiter = null;
            }
          }, 5000);
        })
        .catch(reject);
    });
  }

  return {
    connectionStatus: readonly(connectionStatus),
    connect,
    subscribe,
    unsubscribe,
    sendCommand,
    getEquipmentList,
    getSnapshot,
  };
}
