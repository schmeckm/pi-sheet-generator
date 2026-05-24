import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { listDocuments, getDocument, getKnowledgeStats } from '../services/sopApi';

export const useSopStore = defineStore('sopBrowser', () => {
  const documents = ref([]);
  const stats = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const selected = ref(null);

  const search = ref('');
  const categoryFilter = ref('');
  const processTypeFilter = ref('');

  const filtered = computed(() => {
    let list = documents.value;
    if (search.value) {
      const q = search.value.toLowerCase();
      list = list.filter((d) =>
        d.title?.toLowerCase().includes(q) ||
        d.filename?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter.value) {
      list = list.filter((d) => d.category === categoryFilter.value);
    }
    if (processTypeFilter.value) {
      list = list.filter((d) => d.process_type === processTypeFilter.value);
    }
    return list;
  });

  const categories = computed(() => [...new Set(documents.value.map((d) => d.category).filter(Boolean))]);
  const processTypes = computed(() => [...new Set(documents.value.map((d) => d.process_type).filter(Boolean))]);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const [docsRes, statsRes] = await Promise.all([
        listDocuments(),
        getKnowledgeStats(),
      ]);
      documents.value = docsRes.items || docsRes || [];
      stats.value = statsRes;
    } catch (err) {
      error.value = err?.message || 'Failed to load knowledge documents';
    } finally {
      loading.value = false;
    }
  }

  async function selectDocument(id) {
    try {
      selected.value = await getDocument(id);
    } catch {
      selected.value = null;
    }
  }

  function clearSelection() {
    selected.value = null;
  }

  return { documents, stats, loading, error, selected, search, categoryFilter, processTypeFilter, filtered, categories, processTypes, load, selectDocument, clearSelection };
});
