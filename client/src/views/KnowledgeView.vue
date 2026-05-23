<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold text-slate-800">{{ t('knowledge.title') }}</h1>
    <p class="mt-1 text-slate-600">{{ t('knowledge.subtitle') }}</p>

    <div
      v-if="stats"
      class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
    >
      {{
        t('knowledge.statsBar', {
          docs: stats.totalDocs,
          chunks: stats.totalChunks,
          mb: stats.totalMb,
        })
      }}
    </div>

    <div
      class="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 transition-colors"
      :class="dragOver ? 'border-[var(--sapBrandColor)] bg-[var(--sapHighlightColor)]' : ''"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".pdf,.docx,.xlsx,.txt"
        @change="onFileSelect"
      />
      <p class="text-slate-600">{{ t('knowledge.uploadHint') }}</p>
      <p class="mt-1 text-xs text-slate-400">{{ t('knowledge.uploadFormats') }}</p>
      <button
        type="button"
        class="sap-btn sap-btn--emphasized mt-4"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        {{ uploading ? t('knowledge.uploading') : t('knowledge.selectFile') }}
      </button>
      <div v-if="uploading" class="mt-3 w-full max-w-md">
        <div class="h-2 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full animate-pulse rounded-full bg-[var(--sapBrandColor)]" style="width: 60%" />
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-3 text-sm">
      <label class="flex items-center gap-2">
        <span class="text-slate-600">{{ t('knowledge.uploadCategory') }}</span>
        <select v-model="uploadMeta.category" class="rounded border px-2 py-1">
          <option value="">{{ t('knowledge.none') }}</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2">
        <span class="text-slate-600">{{ t('knowledge.processType') }}</span>
        <input
          v-model="uploadMeta.process_type"
          type="text"
          class="rounded border px-2 py-1"
          :placeholder="t('knowledge.processPlaceholder')"
        />
      </label>
    </div>

    <div v-if="loading" class="mt-8 text-slate-500">{{ t('common.loading') }}</div>

    <div v-else class="mt-8 sap-tile overflow-hidden">
      <div v-if="!documents.length" class="p-8 text-center text-sm text-slate-500">
        {{ t('knowledge.empty') }}
      </div>
      <template v-else>
        <div class="space-y-3 p-3 md:hidden">
          <article v-for="doc in documents" :key="doc.id" class="sap-mobile-card">
            <p class="font-medium text-slate-800">
              {{ doc.title }}
              <span
                v-if="isDuplicateTitle(doc)"
                class="ml-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
              >
                {{ t('knowledge.duplicateHint') }}
              </span>
            </p>
            <p class="mt-1 text-xs text-slate-500">{{ doc.filename }}</p>
            <div class="sap-mobile-card__row">
              <span class="sap-mobile-card__label">{{ t('knowledge.colUploaded') }}</span>
              <span>{{ formatDate(doc.created_at) }}</span>
            </div>
            <div class="sap-mobile-card__row">
              <span class="sap-mobile-card__label">{{ t('knowledge.colType') }}</span>
              <span class="uppercase">{{ doc.file_type }}</span>
            </div>
            <div class="sap-mobile-card__row">
              <span class="sap-mobile-card__label">{{ t('knowledge.colCategory') }}</span>
              <select
                :value="doc.category || ''"
                class="sap-input !text-sm"
                @change="updateCategory(doc, $event.target.value)"
              >
                <option value="">{{ t('knowledge.none') }}</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="sap-mobile-card__row">
              <span class="sap-mobile-card__label">{{ t('knowledge.processType') }}</span>
              <span>{{ doc.process_type || '—' }}</span>
            </div>
            <div class="sap-mobile-card__row">
              <span class="sap-mobile-card__label">{{ t('knowledge.colStatus') }}</span>
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusClass(doc.status)"
              >
                {{ t(`knowledge.status.${doc.status}`) }}
              </span>
            </div>
            <p v-if="doc.status === 'error' && doc.error_message" class="text-xs text-red-600">
              {{ doc.error_message }}
            </p>
            <div class="sap-mobile-card__actions">
              <button type="button" class="sap-btn sap-btn--transparent !min-h-11 !text-sm text-red-700" @click="confirmDelete(doc)">
                {{ t('knowledge.delete') }}
              </button>
            </div>
          </article>
        </div>
        <div class="hidden overflow-x-auto md:block">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colTitle') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colFilename') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colUploaded') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colType') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colCategory') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.processType') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colPages') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colChunks') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('knowledge.colStatus') }}</th>
            <th class="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="doc in documents" :key="doc.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-800">
              {{ doc.title }}
              <span
                v-if="isDuplicateTitle(doc)"
                class="ml-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
              >
                {{ t('knowledge.duplicateHint') }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500">{{ doc.filename }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-slate-600">{{ formatDate(doc.created_at) }}</td>
            <td class="px-4 py-3 uppercase text-slate-600">{{ doc.file_type }}</td>
            <td class="px-4 py-3">
              <select
                :value="doc.category || ''"
                class="rounded border px-2 py-1 text-sm"
                @change="updateCategory(doc, $event.target.value)"
              >
                <option value="">{{ t('knowledge.none') }}</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ doc.process_type || '—' }}</td>
            <td class="px-4 py-3">{{ doc.page_count ?? '—' }}</td>
            <td class="px-4 py-3">{{ doc.chunk_count }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusClass(doc.status)"
              >
                {{ t(`knowledge.status.${doc.status}`) }}
              </span>
              <p v-if="doc.status === 'error' && doc.error_message" class="mt-1 text-xs text-red-600">
                {{ doc.error_message }}
              </p>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="text-red-600 hover:underline"
                @click="confirmDelete(doc)"
              >
                {{ t('knowledge.delete') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, post, patch, del } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';

const { t, locale } = useI18n();
const toast = useToast();
const confirmDialog = useConfirm();

const documents = ref([]);
const stats = ref(null);
const categories = ref([]);
const loading = ref(true);
const uploading = ref(false);
const dragOver = ref(false);
const fileInput = ref(null);
let pollTimer = null;

const uploadMeta = ref({
  category: '',
  process_type: '',
});

function statusClass(status) {
  if (status === 'ready') return 'bg-green-100 text-green-800';
  if (status === 'error') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

async function loadData() {
  const [listRes, statsRes] = await Promise.all([
    get('/knowledge'),
    get('/knowledge/stats'),
  ]);
  documents.value = listRes.items || [];
  stats.value = statsRes;
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const hasProcessing = documents.value.some((d) => d.status === 'processing');
    if (!hasProcessing) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    await loadData();
  }, 3000);
}

const titleCounts = computed(() => {
  const counts = {};
  for (const doc of documents.value) {
    const key = (doc.title || '').toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
});

function isDuplicateTitle(doc) {
  const key = (doc.title || '').toLowerCase();
  return (titleCounts.value[key] || 0) > 1;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(locale.value === 'en' ? 'en-GB' : 'de-DE');
}

async function uploadFile(file, replace = false) {
  if (!file) return;
  uploading.value = true;
  try {
    const form = new FormData();
    form.append('file', file);
    if (uploadMeta.value.category) form.append('category', uploadMeta.value.category);
    if (uploadMeta.value.process_type) form.append('process_type', uploadMeta.value.process_type);
    if (replace) form.append('replace', 'true');

    await post('/knowledge/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast.success(replace ? t('knowledge.replaced') : t('knowledge.uploadSuccess'));
    await loadData();
    startPolling();
  } catch (err) {
    if (err.response?.status === 409 && !replace) {
      const name = file.name;
      const ok = await confirmDialog.confirm({
        title: t('knowledge.duplicateTitle'),
        message: t('knowledge.duplicateConfirm', { name }),
        confirmLabel: t('knowledge.replace'),
        variant: 'danger',
      });
      if (ok) {
        uploading.value = false;
        return uploadFile(file, true);
      }
      return;
    }
    toast.error(err.response?.data?.error || t('knowledge.uploadFailed'));
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onFileSelect(e) {
  const file = e.target.files?.[0];
  uploadFile(file);
}

function onDrop(e) {
  dragOver.value = false;
  const file = e.dataTransfer.files?.[0];
  uploadFile(file);
}

async function updateCategory(doc, category) {
  try {
    await patch(`/knowledge/${doc.id}`, { category: category || null });
    doc.category = category || null;
    toast.success(t('knowledge.saved'));
  } catch {
    toast.error(t('knowledge.saveFailed'));
  }
}

async function confirmDelete(doc) {
  const ok = await confirmDialog.confirm({
    title: t('knowledge.deleteTitle'),
    message: t('knowledge.deleteConfirm', { title: doc.title }),
    confirmLabel: t('repository.delete'),
    variant: 'danger',
  });
  if (!ok) return;
  deleteDoc(doc);
}

async function deleteDoc(doc) {
  try {
    await del(`/knowledge/${doc.id}`);
    toast.success(t('knowledge.deleted'));
    await loadData();
  } catch {
    toast.error(t('knowledge.deleteFailed'));
  }
}

onMounted(async () => {
  categories.value = [
    'SOP',
    'Arbeitsanweisung',
    'Chargenprotokoll',
    'Validierung',
    'Qualitätsrichtlinie',
    'Sonstiges',
  ];
  try {
    await loadData();
    if (documents.value.some((d) => d.status === 'processing')) startPolling();
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>
