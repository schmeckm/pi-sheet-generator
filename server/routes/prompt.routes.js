const express = require('express');
const Joi = require('joi');
const { PromptConfig, AuditLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');
const { logAudit } = require('../services/audit.service');
const llmService = require('../services/llm.service');
const { DEFAULT_SYSTEM_PROMPT } = require('../seeders/default-system-prompt');
const { PROMPT_ACCESS_ROLES, ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware, roles(...PROMPT_ACCESS_ROLES));

router.get('/', async (req, res, next) => {
  try {
    const prompts = await PromptConfig.findAll({ order: [['created_at', 'DESC']] });
    res.json(prompts);
  } catch (err) {
    next(err);
  }
});

router.get('/default-template', async (req, res, next) => {
  try {
    res.json({ system_prompt: DEFAULT_SYSTEM_PROMPT });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      system_prompt: Joi.string().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.create({
      ...value,
      is_active: false,
      created_by: req.user.id,
    });
    await logAudit({
      userId: req.user.id,
      action: 'prompt_created',
      entityType: 'prompt_config',
      entityId: prompt.id,
      details: { name: prompt.name },
    });
    res.status(201).json(prompt);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const schema = Joi.object({ system_prompt: Joi.string().required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const previousPrompt = prompt.system_prompt;
    await prompt.update(value);
    await logAudit({
      userId: req.user.id,
      action: 'prompt_updated',
      entityType: 'prompt_config',
      entityId: prompt.id,
      details: {
        name: prompt.name,
        previous_prompt: previousPrompt,
        char_count: previousPrompt?.length || 0,
      },
    });
    res.json(prompt);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/activate', roles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    await PromptConfig.update({ is_active: false }, { where: {} });
    await prompt.update({ is_active: true });
    await logAudit({
      userId: req.user.id,
      action: 'prompt_activated',
      entityType: 'prompt_config',
      entityId: prompt.id,
      details: {},
    });
    res.json(prompt);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const rows = await AuditLog.findAll({
      where: {
        entity_type: 'prompt_config',
        entity_id: req.params.id,
        action: 'prompt_updated',
      },
      order: [['created_at', 'DESC']],
      limit: 20,
      include: [{ association: 'user', attributes: ['email', 'name'] }],
    });
    res.json(
      rows.map((r) => {
        const previous = r.details?.previous_prompt || '';
        return {
          id: r.id,
          created_at: r.created_at,
          user: r.user,
          char_count: r.details?.char_count ?? previous.length,
          excerpt: previous.slice(0, 200),
          previous_prompt: previous,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const schema = Joi.object({
      test_prompt: Joi.string().min(10).max(2000).required(),
      mode: Joi.string().valid('auto', 'pi_sheet', 'qa').default('auto'),
      locale: Joi.string().valid('de', 'en').default('de'),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const opts = { promptConfig: prompt, locale: value.locale };
    let resolvedMode = value.mode;
    if (resolvedMode === 'auto') {
      resolvedMode = llmService.isPiSheetIntent(value.test_prompt) ? 'pi_sheet' : 'qa';
    }

    if (resolvedMode === 'qa') {
      const answer = await llmService.answerChat(value.test_prompt, req.user.id, opts);
      return res.json({ mode: 'qa', message: answer.message });
    }

    const piSheet = await llmService.generatePISheet(value.test_prompt, req.user.id, opts);
    res.json({
      mode: 'pi_sheet',
      piSheet,
      raw: piSheet.llm_response,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
