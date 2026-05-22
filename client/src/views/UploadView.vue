<template>
  <div class="pb-4">
    <div class="sap-object-header mb-4 !rounded-lg">
      <h1 class="text-xl font-bold">{{ t('admin.uploadTitle') }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('upload.subtitle') }}</p>
    </div>

    <ol class="mb-6 flex flex-wrap gap-2 text-sm">
      <li
        v-for="(label, i) in stepLabels"
        :key="i"
        class="rounded-full px-3 py-1"
        :class="step === i + 1 ? 'bg-[var(--sapBrandColor)] text-white' : 'bg-gray-100 text-gray-600'"
      >
        {{ i + 1 }}. {{ label }}
      </li>
    </ol>

    <div v-if="step === 1" class="sap-tile p-8 text-center">
      <div
        class="rounded-xl border-2 border-dashed p-12"
        :class="dragOver ? 'border-[var(--sapBrandColor)] bg-[var(--sapHighlightColor)]' : 'border-gray-300'"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('upload.dropHint') }}</p>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.json,.xlsx,.xls,.xml,.zip"
          class="hidden"
          @change="onFile"
        />
        <button type="button" class="sap-btn sap-btn--emphasized mt-4" @click="fileInput?.click()">
          {{ t('upload.selectFile') }}
        </button>
        <p v-if="file" class="mt-2 text-sm font-medium">{{ file.name }}</p>
      </div>
      <button
        v-if="file"
        type="button"
        class="sap-btn sap-btn--emphasized mt-4"
        :disabled="previewing"
        @click="runPreview"
      >
        {{ previewing ? t('common.loading') : t('upload.next') }}
      </button>
    </div>

    <div v-if="step === 2 && preview" class="sap-tile p-6">
      <p
        v-if="!preview.total_rows"
        class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        {{ t('upload.previewEmpty') }}
      </p>
      <p class="mb-2 text-sm">
        {{ t('upload.formatDetected', { format: preview.detected_format }) }}
        · {{ t('upload.rowsDetected', { count: preview.total_rows }) }}
      </p>
      <ul v-if="preview.files?.length" class="mb-4 space-y-1 text-xs">
        <li v-for="f in preview.files" :key="f.name">
          {{ f.name }} — {{ f.detected_role }} ({{ f.rows }} {{ t('upload.rows') }})
        </li>
      </ul>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b">
              <th v-for="col in previewColumns" :key="col" class="p-2 text-left">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in (preview.preview_rows || []).slice(0, 8)" :key="i" class="border-b">
              <td v-for="col in previewColumns" :key="col" class="p-2">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="sap-btn sap-btn--emphasized mt-4" @click="step = 3">{{ t('upload.next') }}</button>
    </div>

    <div v-if="step === 3" class="sap-tile p-6">
      <ColumnMapper v-model:mapping="mapping" :columns="previewColumns" />
      <p v-if="preview?.unmapped_required?.length" class="mt-2 text-xs text-red-700">
        {{ t('upload.unmappedRequired') }}: {{ preview.unmapped_required.join(', ') }}
      </p>
      <div class="mt-4 flex gap-2">
        <button type="button" class="sap-btn sap-btn--transparent" @click="step = 2">{{ t('upload.back') }}</button>
        <button
          type="button"
          class="sap-btn sap-btn--emphasized"
          :disabled="validating || !canProceedMapping"
          @click="runValidation"
        >
          {{ validating ? t('upload.validating') : t('upload.next') }}
        </button>
      </div>
    </div>

    <div v-if="step === 4 && validation" class="sap-tile p-6">
      <p class="mb-3 text-sm font-semibold">{{ t('upload.validationTitle') }}</p>
      <ul class="space-y-1 text-sm">
        <li class="text-green-700">✅ {{ t('upload.validCount', { n: validation.summary?.valid ?? 0 }) }}</li>
        <li class="text-amber-700">⚠️ {{ t('upload.warnCount', { n: validation.summary?.warnings ?? 0 }) }}</li>
        <li class="text-red-700">❌ {{ t('upload.errorCount', { n: validation.summary?.errors ?? 0 }) }}</li>
      </ul>
      <ul v-if="validation.errors?.length" class="mt-3 max-h-40 overflow-auto text-xs text-red-800">
        <li v-for="(e, i) in validation.errors.slice(0, 25)" :key="i">
          {{ t('upload.row') }} {{ e.row }}: {{ e.message }}
        </li>
      </ul>
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="sap-btn sap-btn--transparent" @click="step = 3">{{ t('upload.back') }}</button>
        <button
          v-if="(validation.summary?.valid ?? 0) > 0"
          type="button"
          class="sap-btn sap-btn--emphasized"
          :disabled="importing"
          @click="doImport"
        >
          {{ importing ? t('upload.importing') : t('upload.importAnyway') }}
        </button>
      </div>
    </div>

    <div v-if="step === 5 && report" class="sap-tile p-6">
      <h2 class="font-semibold">{{ t('upload.result') }}</h2>
      <p class="text-xs text-[var(--sapContentLabelColor)]">
        {{ t('upload.duration', { ms: report.duration_ms || 0 }) }}
      </p>
      <ul class="mt-2 space-y-1 text-sm">
        <li>{{ t('upload.created', { n: report.created || 0 }) }}</li>
        <li>{{ t('upload.updated', { n: report.updated || 0 }) }}</li>
        <li>{{ t('upload.skipped', { n: report.skipped || 0 }) }}</li>
        <li>{{ t('upload.errors', { n: report.errors?.length || 0 }) }}</li>
      </ul>
      <router-link to="/admin/repository" class="sap-btn sap-btn--emphasized mt-4 inline-block">
        {{ t('upload.toRepository') }}
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRepositoryStore } from '@/stores/repository';
import { useToast } from '@/composables/useToast';
import ColumnMapper from '@/components/admin/ColumnMapper.vue';

