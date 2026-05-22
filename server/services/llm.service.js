const { EventEmitter } = require('events');
const { getAnthropicClient } = require('../config/anthropic');
const { PromptConfig, PISheet, PISheetStep, EquipmentConfig } = require('../models');
const embeddingService = require('./embedding.service');
const knowledgeService = require('./knowledge.service');
const graphService = require('./graph.service');
const { logAudit } = require('./audit.service');
const settingsService = require('./settings.service');
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

const MODEL = 'claude-sonnet-4-20250514';
const MCP_BETA = 'mcp-client-2025-11-20';
const SAP_MCP_SERVER_NAME = 'sap-mcp';

const PROCESS_TYPES = ['Verpackung', 'Abfüllung', 'Granulation', 'Tablettierung', 'Coating'];

function parseLlmJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      return JSON.parse(codeBlock[1].trim());
    }
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse JSON from LLM response');
  }
}

function formatXStepsContext(xsteps) {
  return JSON.stringify(
    xsteps.map((x) => ({
      xstep_id: x.xstep_id,
      name: x.name,
      category: x.category,
      process_type: x.process_type,
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

async function buildMessages(userPrompt, systemPrompt, locale = 'de') {
  const { documentContextAppend, equipmentContextAppend, mcpContextAppend, graphContextAppend, labels } =
    getLlmLocaleConfig(locale);
  const processType = inferProcessType(userPrompt);
  const [rawXsteps, docChunks, equipmentRows] = await Promise.all([
    retrieveXSteps(userPrompt, processType),
    retrieveDocumentChunks(userPrompt, processType),
    retrieveEquipmentContext(),
  ]);
  const { xsteps, graphCtx } = await graphService.mergeXStepsWithGraph(rawXsteps, processType);

  const xstepsJSON = formatXStepsContext(xsteps);
  const graphJSON = graphService.formatGraphContext(graphCtx, locale);
  const docsJSON = formatDocumentChunksContext(docChunks, locale);
  const equipmentJSON = formatEquipmentContext(equipmentRows);
  const sapOn = await isSapMcpEnabled();
  const mcpAppend = sapOn ? mcpContextAppend : '';
  const extendedSystem = applyLocaleToSystemPrompt(
    `${systemPrompt}${graphContextAppend}${documentContextAppend}${equipmentContextAppend}${mcpAppend}`,
    locale
  );

  const userContent = [
    `${labels.processGraph}:\n${graphJSON}`,
    `${labels.xsteps}:\n${xstepsJSON}`,
    `${labels.documents}: ${docsJSON}`,
    `${labels.equipment}:\n${equipmentJSON}`,
    `${labels.userRequest}: ${userPrompt}`,
  ].join('\n\n');

  return { xsteps, graphCtx, docChunks, equipmentRows, userContent, systemPrompt: extendedSystem };
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
        client.beta.messages.create({ ...params, betas: [MCP_BETA] })
    : (params) => client.messages.create(params);

  const defaultTools = [...EQUIPMENT_TOOL_DEFINITIONS, ...GRAPH_TOOL_DEFINITIONS];
  let params = { ...requestParams };
  if (!params.tools?.length) {
    params.tools = defaultTools;
  }
  let response = await createMessage(params);
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

    params = {
      ...requestParams,
      tools: requestParams.tools?.length ? requestParams.tools : defaultTools,
      messages: [
        ...requestParams.messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    };

    response = await createMessage(params);
    rounds += 1;
  }

  return response;
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
  const { includeMcp = true, includeEquipmentTools = true, includeGraphTools = false } = options;
  const mcp = includeMcp ? await buildMcpConnectorParams() : {};
  const { tools: mcpTools, ...mcpRest } = mcp;
  const tools = [
    ...(includeEquipmentTools ? EQUIPMENT_TOOL_DEFINITIONS : []),
    ...(includeGraphTools ? GRAPH_TOOL_DEFINITIONS : []),
    ...(mcpTools || []),
  ];
  return {
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    ...(tools.length ? { tools } : {}),
    ...mcpRest,
  };
}

function validatePiSheet(parsed) {
  if (!parsed?.title || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Invalid PI Sheet structure: title and steps required');
  }
  return parsed;
}

async function savePiSheet(parsed, userPrompt, userId, locale = 'de') {
  const warnings = await graphService.warningsForPiSheet(parsed, locale);
  const piSheet = await PISheet.create({
    title: parsed.title,
    process_type: parsed.process_type || null,
    description: parsed.description || null,
    user_prompt: userPrompt,
    llm_response: parsed,
    status: 'draft',
    notes: parsed.notes || [],
    warnings,
    created_by: userId,
  });

  const steps = parsed.steps.map((step, idx) => ({
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
    details: { title: piSheet.title, stepCount: steps.length },
  });

  return PISheet.findByPk(piSheet.id, {
    include: [{ association: 'steps', separate: true, order: [['sort_order', 'ASC']] }],
  });
}

async function generatePISheet(userPrompt, userId, options = {}) {
  const client = getAnthropicClient();
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const promptConfig =
    options.promptConfig ||
    (await PromptConfig.findOne({ where: { is_active: true } }));
  if (!promptConfig) {
    throw new Error('No active prompt configuration found');
  }

  const { userContent, systemPrompt } = await buildMessages(
    userPrompt,
    promptConfig.system_prompt,
    options.locale
  );

  let requestParams = await buildClaudeRequestParams(
    { systemPrompt, userContent },
    { includeMcp: true, includeEquipmentTools: false }
  );
  let response;
  try {
    response = await runToolLoop(client, requestParams);
  } catch (err) {
    console.warn('[llm] Request failed, retry without MCP:', err.message);
    requestParams = await buildClaudeRequestParams(
      { systemPrompt, userContent },
      { includeMcp: false, includeEquipmentTools: false }
    );
    response = await runToolLoop(client, requestParams);
  }

  const text = extractTextFromResponse(response);
  const parsed = validatePiSheet(parseLlmJson(text));
  return savePiSheet(parsed, userPrompt, userId, options.locale);
}

function resolveChatMode(userPrompt) {
  return isPiSheetIntent(userPrompt) ? 'pi_sheet' : 'qa';
}

async function buildAnswerChatRequest(userPrompt, options = {}) {
  const client = getAnthropicClient();
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const promptConfig =
    options.promptConfig ||
    (await PromptConfig.findOne({ where: { is_active: true } }));
  if (!promptConfig) throw new Error('No active prompt configuration found');

  const qaSystem = applyLocaleToSystemPrompt(
    `${promptConfig.system_prompt}

[Laufzeit — Modus 2 aktiv]
Diese Anfrage ist eine Informationsfrage, kein PI-Sheet-Auftrag. Befolge Abschnitt „Modus 2“ im System-Prompt: natürliche Sprache, Equipment-Tools nutzen, kein JSON.

Effizienz: Bei Fragen zu aktiven/inaktiven Geräten oder Waagen reicht in der Regel ein Aufruf von list_equipment (z. B. active_only, equipment_type scale). Keine OPC/MQTT-Verbindungen, kein search_industrial_namespace und kein read_equipment_value, außer der Nutzer fragt explizit nach Live-Werten, Namespace oder Nodes.

Prozessgraph: Bei Fragen zu Schrittfolge, Standard-XSteps oder Equipment-Zuordnung pro Prozess (z. B. Verpackung) nutze get_process_chain oder get_step_requirements.`,
    options.locale
  );

  const { userContent } = await buildMessages(userPrompt, promptConfig.system_prompt, options.locale);
  const requestParams = await buildClaudeRequestParams(
    { systemPrompt: qaSystem, userContent },
    { includeMcp: false, includeGraphTools: true }
  );
  return { client, requestParams };
}

async function answerChat(userPrompt, userId, options = {}) {
  const { client, requestParams } = await buildAnswerChatRequest(userPrompt, options);
  const response = await runToolLoop(client, requestParams);
  const text = extractTextFromResponse(response);
  return { type: 'text', message: text.trim() || 'Keine Antwort.' };
}

async function completeChat(userPrompt, userId, options = {}) {
  const requestMode = resolveChatMode(userPrompt);
  if (requestMode === 'pi_sheet') {
    const piSheet = await generatePISheet(userPrompt, userId, options);
    return { type: 'pi_sheet', requestMode, piSheet };
  }
  const answer = await answerChat(userPrompt, userId, options);
  return { type: 'text', requestMode: 'qa', message: answer.message };
}

function createLlmStreamEmitter(client, requestParams, maxRounds = 6) {
  const emitter = new EventEmitter();
  let finalMessage = null;

  (async () => {
    try {
      let messages = [...requestParams.messages];
      let rounds = 0;

      while (rounds < maxRounds) {
        const stream = client.messages.stream({
          ...requestParams,
          messages,
        });

        stream.on('text', (text) => emitter.emit('text', text));

        const msg = await stream.finalMessage();
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

      const err = new Error('Equipment tool loop exceeded max rounds');
      emitter.emit('error', err);
    } catch (err) {
      emitter.emit('error', err);
    }
  })();

  emitter.finalMessage = async () => {
    if (finalMessage) return finalMessage;
    return new Promise((resolve, reject) => {
      emitter.once('end', resolve);
      emitter.once('error', reject);
    });
  };

  return emitter;
}

async function generatePISheetStream(userPrompt, userId, options = {}) {
  const client = getAnthropicClient();
  if (!client) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const promptConfig =
    options.promptConfig ||
    (await PromptConfig.findOne({ where: { is_active: true } }));
  if (!promptConfig) {
    throw new Error('No active prompt configuration found');
  }

  const { userContent, systemPrompt } = await buildMessages(
    userPrompt,
    promptConfig.system_prompt,
    options.locale
  );

  // No equipment/MCP tools during stream — tool rounds often prevent final JSON → empty preview
  const requestParams = await buildClaudeRequestParams(
    { systemPrompt, userContent },
    { includeMcp: false, includeEquipmentTools: false }
  );

  return createLlmStreamEmitter(client, requestParams);
}

async function generateAnswerChatStream(userPrompt, options = {}) {
  const { client, requestParams } = await buildAnswerChatRequest(userPrompt, options);
  return createLlmStreamEmitter(client, requestParams, 4);
}

async function finalizeAnswerStream(stream, finalMessageOverride) {
  const finalMessage = finalMessageOverride || (await stream.finalMessage());
  const text = extractTextFromResponse(finalMessage);
  return text.trim() || 'Keine Antwort.';
}

async function finalizeStream(stream, userPrompt, userId, options = {}) {
  const finalMessage = await stream.finalMessage();
  return finalizeFromMessage(finalMessage, userPrompt, userId, options);
}

async function finalizeFromMessage(finalMessage, userPrompt, userId, options = {}) {
  const text = finalMessage.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const parsed = validatePiSheet(parseLlmJson(text));
  return savePiSheet(parsed, userPrompt, userId, options.locale);
}

module.exports = {
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
};
