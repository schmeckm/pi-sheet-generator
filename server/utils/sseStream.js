/** @typedef {{ writeEvent: (payload: object) => boolean, finish: (payload?: object) => void, cleanup: () => void }} SseSession */

const HEARTBEAT_MS = 15_000;
/** Large single SSE lines can break HTTP/2 proxies — send id only and let client fetch. */
const INLINE_PI_SHEET_MAX_BYTES = 32 * 1024;

function beginSseResponse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/**
 * @param {import('express').Response} res
 * @param {() => void} [onClientGone]
 * @returns {SseSession}
 */
function createSseSession(res, onClientGone) {
  let closed = false;
  let finishing = false;

  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded || res.destroyed) return;
    try {
      res.write(': heartbeat\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch {
      cleanup();
    }
  }, HEARTBEAT_MS);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    onClientGone?.();
  };

  res.on('error', cleanup);
  res.on('close', cleanup);

  const writeEvent = (payload) => {
    if (closed || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch {
      return false;
    }
  };

  const finish = (payload) => {
    if (finishing) return;
    finishing = true;
    try {
      if (!res.writableEnded && !res.destroyed) {
        if (payload) writeEvent(payload);
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    } catch {
      /* client gone */
    }
    cleanup();
  };

  return { writeEvent, finish, cleanup };
}

function buildPiSheetCompletePayload(sheetJson, usage) {
  const payload = { type: 'complete', usage };
  if (!sheetJson) return payload;

  // Streams: prefer id-only complete events (small SSE line; avoids proxy chunk errors).
  if (sheetJson.id) {
    payload.piSheetId = sheetJson.id;
    return payload;
  }

  let serialized = '';
  try {
    serialized = JSON.stringify(sheetJson);
  } catch {
    serialized = '';
  }

  if (serialized.length > INLINE_PI_SHEET_MAX_BYTES) {
    return payload;
  }
  payload.piSheet = sheetJson;
  return payload;
}

module.exports = {
  HEARTBEAT_MS,
  INLINE_PI_SHEET_MAX_BYTES,
  beginSseResponse,
  createSseSession,
  buildPiSheetCompletePayload,
};
