import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { listProposals, getProposal, transitionProposal, getProposalAudit } from '../services/xstepAgentApi';

export const useReviewStore = defineStore('reviewBoard', () => {
  const proposals = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref(null);
  const statusFilter = ref('');
  const selected = ref(null);
  const selectedAudit = ref([]);
  const detailLoading = ref(false);
  const actionLoading = ref(false);
  const actionError = ref(null);

  const filtered = computed(() => {
    if (!statusFilter.value) return proposals.value;
    return proposals.value.filter((p) => p.status === statusFilter.value);
  });

  const statusCounts = computed(() => {
    const counts = {};
    for (const p of proposals.value) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  });

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const res = await listProposals();
      proposals.value = res.proposals || [];
      total.value = res.total || 0;
    } catch (err) {
      error.value = err?.message || 'Failed to load proposals';
    } finally {
      loading.value = false;
    }
  }

  async function selectProposal(id) {
    detailLoading.value = true;
    actionError.value = null;
    try {
      const [proposal, audit] = await Promise.all([
        getProposal(id),
        getProposalAudit(id).catch(() => ({ audit: [] })),
      ]);
      selected.value = proposal;
      selectedAudit.value = audit.audit || [];
    } catch {
      selected.value = null;
      selectedAudit.value = [];
    } finally {
      detailLoading.value = false;
    }
  }

  async function performAction(action, comment) {
    if (!selected.value) return;
    actionLoading.value = true;
    actionError.value = null;
    try {
      const updated = await transitionProposal(selected.value.id, action, comment);
      selected.value = updated;
      const idx = proposals.value.findIndex((p) => p.id === updated.id);
      if (idx >= 0) proposals.value[idx] = updated;
      const auditRes = await getProposalAudit(updated.id).catch(() => ({ audit: [] }));
      selectedAudit.value = auditRes.audit || [];
    } catch (err) {
      actionError.value = err?.response?.data?.error || err?.message || 'Action failed';
    } finally {
      actionLoading.value = false;
    }
  }

  function clearSelection() {
    selected.value = null;
    selectedAudit.value = [];
    actionError.value = null;
  }

  return {
    proposals, total, loading, error, statusFilter, selected, selectedAudit,
    detailLoading, actionLoading, actionError, filtered, statusCounts,
    load, selectProposal, performAction, clearSelection,
  };
});
