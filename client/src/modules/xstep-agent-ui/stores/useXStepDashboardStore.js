import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchDashboardStats } from '../services/dashboardApi';

export const useXStepDashboardStore = defineStore('xstepDashboard', () => {
  const stats = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const lastFetched = ref(null);

  const isHealthy = computed(() => stats.value?.systemStatus === 'OK');
  const features = computed(() => stats.value?.features || {});

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      stats.value = await fetchDashboardStats();
      lastFetched.value = new Date().toISOString();
    } catch (err) {
      error.value = err?.message || 'Failed to load dashboard';
      stats.value = null;
    } finally {
      loading.value = false;
    }
  }

  function $reset() {
    stats.value = null;
    loading.value = false;
    error.value = null;
    lastFetched.value = null;
  }

  return { stats, loading, error, lastFetched, isHealthy, features, load, $reset };
});
