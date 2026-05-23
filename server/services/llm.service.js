const { EventEmitter } = require('events');
const { getAnthropicClient } = require('../config/anthropic');
const { PISheet, PISheetStep, EquipmentConfig } = require('../models');
const embeddingService = require('./embedding.service');
const knowledgeService = require('./knowledge.service');
const graphService = require('./graph.service');
const { logAudit } = require('./audit.service');
const settingsService = require('./settings.service');
const promptConfigService = require('./promptConfig.service');
const {
  EQUIPMENT_TOOL_DEFINITIONS,
  executeEquipmentToolSafe,
} = require('./equipment/equipment-llm.tools');
const {
  GRAPH_TOOL_DEFINITIONS,
  GRAPH_TOOL_NAMES,
  executeGraphToolSafe,
} = require('./graph-llm.tools');
const { applyLocaleToSystemPrompt, getLlmLocaleConfig } = require('../utils/locale');
const { enrichPiSheetConfidence } = require('../utils/piSheetConfidence');
const { addUsage, extractUsageFromResponse } = require('../utils/llmUsage');
const {
  LlmError,
  mapLlmError,
  isMcpRetryable,
  parseLlmJson,
  validatePiSheet,
} = require('../utils/llmErrors');
const { trimBuildContext } = require('../utils/llmContext');
const { withTimeout } = require('../utils/withTimeout');
const { getModelConfig } = require('../utils/llmModel');
const {
  detectSapPath,
  filterXStepsBySapPath,
  sapPathPromptHint,
} = require('../utils/sapPathHints');
const tokenBudget = require('./tokenBudget.service');

const MCP_BETA = 'mcp-client-2025-11-20';
const SAP_MCP_SERVER_NAME = 'sap-mcp';
const LLM_REQUEST_TIMEOUT_MS = 150_000;

const PROCESS_TYPES = ['Verpackung', 'Abfüllung', 'Granulation', 'Tablettierung', 'Coating'];

async function callAnthropic(createFn) {
  try {
    return await withTimeout(createFn(), LLM_REQUEST_TIMEOUT_MS, 'Anthropic API');
  } catch (err) {
    throw mapLlmError(err);
  }
}

function formatXStepsContext(xsteps) {
  return JSON.stringify(
    xsteps.map((x) => ({
      xstep_id: x.xstep_id,
      name: x.name,
      category: x.category,
      process_type: x.process_type,
      sap_system: x.sap_system || null,
      tags: Array.isArray(x.tags) ? x.tags : [],
      description: x.description,
      instruction_template: x.instruction_template,
      params: x.params,
      sap_transaction: x.sap_transaction,
      movement_type: x.movement_type,
      gmp_relevant: x.gmp_relevant,
      signature_required: x.signature_required,
    })),
    null,
    2
  );
}

function inferProcessType(userPrompt) {
  const lower = userPrompt.toLowerCase();
  for (const type of PROCESS_TYPES) {
    if (lower.includes(type.toLowerCase())) return type;
  }
  return null;
}

async function retrieveXSteps(userPrompt, processType) {
  try {
    return await embeddingService.searchSimilar(userPrompt, { limit: 15, processType });
  } catch {
    return embeddingService.searchByKeywords(userPrompt, { limit: 15, processType });
  }
}

async function retrieveDocumentChunks(userPrompt, processType) {
  try {
    return await knowledgeService.searchChunks(userPrompt, { limit: 10, processType });
  } catch {
    return [];
  }
}

function formatEquipmentContext(rows) {
  return JSON.stringify(
    rows.map((r) => {
      const row = r.dataValues || r;
      return {
        equipment_id: row.equipment_id,
        name: row.name,
        equipment_type: row.equipment_type,
        location: row.location,
        connection_type: row.connection_type,
        max_capacity_kg: row.scale_config?.max_capacity_kg ?? null,
        resolution_kg: row.scale_config?.resolution_kg ?? null,
      };
    }),
    null,
    2
  );
}

async function retrieveEquipmentContext() {
  return EquipmentConfig.findAll({
    where: { is_active: true },
    order: [['equipment_id', 'ASC']],
    attributes: [
      'equipment_id',
      'name',
      'equipment_type',
      'location',
      'connection_type',
      'scale_config',
    ],
  });
}

