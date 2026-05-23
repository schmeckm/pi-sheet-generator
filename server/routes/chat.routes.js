const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const Joi = require('joi');
const { PISheet } = require('../models');
const llmService = require('../services/llm.service');
const tokenBudget = require('../services/tokenBudget.service');
const lifecycle = require('../services/lifecycle.service');
const { authMiddleware } = require('../middleware/auth');
const { toErrorPayload } = require('../utils/llmErrors');
const { tag } = require('../middleware/requestId');
const {
  beginSseResponse,
  createSseSession,
  buildPiSheetCompletePayload,
} = require('../utils/sseStream');

// Track active streams per request id so the client can abort them.
const ACTIVE_STREAMS = new Map();

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
      requestId: req.requestId,
      role: req.user.role,
    });
    if (result.piSheet?.toJSON) {
      result.piSheet = result.piSheet.toJSON();
      if (result.usage && !result.piSheet.llm_usage) {
        result.piSheet.llm_usage = result.usage;
      }
    }
    res.json(result);
  } catch (err) {
    console.error(`[chat/generate] ${req.requestId}`, err?.code || err?.name, err?.message);
    respondLlmError(res, err, req.body?.locale || 'de', next);
  }
});

// Allow the client to cancel a running stream.
router.post('/abort/:id', (req, res) => {
  const id = req.params.id;
  const stream = ACTIVE_STREAMS.get(id);
  if (!stream) return res.status(404).json({ error: 'Stream not found or already finished' });
  try {
    stream.abort?.();
  } catch {
    /* ignore */
  }
  res.json({ ok: true });
});

