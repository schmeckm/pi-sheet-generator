<template>
  <div class="sap-tile mb-6 p-4">
    <h2 class="text-sm font-bold">{{ t('equipmentPage.namespaceTitle') }}</h2>
    <p class="mt-1 text-xs text-[var(--sapContentLabelColor)]">{{ t('equipmentPage.namespaceHint') }}</p>
    <form class="mt-3 flex flex-wrap items-end gap-2" @submit.prevent="search">
      <label class="min-w-[12rem] flex-1">
        <span class="sap-label">{{ t('equipmentPage.namespaceQuery') }}</span>
        <input v-model="query" class="sap-input mt-1" placeholder="Scale, Waggon, aktiv, VP-03" />
      </label>
      <label class="min-w-[10rem]">
        <span class="sap-label">{{ t('equipmentPage.namespaceEquipment') }}</span>
        <select v-model="equipmentId" class="sap-input mt-1">
          <option value="">{{ t('equipmentPage.namespaceAll') }}</option>
          <option v-for="e in equipmentOptions" :key="e.equipment_id" :value="e.equipment_id">
            {{ e.equipment_id }}
          </option>
        </select>
      </label>
      <button type="submit" class="sap-btn sap-btn--emphasized" :disabled="searching || query.trim().length < 2">
        {{ searching ? t('common.loading') : t('equipmentPage.namespaceSearch') }}
      </button>
    </form>
    <p v-if="error" class="mt-2 text-xs text-red-700">{{ error }}</p>
    <div v-if="results.length" class="mt-4 max-h-64 overflow-auto rounded border border-[var(--sapNeutralBorderColor)]">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-[var(--sapList_HeaderBackground)]">
          <tr>
            <th class="p-2 text-left">{{ t('equipmentPage.colId') }}</th>
            <th class="p-2 text-left">{{ t('equipmentPage.namespaceNode') }}</th>
            <th class="p-2 text-left">{{ t('equipmentPage.colConnection') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in results" :key="i" class="border-t">
            <td class="p-2 font-mono">{{ row.equipment_id || '—' }}</td>
            <td class="p-2 font-mono">{{ row.node_id || row.topic || row.path || row.name || '—' }}</td>
            <td class="p-2">{{ row.connection_type || row.protocol || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="searched && !searching" class="mt-3 text-xs text-[var(--sapContentLabelColor)]">
      {{ t('equipmentPage.namespaceEmpty') }}
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { post } from '@/composables/useApi';

defineProps({
  equipmentOptions: { type: Array, default: () => [] },
});

const { t } = useI18n();
const query = ref('');
const equipmentId = ref('');
const results = ref([]);
const searching = ref(false);
const searched = ref(false);
const error = ref('');

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.nodes)) return data.nodes;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function search() {
  const q = query.value.trim();
  if (q.length < 2) return;
  searching.value = true;
  searched.value = false;
  error.value = '';
  results.value = [];
  try {
    const body = { query: q };
    if (equipmentId.value) body.equipment_id = equipmentId.value;
    const data = await post('/equipment/namespace-search', body);
    results.value = normalizeRows(data);
    searched.value = true;
  } catch (e) {
    error.value = e.response?.data?.error || e.message;
  } finally {
    searching.value = false;
  }
}
</script>