function formatDocumentChunksContext(chunks, locale = 'de') {
  const fallbackSource = locale === 'en' ? 'Document' : 'Dokument';
  const items = chunks.map((chunk) => ({
    source: chunk.document_title || chunk.filename || fallbackSource,
    page: chunk.page_number,
    content: chunk.content,
  }));
  return JSON.stringify(items, null, 2);
}

/**
 * Build messages for the LLM.
 *
 * `mode`:
 *   - 'pi_sheet': full RAG (xsteps, docs, graph, equipment) + EWM/MM filter
 *   - 'qa':      minimal context — tools fetch live data, no RAG embedding cost
 */
async function buildMessages(userPrompt, systemPrompt, locale = 'de', mode = 'pi_sheet') {
  const localeCfg = getLlmLocaleConfig(locale);
  const {
    documentContextAppend,
    equipmentContextAppend,
    mcpContextAppend,
    graphContextAppend,
    labels,
  } = localeCfg;

  const sapOn = await isSapMcpEnabled();
  const mcpAppend = sapOn ? mcpContextAppend : '';

  if (mode === 'qa') {
    // QA-Modus: kein RAG, kein Embedding, keine Graph-Berechnung.
    // Equipment-Daten kommen über Tools (list_equipment, get_equipment_config, ...).
    const extendedSystem = applyLocaleToSystemPrompt(
      `${systemPrompt}${mcpAppend}`,
      locale
    );
    return {
      xsteps: [],
      graphCtx: { chain: [], requirements: [] },
      docChunks: [],
      equipmentRows: [],
      userContent: `${labels.userRequest}: ${userPrompt}`,
      systemPrompt: extendedSystem,
      contextTrimmed: false,
      trimmedSections: [],
      sapPath: 'auto',
    };
  }

  const processType = inferProcessType(userPrompt);
  const sapPath = detectSapPath(userPrompt);

  const [rawXsteps, docChunks, equipmentRows] = await Promise.all([
    retrieveXSteps(userPrompt, processType),
    retrieveDocumentChunks(userPrompt, processType),
    retrieveEquipmentContext(),
  ]);

  const filteredXsteps = filterXStepsBySapPath(rawXsteps, sapPath);
  const { xsteps, graphCtx } = await graphService.mergeXStepsWithGraph(
    filteredXsteps,
    processType
  );

  let xstepsJSON = formatXStepsContext(xsteps);
  let graphJSON = graphService.formatGraphContext(graphCtx, locale);
  let docsJSON = formatDocumentChunksContext(docChunks, locale);
  let equipmentJSON = formatEquipmentContext(equipmentRows);

  const trimmed = trimBuildContext(
    { graphJSON, xstepsJSON, docsJSON, equipmentJSON },
    { locale }
  );
  graphJSON = trimmed.graphJSON;
  xstepsJSON = trimmed.xstepsJSON;
  docsJSON = trimmed.docsJSON;
  equipmentJSON = trimmed.equipmentJSON;

  const pathHint = sapPathPromptHint(sapPath, locale);
  const extendedSystem = applyLocaleToSystemPrompt(
    `${systemPrompt}${graphContextAppend}${documentContextAppend}${equipmentContextAppend}${mcpAppend}${
      pathHint ? `\n\n${pathHint}` : ''
    }`,
    locale
  );

  const userParts = [
    `${labels.processGraph}:\n${graphJSON}`,
    `${labels.xsteps}:\n${xstepsJSON}`,
    `${labels.documents}: ${docsJSON}`,
    `${labels.equipment}:\n${equipmentJSON}`,
  ];
  if (pathHint) userParts.push(pathHint);
  userParts.push(`${labels.userRequest}: ${userPrompt}`);
  const userContent = userParts.join('\n\n');

  return {
    xsteps,
    graphCtx,
    docChunks,
    equipmentRows,
    userContent,
    systemPrompt: extendedSystem,
    contextTrimmed: trimmed.contextTrimmed,
    trimmedSections: trimmed.trimmedSections,
    sapPath,
  };
}

