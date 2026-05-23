const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const Joi = require('joi');
const { PISheet } = require('../models');
const llmService = require('../services/llm.service');
const lifecycle = require('../services/lifecycle.service');
const { authMiddleware } = require('../middleware/auth');
const { toErrorPayload } = require('../utils/llmErrors');

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

function respondLlmError(res, err, locale, next) {
  const payload = toErrorPayload(err, locale);
  if (res.headersSent) {
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: payload.error,
          code: payload.code,
        })}\n\n`
      );
      res.end();
    } catch {
      /* client gone */
    }
    return;
  }
  return res.status(payload.statusCode).json({
    error: payload.error,
    code: payload.code,
    details: payload.details,
  });
}

function streamErrorEvent(err, locale = 'de') {
  const payload = toErrorPayload(err, locale);
  return { type: 'error', message: payload.error, code: payload.code };
}

router.post('/generate', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await llmService.completeChat(value.prompt, req.user.id, {
      locale: value.locale,
    });
    if (result.piSheet?.toJSON) {
      result.piSheet = result.piSheet.toJSON();
      if (result.usage && !result.piSheet.llm_usage) {
        result.piSheet.llm_usage = result.usage;
      }
    }
    res.json(result);
  } catch (err) {
    respondLlmError(res, err, req.body?.locale || 'de', next);
  }
});

function attachStreamHandlers(res, stream, { prompt, userId, locale }) {
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

  if (stream.contextMeta?.contextTrimmed) {
    writeEvent({
      type: 'meta',
      contextTrimmed: true,
      trimmedSections: stream.contextMeta.trimmedSections || [],
    });
  }

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
    finish(streamErrorEvent(err, locale));
  });

  stream.on('end', async () => {
    if (finishing) return;
    finishing = true;
    writeEvent({ type: 'status', phase: 'finalizing' });
    try {
      const { piSheet, usage } = await llmService.finalizeStream(stream, prompt, userId, { locale });
      const sheetJson =
        piSheet && typeof piSheet.toJSON === 'function' ? piSheet.toJSON() : piSheet;
      if (usage && sheetJson && !sheetJson.llm_usage) {
        sheetJson.llm_usage = usage;
      }
      finish({ type: 'complete', piSheet: sheetJson, usage });
    } catch (err) {
      console.error('[chat] finalize error:', err.message);
      finish(streamErrorEvent(err, locale));
    }
  });
}

function attachQaStreamHandlers(res, stream, locale = 'de') {
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
    finish(streamErrorEvent(err, locale));
  });

  stream.on('end', async (finalMsg) => {
    if (finishing) return;
    finishing = true;
    try {
      const { message, usage } = await llmService.finalizeAnswerStream(stream, finalMsg);
      finish({ type: 'complete', requestMode: 'qa', message, usage });
    } catch (err) {
      console.error('[chat] qa finalize error:', err.message);
      finish(streamErrorEvent(err, locale));
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
    attachQaStreamHandlers(res, stream, value.locale);
  } catch (err) {
    respondLlmError(res, err, req.body?.locale || 'de', next);
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
      locale: value.locale,
    });
  } catch (err) {
    respondLlmError(res, err, req.body?.locale || 'de', next);
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
