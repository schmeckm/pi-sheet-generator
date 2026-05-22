import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, get, post, put, del } from '@/composables/useApi';

export const useRepositoryStore = defineStore('repository', () => {
  const xsteps = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const filters = ref({});
  const importReport = ref(null);
  const importSession = ref(null);

  async function loadXSteps(params = {}) {
    loading.value = true;
    filters.value = params;
    try {
      const data = await get('/xsteps', { params });
      xsteps.value = data.items || [];
      total.value = data.total || 0;
    } finally {
      loading.value = false;
    }
  }

  async function createXStep(data) {
    const created = await post('/xsteps', data);
    await loadXSteps(filters.value);
    return created;
  }

  async function updateXStep(id, data) {
    const updated = await put(`/xsteps/${id}`, data);
    await loadXSteps(filters.value);
    return updated;
  }

  async function deleteXStep(id) {
    await del(`/xsteps/${id}`);
    await loadXSteps(filters.value);
  }

  async function previewImport(file, options = {}, fileRoles = {}) {
    const form = new FormData();
    form.append('file', file);
    if (Object.keys(options).length) form.append('options', JSON.stringify(options));
    if (Object.keys(fileRoles).length) form.append('file_roles', JSON.stringify(fileRoles));
    const res = await api.post('/xsteps/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    importSession.value = res.data;
    return res.data;
  }

  async function validateImport(sessionId, mapping) {
    return post('/xsteps/import/validate', { session_id: sessionId, mapping });
  }

  async function confirmImport(sessionId, mapping) {
    const res = await post('/xsteps/import/confirm', { session_id: sessionId, mapping });
    importReport.value = res;
    await loadXSteps(filters.value);
    return res;
  }

  async function bulkAction(action, ids) {
    await post('/xsteps/bulk-action', { action, ids });
    await loadXSteps(filters.value);
  }

  return {
    xsteps,
    total,
    loading,
    filters,
    importReport,
    importSession,
    loadXSteps,
    createXStep,
    updateXStep,
    deleteXStep,
    previewImport,
    validateImport,
    confirmImport,
    bulkAction,
  };
});
