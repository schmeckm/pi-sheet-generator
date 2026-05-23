<template>
  <div class="flex h-full flex-col bg-[var(--sapGroupContentBackground)]">
    <PISheetWorkflow
      v-if="sheet?.id && showWorkflow"
      :sheet="sheet"
      @updated="onWorkflowUpdated"
    />
    <div
      v-if="!hideToolbar"
      class="flex flex-wrap items-center gap-2 border-b border-[var(--sapNeutralBorderColor)] p-3 print:hidden"
    >
      <button
        type="button"
        class="sap-btn !text-sm"
        :class="viewMode === 'digital' ? 'sap-btn--emphasized' : 'sap-btn--transparent'"
        @click="viewMode = 'digital'"
      >
        {{ t('preview.digital') }}
      </button>
      <button
        type="button"
        class="sap-btn !text-sm"
        :class="viewMode === 'print' ? 'sap-btn--emphasized' : 'sap-btn--transparent'"
        @click="viewMode = 'print'"
      >
        {{ t('preview.print') }}
      </button>
      <div v-if="sheet?.id" class="ml-auto flex gap-2">
        <button type="button" class="sap-btn sap-btn--transparent !text-sm" @click="printSheet">
          {{ t('preview.print') }}
        </button>
        <button type="button" class="sap-btn sap-btn--emphasized !text-sm" @click="downloadPdf">
          {{ t('preview.pdf') }}
        </button>
      </div>
    </div>

    <div
      v-if="!sheet"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-[var(--sapContentLabelColor)]"
    >
      <div class="h-14 w-14 rounded-lg border-2 border-dashed border-[var(--sapNeutralBorderColor)]" />
      <p class="text-sm font-medium text-[var(--sapTextColor)]">{{ t('preview.emptyTitle') }}</p>
      <p class="max-w-xs text-xs">{{ t('preview.emptyHint') }}</p>
    </div>

    <div
      v-else
      class="flex-1 overflow-y-auto p-4 pisheet-print-area"
      :class="viewMode === 'print' ? 'print-view text-black' : ''"
    >
      <header class="mb-6 border-b pb-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <p class="text-xs uppercase tracking-wide text-gray-500">{{ t('preview.docType') }}</p>
          <PISheetStatusBadge v-if="!showWorkflow" :status="sheet.status" />
        </div>
        <h2 class="text-xl font-bold">{{ localizeText(sheet.title) }}</h2>
        <p v-if="sheet.description" class="text-sm text-gray-600">{{ localizeText(sheet.description) }}</p>
        <p class="mt-2 text-xs text-gray-500">
          {{
            t('preview.docMeta', {
              id: sheet.id?.slice(0, 8),
              version: versionLabel,
              date: formatDate(sheet.created_at),
            })
          }}
        </p>
        <p v-if="sheet.order_number || sheet.batch_number" class="mt-1 text-xs text-gray-600">
          {{ t('preview.batchMeta', { order: sheet.order_number || '—', batch: sheet.batch_number || '—' }) }}
        </p>
        <div
          v-if="sheet.graph_snapshot?.chain?.length"
          class="mt-3 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-900"
        >
          <p class="font-semibold">{{ t('preview.graphSnapshotTitle') }}</p>
          <p class="mt-1 font-mono">{{ sheet.graph_snapshot.chain.join(' → ') }}</p>
          <p v-if="sheet.graph_snapshot.captured_at" class="mt-1 text-green-800">
            {{ t('preview.graphSnapshotAt', { date: formatDate(sheet.graph_snapshot.captured_at) }) }}
          </p>
        </div>
        <div
          v-if="overallConfidence != null && viewMode !== 'print'"
          class="mt-4 rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] p-3"
        >
          <ConfidenceMeter
            :value="overallConfidence"
            :label="t('preview.confidenceOverall')"
            :hint="t('preview.confidenceHint')"
          />
          <p v-if="confidenceBreakdownText" class="mt-2 text-[11px] text-[var(--sapContentLabelColor)]">
            {{ confidenceBreakdownText }}
          </p>
          <TokenUsageLine :usage="tokenUsage" class="mt-2" />
        </div>
        <p v-if="viewMode === 'print'" class="mt-3 text-sm">
          {{ t('preview.printFields') }}
        </p>
      </header>

      <StepCard
        v-for="step in sortedSteps"
        :key="step.id || step.step_nr"
        :step="step"
        :print-mode="viewMode === 'print' || sheetReadOnly"
        :read-only="sheetReadOnly"
        :pi-sheet-id="sheet?.id"
        :match-status="showMatchBorders ? step.match_status : null"
      />

      <section v-if="sheet.notes?.length" class="mb-4">
        <h3 class="font-semibold">{{ t('preview.notes') }}</h3>
        <ul class="list-disc pl-5 text-sm">
          <li v-for="(n, i) in sheet.notes" :key="i">{{ localizeText(n) }}</li>
        </ul>
      </section>

      <section v-if="sheet.warnings?.length" class="rounded border-2 border-amber-400 bg-amber-50 p-3">
        <h3 class="font-semibold text-amber-900">⚠ {{ t('preview.gmpWarnings') }}</h3>
        <ul class="list-disc pl-5 text-sm text-amber-900">
          <li v-for="(w, i) in sheet.warnings" :key="i">{{ localizeText(w) }}</li>
        </ul>
      </section>

      <footer v-if="viewMode === 'print'" class="mt-8 border-t pt-4 text-xs">
        {{ t('preview.printFooter') }}
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import StepCard from './StepCard.vue';
import PISheetStatusBadge from './PISheetStatusBadge.vue';
import PISheetWorkflow from './PISheetWorkflow.vue';
import ConfidenceMeter from '@/components/shared/ConfidenceMeter.vue';
import TokenUsageLine from '@/components/shared/TokenUsageLine.vue';
import { api } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';