async function isSapMcpEnabled() {
  try {
    const dbEnabled = await settingsService.isFeatureEnabled('sap_integration_enabled');
    if (!dbEnabled) return false;
  } catch {
    const flag = process.env.SAP_MCP_ENABLED;
    if (flag === 'false' || flag === '0') return false;
  }
  const url =
    (await settingsService.get('sap_mcp_url').catch(() => null)) || process.env.SAP_MCP_URL;
  return Boolean(url);
}

function isEquipmentIntent(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const questionPatterns = [
    /welche\s+(waggen|waagen|geräte|gerate|skalen|scales)/,
    /welche\s+.+\s+sind\s+aktiv/,
    /sind\s+(die\s+)?(waggen|waagen|geräte|gerate).*\s+aktiv/,
    /aktive?\s+(waggen|waagen|geräte|gerate)/,
    /gibt\s+es\s+.*(waagen|waggen|equipment)/,
    /which\s+(wagons?|scales?|equipment)/,
    /are\s+.*\s+active/,
    /what\s+equipment/,
    /show\s+.*equipment/,
    /list\s+equipment/,
  ];
  if (questionPatterns.some((re) => re.test(lower))) return true;

  const equipmentHints = [
    'waggon',
    'waggen',
    'waage',
    'waagen',
    'equipment',
    'gerät',
    'geräte',
    'gerate',
    'opc-ua',
    'opc ua',
    'uns',
    'mqtt',
    'namespace',
    'scale',
    'sensor',
    'messwert',
    'verbindung',
  ];
  const looksLikeQuestion = /\?|welche|which|wie viele|how many|zeig|show|list|sind|are|gibt/i.test(
    lower
  );
  return looksLikeQuestion && equipmentHints.some((h) => lower.includes(h));
}

function isPiSheetIntent(prompt) {
  if (isEquipmentIntent(prompt)) return false;
  const lower = prompt.toLowerCase();
  const createWords = [
    'erstelle',
    'erzeug',
    'generier',
    'create',
    'generate',
    'pi sheet',
    'pi-sheet',
    'prozessanweisung',
    'process instruction',
    'anweisung',
    'prozessschritt',
    'batch',
    'charge',
  ];
  return createWords.some((w) => lower.includes(w));
}

