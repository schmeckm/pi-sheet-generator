import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { retrieve } from '../services/xstepAgentApi';

export const useRetrievalDebuggerStore = defineStore('retrievalDebugger', () => {
  const query = ref('');
  const processArea = ref('');
  const packagingType = ref('');
  const topK = ref(15);

  const result = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const hasResult = computed(() => !!result.value);

  const xstepResults = computed(() =>
    (result.value?.results || []).filter((r) => r.type === 'xstep')
  );
  const knowledgeResults = computed(() =>
    (result.value?.results || []).filter((r) => r.type === 'knowledge' || r.type === 'sop')
  );
  const materialResults = computed(() =>
    (result.value?.results || []).filter((r) => r.type === 'material')
  );
  const recipeResults = computed(() =>
    (result.value?.results || []).filter((r) => r.type === 'recipe')
  );
  const exampleResults = computed(() =>
    (result.value?.results || []).filter((r) => r.type === 'pi-sheet-example')
  );
  const graphContext = computed(() => result.value?.graphContext || null);
  const counts = computed(() => result.value?.counts || {});

  async function run() {
    if (!query.value.trim()) return;
    loading.value = true;
    error.value = null;
    result.value = null;
    try {
      const payload = { query: query.value, topK: topK.value };
      if (processArea.value) payload.processArea = processArea.value;
      if (packagingType.value) payload.packagingType = packagingType.value;
      result.value = await retrieve(payload);
    } catch (err) {
      error.value = err?.response?.data?.error || err?.message || 'Retrieval failed';
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    query.value = '';
    processArea.value = '';
    packagingType.value = '';
    topK.value = 15;
    result.value = null;
    error.value = null;
  }

  return {
    query, processArea, packagingType, topK,
    result, loading, error, hasResult,
    xstepResults, knowledgeResults, materialResults, recipeResults, exampleResults,
    graphContext, counts, run, reset,
  };
});
