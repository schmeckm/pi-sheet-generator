import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getExplorer } from '../services/graphApi';

export const useKnowledgeGraphStore = defineStore('knowledgeGraph', () => {
  const processType = ref('');
  const explorer = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const selectedNode = ref(null);

  const nodeFilter = ref('');
  const edgeTypeFilter = ref('');

  const chain = computed(() => explorer.value?.chain || []);
  const groups = computed(() => explorer.value?.groups || {});
  const nodes = computed(() => explorer.value?.nodes || {});
  const mermaid = computed(() => explorer.value?.mermaid || '');
  const stats = computed(() => explorer.value?.stats || {});

  const xstepNodes = computed(() => {
    let list = nodes.value.xsteps || [];
    if (nodeFilter.value) {
      const q = nodeFilter.value.toLowerCase();
      list = list.filter((n) =>
        n.id?.toLowerCase().includes(q) ||
        n.name?.toLowerCase().includes(q) ||
        n.category?.toLowerCase().includes(q)
      );
    }
    return list;
  });

  const equipmentNodes = computed(() => nodes.value.equipment || []);

  const allEdges = computed(() => {
    const all = [];
    for (const [type, edges] of Object.entries(groups.value)) {
      if (edgeTypeFilter.value && type !== edgeTypeFilter.value) continue;
      for (const e of edges) {
        all.push({ ...e, edge_type: type });
      }
    }
    return all;
  });

  async function load(pt) {
    if (pt) processType.value = pt;
    if (!processType.value) return;
    loading.value = true;
    error.value = null;
    explorer.value = null;
    try {
      explorer.value = await getExplorer(processType.value);
    } catch (err) {
      error.value = err?.response?.data?.error || err?.message || 'Failed to load graph';
    } finally {
      loading.value = false;
    }
  }

  function selectNode(node) { selectedNode.value = node; }
  function clearSelection() { selectedNode.value = null; }

  return {
    processType, explorer, loading, error, selectedNode,
    nodeFilter, edgeTypeFilter,
    chain, groups, nodes, mermaid, stats,
    xstepNodes, equipmentNodes, allEdges,
    load, selectNode, clearSelection,
  };
});