router.get('/token-budget', async (req, res, next) => {
  try {
    const status = await tokenBudget.getStatus(req.user.id, req.user.role);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

function attachStreamHandlers(res, stream, { prompt, userId, locale, streamId, requestId }) {
  let finishing = false;

  const stopClientStream = () => {
    stream.removeAllListeners('text');
    stream.removeAllListeners('tools');
  };

  const sse = createSseSession(res, () => {
    stopClientStream();
    if (streamId) ACTIVE_STREAMS.delete(streamId);
    try {
      stream.abort?.();
    } catch {
      /* ignore */
    }
  });

  sse.writeEvent({
    type: 'meta',
    requestMode: 'pi_sheet',
    streamId,
    requestId,
    sapPath: stream.contextMeta?.sapPath,
    stats: stream.contextMeta?.stats,
    contextTrimmed: !!stream.contextMeta?.contextTrimmed,
    trimmedSections: stream.contextMeta?.trimmedSections || [],
  });
  sse.writeEvent({ type: 'status', phase: 'generating' });

  let tokenCount = 0;
  stream.on('text', (text) => {
    tokenCount += String(text).length;
    sse.writeEvent({ type: 'chunk', text, chars: tokenCount });
  });

  stream.on('tools', (tools) => {
    sse.writeEvent({ type: 'tools', tools });
    sse.writeEvent({ type: 'status', phase: 'tools' });
  });

  stream.on('error', (err) => {
    console.error(tag({ requestId }, 'chat'), 'stream error:', err.message);
    sse.finish(streamErrorEvent(err, locale));
  });

  stream.on('end', () => {
    void (async () => {
      if (finishing) return;
      finishing = true;
      sse.writeEvent({ type: 'status', phase: 'finalizing' });
      try {
        const { piSheet, usage } = await llmService.finalizeStream(stream, prompt, userId, { locale });
        await llmService.trackTokenUsage(userId, usage);
        const sheetJson =
          piSheet && typeof piSheet.toJSON === 'function' ? piSheet.toJSON() : piSheet;
        if (usage && sheetJson && !sheetJson.llm_usage) {
          sheetJson.llm_usage = usage;
        }
        sse.finish(buildPiSheetCompletePayload(sheetJson, usage));
      } catch (err) {
        console.error(tag({ requestId }, 'chat'), 'finalize error:', err.message);
        sse.finish(streamErrorEvent(err, locale));
      }
    })();
  });
}

function attachQaStreamHandlers(res, stream, locale = 'de', { streamId, requestId, userId } = {}) {
  let finishing = false;

  const stop = () => {
    stream.removeAllListeners('text');
    stream.removeAllListeners('tools');
    stream.removeAllListeners('end');
    stream.removeAllListeners('error');
  };

  const sse = createSseSession(res, () => {
    stop();
    if (streamId) ACTIVE_STREAMS.delete(streamId);
    try {
      stream.abort?.();
    } catch {
      /* ignore */
    }
  });

  sse.writeEvent({ type: 'meta', requestMode: 'qa', streamId, requestId });
  sse.writeEvent({ type: 'status', phase: 'generating' });

  stream.on('text', (text) => sse.writeEvent({ type: 'chunk', text }));
  stream.on('tools', (tools) => {
    sse.writeEvent({ type: 'tools', tools });
    sse.writeEvent({ type: 'status', phase: 'tools' });
  });

  stream.on('error', (err) => {
    console.error(tag({ requestId }, 'chat'), 'qa stream error:', err.message);
    sse.finish(streamErrorEvent(err, locale));
  });

  stream.on('end', (finalMsg) => {
    void (async () => {
      if (finishing) return;
      finishing = true;
      sse.writeEvent({ type: 'status', phase: 'finalizing' });
      try {
        const { message, usage } = await llmService.finalizeAnswerStream(stream, finalMsg);
        await llmService.trackTokenUsage(userId, usage);
        sse.finish({ type: 'complete', requestMode: 'qa', message, usage });
      } catch (err) {
        console.error(tag({ requestId }, 'chat'), 'qa finalize error:', err.message);
        sse.finish(streamErrorEvent(err, locale));
      }
    })();
  });
}

router.post('/qa-stream', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    beginSseResponse(res);

    const stream = await llmService.generateAnswerChatStream(value.prompt, req.user.id, {
      locale: value.locale,
      requestId: req.requestId,
      role: req.user.role,
    });
    const streamId = req.requestId;
    ACTIVE_STREAMS.set(streamId, stream);
    attachQaStreamHandlers(res, stream, value.locale, {
      streamId,
      requestId: req.requestId,
      userId: req.user.id,
    });
  } catch (err) {
    respondLlmError(res, err, req.body?.locale || 'de', next);
  }
});

router.post('/stream', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    beginSseResponse(res);

    // C4: server is the single source of truth for the mode.
    const resolvedMode = llmService.resolveChatMode(value.prompt);
    const streamId = req.requestId;

    if (resolvedMode === 'pi_sheet') {
      const stream = await llmService.generatePISheetStream(value.prompt, req.user.id, {
        locale: value.locale,
        requestId: req.requestId,
        role: req.user.role,
      });
      ACTIVE_STREAMS.set(streamId, stream);
      attachStreamHandlers(res, stream, {
        prompt: value.prompt,
        userId: req.user.id,
        locale: value.locale,
        streamId,
        requestId: req.requestId,
      });
    } else {
      const stream = await llmService.generateAnswerChatStream(value.prompt, req.user.id, {
        locale: value.locale,
        requestId: req.requestId,
        role: req.user.role,
      });
      ACTIVE_STREAMS.set(streamId, stream);
      attachQaStreamHandlers(res, stream, value.locale, {
        streamId,
        requestId: req.requestId,
        userId: req.user.id,
      });
    }
  } catch (err) {
    respondLlmError(res, err, req.body?.locale || 'de', next);
  }
});

router.post('/generate-stream', chatLimiter, async (req, res, next) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    beginSseResponse(res);

    const stream = await llmService.generatePISheetStream(value.prompt, req.user.id, {
      locale: value.locale,
      requestId: req.requestId,
      role: req.user.role,
    });
    const streamId = req.requestId;
    ACTIVE_STREAMS.set(streamId, stream);

    attachStreamHandlers(res, stream, {
      prompt: value.prompt,
      userId: req.user.id,
      locale: value.locale,
      streamId,
      requestId: req.requestId,
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
