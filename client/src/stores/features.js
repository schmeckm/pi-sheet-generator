import { defineStore } from 'pinia';
import { ref } from 'vue';
import { get } from '@/composables/useApi';

export const useFeaturesStore = defineStore('features', () => {
  const plantExplorerEnabled = ref(false);
  const loaded = ref(false);

  async function ensureLoaded() {
    if (loaded.value) return;
    const data = await get('/features');
    plantExplorerEnabled.value = Boolean(data.plant_explorer_enabled);
    loaded.value = true;
  }

  function reset() {
    loaded.value = false;
    plantExplorerEnabled.value = false;
  }

  async function reload() {
    reset();
    await ensureLoaded();
  }

  return { plantExplorerEnabled, loaded, ensureLoaded, reload, reset };
});
