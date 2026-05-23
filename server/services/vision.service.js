const path = require('path');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { createWorker } = require('tesseract.js');
const { getAnthropicClient } = require('../config/anthropic');
const { PromptConfig, PISheet, PISheetStep } = require('../models');
const embeddingService = require('./embedding.service');
const llmService = require('./llm.service');
const { logAudit } = require('./audit.service');
const { applyLocaleToSystemPrompt, getLlmLocaleConfig } = require('../utils/locale');
const { getModelConfig } = require('../utils/llmModel');

async function visionLlmParams() {
  const cfg = await getModelConfig('vision');
  return { model: cfg.model, max_tokens: cfg.max_tokens };
}
const MAX_IMAGE_DIM = 2048;
const PDF_TEXT_MIN_CHARS = 100;
const MATCH_DIRECT = 0.85;
const MATCH_POSSIBLE = 0.6;

const VISION_ANALYSIS_PROMPT = `Du analysierst ein Foto oder Scan eines pharmazeutischen PI Sheets (Process Instruction Sheet) oder Chargenprotokolls.

Extrahiere ALLE erkennbaren Informationen und gib sie als JSON zurück (ohne Markdown-Backticks):

{
  "document_type": "PI Sheet | Chargenprotokoll | Arbeitsanweisung | Unbekannt",
  "title": "Erkannter Titel des Dokuments",
  "process_type": "Verpackung | Abfüllung | Granulation | etc.",
  "metadata": {
    "document_number": "falls erkennbar",
    "version": "falls erkennbar",
    "product": "falls erkennbar",
    "line": "falls erkennbar"
  },
  "steps": [
    {
      "step_nr": 1,
      "name": "Name des Schritts",
      "category_guess": "Warenbewegung | Rückmeldung | Prozess | Qualität | Dokumentation",
      "instruction": "Erkannter Anweisungstext",
      "params": [
        { "name": "Parametername", "value": "vorausgefüllter Wert oder leer", "unit": "Einheit" }
      ],
      "has_signature_field": true,
      "confidence": 0.95
    }
  ],
  "notes": ["Erkannte Hinweise oder Bemerkungen"],
  "quality": {
    "image_quality": "good | medium | poor",
    "readability": "full | partial | low",
    "issues": ["Teilweise unleserlich in Bereich X", "Seite abgeschnitten"]
  }
}

Wichtig:
- Erkenne auch handschriftliche Einträge wenn möglich
- Bei unleserlichen Stellen: setze den Wert auf null und notiere es in quality.issues
- Versuche die Kategorie jedes Schritts zu erraten basierend auf dem Inhalt
- SAP-spezifische Begriffe (Bewegungsart, Rückmeldung, MIGO, CO11N) sind Hinweise für die Kategorisierung
- Wenn es ein mehrseitiges Dokument ist, nummeriere die Schritte durchgehend
- Sprache: Deutsch oder Englisch — gib alles so wieder wie es auf dem Dokument steht`;

const TEXT_ANALYSIS_PROMPT = `Du analysierst den extrahierten Text eines pharmazeutischen PI Sheets, Chargenprotokolls, Arbeitsanweisung oder einer PI-Vorlage (Word/Excel/PDF).

Extrahiere ALLE erkennbaren Informationen und gib sie als JSON zurück (ohne Markdown-Backticks):

{
  "document_type": "PI Sheet | Chargenprotokoll | Arbeitsanweisung | Unbekannt",
  "title": "Erkannter Titel des Dokuments",
  "process_type": "Verpackung | Abfüllung | Granulation | etc.",
  "metadata": {
    "document_number": "falls erkennbar",
    "version": "falls erkennbar",
    "product": "falls erkennbar",
    "line": "falls erkennbar"
  },
  "steps": [
    {
      "step_nr": 1,
      "name": "Name des Schritts",
      "category_guess": "Warenbewegung | Rückmeldung | Prozess | Qualität | Dokumentation",
      "instruction": "Erkannter Anweisungstext",
      "params": [
        { "name": "Parametername", "value": "vorausgefüllter Wert oder leer", "unit": "Einheit" }
      ],
      "has_signature_field": true,
      "confidence": 0.95
    }
  ],
  "notes": ["Erkannte Hinweise oder Bemerkungen"],
  "quality": {
    "image_quality": "good | medium | poor",
    "readability": "full | partial | low",
    "issues": []
  }
}

Wichtig:
- Tabellen und nummerierte Listen als Prozessschritte interpretieren
- SAP-Begriffe (Bewegungsart, Rückmeldung, MIGO, CO11N) für Kategorisierung nutzen
- Schritte durchgehend nummerieren
- Sprache: wie im Dokument (Deutsch/Englisch)`;

