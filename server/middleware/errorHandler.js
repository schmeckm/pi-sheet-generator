const { mapLlmError } = require('../utils/llmErrors');

function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors?.map((e) => e.message) || [err.message],
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (err.name === 'LlmError' || err.code) {
    const mapped = err.name === 'LlmError' ? err : mapLlmError(err);
    return res.status(mapped.statusCode).json({
      error: mapped.message,
      code: mapped.code,
      details: mapped.details || undefined,
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || undefined,
    });
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
