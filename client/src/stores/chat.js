import { defineStore } from 'pinia';

import { ref } from 'vue';

import { get, post } from '@/composables/useApi';

import { i18n } from '@/i18n';

import { useShellStore } from '@/stores/shell';

import { getChatRequestMode } from '@/utils/chatIntent';
import { resolveChatError, contextTrimmedMessage, isStreamTransportError } from '@/utils/chatErrors';
import {
  streamChat,
  abortChatStream,
  disableChatStream,
  waitForApiHealth,
} from '@/composables/useStreaming';
import { useToast } from '@/composables/useToast';



function t(key, params) {

  return i18n.global.t(key, params);

}



function portalLocale() {

  return i18n.global.locale.value === 'en' ? 'en' : 'de';

}



/** Normalize Sequelize / API shapes for PISheetPreview. */

function normalizePiSheet(raw) {

  if (!raw || typeof raw !== 'object') return null;

  if (raw.type === 'pi_sheet' && raw.piSheet) return normalizePiSheet(raw.piSheet);

  const base = raw.dataValues ? { ...raw.dataValues } : { ...raw };

  let steps = raw.steps || base.steps || [];
  const llmResponse = base.llm_response || raw.llm_response;
  const llmSteps = llmResponse?.steps || [];
  const llmByNr = new Map(llmSteps.map((s) => [s.step_nr, s]));

  if (Array.isArray(steps)) {
    steps = steps.map((s) => {
      const row = s?.dataValues ? { ...s.dataValues } : { ...s };
      const llm = llmByNr.get(row.step_nr);
      if (row.confidence == null && llm?.confidence != null) {
        row.confidence = llm.confidence;
        row.confidence_source = llm.confidence_source;
      }
      return row;
    });
  } else {
    steps = [];
  }

  const confidence =
    base.confidence ?? llmResponse?.confidence ?? null;
  const confidence_percent =
    base.confidence_percent ?? llmResponse?.confidence_percent ?? null;
  const confidence_breakdown =
    base.confidence_breakdown ?? llmResponse?.confidence_breakdown ?? null;
  const llm_usage = base.llm_usage ?? llmResponse?.llm_usage ?? null;

  const title = base.title || raw.title;

  if (!title) return null;

  return {
    ...base,
    title,
    steps,
    llm_response: llmResponse,
    confidence,
    confidence_percent,
    confidence_breakdown,
    llm_usage,
  };

}



