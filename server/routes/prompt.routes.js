const express = require('express');
const Joi = require('joi');
const { PromptConfig } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');
const { logAudit } = require('../services/audit.service');
const llmService = require('../services/llm.service');
const promptConfigService = require('../services/promptConfig.service');
const promptVersionService = require('../services/promptVersion.service');
const { DEFAULT_SYSTEM_PROMPT } = require('../seeders/default-system-prompt');
const { PROMPT_ACCESS_ROLES, ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware, roles(...PROMPT_ACCESS_ROLES));

async function runPromptTest(testPrompt, userId, promptForTest, { mode, locale, role }) {
  const opts = { promptConfig: promptForTest, locale, role };
  let resolvedMode = mode;
  if (resolvedMode === 'auto') {
    resolvedMode = llmService.isPiSheetIntent(testPrompt) ? 'pi_sheet' : 'qa';
  }
  if (resolvedMode === 'qa') {
    const answer = await llmService.answerChat(testPrompt, userId, opts);
    return { mode: 'qa', message: answer.message, usage: answer.usage };
  }
  const { piSheet, usage } = await llmService.generatePISheet(testPrompt, userId, opts);
  const sheetJson = piSheet?.toJSON ? piSheet.toJSON() : piSheet;
  return {
    mode: 'pi_sheet',
    piSheet: sheetJson,
    raw: sheetJson?.llm_response,
    usage,
  };
}

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
    await promptVersionService.createSnapshot(
      prompt.id,
      prompt.system_prompt,
      req.user.id,
      { changeNote: 'Initial version' }
    );
    promptConfigService.invalidate();
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
    const schema = Joi.object({
      system_prompt: Joi.string().required(),
      change_note: Joi.string().max(500).allow('').optional(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const previousPrompt = prompt.system_prompt;
    if (previousPrompt !== value.system_prompt) {
      await promptVersionService.createSnapshot(
        prompt.id,
        previousPrompt,
        req.user.id,
        { changeNote: value.change_note || 'Before save' }
      );
    }
    await prompt.update({ system_prompt: value.system_prompt });
    promptConfigService.invalidate();
    await logAudit({
      userId: req.user.id,
      action: 'prompt_updated',
      entityType: 'prompt_config',
      entityId: prompt.id,
      details: {
        name: prompt.name,
        char_count: value.system_prompt.length,
      },
    });
    res.json(prompt);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/activate', roles(ROLES.ADMIN), async (req, res, next) => {
  const { sequelize } = require('../config/database');
  const tx = await sequelize.transaction();
  try {
    const prompt = await PromptConfig.findByPk(req.params.id, { transaction: tx });
    if (!prompt) {
      await tx.rollback();
      return res.status(404).json({ error: 'Prompt not found' });
    }

    if (prompt.is_active) {
      await tx.commit();
      return res.json(prompt);
    }

    const previouslyActive = await PromptConfig.findAll({
      where: { is_active: true },
      transaction: tx,
    });

    for (const row of previouslyActive) {
      if (row.id === prompt.id) continue;
      await row.update({ is_active: false }, { transaction: tx });
      await logAudit({
        userId: req.user.id,
        action: 'prompt_deactivated',
        entityType: 'prompt_config',
        entityId: row.id,
        details: { name: row.name, replaced_by: prompt.name },
      });
    }

    await prompt.update({ is_active: true }, { transaction: tx });
    await logAudit({
      userId: req.user.id,
      action: 'prompt_activated',
      entityType: 'prompt_config',
      entityId: prompt.id,
      details: { name: prompt.name },
    });

    await tx.commit();
    promptConfigService.invalidate();
    res.json(prompt);
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* ignore */
    }
    next(err);
  }
});

/** Version history (B5) — replaces audit-log bloat for prompt text. */
router.get('/:id/versions', async (req, res, next) => {
  try {
    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const versions = await promptVersionService.listVersions(req.params.id, { limit });
    res.json(versions);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/versions/:versionId', async (req, res, next) => {
  try {
    const version = await promptVersionService.getVersion(req.params.versionId);
    if (!version || version.prompt_config_id !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' });
    }
    res.json(version);
  } catch (err) {
    next(err);
  }
});

/** Backward-compatible alias. */
router.get('/:id/history', async (req, res, next) => {
  try {
    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    const versions = await promptVersionService.listVersions(req.params.id, { limit: 20 });
    res.json(versions);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/compare', async (req, res, next) => {
  try {
    const schema = Joi.object({
      left: Joi.string().uuid().required(),
      right: Joi.string().uuid().required(),
    });
    const { error, value } = schema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const comparison = await promptVersionService.compareVersions(value.left, value.right);
    res.json(comparison);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

router.post('/:id/compare-test', async (req, res, next) => {
  try {
    const schema = Joi.object({
      test_prompt: Joi.string().min(10).max(2000).required(),
      version_a_id: Joi.string().uuid().required(),
      version_b_id: Joi.string().uuid().required(),
      mode: Joi.string().valid('auto', 'pi_sheet', 'qa').default('auto'),
      locale: Joi.string().valid('de', 'en').default('de'),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const [va, vb] = await Promise.all([
      promptVersionService.getVersion(value.version_a_id),
      promptVersionService.getVersion(value.version_b_id),
    ]);
    if (!va || !vb || va.prompt_config_id !== prompt.id || vb.prompt_config_id !== prompt.id) {
      return res.status(404).json({ error: 'Version not found for this configuration' });
    }

    const base = prompt.get({ plain: true });
    const promptA = { ...base, system_prompt: va.system_prompt };
    const promptB = { ...base, system_prompt: vb.system_prompt };
    const opts = {
      mode: value.mode,
      locale: value.locale,
      role: req.user.role,
    };

    const [resultA, resultB] = await Promise.all([
      runPromptTest(value.test_prompt, req.user.id, promptA, opts),
      runPromptTest(value.test_prompt, req.user.id, promptB, opts),
    ]);

    res.json({
      version_a: { id: va.id, version_number: va.version_number, result: resultA },
      version_b: { id: vb.id, version_number: vb.version_number, result: resultB },
    });
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
      system_prompt_override: Joi.string().min(20).max(50_000).optional(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const prompt = await PromptConfig.findByPk(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const promptForTest = value.system_prompt_override
      ? { ...prompt.get({ plain: true }), system_prompt: value.system_prompt_override }
      : prompt;
    const usedDraft = Boolean(value.system_prompt_override);

    const result = await runPromptTest(value.test_prompt, req.user.id, promptForTest, {
      mode: value.mode,
      locale: value.locale,
      role: req.user.role,
    });

    res.json({ ...result, used_draft: usedDraft });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