const PI_SHEET_GENERATION_PROMPT = `Basierend auf der Dokumentenerkennung und den Repository-Matches erstelle ein vollständiges PI Sheet als JSON (ohne Markdown-Backticks).

Nutze für Schritte mit status "matched" die Repository-XStep-Daten (xstep_id, instruction_template, params).
Für "possible" nutze den vorgeschlagenen XStep, markiere in warnings dass User-Bestätigung nötig ist.
Für "new" behalte den erkannten Text, setze is_suggestion: true und xstep_id wie "NEW-001".

Ergänze fehlende GMP-Schritte (Linienclearance, IPC, Dokumentation) wenn nicht vorhanden — als is_suggestion: true.

Format (wie Standard-PI-Sheet):
{
  "title": "...",
  "process_type": "...",
  "description": "...",
  "steps": [
    {
      "step_nr": 1,
      "xstep_id": "XS-... oder NEW-...",
      "name": "...",
      "category": "Warenbewegung|...",
      "instruction": "Deutsche Operatorenanweisung",
      "params": [{"name": "...", "type": "input|display|checkbox", "unit": "...", "required": true}],
      "is_suggestion": false
    }
  ],
  "notes": [],
  "warnings": ["Entwurf — menschliche Prüfung erforderlich"]
}`;

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.docx', '.xlsx']);

function fileExtension(filename) {
  return path.extname(filename || '').toLowerCase();
}

function detectSourceType(filename, mimetype) {
  const ext = fileExtension(filename);
  if (['.jpg', '.jpeg', '.png'].includes(ext) || mimetype?.startsWith('image/')) {
    return 'image';
  }
  if (ext === '.pdf' || mimetype === 'application/pdf') return 'pdf';
  if (ext === '.docx' || mimetype?.includes('wordprocessingml')) return 'docx';
  if (ext === '.xlsx' || mimetype?.includes('spreadsheetml')) return 'xlsx';
  return null;
}

async function optimizeImageBuffer(buffer) {
  const pipeline = sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, { fit: 'inside', withoutEnlargement: true })
    .normalize()
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png();

  const out = await pipeline.toBuffer();
  return {
    buffer: out,
    base64: out.toString('base64'),
    mediaType: 'image/png',
  };
}

async function ocrImageBuffer(buffer) {
  const worker = await createWorker('deu+eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

async function preprocessImage(buffer, filename) {
  const optimized = await optimizeImageBuffer(buffer);
  return {
    mode: 'vision',
    source: { type: 'image', filename, pages: 1 },
    images: [optimized],
    text: null,
  };
}

async function preprocessPdf(buffer, filename) {
  const parser = new PDFParse({ data: buffer });
  try {
    let text = '';
    let pageCount = 1;
    try {
      const textResult = await parser.getText();
      text = (textResult.text || '').trim();
      pageCount = textResult.total || textResult.pages?.length || 1;
    } catch {
      text = '';
    }

    if (text.length >= PDF_TEXT_MIN_CHARS) {
      return {
        mode: 'text',
        source: { type: 'pdf', filename, pages: pageCount },
        images: [],
        text,
      };
    }

    const screenshot = await parser.getScreenshot({
      scale: 2,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const images = [];
    for (const page of screenshot.pages || []) {
      if (!page.data) continue;
      images.push(await optimizeImageBuffer(page.data));
    }

    if (!images.length) {
      throw new Error('PDF konnte nicht als Bild verarbeitet werden (Scan ohne Text)');
    }

    return {
      mode: 'vision',
      source: { type: 'pdf', filename, pages: images.length },
      images,
      text: text || null,
    };
  } finally {
    await parser.destroy();
  }
}

async function preprocessDocx(buffer, filename) {
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || '').trim();
  if (!text) {
    throw new Error('DOCX enthält keinen extrahierbaren Text');
  }
  return {
    mode: 'text',
    source: { type: 'docx', filename, pages: 1 },
    images: [],
    text,
  };
}

function preprocessXlsx(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    parts.push(`## Sheet: ${sheetName}\n${rows.map((r) => r.join('\t')).join('\n')}`);
  }
  const text = parts.join('\n\n');
  if (!text.trim()) {
    throw new Error('XLSX enthält keine Daten');
  }
  return {
    mode: 'text',
    source: { type: 'xlsx', filename, pages: workbook.SheetNames.length },
    images: [],
    text,
  };
}

async function preprocessFile(file) {
  const ext = fileExtension(file.originalname);
  const sourceType = detectSourceType(file.originalname, file.mimetype);
  if (!sourceType || !ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error('Nicht unterstütztes Format. Erlaubt: JPG, PNG, PDF, DOCX, XLSX');
    err.statusCode = 400;
    throw err;
  }

  switch (sourceType) {
    case 'image':
      return preprocessImage(file.buffer, file.originalname);
    case 'pdf':
      return preprocessPdf(file.buffer, file.originalname);
    case 'docx':
      return preprocessDocx(file.buffer, file.originalname);
    case 'xlsx':
      return preprocessXlsx(file.buffer, file.originalname);
    default:
      throw new Error('Unbekannter Dateityp');
  }
}

function buildVisionMessageContent(images) {
  const blocks = [];
  for (const img of images) {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    });
  }
  blocks.push({ type: 'text', text: VISION_ANALYSIS_PROMPT });
  return blocks;
}