export const useChatStore = defineStore('chat', () => {

  const messages = ref([]);

  const currentPiSheet = ref(null);

  const isGenerating = ref(false);

  const requestMode = ref('qa');

  const thinkingPhase = ref('searching');

  const activeTools = ref([]);

  const history = ref([]);

  const activeHistoryId = ref(null);

  const activeStreamId = ref(null);

  const tokenBudget = ref(null);

  let activeStreamHandle = null;



  function resetConversation() {

    messages.value = [];

    currentPiSheet.value = null;

    activeHistoryId.value = null;

    isGenerating.value = false;

    requestMode.value = 'qa';

    activeTools.value = [];

  }



  resetConversation();



  function applyPiSheetToPreview(piSheet) {

    const normalized = normalizePiSheet(piSheet);

    if (!normalized?.title) return null;

    currentPiSheet.value = normalized;

    useShellStore().chatPreviewOpen = true;

    return normalized;

  }



  function applyStreamResult(payload, assistantIdx) {

    if (payload?.text) {

      messages.value[assistantIdx] = {

        role: 'assistant',

        content: payload.text,

        streaming: false,

        requestMode: payload.requestMode || 'qa',

        tokenUsage: payload.usage || null,

        timestamp: Date.now(),

      };

      return;

    }

    const piSheet = applyPiSheetToPreview(payload.piSheet || payload);

    if (!piSheet) {

      throw new Error(t('chat.generateFailed'));

    }

    activeHistoryId.value = piSheet.id;

    messages.value[assistantIdx] = {

      role: 'assistant',

      content: t('chat.sheetCreated', {

        title: piSheet.title,

        count: piSheet.steps?.length || 0,

      }),

      streaming: false,

      requestMode: 'pi_sheet',

      piSheet,

      tokenUsage: payload.usage || piSheet.llm_usage || null,

      timestamp: Date.now(),

    };

    loadHistory();

  }



  // Fallback heuristic when the server has not yet emitted a status event.
  function advanceThinkingPhase(elapsedMs, mode) {

    if (mode === 'pi_sheet') {

      if (elapsedMs > 8000) thinkingPhase.value = 'structuring';

      else if (elapsedMs > 5000) thinkingPhase.value = 'generating';

      else if (elapsedMs > 2000) thinkingPhase.value = 'context';

      else thinkingPhase.value = 'searching';

      return;

    }

    if (elapsedMs > 6000) thinkingPhase.value = 'structuring';

    else if (elapsedMs > 2500) thinkingPhase.value = 'generating';

    else if (elapsedMs > 800) thinkingPhase.value = 'context';

    else thinkingPhase.value = 'searching';

  }

  // Authoritative status from server overrides the heuristic.
  function applyServerStatus(status) {
    if (!status?.phase) return;
    const map = {
      generating: 'generating',
      tools: 'context',
      finalizing: 'structuring',
    };
    const mapped = map[status.phase];
    if (mapped) thinkingPhase.value = mapped;
  }



  function applyServerMode(result) {

    if (result?.requestMode) requestMode.value = result.requestMode;

  }



  function notifyContextTrimmed(result) {
    if (!result?.contextTrimmed) return;
    const toast = useToast();
    toast.warning(contextTrimmedMessage(result.trimmedSections));
  }

  async function refreshTokenBudget() {
    try {
      tokenBudget.value = await get('/chat/token-budget');
    } catch {
      tokenBudget.value = null;
    }
  }

  async function sendMessage(prompt, options = {}) {
    const display = options.display?.trim() || prompt;
    const userPrompt = display !== prompt ? prompt : undefined;

    messages.value.push({
      role: 'user',
      content: display,
      userPrompt,
      timestamp: Date.now(),
    });

    // Client guess only for the placeholder UX; server's meta event is
    // authoritative (C4).
    const clientMode = getChatRequestMode(prompt);

    requestMode.value = clientMode;

    isGenerating.value = true;

    activeTools.value = [];

    thinkingPhase.value = 'searching';

    activeStreamId.value = null;

    const started = Date.now();

    const phaseTimer = setInterval(

      () => advanceThinkingPhase(Date.now() - started, requestMode.value),

      800

    );



    const assistantIdx = messages.value.length;

    messages.value.push({

      role: 'assistant',

      content: '',

      streaming: true,

      requestMode: clientMode,

      timestamp: Date.now(),

    });



    try {
      const locale = portalLocale();
      const onChunk = (text) => {
        if (requestMode.value === 'pi_sheet') return;
        const msg = messages.value[assistantIdx];
        if (msg) msg.content = (msg.content || '') + text;
      };
      const onMeta = (meta) => {
        if (meta.requestMode) requestMode.value = meta.requestMode;
        const msg = messages.value[assistantIdx];
        if (msg && meta.requestMode === 'pi_sheet') {
          msg.requestMode = 'pi_sheet';
          msg.content = '';
        }
        if (meta.streamId) activeStreamId.value = meta.streamId;
        if (meta.contextTrimmed) {
          useToast().warning(contextTrimmedMessage(meta.trimmedSections));
        }
      };
      const onStatus = (status) => applyServerStatus(status);
      const onTools = (tools) => {
        activeTools.value = tools || [];
      };

      activeStreamHandle = streamChat(prompt, {
        locale,
        onChunk,
        onMeta,
        onStatus,
        onTools,
      });
      const result = await activeStreamHandle;

      applyServerMode(result);
      applyStreamResult(result, assistantIdx);
      notifyContextTrimmed(result);
    } catch (err) {
      if (err?.code === 'LLM_ABORTED' || /aborted/i.test(err?.message || '')) {
        messages.value[assistantIdx] = {
          role: 'assistant',
          content: t('chat.stopped'),
          streaming: false,
          requestMode: requestMode.value,
          timestamp: Date.now(),
        };
        return;
      }
      if (isStreamTransportError(err)) {
        disableChatStream();
        useToast().info(t('chat.streamTransportFallback'));
        await waitForApiHealth();
      }
      const ok = await tryNonStreamGenerate(prompt, assistantIdx);
      if (!ok) {
        const message = resolveChatError(err);
        messages.value[assistantIdx] = {
          role: 'assistant',
          content: message,
          streaming: false,
          errorCode: err?.response?.data?.code || err?.code,
          timestamp: Date.now(),
        };
        throw Object.assign(new Error(message), { code: err?.response?.data?.code });
      }
    } finally {

      clearInterval(phaseTimer);

      isGenerating.value = false;

      activeTools.value = [];

      activeStreamHandle = null;

      activeStreamId.value = null;

      await refreshTokenBudget();

    }

  }

  function stopGeneration() {
    if (!isGenerating.value) return;
    try {
      activeStreamHandle?.abort?.();
    } catch {
      /* ignore */
    }
    if (activeStreamId.value) abortChatStream(activeStreamId.value);
  }



  function isRetryableGatewayError(err) {
    const status = err?.response?.status;
    if (status === 502 || status === 503 || status === 504) return true;
    const msg = String(err?.message || '');
    return /ECONNREFUSED|ERR_CONNECTION|ERR_EMPTY|Bad Gateway|network/i.test(msg);
  }

  async function tryNonStreamGenerate(prompt, assistantIdx) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 3000));
        }

      const result = await post('/chat/generate', {

        prompt,

        locale: portalLocale(),

      }, { timeout: 180000 });

      applyServerMode(result);
      notifyContextTrimmed(result);

      if (result.type === 'text') {

        messages.value[assistantIdx] = {

          role: 'assistant',

          content: result.message,

          streaming: false,

          requestMode: result.requestMode || 'qa',

          tokenUsage: result.usage || null,

          timestamp: Date.now(),

        };

        return true;

      }

      const raw = result.piSheet || result;

      const piSheet = applyPiSheetToPreview(raw);

      if (!piSheet) return false;

      activeHistoryId.value = piSheet.id;

      messages.value[assistantIdx] = {

        role: 'assistant',

        content: t('chat.sheetCreatedShort', {

          title: piSheet.title,

          count: piSheet.steps?.length || 0,

        }),

        streaming: false,

        requestMode: 'pi_sheet',

        piSheet,

        tokenUsage: result.usage || piSheet.llm_usage || null,

        timestamp: Date.now(),

      };

      await loadHistory();

      return true;
      } catch (err) {
        if (attempt === 0 && isRetryableGatewayError(err)) continue;
        messages.value[assistantIdx] = {
          role: 'assistant',
          content: resolveChatError(err),
          streaming: false,
          errorCode: err?.response?.data?.code,
          timestamp: Date.now(),
        };
        return false;
      }
    }
    return false;
  }



  async function loadHistory() {

    try {

      const data = await get('/chat/history');

      history.value = data.items || [];

    } catch {

      history.value = [];

    }

  }



  async function loadPiSheet(id) {

    const sheet = await get(`/chat/${id}`);

    const normalized = applyPiSheetToPreview(sheet) || normalizePiSheet(sheet);

    if (normalized) currentPiSheet.value = normalized;

    activeHistoryId.value = id;

    return normalized || sheet;

  }



  function showPiSheetPreview(piSheet) {

    return applyPiSheetToPreview(piSheet);

  }



  return {

    messages,

    currentPiSheet,

    isGenerating,

    requestMode,

    thinkingPhase,

    activeTools,

    history,

    activeHistoryId,

    resetConversation,

    sendMessage,

    stopGeneration,

    tokenBudget,

    refreshTokenBudget,

    loadHistory,

    loadPiSheet,

    showPiSheetPreview,

  };

});