function extractTextFromResponse(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function executeChatToolSafe(name, input = {}) {
  if (GRAPH_TOOL_NAMES.has(name)) {
    return executeGraphToolSafe(name, input);
  }
  return executeEquipmentToolSafe(name, input);
}

async function runToolLoop(client, requestParams, maxRounds = 6) {
  const createMessage = requestParams.mcp_servers
    ? (params) =>
        callAnthropic(() => client.beta.messages.create({ ...params, betas: [MCP_BETA] }))
    : (params) => callAnthropic(() => client.messages.create(params));

  // FIX A1: do NOT inject default tools when the caller explicitly omitted them
  // (e.g. PI-sheet generation must reply with JSON, not with tool_use blocks).
  let response = await createMessage(requestParams);
  let usage = extractUsageFromResponse(response);
  let rounds = 0;

  while (rounds < maxRounds && response.content.some((b) => b.type === 'tool_use')) {
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let result;
      try {
        result = await executeChatToolSafe(block.name, block.input || {});
      } catch (err) {
        result = { error: err.message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    const nextParams = {
      ...requestParams,
      messages: [
        ...requestParams.messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    };

    response = await createMessage(nextParams);
    usage = addUsage(usage, response);
    rounds += 1;
  }

  return { response, usage };
}

async function buildMcpConnectorParams() {
  if (!(await isSapMcpEnabled())) return {};

  const url = (
    (await settingsService.get('sap_mcp_url')) ||
    process.env.SAP_MCP_URL ||
    ''
  ).replace(/\/$/, '');
  const token = process.env.SAP_MCP_AUTH_TOKEN;

  const serverDef = {
    type: 'url',
    url,
    name: SAP_MCP_SERVER_NAME,
  };
  if (token) {
    serverDef.authorization_token = token;
  }

  return {
    betas: [MCP_BETA],
    mcp_servers: [serverDef],
    tools: [{ type: 'mcp_toolset', mcp_server_name: SAP_MCP_SERVER_NAME }],
  };
}

async function buildClaudeRequestParams({ systemPrompt, userContent }, options = {}) {
  const {
    includeMcp = true,
    includeEquipmentTools = true,
    includeGraphTools = false,
    mode = 'pi_sheet',
    modelOverride,
    maxTokensOverride,
  } = options;

  const cfg = await getModelConfig(mode);
  const model = modelOverride || cfg.model;
  const max_tokens = maxTokensOverride || cfg.max_tokens;

  const mcp = includeMcp ? await buildMcpConnectorParams() : {};
  const { tools: mcpTools, ...mcpRest } = mcp;
  const tools = [
    ...(includeEquipmentTools ? EQUIPMENT_TOOL_DEFINITIONS : []),
    ...(includeGraphTools ? GRAPH_TOOL_DEFINITIONS : []),
    ...(mcpTools || []),
  ];
  return {
    model,
    max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    ...(tools.length ? { tools } : {}),
    ...mcpRest,
  };
}

function requireAnthropicClient() {
  const client = getAnthropicClient();
  if (!client) {
    throw mapLlmError(new Error('ANTHROPIC_API_KEY is not configured'));
  }
  return client;
}

async function requireActivePromptConfig(options = {}) {
  const promptConfig =
    options.promptConfig ||
    (await promptConfigService.getForMode(options.mode || 'pi_sheet'));
  if (!promptConfig) {
    throw mapLlmError(new Error('No active prompt configuration found'));
  }
  return promptConfig;
}

async function buildPiSheetRequestParams(systemPrompt, userContent, includeMcp, maxTokensOverride) {
  return buildClaudeRequestParams(
    { systemPrompt, userContent },
    {
      includeMcp,
      includeEquipmentTools: false,
      includeGraphTools: false,
      mode: 'pi_sheet',
      maxTokensOverride,
    }
  );
}

async function savePiSheet(parsed, userPrompt, userId, options = {}) {
  const locale = typeof options === 'string' ? options : options.locale || 'de';
  const contextXstepIds = options.contextXstepIds || [];
  const enriched = await enrichPiSheetConfidence(parsed, { contextXstepIds });
  if (options.usage) {
    enriched.llm_usage = options.usage;
  }
  const warnings = await graphService.warningsForPiSheet(enriched, locale);
  const defaultPlant =
    (await settingsService.get('default_plant').catch(() => null)) || 'CH01';
  const piSheet = await PISheet.create({
    title: enriched.title,
    process_type: enriched.process_type || null,
    plant: enriched.plant || defaultPlant,
    description: enriched.description || null,
    user_prompt: userPrompt,
    llm_response: enriched,
    status: 'draft',
    notes: enriched.notes || [],
    warnings,
    created_by: userId,
  });

  const steps = enriched.steps.map((step, idx) => ({
    pi_sheet_id: piSheet.id,
    step_nr: step.step_nr ?? idx + 1,
    xstep_id: step.xstep_id || null,
    name: step.name,
    category: step.category || null,
    instruction: step.instruction || null,
    params: step.params || [],
    is_suggestion: Boolean(step.is_suggestion),
    sort_order: step.step_nr ?? idx + 1,
  }));

  await PISheetStep.bulkCreate(steps);

  await logAudit({
    userId,
    action: 'pi_sheet_generated',
    entityType: 'pi_sheet',
    entityId: piSheet.id,
      details: {
        title: piSheet.title,
        stepCount: steps.length,
        ...(options.usage ? { token_usage: options.usage } : {}),
      },
  });

  return PISheet.findByPk(piSheet.id, {
    include: [{ association: 'steps', separate: true, order: [['sort_order', 'ASC']] }],
  });
}

async function guardTokenBudget(userId, options = {}) {
  await tokenBudget.assertWithinBudget(userId, options.role);
}

async function trackTokenUsage(userId, usage) {
  await tokenBudget.recordUsage(userId, usage);
}

async function generatePISheet(userPrompt, userId, options = {}) {
  await guardTokenBudget(userId, options);
  const client = requireAnthropicClient();
  const promptConfig = await requireActivePromptConfig({
    ...options,
    mode: 'pi_sheet',
  });

  const ctx = await buildMessages(
    userPrompt,
    promptConfig.system_prompt,
    options.locale,
    'pi_sheet'
  );
  const { userContent, systemPrompt, xsteps, equipmentRows } = ctx;
  const allowedEquipmentIds = equipmentRows.map(
    (r) => (r.dataValues || r).equipment_id
  );

  let requestParams = await buildPiSheetRequestParams(systemPrompt, userContent, true);
  const hadMcp = Boolean(requestParams.mcp_servers?.length);
  let response;
  let usage = null;
  const maxRetryTokens = 8000;

  const runGeneration = async (params) => {
    try {
      return await runToolLoop(client, params);
    } catch (err) {
      if (hadMcp && isMcpRetryable(err)) {
        console.warn('[llm] Request failed (MCP-retryable), retry without MCP:', err.message);
        const fallbackParams = await buildPiSheetRequestParams(systemPrompt, userContent, false);
        return runToolLoop(client, fallbackParams);
      }
      throw mapLlmError(err);
    }
  };

  ({ response, usage } = await runGeneration(requestParams));

  let text = extractTextFromResponse(response);
  let parsed;
  try {
    parsed = validatePiSheet(parseLlmJson(text, { stopReason: response.stop_reason }), text, {
      allowedEquipmentIds,
    });
  } catch (parseErr) {
    const shouldRetryForTokens =
      parseErr.code === 'PI_JSON_PARSE' &&
      requestParams.max_tokens < maxRetryTokens;
    if (shouldRetryForTokens) {
      console.warn(
        `[llm] PI JSON parse failed at ${requestParams.max_tokens} tokens, retrying with ${maxRetryTokens}`
      );
      requestParams = await buildPiSheetRequestParams(systemPrompt, userContent, false, maxRetryTokens);
      ({ response, usage } = await runGeneration(requestParams));
      text = extractTextFromResponse(response);
      parsed = validatePiSheet(parseLlmJson(text, { stopReason: response.stop_reason }), text, {
        allowedEquipmentIds,
      });
    } else {
      throw parseErr;
    }
  }
  const piSheet = await savePiSheet(parsed, userPrompt, userId, {
    locale: options.locale,
    contextXstepIds: xsteps.map((x) => x.xstep_id),
    usage,
  }).catch((err) => {
    console.error('[llm] savePiSheet failed:', err.message);
    throw new LlmError(
      'PI_SAVE_FAILED',
      'PI Sheet was generated but could not be saved. Please try again.',
      503,
      err.message
    );
  });
  await trackTokenUsage(userId, usage);
  return {
    piSheet,
    usage,
    contextTrimmed: ctx.contextTrimmed,
    trimmedSections: ctx.trimmedSections,
    sapPath: ctx.sapPath,
  };
}

function resolveChatMode(userPrompt) {
  return isPiSheetIntent(userPrompt) ? 'pi_sheet' : 'qa';
}

async function buildAnswerChatRequest(userPrompt, options = {}) {
  const client = requireAnthropicClient();
  const promptConfig = await requireActivePromptConfig({ ...options, mode: 'qa' });

  const qaSystem = applyLocaleToSystemPrompt(
    `${promptConfig.system_prompt}

[Laufzeit — Modus 2 aktiv]
Diese Anfrage ist eine Informationsfrage, kein PI-Sheet-Auftrag. Befolge Abschnitt „Modus 2": natürliche Sprache, Equipment- und Graph-Tools nutzen, kein JSON.

Effizienz:
- Aktive/inaktive Geräte oder Waagen → list_equipment (active_only, equipment_type scale).
- Schrittfolge, Standard-XSteps, Equipment-Zuordnung pro Prozess → get_process_chain oder get_step_requirements.
- KEINE OPC/MQTT-Verbindungen, kein search_industrial_namespace, kein read_equipment_value außer der Nutzer fragt ausdrücklich nach Live-Werten, Namespace oder Nodes.`,
    options.locale
  );

  const ctx = await buildMessages(
    userPrompt,
    promptConfig.system_prompt,
    options.locale,
    'qa'
  );
  const requestParams = await buildClaudeRequestParams(
    { systemPrompt: qaSystem, userContent: ctx.userContent },
    {
      includeMcp: false,
      includeEquipmentTools: true,
      includeGraphTools: true,
      mode: 'qa',
    }
  );
  return { client, requestParams, ctx };
}

async function answerChat(userPrompt, userId, options = {}) {
  await guardTokenBudget(userId, options);
  const { client, requestParams } = await buildAnswerChatRequest(userPrompt, options);
  const { response, usage } = await runToolLoop(client, requestParams);
  const text = extractTextFromResponse(response);
  await trackTokenUsage(userId, usage);
  return { type: 'text', message: text.trim() || 'Keine Antwort.', usage };
}

async function completeChat(userPrompt, userId, options = {}) {
  const requestMode = resolveChatMode(userPrompt);
  if (requestMode === 'pi_sheet') {
    const result = await generatePISheet(userPrompt, userId, options);
    return {
      type: 'pi_sheet',
      requestMode,
      piSheet: result.piSheet,
      usage: result.usage,
      contextTrimmed: result.contextTrimmed,
      trimmedSections: result.trimmedSections,
      sapPath: result.sapPath,
    };
  }
  const answer = await answerChat(userPrompt, userId, options);
  return { type: 'text', requestMode: 'qa', message: answer.message, usage: answer.usage };
}

function createLlmStreamEmitter(client, requestParams, maxRounds = 6, retry = null) {
  const emitter = new EventEmitter();
  let finalMessage = null;
  let totalUsage = null;
  let aborted = false;
  let activeStream = null;

  emitter.abort = () => {
    aborted = true;
    try {
      activeStream?.controller?.abort?.();
    } catch {
      /* ignore */
    }
  };

  const runOnce = async (params) => {
    let messages = [...params.messages];
    let rounds = 0;

    while (rounds < maxRounds) {
      if (aborted) throw new LlmError('LLM_ABORTED', 'Generation aborted by user', 499);
      const msg = await callAnthropic(async () => {
        const stream = client.messages.stream({
          ...params,
          messages,
        });
        activeStream = stream;
        stream.on('text', (text) => emitter.emit('text', text));
        try {
          return await stream.finalMessage();
        } finally {
          activeStream = null;
        }
      });

      totalUsage = addUsage(totalUsage, msg);
      const toolUses = msg.content.filter((b) => b.type === 'tool_use');

      if (!toolUses.length) {
        finalMessage = msg;
        emitter.emit('end', msg);
        return;
      }

      emitter.emit('tools', toolUses.map((t) => t.name));

      const toolResults = [];
      for (const block of toolUses) {
        let result;
        try {
          result = await executeChatToolSafe(block.name, block.input || {});
        } catch (err) {
          result = { error: err.message };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages = [
        ...messages,
        { role: 'assistant', content: msg.content },
        { role: 'user', content: toolResults },
      ];
      rounds += 1;
    }

    throw mapLlmError(new Error('Equipment tool loop exceeded max rounds'));
  };

  (async () => {
    try {
      await runOnce(requestParams);
    } catch (err) {
      const mapped = mapLlmError(err);
      if (
        retry?.withMcpFallback &&
        !retry.attempted &&
        isMcpRetryable(mapped) &&
        !aborted
      ) {
        retry.attempted = true;
        try {
          console.warn('[llm] Stream failed (MCP-retryable), retry without MCP:', err.message);
          const fallbackParams = await retry.buildParams(false);
          await runOnce(fallbackParams);
          return;
        } catch (retryErr) {
          emitter.emit('error', mapLlmError(retryErr));
          return;
        }
      }
      emitter.emit('error', mapped);
    }
  })();

  emitter.finalMessage = async () => {
    if (finalMessage) return finalMessage;
    return new Promise((resolve, reject) => {
      emitter.once('end', resolve);
      emitter.once('error', reject);
    });
  };

  emitter.getUsage = () => totalUsage;

  return emitter;
}

async function generatePISheetStream(userPrompt, userId, options = {}) {
  await guardTokenBudget(userId, options);
  const client = requireAnthropicClient();
  const promptConfig = await requireActivePromptConfig({
    ...options,
    mode: 'pi_sheet',
  });

  options.onProgress?.({ phase: 'searching' });
  const ctx = await buildMessages(
    userPrompt,
    promptConfig.system_prompt,
    options.locale,
    'pi_sheet'
  );
  options.onProgress?.({
    phase: 'context',
    stats: {
      xsteps: ctx.xsteps.length,
      docs: ctx.docChunks.length,
      equipment: ctx.equipmentRows.length,
    },
  });
  const { userContent, systemPrompt, equipmentRows, xsteps, sapPath } = ctx;

  const buildParams = (includeMcp) =>
    buildPiSheetRequestParams(systemPrompt, userContent, includeMcp);

  const requestParams = await buildParams(true);
  const emitter = createLlmStreamEmitter(client, requestParams, 6, {
    withMcpFallback: true,
    attempted: false,
    buildParams,
  });

  emitter.contextMeta = {
    contextTrimmed: ctx.contextTrimmed,
    trimmedSections: ctx.trimmedSections,
    sapPath,
    allowedEquipmentIds: equipmentRows.map(
      (r) => (r.dataValues || r).equipment_id
    ),
    xstepIds: xsteps.map((x) => x.xstep_id),
    stats: {
      xsteps: xsteps.length,
      docs: ctx.docChunks.length,
      equipment: equipmentRows.length,
    },
  };

  return emitter;
}

async function generateAnswerChatStream(userPrompt, userId, options = {}) {
  await guardTokenBudget(userId, options);
  const { client, requestParams } = await buildAnswerChatRequest(userPrompt, options);
  return createLlmStreamEmitter(client, requestParams, 4);
}

async function finalizeAnswerStream(stream, finalMessageOverride) {
  const finalMessage = finalMessageOverride || (await stream.finalMessage());
  const text = extractTextFromResponse(finalMessage);
  const usage = stream.getUsage?.() || extractUsageFromResponse(finalMessage);
  return { message: text.trim() || 'Keine Antwort.', usage };
}

async function finalizeStream(stream, userPrompt, userId, options = {}) {
  const finalMessage = await stream.finalMessage();
  return finalizeFromMessage(finalMessage, userPrompt, userId, {
    ...options,
    usage: stream.getUsage?.() || extractUsageFromResponse(finalMessage),
    contextMeta: stream.contextMeta,
  });
}

async function finalizeFromMessage(finalMessage, userPrompt, userId, options = {}) {
  const text = finalMessage.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const meta = options.contextMeta || {};
  const allowedEquipmentIds = meta.allowedEquipmentIds || [];
  const parsed = validatePiSheet(
    parseLlmJson(text, { stopReason: finalMessage.stop_reason }),
    text,
    { allowedEquipmentIds }
  );

  // Use xstepIds from build phase if available, only fall back to a fresh
  // search when an external caller invoked finalize directly.
  let contextXstepIds = meta.xstepIds;
  if (!contextXstepIds) {
    const processType = parsed.process_type || inferProcessType(userPrompt);
    const rawXsteps = await retrieveXSteps(userPrompt, processType);
    contextXstepIds = rawXsteps.map((x) => x.xstep_id);
  }

  const usage =
    options.usage ||
    extractUsageFromResponse(finalMessage) ||
    null;
  const piSheet = await savePiSheet(parsed, userPrompt, userId, {
    locale: options.locale,
    contextXstepIds,
    usage,
  });
  return { piSheet, usage };
}

module.exports = {
  guardTokenBudget,
  trackTokenUsage,
  generatePISheet,
  generatePISheetStream,
  generateAnswerChatStream,
  finalizeAnswerStream,
  finalizeStream,
  finalizeFromMessage,
  completeChat,
  answerChat,
  resolveChatMode,
  isEquipmentIntent,
  isPiSheetIntent,
  parseLlmJson,
  validatePiSheet,
  savePiSheet,
  mapLlmError,
  LlmError,
  detectSapPath,
};