const { t } = useI18n();
const repo = useRepositoryStore();
const toast = useToast();

const step = ref(1);
const file = ref(null);
const fileInput = ref(null);
const dragOver = ref(false);
const preview = ref(null);
const mapping = ref({});
const previewing = ref(false);
const validating = ref(false);
const validation = ref(null);
const importing = ref(false);
const report = ref(null);

const stepLabels = computed(() => [
  t('upload.stepUpload'),
  t('upload.stepPreview'),
  t('upload.stepMap'),
  t('upload.stepValidate'),
  t('upload.stepResult'),
]);

const previewColumns = computed(() => {
  if (!preview.value?.preview_rows?.length) return preview.value?.columns || [];
  return preview.value.columns || Object.keys(preview.value.preview_rows[0]);
});

const canProceedMapping = computed(() => {
  const required = ['xstep_id', 'name', 'category', 'process_type'];
  const mapped = new Set(Object.values(mapping.value).filter(Boolean));
  return required.every((f) => mapped.has(f));
});

function onFile(e) {
  const f = e.target.files?.[0];
  if (f) file.value = f;
}

function onDrop(e) {
  dragOver.value = false;
  const f = e.dataTransfer.files?.[0];
  if (f) file.value = f;
}

async function runPreview() {
  if (!file.value) return;
  previewing.value = true;
  try {
    preview.value = await repo.previewImport(file.value);
    mapping.value = { ...preview.value.auto_mapping };
    validation.value = null;
    report.value = null;
    step.value = 2;
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    previewing.value = false;
  }
}

async function runValidation() {
  if (!preview.value?.session_id) return;
  validating.value = true;
  try {
    validation.value = await repo.validateImport(preview.value.session_id, mapping.value);
    step.value = 4;
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    validating.value = false;
  }
}

async function doImport() {
  if (!preview.value?.session_id) return;
  importing.value = true;
  try {
    report.value = await repo.confirmImport(preview.value.session_id, mapping.value);
    step.value = 5;
    toast.success(t('upload.done'));
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    importing.value = false;
  }
}
</script>
