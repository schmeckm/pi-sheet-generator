// override: true — shell PORT must not win over .env (default host port 7000)
require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
  override: true,
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { initializeDatabase } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');

const authRoutes = require('./routes/auth.routes');
const repositoryRoutes = require('./routes/repository.routes');
const chatRoutes = require('./routes/chat.routes');
const templateRoutes = require('./routes/template.routes');
const adminRoutes = require('./routes/admin.routes');
const promptRoutes = require('./routes/prompt.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const visionRoutes = require('./routes/vision.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const weighingRoutes = require('./routes/weighing.routes');
const settingsRoutes = require('./routes/settings.routes');
const graphRoutes = require('./routes/graph.routes');
const plantRoutes = require('./routes/plant.routes');
const { attachEquipmentWebSocket, closeEquipmentWebSocket } = require('./websocket/equipment.ws');
const equipmentGateway = require('./services/equipment/gateway.service');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(helmet());
const defaultCorsOrigins = [
  'http://localhost:7002',
  'http://127.0.0.1:7002',
  'http://localhost:7004',
  'http://127.0.0.1:7004',
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : defaultCorsOrigins;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(requestId);
morgan.token('reqid', (req) => req.requestId || '-');
app.use(morgan(':reqid :method :url :status :response-time ms'));
app.use(express.json({ limit: '2mb' }));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Too many login attempts. Please try again later.' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) =>
    req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  message: { error: 'Chat generation limit reached. Please try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pi-sheet-generator' });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/xsteps', repositoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/admin/prompts', promptRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/weighing', weighingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/plants', plantRoutes);

app.use(errorHandler);

const net = require('net');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });
}

/** Wait for port after node --watch restart (old process may still be shutting down). */
async function waitForPort(port, attempts = 10) {
  for (let i = attempts; i > 0; i -= 1) {
    if (await isPortFree(port)) return true;
    if (i < attempts) {
      console.warn(`Port ${port} busy (watch restart?) — retry in 600ms (${i} left)…`);
    }
    await sleep(600);
  }
  return false;
}

async function reportPortConflict() {
  console.error(`Port ${PORT} is already in use.`);
  try {
    const { execSync } = require('child_process');
    const out = execSync(`netstat -ano | findstr ":${PORT}" | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const pid = out.trim().split(/\s+/).pop();
    if (pid && /^\d+$/.test(pid)) {
      console.error(`  • Blocking PID: ${pid} (often a leftover "node index.js" from npm run dev)`);
    }
  } catch {
    /* ignore */
  }
  console.error('  • Only one dev server: stop other terminals (Ctrl+C), then:');
  console.error(
    `  • PowerShell: Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`
  );
  console.error('  • Clear stale shell PORT: Remove-Item Env:PORT -ErrorAction SilentlyContinue');
}

async function start() {
  try {
    await initializeDatabase();
    console.log('Database connected (pgvector ready).');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('  • Start DB: docker compose up -d db  (host port 7003)');
    process.exit(1);
  }

  let equipmentWss;
  let shuttingDown = false;

  if (process.env.NODE_ENV !== 'production') {
    const ready = await waitForPort(PORT);
    if (!ready) {
      await reportPortConflict();
      process.exit(1);
    }
  }

  const server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(PORT, async () => {
      console.log(`Server running on http://localhost:${PORT}`);
      equipmentWss = attachEquipmentWebSocket(httpServer);
      try {
        await equipmentGateway.autoConnectActive();
      } catch (err) {
        console.warn('[equipment] Auto-connect skipped:', err.message);
      }
      resolve(httpServer);
    });

    httpServer.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        await reportPortConflict();
        process.exit(1);
      }
      reject(err);
    });
  });

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — closing server…`);
    try {
      await equipmentGateway.shutdownAll();
    } catch (err) {
      console.warn('[equipment] Shutdown warning:', err.message);
    }
    closeEquipmentWebSocket(equipmentWss);
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2500).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
