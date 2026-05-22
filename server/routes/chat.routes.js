const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const Joi = require('joi');
const { PISheet } = require('../models');
const llmService = require('../services/llm.service');
const lifecycle = require('../services/lifecycle.service');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) =>
    req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  message: { error: 'Chat generation limit reached. Please try again later.' },
});

router.use(authMiddleware);

const promptSchema = Joi.object({
  prompt: Joi.string().min(10).max(2000).required(),
  locale: Joi.string().valid('de', 'en').default('de'),
});

router.post('/generate', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await llmService.completeChat(value.prompt, req.user.id, {
      locale: value.locale,
    });
    if (result.piSheet?.toJSON) {
      result.piSheet = result.piSheet.toJSON();
    }
    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({
        error:
          'Die KI konnte kein PI Sheet generieren. Bitte ANTHROPIC_API_KEY konfigurieren.',
      });
    }
    next(err);
  }
});

function attachStreamHandlers(res, stream, { prompt, userId }) {
  let closed = false;
  let finishing = false;

  const stopClientStream = () => {
    closed = true;
    stream.removeAllListeners('text');
    stream.removeAllListeners('tools');
  };

  res.on('error', () => {
    stopClientStream();
  });

  res.on('close', () => {
    stopClientStream();
  });

  const writeEvent = (payload) => {
    if (closed || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch (err) {
      stopClientStream();
      return false;
    }
  };

  const finish = (payload) => {
    if (finishing) return;
    finishing = true;
    if (!closed && !res.writableEnded) {
      if (payload) writeEvent(payload);
      try {
        res.write('data: [DONE]\n\n');
        res.end();
      } catch {
        /* client gone */
      }
    }
    stopClientStream();
  };

  stream.on('text', (text) => {
    writeEvent({ type: 'chunk', text });
  });

  stream.on('tools', (tools) => {
    writeEvent({ type: 'tools', tools });
  });

  stream.on('error', (err) => {
    console.error('[chat] stream error:', err.message);
    finish({ type: 'error', message: err.message });
  });

  stream.on('end', async () => {
    if (finishing) return;
    finishing = true;
    writeEvent({ type: 'status', phase: 'finalizing' });
    try {
      const piSheet = await llmService.finalizeStream(stream, prompt, userId);
      const sheetJson =
        piSheet && typeof piSheet.toJSON === 'function' ? piSheet.toJSON() : piSheet;
      finish({ type: 'complete', piSheet: sheetJson });
    } catch (err) {
      console.error('[chat] finalize error:', err.message);
      finish({ type: 'error', message: err.message });
    }
  });
}

function attachQaStreamHandlers(res, stream) {
  let closed = false;
  let finishing = false;

  const stop = () => {
    closed = true;
    stream.removeAllListeners('text');
    stream.removeAllListeners('tools');
    stream.removeAllListeners('end');
    stream.removeAllListeners('error');
  };

  res.on('close', stop);
  res.on('error', stop);

  const writeEvent = (payload) => {
    if (closed || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch {
      stop();
      return false;
    }
  };

  const finish = (payload) => {
    if (finishing) return;
    finishing = true;
    if (!closed && !res.writableEnded) {
      if (payload) writeEvent(payload);
      try {
        res.write('data: [DONE]\n\n');
        res.end();
      } catch {
        /* client gone */
      }
    }
    stop();
  };

  writeEvent({ type: 'meta', requestMode: 'qa' });

  stream.on('text', (text) => writeEvent({ type: 'chunk', text }));
  stream.on('tools', (tools) => writeEvent({ type: 'tools', tools }));

  stream.on('error', (err) => {
    console.error('[chat] qa stream error:', err.message);
    finish({ type: 'error', message: err.message });
  });

  stream.on('end', async (finalMsg) => {
    if (finishing) return;
    finishing = true;
    try {
      const message = await llmService.finalizeAnswerStream(stream, finalMsg);
      finish({ type: 'complete', requestMode: 'qa', message });
    } catch (err) {
      console.error('[chat] qa finalize error:', err.message);
      finish({ type: 'error', message: err.message });
    }
  });
}

router.post('/qa-stream', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const stream = await llmService.generateAnswerChatStream(value.prompt, {
      locale: value.locale,
    });
    attachQaStreamHandlers(res, stream);
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({
        error:
          'Die KI konnte nicht antworten. Bitte ANTHROPIC_API_KEY konfigurieren.',
      });
    }
    if (!res.headersSent) next(err);
    else {
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`
        );
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
});

router.post('/generate-stream', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const stream = await llmService.generatePISheetStream(value.prompt, req.user.id, {
      locale: value.locale,
    });

    attachStreamHandlers(res, stream, {
      prompt: value.prompt,
      userId: req.user.id,
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({
        error:
          'Die KI konnte kein PI Sheet generieren. Bitte ANTHROPIC_API_KEY konfigurieren.',
      });
    }
    if (!res.headersSent) {
      next(err);
    } else {
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`
        );
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where =
      req.user.role === 'admin' ? {} : { created_by: req.user.id };

    const { rows, count } = await PISheet.findAndCountAll({
      where,
      attributes: [
        'id',
        'title',
        'process_type',
        'user_prompt',
        'status',
        'created_at',
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({ items: rows, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const piSheet = await lifecycle.loadSheet(req.params.id, req.user.id, req.user.role);
    if (!piSheet) return res.status(404).json({ error: 'PI Sheet not found' });
    res.json(piSheet);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
