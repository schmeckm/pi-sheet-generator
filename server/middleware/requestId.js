const { randomUUID } = require('crypto');

/**
 * Attach a short request id (or honor X-Request-ID header) so downstream
 * logs can be correlated.
 */
function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length >= 6 && incoming.length <= 128
      ? incoming
      : randomUUID().slice(0, 8);
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

function tag(req, scope) {
  return `[${scope}${req?.requestId ? ` ${req.requestId}` : ''}]`;
}

module.exports = { requestId, tag };
