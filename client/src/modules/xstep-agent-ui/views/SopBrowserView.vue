<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.sopBrowserTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.sopBrowserSubtitle') }}</p>
      </div>
      <div v-if="store.stats" class="flex gap-3 text-sm text-gray-500">
        <span>{{ store.stats.totalDocs || 0 }} {{ t('xstepAgent.kpiDocuments') }}</span>
        <span>{{ store.stats.totalChunks || 0 }} Chunks</span>
      </div>
    </header>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex-1 min-w-[200px]">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.filterSearch') }}</label>
        <input
          v-model="store.search"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          :placeholder="t('xstepAgent.sopSearchPlaceholder')"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldCategory') }}</label>
        <select v-model="store.categoryFilter" class="rounded border px-3 py-1.5 text-sm">
          <option value="">{{ t('xstepAgent.all') }}</option>
          <option v-for="c in store.categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</label>
        <select v-model="store.processTypeFilter" class="rounded border px-3 py-1.5 text-sm">
          <option value="">{{ t('xstepAgent.all') }}</option>
          <option v-for="pt in store.processTypes" :key="pt" :value="pt">{{ pt }}</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <!-- Document Cards -->
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="doc in store.filtered"
        :key="doc.id"
        class="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md hover:border-blue-300"
        @click="store.selectDocument(doc.id)"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">{{ fileIcon(doc.file_type) }}</span>
            <div>
              <p class="font-medium text-gray-900">{{ doc.title }}</p>
              <p class="text-xs text-gray-400">{{ doc.filename }}</p>
            </div>
          </div>
          <span
            class="inline-block rounded px-2 py-0.5 text-xs font-medium"
            :class="doc.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ doc.status }}
          </span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span v-if="doc.category" class="rounded bg-gray-100 px-2 py-0.5">{{ doc.category }}</span>
          <span v-if="doc.process_type" class="rounded bg-blue-50 px-2 py-0.5 text-blue-600">{{ doc.process_type }}</span>
          <span v-if="doc.chunk_count" class="rounded bg-purple-50 px-2 py-0.5 text-purple-600">{{ doc.chunk_count }} chunks</span>
          <span v-if="doc.page_count" class="text-gray-400">{{ doc.page_count }} {{ t('xstepAgent.pages') }}</span>
        </div>
      </div>
      <div v-if="!store.filtered.length" class="col-span-full py-8 text-center text-gray-400">
        {{ t('xstepAgent.noResults') }}
      </div>
    </div>

    <!-- Detail Drawer -->
    <div v-if="store.selected" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
    <div v-if="store.selected" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <h3 class="text-lg font-bold text-gray-900">{{ store.selected.title }}</h3>
        <button class="rounded p-1 hover:bg-gray-100" @click="store.clearSelection()">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
        <p><span class="text-gray-400">Datei:</span> {{ store.selected.filename }}</p>
        <p><span class="text-gray-400">Typ:</span> {{ store.selected.file_type }}</p>
        <p><span class="text-gray-400">Status:</span> {{ store.selected.status }}</p>
        <p><span class="text-gray-400">Kategorie:</span> {{ store.selected.category || '-' }}</p>
        <p><span class="text-gray-400">Prozess:</span> {{ store.selected.process_type || '-' }}</p>
        <p><span class="text-gray-400">Seiten:</span> {{ store.selected.page_count || '-' }}</p>
        <p><span class="text-gray-400">Chunks:</span> {{ store.selected.chunk_count || '-' }}</p>
        <p><span class="text-gray-400">Hochgeladen:</span> {{ new Date(store.selected.created_at).toLocaleString() }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSopStore } from '../stores/useSopStore';

const { t } = useI18n();
const store = useSopStore();

function fileIcon(type) {
  const icons = { pdf: '📕', docx: '📘', xlsx: '📗', csv: '📊', txt: '📝' };
  return icons[type] || '📄';
}

onMounted(() => { store.load(); });
</script>
