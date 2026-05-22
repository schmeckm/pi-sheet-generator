const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { User } = require('../models');
const gateway = require('../services/equipment/gateway.service');

function parseToken(url) {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function attachEquipmentWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/equipment' });

  wss.on('connection', async (ws, req) => {
    const token = parseToken(req.url);
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let user;
    try {
      const payload = jwt.verify(token, jwtSecret);
      user = await User.findByPk(payload.sub, { attributes: ['id', 'email', 'role'] });
      if (!user) throw new Error('Invalid user');
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    const subscriptions = new Map();

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendJson(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      const { action, equipmentId, command, params } = msg;

      try {
        if (action === 'subscribe' && equipmentId) {
          if (!gateway.getStatus(equipmentId).online) {
            await gateway.connect(equipmentId);
          }

          if (subscriptions.has(equipmentId)) {
            subscriptions.get(equipmentId)();
          }

          const unsub = gateway.subscribe(equipmentId, (payload) => {
            if (payload.type === 'status' || payload.type === 'debug') {
              sendJson(ws, payload);
              return;
            }
            sendJson(ws, {
              type: 'data',
              equipmentId: payload.equipmentId,
              values: payload.values,
              timestamp: payload.timestamp,
              source: payload.source,
              fallback: gateway.getStatus(equipmentId).fallback,
            });
          });

          subscriptions.set(equipmentId, unsub);
          const status = gateway.getStatus(equipmentId);
          sendJson(ws, {
            type: 'status',
            equipmentId,
            online: status.online,
            source: status.actual_source,
            connection_type: status.connection_type,
            fallback: status.fallback,
          });
          return;
        }

        if (action === 'unsubscribe' && equipmentId) {
          if (subscriptions.has(equipmentId)) {
            subscriptions.get(equipmentId)();
            subscriptions.delete(equipmentId);
          }
          sendJson(ws, { type: 'unsubscribed', equipmentId });
          return;
        }

        if (action === 'command' && equipmentId && command) {
          const result = await gateway.sendCommand(equipmentId, command, params || {});
          sendJson(ws, {
            type: 'command_result',
            equipmentId,
            command,
            ...result,
          });
          return;
        }

        if (action === 'list') {
          const equipment = await gateway.getEquipmentList();
          sendJson(ws, { type: 'equipment_list', equipment });
          return;
        }

        if (action === 'snapshot' && equipmentId) {
          if (!gateway.getStatus(equipmentId).online) {
            await gateway.connect(equipmentId);
          }
          const snapshot = await gateway.getLiveSnapshot(equipmentId);
          sendJson(ws, { type: 'snapshot', ...snapshot });
          return;
        }

        sendJson(ws, { type: 'error', message: 'Unknown action' });
      } catch (err) {
        if (action === 'command' && equipmentId && command) {
          sendJson(ws, {
            type: 'command_result',
            equipmentId,
            command,
            success: false,
            message: err.message,
          });
        } else {
          sendJson(ws, {
            type: 'error',
            equipmentId,
            message: err.message,
          });
        }
      }
    });

    ws.on('close', () => {
      for (const unsub of subscriptions.values()) {
        try {
          unsub();
        } catch {
          /* ignore */
        }
      }
      subscriptions.clear();
    });

    sendJson(ws, {
      type: 'connected',
      userId: user.id,
      message: 'Equipment WebSocket ready',
    });
  });

  console.log('[equipment] WebSocket server attached at /ws/equipment');
  return wss;
}

function closeEquipmentWebSocket(wss) {
  if (!wss) return;
  for (const client of wss.clients) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }
  try {
    wss.close();
  } catch {
    /* ignore */
  }
}

module.exports = { attachEquipmentWebSocket, closeEquipmentWebSocket };
