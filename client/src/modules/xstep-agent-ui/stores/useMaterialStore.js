import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { retrieve } from '../services/xstepAgentApi';

export const useMaterialStore = defineStore('materialExplorer', () => {
  const items = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const search = ref('');
  const selected = ref(null);

  const filtered = computed(() => {
    if (!search.value) return items.value;
    const q = search.value.toLowerCase();
    return items.value.filter((m) =>
      m.id?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.plant?.toLowerCase().includes(q)
    );
  });

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const res = await retrieve({ query: 'materials', topK: 50 });
      items.value = (res.results || [])
        .filter((r) => r.type === 'material')
        .map((r) => r.data);
    } catch (err) {
      error.value = err?.message || 'Failed to load materials';
    } finally {
      loading.value = false;
    }
  }

  function select(item) { selected.value = item; }
  function clearSelection() { selected.value = null; }

  return { items, loading, error, search, filtered, selected, load, select, clearSelection };
});
