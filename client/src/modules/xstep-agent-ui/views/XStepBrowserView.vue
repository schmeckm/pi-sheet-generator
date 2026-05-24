<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.xstepBrowserTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.xstepBrowserSubtitle') }}</p>
      </div>
      <span class="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        {{ store.total }} XSteps
      </span>
    </header>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex-1 min-w-[200px]">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.filterSearch') }}</label>
        <input
          v-model="store.filters.search"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          :placeholder="t('xstepAgent.searchPlaceholder')"
          @keyup.enter="store.load()"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</label>
        <select v-model="store.filters.process_type" class="rounded border px-3 py-1.5 text-sm" @change="store.load()">
          <option value="">{{ t('xstepAgent.all') }}</option>
          <option v-for="pt in processTypes" :key="pt" :value="pt">{{ pt }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldCategory') }}</label>
        <select v-model="store.filters.category" class="rounded border px-3 py-1.5 text-sm" @change="store.load()">
          <option value="">{{ t('xstepAgent.all') }}</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">GMP</label>
        <select v-model="store.filters.gmp_relevant" class="rounded border px-3 py-1.5 text-sm" @change="store.load()">
          <option value="">{{ t('xstepAgent.all') }}</option>
          <option value="true">{{ t('xstepAgent.yes') }}</option>
          <option value="false">{{ t('xstepAgent.no') }}</option>
        </select>
      </div>
      <button class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700" @click="store.load()">
        {{ t('xstepAgent.filterApply') }}
      </button>
      <button v-if="store.hasFilters" class="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" @click="store.resetFilters()">
        {{ t('xstepAgent.filterReset') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.colName') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldCategory') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">SAP</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">GMP</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in store.items"
            :key="item.id"
            class="cursor-pointer border-b transition hover:bg-blue-50"
            @click="store.selectXStep(item.id)"
          >
            <td class="px-4 py-2.5 font-mono text-xs text-gray-500">{{ item.xstep_id }}</td>
            <td class="px-4 py-2.5 font-medium text-gray-900">{{ item.name }}</td>
            <td class="px-4 py-2.5 text-gray-600">{{ item.category }}</td>
            <td class="px-4 py-2.5 text-gray-600">{{ item.process_type }}</td>
            <td class="px-4 py-2.5 font-mono text-xs text-gray-500">{{ item.sap_transaction || '-' }}</td>
            <td class="px-4 py-2.5 text-center">
              <span v-if="item.gmp_relevant" class="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              <span v-else class="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
            </td>
          </tr>
          <tr v-if="!store.items.length">
            <td colspan="6" class="py-8 text-center text-gray-400">{{ t('xstepAgent.noResults') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        {{ t('xstepAgent.pageInfo', { page: store.filters.page, total: totalPages }) }}
      </p>
      <div class="flex gap-1">
        <button
          :disabled="store.filters.page <= 1"
          class="rounded border px-3 py-1 text-sm disabled:opacity-40"
          @click="store.setPage(store.filters.page - 1)"
        >&laquo;</button>
        <button
          :disabled="store.filters.page >= totalPages"
          class="rounded border px-3 py-1 text-sm disabled:opacity-40"
          @click="store.setPage(store.filters.page + 1)"
        >&raquo;</button>
      </div>
    </div>

    <!-- Detail Drawer -->
    <XStepDetailDrawer :xstep="store.selected" @close="store.clearSelection()" />
    <div v-if="store.selected" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useXStepStore } from '../stores/useXStepStore';
import XStepDetailDrawer from '../components/explorer/XStepDetailDrawer.vue';

const { t } = useI18n();
const store = useXStepStore();

const processTypes = ['Granulierung', 'Tablettierung', 'Coating', 'Verpackung', 'Packaging'];
const categories = ['Warenbewegung', 'Rückmeldung', 'Prozess', 'Qualität', 'Dokumentation'];

const totalPages = computed(() => Math.ceil(store.total / store.filters.limit) || 1);

onMounted(() => { store.load(); });
</script>
