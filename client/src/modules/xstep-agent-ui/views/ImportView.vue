<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <!-- Header -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.importTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.importSubtitle') }}</p>
      </div>
      <span v-if="imports.length" class="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        {{ imports.length }} {{ t('xstepAgent.importCount') }}
      </span>
    </header>

    <!-- Upload Zone -->
    <div
      class="relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors"
      :class="dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <svg class="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-sm text-gray-600">
        {{ t('xstepAgent.importDropHint') }}
      </p>
      <label class="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        {{ t('xstepAgent.importBrowse') }}
        <input type="file" accept=".xml" class="hidden" @change="onFilePick" />
      </label>
      <p class="text-xs text-gray-400">{{ t('xstepAgent.importFileHint') }}</p>
    </div>

    <!-- Uploading indicator -->
    <div v-if="uploading" class="flex items-center justify-center gap-3 py-6">
      <div class="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <span class="text-sm text-gray-600">{{ t('xstepAgent.importUploading') }}</span>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm font-medium text-red-700">{{ error }}</p>
    </div>

    <!-- Preview Result -->
    <template v-if="preview">
      <div class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('xstepAgent.importResult') }}</h2>
          <div class="flex items-center gap-3">
            <span class="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              {{ preview.stepCount }} Steps
            </span>
            <span
              v-if="preview.validation.warningCount > 0"
              class="rounded bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
            >
              {{ preview.validation.warningCount }} {{ t('xstepAgent.importWarnings') }}
            </span>
            <span v-else class="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              {{ t('xstepAgent.importNoWarnings') }}
            </span>
          </div>
        </div>

        <!-- Validation Warnings -->
        <div v-if="preview.validation.warnings.length" class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 class="mb-2 text-sm font-semibold text-amber-800">
            {{ t('xstepAgent.importValidationTitle') }} ({{ preview.validation.warnings.length }})
          </h4>
          <ul class="space-y-1">
            <li v-for="(w, i) in preview.validation.warnings" :key="i" class="flex items-start gap-2 text-sm">
              <span class="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
              <span class="text-gray-700">{{ w }}</span>
            </li>
          </ul>
        </div>

        <!-- Steps Table -->
        <div class="overflow-x-auto rounded-lg border">
          <table class="w-full text-sm">
            <thead class="border-b bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.colName') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColStepType') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</th>
                <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">GMP</th>
                <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColSig') }}</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColKeywords') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(step, idx) in preview.steps" :key="step.id" class="border-b transition hover:bg-blue-50">
                <td class="px-4 py-2.5 text-gray-400">{{ idx + 1 }}</td>
                <td class="px-4 py-2.5 font-mono text-xs text-gray-500">{{ step.id }}</td>
                <td class="px-4 py-2.5 font-medium text-gray-900">{{ step.name }}</td>
                <td class="px-4 py-2.5">
                  <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{{ step.stepType }}</span>
                </td>
                <td class="px-4 py-2.5 text-gray-600">{{ step.processArea || '—' }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="step.gmpRelevant" class="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span v-else class="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="step.requiresSignature" class="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span v-else class="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
                </td>
                <td class="px-4 py-2.5 text-xs text-gray-500">{{ step.keywords.join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Import ID -->
        <div v-if="preview.importId" class="flex items-center gap-2 text-sm text-gray-500">
          <span>Import ID:</span>
          <code class="rounded bg-gray-100 px-2 py-0.5 text-xs">{{ preview.importId }}</code>
        </div>
      </div>
    </template>

    <!-- Import History -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('xstepAgent.importHistoryTitle') }}</h2>
        <button
          class="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          @click="loadHistory"
        >
          {{ t('xstepAgent.importRefresh') }}
        </button>
      </div>

      <div v-if="historyLoading" class="flex justify-center py-6">
        <div class="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>

      <div v-else-if="imports.length === 0" class="rounded-lg border bg-gray-50 p-6 text-center">
        <p class="text-sm text-gray-400">{{ t('xstepAgent.importHistoryEmpty') }}</p>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table class="w-full text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColFile') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColDate') }}</th>
              <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Steps</th>
              <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importWarnings') }}</th>
              <th class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="imp in imports" :key="imp.id" class="border-b transition hover:bg-blue-50">
              <td class="px-4 py-2.5 font-medium text-gray-900">{{ imp.filename }}</td>
              <td class="px-4 py-2.5 text-gray-600">{{ formatDate(imp.importedAt) }}</td>
              <td class="px-4 py-2.5 text-center">{{ imp.stepCount }}</td>
              <td class="px-4 py-2.5 text-center">
                <span
                  v-if="imp.warningCount > 0"
                  class="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                >{{ imp.warningCount }}</span>
                <span v-else class="text-xs text-green-600">0</span>
              </td>
              <td class="px-4 py-2.5 text-right">
                <button class="mr-2 text-sm text-blue-600 hover:underline" @click="viewImport(imp.id)">
                  {{ t('xstepAgent.importView') }}
                </button>
                <button class="text-sm text-red-500 hover:underline" @click="removeImport(imp.id)">
                  {{ t('xstepAgent.importDelete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detailRecord" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="detailRecord = null">
      <div class="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">{{ detailRecord.filename }}</h3>
          <button class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" @click="detailRecord = null">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="mb-3 flex gap-3 text-sm text-gray-500">
          <span>{{ formatDate(detailRecord.importedAt) }}</span>
          <span>{{ detailRecord.steps?.length || 0 }} Steps</span>
          <span v-if="detailRecord.warningCount > 0" class="text-amber-600">{{ detailRecord.warningCount }} Warnings</span>
        </div>
        <div v-if="detailRecord.warnings?.length" class="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
          <ul class="space-y-1 text-sm text-amber-800">
            <li v-for="(w, i) in detailRecord.warnings" :key="i">• {{ w }}</li>
          </ul>
        </div>
        <div class="overflow-x-auto rounded border">
          <table class="w-full text-sm">
            <thead class="border-b bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.colName') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.importColStepType') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</th>
                <th class="px-3 py-2 text-center text-xs font-medium uppercase text-gray-500">GMP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="step in detailRecord.steps" :key="step.id" class="border-b">
                <td class="px-3 py-2 font-mono text-xs text-gray-500">{{ step.id }}</td>
                <td class="px-3 py-2 font-medium text-gray-900">{{ step.name }}</td>
                <td class="px-3 py-2">
                  <span class="rounded bg-gray-100 px-2 py-0.5 text-xs">{{ step.stepType }}</span>
                </td>
                <td class="px-3 py-2 text-gray-600">{{ step.processArea || '—' }}</td>
                <td class="px-3 py-2 text-center">
                  <span v-if="step.gmpRelevant" class="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span v-else class="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { uploadXml, listImports, getImport, deleteImport } from '../services/importApi';

const { t } = useI18n();

const dragOver = ref(false);
const uploading = ref(false);
const error = ref(null);
const preview = ref(null);

const imports = ref([]);
const historyLoading = ref(false);
const detailRecord = ref(null);

async function handleFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.xml')) {
    error.value = t('xstepAgent.importOnlyXml');
    return;
  }

  error.value = null;
  preview.value = null;
  uploading.value = true;

  try {
    const result = await uploadXml(file);
    preview.value = result;
    await loadHistory();
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    uploading.value = false;
  }
}

function onDrop(e) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  handleFile(file);
}

function onFilePick(e) {
  const file = e.target?.files?.[0];
  handleFile(file);
  e.target.value = '';
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const data = await listImports();
    imports.value = (data.imports || []).reverse();
  } catch {
    imports.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function viewImport(id) {
  try {
    detailRecord.value = await getImport(id);
  } catch {
    error.value = 'Could not load import details';
  }
}

async function removeImport(id) {
  try {
    await deleteImport(id);
    imports.value = imports.value.filter((i) => i.id !== id);
    if (preview.value?.importId === id) preview.value = null;
  } catch {
    error.value = 'Could not delete import';
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

onMounted(() => { loadHistory(); });
</script>
