import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { listXSteps, getXStep } from '../services/xstepApi';

export const useXStepStore = defineStore('xstepBrowser', () => {
  const items = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref(null);
  const selected = ref(null);
  const detailLoading = ref(false);

  const filters = ref({
    search: '',
    process_type: '',
    category: '',
    gmp_relevant: '',
    sap_system: '',
    page: 1,
    limit: 25,
  });

  const hasFilters = computed(() =>
    filters.value.search || filters.value.process_type || filters.value.category ||
    filters.value.gmp_relevant || filters.value.sap_system
  );

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const params = {};
      for (const [k, v] of Object.entries(filters.value)) {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      }
      const res = await listXSteps(params);
      items.value = res.items || [];
      total.value = res.total || 0;
    } catch (err) {
      error.value = err?.message || 'Failed to load XSteps';
    } finally {
      loading.value = false;
    }
  }

  async function selectXStep(id) {
    detailLoading.value = true;
    try {
      selected.value = await getXStep(id);
    } catch {
      selected.value = null;
    } finally {
      detailLoading.value = false;
    }
  }

  function clearSelection() {
    selected.value = null;
  }

  function setPage(p) {
    filters.value.page = p;
    load();
  }

  function resetFilters() {
    filters.value = { search: '', process_type: '', category: '', gmp_relevant: '', sap_system: '', page: 1, limit: 25 };
    load();
  }

  return { items, total, loading, error, selected, detailLoading, filters, hasFilters, load, selectXStep, clearSelection, setPage, resetFilters };
});
