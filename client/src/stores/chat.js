import { defineStore } from 'pinia';

import { ref } from 'vue';

import { get, post } from '@/composables/useApi';

import { i18n } from '@/i18n';

import { useShellStore } from '@/stores/shell';

import { getChatRequestMode } from '@/utils/chatIntent';



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

  if (Array.isArray(steps)) {

    steps = steps.map((s) => (s?.dataValues ? { ...s.dataValues } : s));

  } else {

    steps = [];

  }

  const title = base.title || raw.title;

  if (!title) return null;

  return { ...base, title, steps };

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

        timestamp: Date.now(),

      };

      return;

    }

    const piSheet = applyPiSheetToPreview(payload);

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

      timestamp: Date.now(),

    };

    loadHistory();

  }



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



  function applyServerMode(result) {

    if (result?.requestMode) requestMode.value = result.requestMode;

  }



  async function sendMessage(prompt) {

    messages.value.push({

      role: 'user',

      content: prompt,

      timestamp: Date.now(),

    });



    const clientMode = getChatRequestMode(prompt);

    requestMode.value = clientMode;

    isGenerating.value = true;

    activeTools.value = [];

    thinkingPhase.value = 'searching';

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

      const result = await post(

        '/chat/generate',

        { prompt, locale: portalLocale() },

        { timeout: 180000 }

      );

      applyServerMode(result);

      if (result.type === 'text') {

        messages.value[assistantIdx] = {

          role: 'assistant',

          content: result.message,

          streaming: false,

          requestMode: result.requestMode || 'qa',

          timestamp: Date.now(),

        };

      } else {

        const raw = result.piSheet || result;

        applyStreamResult(raw, assistantIdx);

      }

    } catch (err) {

      const ok = await tryNonStreamGenerate(prompt, assistantIdx);

      if (!ok) throw err;

    } finally {

      clearInterval(phaseTimer);

      isGenerating.value = false;

      activeTools.value = [];

    }

  }



  async function tryNonStreamGenerate(prompt, assistantIdx) {

    try {

      const result = await post('/chat/generate', {

        prompt,

        locale: portalLocale(),

      }, { timeout: 180000 });

      applyServerMode(result);

      if (result.type === 'text') {

        messages.value[assistantIdx] = {

          role: 'assistant',

          content: result.message,

          streaming: false,

          requestMode: result.requestMode || 'qa',

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

        timestamp: Date.now(),

      };

      await loadHistory();

      return true;

    } catch {

      messages.value[assistantIdx] = {

        role: 'assistant',

        content: t('chat.generateFailed'),

        streaming: false,

        timestamp: Date.now(),

      };

      return false;

    }

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

    loadHistory,

    loadPiSheet,

    showPiSheetPreview,

  };

});