async function runClaudeAnalysis(preprocessed, options = {}) {
  const client = getAnthropicClient();
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  let userContent;
  if (preprocessed.mode === 'vision') {
    userContent = buildVisionMessageContent(preprocessed.images);
  } else {
    userContent = `${preprocessed.text}\n\n${TEXT_ANALYSIS_PROMPT}`;
  }

  const llmParams = await visionLlmParams();
  const response = await client.messages.create({
    ...llmParams,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  let recognized = llmService.parseLlmJson(text);

  const quality = recognized.quality || {};
  const needsOcr =
    options.ocrFallback !== false &&
    preprocessed.mode === 'vision' &&
    preprocessed.images?.length &&
    (quality.readability === 'low' || quality.image_quality === 'poor');

  if (needsOcr && preprocessed.images[0]?.buffer) {
    const ocrText = await ocrImageBuffer(preprocessed.images[0].buffer);
    if (ocrText.trim().length > 50) {
      const ocrResponse = await client.messages.create({
        ...llmParams,
        messages: [
          {
            role: 'user',
            content: `OCR-Extrakt (Fallback):\n${ocrText}\n\n${TEXT_ANALYSIS_PROMPT}`,
          },
        ],
      });
      const ocrOut = ocrResponse.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      recognized = llmService.parseLlmJson(ocrOut);
      recognized.quality = {
        ...recognized.quality,
        issues: [...(recognized.quality?.issues || []), 'Analyse mit OCR-Fallback'],
      };
    }
  }

  return recognized;
}

function matchStatusFromSimilarity(similarity) {
  if (similarity >= MATCH_DIRECT) return 'matched';
  if (similarity >= MATCH_POSSIBLE) return 'possible';
  return 'new';
}

function buildStepSearchText(step) {
  const params = Array.isArray(step.params) ? step.params : [];
  const paramStr = params.map((p) => `${p.name} ${p.value || ''} ${p.unit || ''}`).join(' ');
  return [step.name, step.instruction, step.category_guess, paramStr].filter(Boolean).join(' - ');
}

async function matchStepsToRepository(steps, processType) {
  const matches = [];
  let matchedCount = 0;
  let newCount = 0;

  for (const step of steps || []) {
    const queryText = buildStepSearchText(step);
    let similar = [];
    try {
      similar = await embeddingService.searchSimilar(queryText, {
        limit: 3,
        processType: processType || null,
      });
    } catch {
      similar = await embeddingService.searchByKeywords(queryText, {
        limit: 3,
        processType: processType || null,
      });
    }

    const top = similar[0];
    const similarity = top?.similarity != null ? Number(top.similarity) : 0;
    const status = matchStatusFromSimilarity(similarity);

    if (status === 'matched') matchedCount += 1;
    else if (status === 'new') newCount += 1;

    matches.push({
      step_nr: step.step_nr,
      recognized_text: step.name || step.instruction,
      recognized_step: step,
      matched_xstep: status !== 'new' ? top?.xstep_id || null : null,
      matched_xstep_record: status !== 'new' ? top : null,
      match_confidence: Math.round(similarity * 100) / 100,
      status,
      alternatives: similar.slice(1, 3).map((x) => ({
        xstep_id: x.xstep_id,
        name: x.name,
        similarity: x.similarity != null ? Number(x.similarity) : null,
      })),
    });
  }

  const stepConfidences = (steps || []).map((s) => s.confidence).filter((c) => typeof c === 'number');
  const avgDocConfidence = stepConfidences.length
    ? stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length
    : 0.75;

  return {
    matches,
    matched_to_repository: matchedCount,
    new_steps: newCount,
    recognized_steps: steps?.length || 0,
    confidence: Math.round(avgDocConfidence * 100) / 100,
  };
}

async function generatePiSheetFromRecognition(recognized, matchResult, locale = 'de') {
  const client = getAnthropicClient();
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const promptConfig = await PromptConfig.findOne({ where: { is_active: true } });
  const baseSystem = promptConfig?.system_prompt || '';
  const { labels } = getLlmLocaleConfig(locale);
  const system = applyLocaleToSystemPrompt(
    `${baseSystem}\n\n${PI_SHEET_GENERATION_PROMPT}`,
    locale
  );

  const contextPayload = {
    recognized,
    matches: matchResult.matches,
    summary: {
      matched: matchResult.matched_to_repository,
      new_steps: matchResult.new_steps,
    },
  };

  const llmParams = await visionLlmParams();
  const response = await client.messages.create({
    ...llmParams,
    system,
    messages: [
      {
        role: 'user',
        content: `${labels.visionRecognition}:\n${JSON.stringify(contextPayload, null, 2)}\n\n${labels.visionGenerate}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return llmService.validatePiSheet(llmService.parseLlmJson(text));
}

async function analyzeDocument(file) {
  const preprocessed = await preprocessFile(file);
  const recognized = await runClaudeAnalysis(preprocessed);
  const matchResult = await matchStepsToRepository(
    recognized.steps || [],
    recognized.process_type
  );

  return {
    status: 'analyzed',
    source: preprocessed.source,
    recognized,
    quality: recognized.quality || {},
    matches: matchResult.matches,
    summary: {
      confidence: matchResult.confidence,
      recognized_steps: matchResult.recognized_steps,
      matched_to_repository: matchResult.matched_to_repository,
      new_steps: matchResult.new_steps,
    },
  };
}

async function generateFromDocument(file, userId, options = {}) {
  const preprocessed = await preprocessFile(file);
  const recognized = await runClaudeAnalysis(preprocessed);
  const matchResult = await matchStepsToRepository(
    recognized.steps || [],
    recognized.process_type
  );
  const piSheetJson = await generatePiSheetFromRecognition(
    recognized,
    matchResult,
    options.locale
  );

  const userPrompt = `Vision-Import: ${file.originalname}`;
  const saved = await llmService.savePiSheet(
    piSheetJson,
    userPrompt,
    userId,
    options.locale
  );

  await logAudit({
    userId,
    action: 'pi_sheet_vision_generated',
    entityType: 'pi_sheet',
    entityId: saved.id,
    details: {
      filename: file.originalname,
      source: preprocessed.source,
      matched: matchResult.matched_to_repository,
    },
  });

  return {
    status: 'generated',
    source: preprocessed.source,
    confidence: matchResult.confidence,
    recognized,
    quality: recognized.quality || {},
    pi_sheet: saved,
    pi_sheet_json: piSheetJson,
    matches: matchResult.matches,
    recognized_steps: matchResult.recognized_steps,
    matched_to_repository: matchResult.matched_to_repository,
    new_steps: matchResult.new_steps,
  };
}

async function confirmPiSheet(piSheetId, { confirmed_steps = [], edits = [] }, userId) {
  const piSheet = await PISheet.findByPk(piSheetId, {
    include: [{ association: 'steps', separate: true, order: [['sort_order', 'ASC']] }],
  });
  if (!piSheet) {
    const err = new Error('PI Sheet not found');
    err.statusCode = 404;
    throw err;
  }

  const stepsByNr = new Map((piSheet.steps || []).map((s) => [s.step_nr, s]));

  for (const edit of edits) {
    const step = stepsByNr.get(edit.step_nr);
    if (!step) continue;
    if (edit.name != null) step.name = edit.name;
    if (edit.category != null) step.category = edit.category;
    if (edit.instruction != null) step.instruction = edit.instruction;
    if (edit.params != null) step.params = edit.params;
    if (edit.xstep_id != null) step.xstep_id = edit.xstep_id;
    if (edit.remove) {
      await step.destroy();
      stepsByNr.delete(edit.step_nr);
      continue;
    }
    await step.save();
  }

  for (const confirmed of confirmed_steps) {
    const step = stepsByNr.get(confirmed.step_nr);
    if (!step) continue;
    if (confirmed.xstep_id) step.xstep_id = confirmed.xstep_id;
    if (confirmed.accept_repository_match) {
      step.is_suggestion = false;
    }
    await step.save();
  }

  const llmResponse = { ...(piSheet.llm_response || {}) };
  if (Array.isArray(llmResponse.warnings)) {
    llmResponse.warnings = llmResponse.warnings.filter(
      (w) => !String(w).includes('Bestätigung')
    );
  }
  piSheet.llm_response = llmResponse;
  piSheet.status = 'confirmed';
  await piSheet.save();

  await logAudit({
    userId,
    action: 'pi_sheet_vision_confirmed',
    entityType: 'pi_sheet',
    entityId: piSheet.id,
    details: { edits: edits.length, confirmed: confirmed_steps.length },
  });

  return PISheet.findByPk(piSheetId, {
    include: [{ association: 'steps', separate: true, order: [['sort_order', 'ASC']] }],
  });
}

module.exports = {
  analyzeDocument,
  generateFromDocument,
  confirmPiSheet,
  preprocessFile,
  VISION_ANALYSIS_PROMPT,
  TEXT_ANALYSIS_PROMPT,
};