const props = defineProps({
  sheet: { type: Object, default: null },
  showMatchBorders: { type: Boolean, default: false },
  hideToolbar: { type: Boolean, default: false },
  showWorkflow: { type: Boolean, default: true },
});

const emit = defineEmits(['sheet-updated']);

const { t, locale } = useI18n();
const { localizeText } = usePiSheetDisplay();
const viewMode = ref('digital');
const toast = useToast();

const sortedSteps = computed(() =>
  [...(props.sheet?.steps || [])].sort((a, b) => a.step_nr - b.step_nr)
);

const overallConfidence = computed(() => {
  const s = props.sheet;
  if (s?.confidence != null) return s.confidence;
  if (s?.confidence_percent != null) return s.confidence_percent;
  return s?.llm_response?.confidence ?? null;
});

const confidenceBreakdownText = computed(() => {
  const b = props.sheet?.confidence_breakdown || props.sheet?.llm_response?.confidence_breakdown;
  if (!b) return '';
  return t('preview.confidenceBreakdown', {
    repo: b.repository_steps ?? 0,
    adapted: b.adapted_steps ?? 0,
    suggest: b.suggestion_steps ?? 0,
    warnings: b.warning_count ?? 0,
  });
});

const tokenUsage = computed(
  () => props.sheet?.llm_usage || props.sheet?.llm_response?.llm_usage || null
);

const sheetStatus = computed(() => {
  const s = props.sheet?.status || 'draft';
  return s === 'review' ? 'in_review' : s;
});

const sheetReadOnly = computed(() => ['approved', 'archived', 'in_review'].includes(sheetStatus.value));

const versionLabel = computed(() => {
  const st = sheetStatus.value;
  if (st === 'approved') return t('preview.versionApproved');
  if (st === 'archived') return t('preview.versionArchived');
  if (st === 'in_review') return t('preview.versionReview');
  return t('preview.versionDraft');
});

function onWorkflowUpdated(updated) {
  emit('sheet-updated', updated);
}

function formatDate(d) {
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  if (!d) return new Date().toLocaleDateString(loc);
  return new Date(d).toLocaleDateString(loc);
}

async function printSheet() {
  const prev = viewMode.value;
  viewMode.value = 'print';
  await nextTick();
  globalThis.print();
  viewMode.value = prev;
}

async function downloadPdf() {
  try {
    const res = await api.get(`/templates/${props.sheet.id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pi-sheet-${props.sheet.id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error(t('admin.pdfFailed'));
  }
}
</script>
