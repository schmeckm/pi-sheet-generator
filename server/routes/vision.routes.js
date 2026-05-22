const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const visionService = require('../services/vision.service');
const { normalizeLocale } = require('../utils/locale');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|pdf|docx|xlsx)$/i.test(file.originalname || '');
    if (!allowed) {
      return cb(new Error('Nur JPG, PNG, PDF, DOCX oder XLSX erlaubt'));
    }
    cb(null, true);
  },
});

const visionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) =>
    req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  message: { error: 'Vision-Analyse Limit erreicht. Bitte später erneut versuchen.' },
});

const confirmSchema = Joi.object({
  pi_sheet_id: Joi.string().uuid().required(),
  confirmed_steps: Joi.array()
    .items(
      Joi.object({
        step_nr: Joi.number().integer().required(),
        xstep_id: Joi.string().allow(null, ''),
        accept_repository_match: Joi.boolean(),
      })
    )
    .default([]),
  edits: Joi.array()
    .items(
      Joi.object({
        step_nr: Joi.number().integer().required(),
        name: Joi.string(),
        category: Joi.string(),
        instruction: Joi.string(),
        params: Joi.array(),
        xstep_id: Joi.string().allow(null, ''),
        remove: Joi.boolean(),
      })
    )
    .default([]),
});

router.use(authMiddleware, visionLimiter);

function handleVisionError(err, res, next) {
  if (err.statusCode === 503) {
    return res.status(503).json({
      error: 'Vision-Analyse nicht verfügbar. Bitte ANTHROPIC_API_KEY konfigurieren.',
    });
  }
  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei zu groß (max. 20 MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}

router.post('/analyze', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Datei erforderlich (Feld: file)' });
    }
    const result = await visionService.analyzeDocument(req.file);
    res.json(result);
  } catch (err) {
    handleVisionError(err, res, next);
  }
});

router.post('/generate', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Datei erforderlich (Feld: file)' });
    }
    const result = await visionService.generateFromDocument(req.file, req.user.id, {
      locale: normalizeLocale(req.body?.locale),
    });
    res.json(result);
  } catch (err) {
    handleVisionError(err, res, next);
  }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const { error, value } = confirmSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const piSheet = await visionService.confirmPiSheet(
      value.pi_sheet_id,
      {
        confirmed_steps: value.confirmed_steps,
        edits: value.edits,
      },
      req.user.id
    );
    res.json({ pi_sheet: piSheet });
  } catch (err) {
    handleVisionError(err, res, next);
  }
});

module.exports = router;
