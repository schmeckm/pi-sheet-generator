<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.debuggerTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.debuggerSubtitle') }}</p>
    </header>

    <!-- Query Input -->
    <div class="rounded-lg border bg-white p-5 shadow-sm space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.debuggerQuery') }}</label>
          <input
            v-model="store.query"
            type="text"
            class="w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            :placeholder="t('xstepAgent.debuggerQueryPlaceholder')"
            @keyup.enter="store.run()"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</label>
          <select v-model="store.processArea" class="w-full rounded border px-3 py-2 text-sm">
            <option value="">{{ t('xstepAgent.all') }}</option>
            <option value="Packaging">Packaging</option>
            <option value="Granulierung">Granulierung</option>
            <option value="Tablettierung">Tablettierung</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-500">Top-K</label>
          <div class="flex gap-2">
            <input
              v-model.number="store.topK"
              type="number"
              min="1"
              max="50"
              class="w-20 rounded border px-3 py-2 text-sm"
            />
            <button
              :disabled="!store.query.trim() || store.loading"
              class="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              @click="store.run()"
            >
              <span v-if="store.loading" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </span>
              <span v-else>{{ t('xstepAgent.debuggerRun') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="store.error" class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <template v-if="store.hasResult">
      <!-- Meta Panel -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div v-for="(val, key) in store.counts" :key="key" class="rounded-lg border bg-white p-3 text-center shadow-sm">
          <p class="text-lg font-bold text-gray-900">{{ val }}</p>
          <p class="text-[10px] text-gray-400">{{ key }}</p>
        </div>
      </div>

      <!-- Graph Context -->
      <div v-if="store.graphContext" class="rounded-lg border bg-white p-5 shadow-sm">
        <h4 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          {{ t('xstepAgent.debuggerGraphContext') }}
        </h4>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-gray-500">{{ t('xstepAgent.debuggerProcessType') }}:</span>
          <span class="font-medium text-gray-800">{{ store.graphContext.processType }}</span>
        </div>
        <div v-if="store.graphContext.chain?.length" class="mt-3">
          <p class="mb-1 text-xs text-gray-400">{{ t('xstepAgent.debuggerChain') }} ({{ store.graphContext.chain.length }})</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="(id, i) in store.graphContext.chain"
              :key="id"
              class="rounded bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-600"
            >
              {{ i + 1 }}. {{ id }}
            </span>
          </div>
        </div>
        <div v-if="store.graphContext.requirements?.length" class="mt-3">
          <p class="mb-1 text-xs text-gray-400">{{ t('xstepAgent.debuggerRequirements') }} ({{ store.graphContext.requirements.length }})</p>
          <div class="space-y-1">
            <div v-for="(req, i) in store.graphContext.requirements" :key="i" class="text-xs text-gray-600">
              <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{{ req.edge_type }}</span>
              {{ req.from_ref }} → {{ req.to_ref }}
            </div>
          </div>
        </div>
      </div>

      <!-- Result Tables -->
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RetrievalResultTable
          v-if="store.xstepResults.length"
          :title="`XSteps (${store.xstepResults.length})`"
          :items="store.xstepResults"
        />
        <RetrievalResultTable
          v-if="store.knowledgeResults.length"
          :title="`Knowledge / SOP (${store.knowledgeResults.length})`"
          :items="store.knowledgeResults"
        />
        <RetrievalResultTable
          v-if="store.materialResults.length"
          :title="`Materials (${store.materialResults.length})`"
          :items="store.materialResults"
        />
        <RetrievalResultTable
          v-if="store.recipeResults.length"
          :title="`Recipes (${store.recipeResults.length})`"
          :items="store.recipeResults"
        />
        <RetrievalResultTable
          v-if="store.exampleResults.length"
          :title="`PI Sheet Examples (${store.exampleResults.length})`"
          :items="store.exampleResults"
        />
      </div>

      <!-- Raw JSON -->
      <details class="rounded-lg border bg-white shadow-sm">
        <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">
          {{ t('xstepAgent.debuggerRawJson') }}
        </summary>
        <pre class="max-h-96 overflow-auto border-t p-4 text-xs text-gray-600">{{ JSON.stringify(store.result, null, 2) }}</pre>
      </details>
    </template>

    <!-- Hint -->
    <div v-if="!store.hasResult && !store.loading" class="rounded-lg border bg-gray-50 p-6 text-center">
      <p class="text-sm text-gray-500">{{ t('xstepAgent.debuggerHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRetrievalDebuggerStore } from '../stores/useRetrievalDebuggerStore';
import RetrievalResultTable from '../components/retrieval/RetrievalResultTable.vue';

const { t } = useI18n();
const store = useRetrievalDebuggerStore();
</script>
