const { sequelize } = require('../config/database');

async function checkDatabase() {
  const started = Date.now();
  try {
    await sequelize.authenticate();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function checkLlm() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return { ok: configured, configured };
}

async function getHealth() {
  const database = await checkDatabase();
  const llm = checkLlm();

  let status = 'healthy';
  if (!database.ok) {
    status = 'down';
  } else if (!llm.ok) {
    status = 'degraded';
  }

  return {
    status,
    service: 'pi-sheet-generator',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    checks: {
      api: { ok: true },
      database,
      llm,
    },
  };
}

module.exports = { getHealth, checkDatabase, checkLlm };
