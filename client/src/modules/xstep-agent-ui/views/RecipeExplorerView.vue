<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.recipeExplorerTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.recipeExplorerSubtitle') }}</p>
    </header>

    <div class="flex items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex-1">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.filterSearch') }}</label>
        <input
          v-model="store.search"
          type="text"
          class="w-full rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          :placeholder="t('xstepAgent.recipeSearchPlaceholder')"
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
      <p class="text-4xl">🧪</p>
      <p class="mt-2 text-gray-500">{{ t('xstepAgent.recipeNoData') }}</p>
      <p class="mt-1 text-xs text-gray-400">{{ t('xstepAgent.recipeNoDataHint') }}</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        v-for="recipe in store.filtered"
        :key="recipe.id"
        class="cursor-pointer rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md hover:border-blue-300"
        @click="store.select(recipe)"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="font-bold text-gray-900">{{ recipe.name || recipe.id }}</p>
            <p class="text-xs text-gray-400">{{ recipe.id }}</p>
          </div>
          <span v-if="recipe.processType" class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
            {{ recipe.processType }}
          </span>
        </div>
        <div v-if="recipe.operations?.length" class="mt-3 space-y-1">
          <p class="text-xs font-medium text-gray-500">{{ recipe.operations.length }} {{ t('xstepAgent.operations') }}</p>
          <div v-for="op in recipe.operations.slice(0, 3)" :key="op.id" class="ml-2 text-xs text-gray-600">
            {{ op.name || op.id }}
            <span v-if="op.phases?.length" class="text-gray-400">({{ op.phases.length }} Phasen)</span>
          </div>
          <p v-if="recipe.operations.length > 3" class="ml-2 text-xs text-gray-400">
            +{{ recipe.operations.length - 3 }} {{ t('xstepAgent.more') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <div v-if="store.selected" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
    <div v-if="store.selected" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <h3 class="text-lg font-bold text-gray-900">{{ store.selected.name || store.selected.id }}</h3>
        <button class="rounded p-1 hover:bg-gray-100" @click="store.clearSelection()">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
        <p><span class="text-gray-400">ID:</span> {{ store.selected.id }}</p>
        <p><span class="text-gray-400">Prozess:</span> {{ store.selected.processType || '-' }}</p>

        <div v-if="store.selected.operations?.length">
          <p class="mb-2 text-xs font-semibold uppercase text-gray-400">{{ t('xstepAgent.operations') }}</p>
          <div v-for="op in store.selected.operations" :key="op.id" class="mb-3 rounded border p-3">
            <p class="font-medium text-gray-800">{{ op.name || op.id }}</p>
            <div v-if="op.phases?.length" class="mt-2 space-y-1 pl-3 border-l-2 border-blue-100">
              <div v-for="phase in op.phases" :key="phase.id" class="text-xs">
                <span class="font-medium text-gray-700">{{ phase.name || phase.id }}</span>
                <span v-if="phase.xstepId" class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500">
                  {{ phase.xstepId }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRecipeStore } from '../stores/useRecipeStore';

const { t } = useI18n();
const store = useRecipeStore();

onMounted(() => { store.load(); });
</script>
