<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ t('graph.title') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('graph.subtitle') }}</p>
    </div>

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <label class="flex flex-col text-xs">
        {{ t('graph.processType') }}
        <select v-model="processFilter" class="sap-input mt-1 !text-sm" @change="load">
          <option value="">{{ t('graph.allProcesses') }}</option>
          <option v-for="p in processTypes" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="load">
        {{ t('repository.apply') }}
      </button>
    </div>

    <div v-if="chain.length" class="sap-tile mb-4 p-4">
      <h2 class="mb-2 text-sm font-semibold">{{ t('graph.chainPreview') }}</h2>
      <p class="font-mono text-xs text-[var(--sapTextColor)]">{{ chain.join(' → ') }}</p>
    </div>

    <div class="mb-6 grid gap-4 lg:grid-cols-2">
      <form class="sap-tile p-4" @submit.prevent="addEdge">
        <h2 class="mb-3 text-sm font-semibold">{{ t('graph.addEdge') }}</h2>
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="text-xs sm:col-span-2">
            {{ t('graph.processType') }}
            <select v-model="form.process_type" class="sap-input mt-1 w-full !text-sm" required>
              <option v-for="p in processTypes" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <label class="text-xs sm:col-span-2">
            {{ t('graph.edgeType') }}
            <select v-model="form.edge_type" class="sap-input mt-1 w-full !text-sm" required>
              <option v-for="et in edgeTypes" :key="et" :value="et">
                {{ t(`graph.edgeTypes.${et}`) }}
              </option>
            </select>
          </label>
          <label class="text-xs">
            {{ t('graph.fromRef') }}
            <input v-model="form.from_ref" type="text" class="sap-input mt-1 w-full !text-sm" required />
          </label>
          <label class="text-xs">
            {{ t('graph.toRef') }}
            <input v-model="form.to_ref" type="text" class="sap-input mt-1 w-full !text-sm" required />
          </label>
        </div>
        <button type="submit" class="sap-btn sap-btn--emphasized mt-3 !text-sm" :disabled="saving">
          {{ t('graph.addEdge') }}
        </button>
      </form>
    </div>

    <div v-if="suggestions.length" class="sap-tile mb-6 overflow-x-auto">
      <h2 class="mb-2 p-4 pb-0 text-sm font-semibold">
        {{ t('graph.suggestionsTitle') }}
        <span class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          {{ suggestions.length }}
        </span>
      </h2>
      <p class="px-4 pb-2 text-xs text-[var(--sapContentLabelColor)]">{{ t('graph.suggestionsHint') }}</p>
      <table class="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr class="border-b text-[var(--sapContentLabelColor)]">
            <th class="p-3">{{ t('graph.colSource') }}</th>
            <th class="p-3">{{ t('graph.colType') }}</th>
            <th class="p-3">{{ t('graph.colFrom') }}</th>
            <th class="p-3">{{ t('graph.colTo') }}</th>
            <th class="p-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in suggestions"
            :key="s.id"
            class="border-b border-[var(--sapNeutralBorderColor)]"
          >
            <td class="p-3 text-xs">
              {{ s.document?.title || s.document?.filename || '—' }}
            </td>
            <td class="p-3">{{ t(`graph.edgeTypes.${s.edge_type}`, s.edge_type) }}</td>
            <td class="p-3 font-mono text-xs">{{ s.from_ref }}</td>
            <td class="p-3 font-mono text-xs">{{ s.to_ref }}</td>
            <td class="p-3 text-right whitespace-nowrap">
              <button
                type="button"
                class="sap-btn sap-btn--emphasized !text-sm"
                @click="approveSuggestion(s)"
              >
                {{ t('graph.approveSuggestion') }}
              </button>
              <button
                type="button"
                class="sap-btn sap-btn--transparent !text-sm"
                @click="rejectSuggestion(s)"
              >
                {{ t('graph.rejectSuggestion') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 v-if="!loading" class="mb-2 text-sm font-semibold">{{ t('graph.confirmedEdges') }}</h2>

    <div v-if="loading" class="text-[var(--sapContentLabelColor)]">{{ t('common.loading') }}</div>

    <div v-else-if="!edges.length" class="sap-tile p-8 text-center text-sm text-[var(--sapContentLabelColor)]">
      {{ t('graph.empty') }}
    </div>

    <div v-else class="sap-tile overflow-x-auto">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr class="border-b text-[var(--sapContentLabelColor)]">
            <th class="p-3">{{ t('graph.colProcess') }}</th>
            <th class="p-3">{{ t('graph.colType') }}</th>
            <th class="p-3">{{ t('graph.colFrom') }}</th>
            <th class="p-3">{{ t('graph.colTo') }}</th>
            <th class="p-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in edges"
            :key="row.id"
            class="border-b border-[var(--sapNeutralBorderColor)]"
          >
            <td class="p-3">{{ row.process_type }}</td>
            <td class="p-3">{{ t(`graph.edgeTypes.${row.edge_type}`, row.edge_type) }}</td>
            <td class="p-3 font-mono text-xs">{{ row.from_ref }}</td>
            <td class="p-3 font-mono text-xs">{{ row.to_ref }}</td>
            <td class="p-3 text-right">
              <button
                type="button"
                class="sap-btn sap-btn--negative !text-sm"
                @click="removeEdge(row)"
              >
                {{ t('graph.deleteEdge') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, post, del } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const processTypes = ['Verpackung', 'Abfüllung', 'Granulation', 'Tablettierung', 'Coating'];
const edgeTypes = ['FOLLOWS', 'USES_EQUIPMENT', 'REQUIRES', 'APPLIES_TO', 'MAPS_TO_SAP'];

const processFilter = ref('Verpackung');
const edges = ref([]);
const suggestions = ref([]);
const chain = ref([]);
const loading = ref(true);
const saving = ref(false);

const form = ref({
  process_type: 'Verpackung',
  edge_type: 'FOLLOWS',
  from_ref: '',
  to_ref: '',
});

async function load() {
  loading.value = true;
  try {
    const params = processFilter.value ? { process_type: processFilter.value } : {};
    const sugParams = { status: 'pending' };
    if (processFilter.value) sugParams.process_type = processFilter.value;
    const [edgeRows, sugRows] = await Promise.all([
      get('/graph/edges', { params }),
      get('/graph/suggestions', { params: sugParams }),
    ]);
    edges.value = edgeRows;
    suggestions.value = sugRows;
    if (processFilter.value) {
      const ctx = await get('/graph/context', { params: { process_type: processFilter.value } });
      chain.value = ctx.chain || [];
    } else {
      chain.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function addEdge() {
  saving.value = true;
  try {
    const usesEquipment = form.value.edge_type === 'USES_EQUIPMENT';
    await post('/graph/edges', {
      process_type: form.value.process_type,
      edge_type: form.value.edge_type,
      from_kind: 'xstep',
      from_ref: form.value.from_ref.trim(),
      to_kind: usesEquipment ? 'equipment' : 'xstep',
      to_ref: form.value.to_ref.trim(),
    });
    toast.success(t('graph.addSuccess'));
    form.value.from_ref = '';
    form.value.to_ref = '';
    await load();
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  } finally {
    saving.value = false;
  }
}

async function removeEdge(row) {
  const ok = await confirm.confirm({
    title: t('graph.deleteEdge'),
    message: t('graph.confirmDelete'),
    confirmLabel: t('common.confirm'),
    variant: 'danger',
  });
  if (!ok) return;
  try {
    await del(`/graph/edges/${row.id}`);
    toast.success(t('graph.deleteSuccess'));
    await load();
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  }
}

async function approveSuggestion(row) {
  try {
    await post(`/graph/suggestions/${row.id}/approve`);
    toast.success(t('graph.suggestionApproved'));
    await load();
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  }
}

async function rejectSuggestion(row) {
  try {
    await post(`/graph/suggestions/${row.id}/reject`);
    toast.success(t('graph.suggestionRejected'));
    await load();
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  }
}

onMounted(load);
</script>
