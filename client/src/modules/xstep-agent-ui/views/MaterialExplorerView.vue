<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.materialExplorerTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.materialExplorerSubtitle') }}</p>
    </header>

    <div class="flex items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex-1">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.filterSearch') }}</label>
        <input
          v-model="store.search"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          :placeholder="t('xstepAgent.materialSearchPlaceholder')"
        />
      </div>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <div v-else-if="store.error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <div v-else-if="!store.filtered.length" class="rounded-lg border bg-white p-8 text-center shadow-sm">
      <p class="text-4xl">📦</p>
      <p class="mt-2 text-gray-500">{{ t('xstepAgent.materialNoData') }}</p>
      <p class="mt-1 text-xs text-gray-400">{{ t('xstepAgent.materialNoDataHint') }}</p>
    </div>

    <div v-else class="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Material ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.colName') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldPlant') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in store.filtered"
            :key="item.id"
            class="cursor-pointer border-b transition hover:bg-blue-50"
            @click="store.select(item)"
          >
            <td class="px-4 py-2.5 font-mono text-xs text-gray-500">{{ item.id }}</td>
            <td class="px-4 py-2.5 font-medium text-gray-900">{{ item.name }}</td>
            <td class="px-4 py-2.5 text-gray-600">{{ item.plant || '-' }}</td>
            <td class="px-4 py-2.5 text-gray-600">{{ item.processType || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Drawer -->
    <div v-if="store.selected" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
    <div v-if="store.selected" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <h3 class="text-lg font-bold text-gray-900">{{ store.selected.name }}</h3>
        <button class="rounded p-1 hover:bg-gray-100" @click="store.clearSelection()">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
        <p><span class="text-gray-400">ID:</span> {{ store.selected.id }}</p>
        <p><span class="text-gray-400">Werk:</span> {{ store.selected.plant || '-' }}</p>
        <p><span class="text-gray-400">Prozess:</span> {{ store.selected.processType || '-' }}</p>
        <p v-if="store.selected.recipeId"><span class="text-gray-400">Rezeptur:</span> {{ store.selected.recipeId }}</p>
        <div v-if="store.selected.productionVersions?.length">
          <p class="text-gray-400">Prod.-Versionen:</p>
          <ul class="ml-4 list-disc text-gray-700">
            <li v-for="pv in store.selected.productionVersions" :key="pv">{{ pv }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMaterialStore } from '../stores/useMaterialStore';

const { t } = useI18n();
const store = useMaterialStore();

onMounted(() => { store.load(); });
</script>
