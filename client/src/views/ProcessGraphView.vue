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
      <label class="flex flex-col text-xs">
        {{ t('graph.edgeType') }}
        <select v-model="edgeTypeFilter" class="sap-input mt-1 !text-sm" @change="load">
          <option value="">{{ t('graph.allEdgeTypes') }}</option>
          <option v-for="et in edgeTypes" :key="et" :value="et">
            {{ t(`graph.edgeTypes.${et}`) }}
          </option>
        </select>
      </label>
      <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="load">
        {{ t('repository.apply') }}
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--emphasized !text-sm"
        :disabled="syncing"
        @click="syncSap"
      >
        {{ syncing ? t('graph.syncingSap') : t('graph.syncSap') }}
      </button>
    </div>

    <div v-if="chain.length" class="sap-tile graph-readable mb-4 p-4">
      <h2 class="mb-2 text-sm font-semibold text-slate-900">{{ t('graph.chainPreview') }}</h2>
      <p class="text-xs text-slate-800">{{ chainPreviewText }}</p>
    </div>

    <div v-if="explorer" class="sap-tile graph-readable mb-6 p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">{{ t('graph.explorerTitle') }}</h2>
        <div class="flex flex-wrap gap-2 text-xs">
          <span
            v-for="(count, type) in explorer.stats.byType"
            :key="type"
            v-show="count > 0"
            class="rounded bg-slate-100 px-2 py-0.5"
          >
            {{ t(`graph.edgeTypes.${type}`) }}: {{ count }}
          </span>
        </div>
      </div>
      <p class="mb-2 text-xs text-slate-600">{{ t('graph.explorerLegend') }}</p>
      <div
        v-if="mermaidError"
        class="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800"
      >
        {{ mermaidError }}
      </div>
      <MermaidZoomViewport
        :disabled="!explorer.mermaid || !!mermaidError || renderingMermaid"
      >
        <div
          ref="mermaidContainer"
          class="graph-mermaid min-h-[120px]"
          :class="{ 'opacity-60': renderingMermaid }"
        />
      </MermaidZoomViewport>
      <details v-if="explorer.mermaid" class="mt-2">
        <summary class="cursor-pointer text-xs text-[var(--sapContentLabelColor)]">
          {{ t('graph.mermaidSource') }}
        </summary>
        <pre
          class="mt-2 max-h-48 overflow-auto rounded border border-[var(--sapNeutralBorderColor)] bg-slate-50 p-3 font-mono text-[10px] leading-relaxed"
        >{{ explorer.mermaid }}</pre>
      </details>
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
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import mermaid from 'mermaid';
import { mermaidInitConfig } from '@/utils/mermaidTheme';
import { get, post, del } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import MermaidZoomViewport from '@/components/graph/MermaidZoomViewport.vue';

mermaid.initialize(mermaidInitConfig);

const mermaidContainer = ref(null);
const mermaidError = ref('');
const renderingMermaid = ref(false);
let mermaidRenderSeq = 0;

async function renderMermaidDiagram(code) {
  const el = mermaidContainer.value;
  if (!el) return;
  if (!code?.trim()) {
    el.innerHTML = '';
    mermaidError.value = '';
    return;
  }
  const seq = ++mermaidRenderSeq;
  renderingMermaid.value = true;
  mermaidError.value = '';
  try {
    const id = `graph-mermaid-${seq}`;
    const { svg } = await mermaid.render(id, code);
    if (seq !== mermaidRenderSeq) return;
    el.innerHTML = svg;
  } catch (err) {
    if (seq !== mermaidRenderSeq) return;
    el.innerHTML = '';
    mermaidError.value = err.message || String(err);
  } finally {
    if (seq === mermaidRenderSeq) renderingMermaid.value = false;
  }
}

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const processTypes = ['Verpackung', 'Abfüllung', 'Granulation', 'Tablettierung', 'Coating'];
const edgeTypes = ['FOLLOWS', 'USES_EQUIPMENT', 'REQUIRES', 'APPLIES_TO', 'MAPS_TO_SAP'];

const processFilter = ref('Verpackung');
const edgeTypeFilter = ref('');
const edges = ref([]);
const suggestions = ref([]);
const chain = ref([]);
const explorer = ref(null);
const loading = ref(true);
const saving = ref(false);
const syncing = ref(false);

const form = ref({
  process_type: 'Verpackung',
  edge_type: 'FOLLOWS',
  from_ref: '',
  to_ref: '',
});

const chainPreviewText = computed(() => {
  if (!chain.value.length) return '';
  const byId = new Map((explorer.value?.nodes?.xsteps || []).map((x) => [x.id, x]));
  return chain.value
    .map((id) => {
      const x = byId.get(id);
      if (!x?.name) return id;
      const bits = [x.name, `(${id})`];
      if (x.category) bits.push(`· ${x.category}`);
      return bits.join(' ');
    })
    .join(' → ');
});

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (processFilter.value) params.process_type = processFilter.value;
    if (edgeTypeFilter.value) params.edge_type = edgeTypeFilter.value;
    const sugParams = { status: 'pending' };
    if (processFilter.value) sugParams.process_type = processFilter.value;
    const [edgeRows, sugRows] = await Promise.all([
      get('/graph/edges', { params }),
      get('/graph/suggestions', { params: sugParams }),
    ]);
    edges.value = edgeRows;
    suggestions.value = sugRows;
    if (processFilter.value) {
      const [ctx, exp] = await Promise.all([
        get('/graph/context', { params: { process_type: processFilter.value } }),
        get('/graph/explorer', { params: { process_type: processFilter.value } }),
      ]);
      chain.value = ctx.chain || [];
      explorer.value = exp;
    } else {
      chain.value = [];
      explorer.value = null;
    }
  } finally {
    loading.value = false;
  }
}

async function addEdge() {
  saving.value = true;
  try {
    const et = form.value.edge_type;
    let toKind = 'xstep';
    if (et === 'USES_EQUIPMENT') toKind = 'equipment';
    else if (et === 'MAPS_TO_SAP') toKind = 'sap';
    await post('/graph/edges', {
      process_type: form.value.process_type,
      edge_type: et,
      from_kind: 'xstep',
      from_ref: form.value.from_ref.trim(),
      to_kind: toKind,
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

async function syncSap() {
  if (!processFilter.value) {
    toast.warning(t('graph.syncSapNeedsProcess'));
    return;
  }
  syncing.value = true;
  try {
    const report = await post('/graph/sync-sap', { process_type: processFilter.value });
    toast.success(
      t('graph.syncSapDone', {
        created: report.created,
        skipped: report.skipped,
      })
    );
    await load();
  } catch (err) {
    toast.error(err.response?.data?.error || t('lifecycle.actionFailed'));
  } finally {
    syncing.value = false;
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

watch(
  () => explorer.value?.mermaid,
  async (code) => {
    await nextTick();
    await renderMermaidDiagram(code);
  }
);

onMounted(load);
</script>

<style scoped>
.graph-readable {
  background: #ffffff !important;
  color: #131e29;
}

.graph-mermaid:empty {
  min-height: 120px;
}

.graph-mermaid :deep(svg) {
  background: #ffffff;
}

/* Fallback if theme/classDef colors are overridden by the shell */
.graph-mermaid :deep(.node rect),
.graph-mermaid :deep(.node polygon),
.graph-mermaid :deep(.flowchart-label rect) {
  fill: #ffffff !important;
  stroke: #334155 !important;
}

.graph-mermaid :deep(.sapNode rect),
.graph-mermaid :deep(.sapNode polygon) {
  fill: #dbeafe !important;
  stroke: #0070f2 !important;
}

.graph-mermaid :deep(.equipNode rect),
.graph-mermaid :deep(.equipNode polygon) {
  fill: #d1fae5 !important;
  stroke: #059669 !important;
}

.graph-mermaid :deep(.gmpNode rect),
.graph-mermaid :deep(.gmpNode polygon) {
  fill: #fef9c3 !important;
  stroke: #ca8a04 !important;
}

.graph-mermaid :deep(.nodeLabel),
.graph-mermaid :deep(.label),
.graph-mermaid :deep(.node .label),
.graph-mermaid :deep(.nodeLabel span),
.graph-mermaid :deep(.nodeLabel p) {
  color: #0f172a !important;
  fill: #0f172a !important;
}

.graph-mermaid :deep(.edgeLabel),
.graph-mermaid :deep(.edgeLabel rect) {
  fill: #ffffff !important;
  color: #334155 !important;
}

.graph-mermaid :deep(.edge-pattern-solid) {
  stroke: #334155 !important;
}
</style>
