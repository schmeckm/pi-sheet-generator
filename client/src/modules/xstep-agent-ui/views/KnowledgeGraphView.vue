<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.graphTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.graphSubtitle') }}</p>
      </div>
      <div v-if="store.stats.totalEdges" class="text-sm text-gray-500">
        {{ store.stats.totalEdges }} Edges
      </div>
    </header>

    <!-- Process Type Selector -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</label>
        <select v-model="store.processType" class="rounded border px-3 py-2 text-sm">
          <option value="">{{ t('xstepAgent.graphSelectProcess') }}</option>
          <option v-for="pt in processTypes" :key="pt" :value="pt">{{ pt }}</option>
        </select>
      </div>
      <button
        :disabled="!store.processType || store.loading"
        class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        @click="store.load()"
      >
        {{ t('xstepAgent.graphLoad') }}
      </button>
      <div v-if="store.explorer" class="flex-1">
        <input
          v-model="store.nodeFilter"
          type="text"
          class="w-full rounded border px-3 py-2 text-sm"
          :placeholder="t('xstepAgent.graphFilterNodes')"
        />
      </div>
      <div v-if="store.explorer">
        <select v-model="store.edgeTypeFilter" class="rounded border px-3 py-2 text-sm">
          <option value="">{{ t('xstepAgent.graphAllEdges') }}</option>
          <option v-for="et in edgeTypes" :key="et" :value="et">{{ et }}</option>
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

    <template v-else-if="store.explorer">
      <!-- Stats Bar -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="rounded-lg border bg-white p-3 text-center shadow-sm">
          <p class="text-lg font-bold text-blue-600">{{ store.chain.length }}</p>
          <p class="text-[10px] text-gray-400">{{ t('xstepAgent.graphChainSteps') }}</p>
        </div>
        <div v-for="(count, type) in store.stats.byType" :key="type" class="rounded-lg border bg-white p-3 text-center shadow-sm">
          <p class="text-lg font-bold text-gray-900">{{ count }}</p>
          <p class="text-[10px] text-gray-400">{{ type }}</p>
        </div>
      </div>

      <!-- Chain Visualization -->
      <div v-if="store.chain.length" class="rounded-lg border bg-white p-5 shadow-sm">
        <h4 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          {{ t('xstepAgent.graphProcessChain') }}
        </h4>
        <div class="flex flex-wrap items-center gap-1">
          <template v-for="(id, i) in store.chain" :key="id">
            <button
              class="rounded-lg border px-3 py-1.5 text-xs font-mono transition hover:bg-blue-50 hover:border-blue-300"
              :class="store.selectedNode?.id === id ? 'bg-blue-100 border-blue-400' : 'bg-white'"
              @click="selectChainNode(id)"
            >
              {{ id }}
            </button>
            <svg v-if="i < store.chain.length - 1" class="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </template>
        </div>
      </div>

      <!-- Nodes + Edges Grid -->
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- XStep Nodes -->
        <div class="rounded-lg border bg-white shadow-sm">
          <div class="border-b px-5 py-3">
            <h4 class="text-sm font-semibold text-gray-700">XStep Nodes ({{ store.xstepNodes.length }})</h4>
          </div>
          <div class="max-h-80 divide-y overflow-y-auto">
            <div
              v-for="node in store.xstepNodes"
              :key="node.id"
              class="cursor-pointer px-5 py-2.5 text-sm hover:bg-blue-50"
              @click="store.selectNode(node)"
            >
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs text-blue-600">{{ node.id }}</span>
                <div class="flex gap-1">
                  <span v-if="node.gmp_relevant" class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-600">GMP</span>
                  <span v-if="node.category" class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{{ node.category }}</span>
                </div>
              </div>
              <p class="mt-0.5 text-gray-700">{{ node.name }}</p>
            </div>
            <div v-if="!store.xstepNodes.length" class="px-5 py-6 text-center text-sm text-gray-400">
              {{ t('xstepAgent.noResults') }}
            </div>
          </div>
        </div>

        <!-- Edges -->
        <div class="rounded-lg border bg-white shadow-sm">
          <div class="border-b px-5 py-3">
            <h4 class="text-sm font-semibold text-gray-700">Edges ({{ store.allEdges.length }})</h4>
          </div>
          <div class="max-h-80 divide-y overflow-y-auto">
            <div v-for="(edge, i) in store.allEdges" :key="i" class="px-5 py-2.5 text-xs">
              <div class="flex items-center gap-2">
                <span class="rounded px-1.5 py-0.5 font-medium" :class="edgeClass(edge.edge_type)">
                  {{ edge.edge_type }}
                </span>
                <span class="font-mono text-gray-600">{{ edge.from_ref }}</span>
                <svg class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span class="font-mono text-gray-600">{{ edge.to_ref }}</span>
              </div>
            </div>
            <div v-if="!store.allEdges.length" class="px-5 py-6 text-center text-sm text-gray-400">
              {{ t('xstepAgent.noResults') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Equipment Nodes -->
      <div v-if="store.equipmentNodes.length" class="rounded-lg border bg-white shadow-sm">
        <div class="border-b px-5 py-3">
          <h4 class="text-sm font-semibold text-gray-700">Equipment ({{ store.equipmentNodes.length }})</h4>
        </div>
        <div class="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="eq in store.equipmentNodes" :key="eq.id" class="rounded border p-3 text-sm">
            <p class="font-mono text-xs text-blue-600">{{ eq.id }}</p>
            <p class="font-medium text-gray-800">{{ eq.name }}</p>
            <p v-if="eq.equipment_type" class="text-xs text-gray-400">{{ eq.equipment_type }}</p>
          </div>
        </div>
      </div>

      <!-- Mermaid Diagram -->
      <details v-if="store.mermaid" class="rounded-lg border bg-white shadow-sm">
        <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">
          {{ t('xstepAgent.graphMermaidDiagram') }}
        </summary>
        <pre class="max-h-96 overflow-auto border-t p-4 text-xs text-gray-600">{{ store.mermaid }}</pre>
      </details>
    </template>

    <!-- Hint -->
    <div v-if="!store.explorer && !store.loading" class="rounded-lg border bg-gray-50 p-6 text-center">
      <p class="text-sm text-gray-500">{{ t('xstepAgent.graphHint') }}</p>
    </div>

    <!-- Node Detail Drawer -->
    <div v-if="store.selectedNode" class="fixed inset-0 z-30 bg-black/20" @click="store.clearSelection()" />
    <div v-if="store.selectedNode" class="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <h3 class="text-lg font-bold text-gray-900">{{ store.selectedNode.name || store.selectedNode.id }}</h3>
        <button class="rounded p-1 hover:bg-gray-100" @click="store.clearSelection()">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
        <p><span class="text-gray-400">ID:</span> <span class="font-mono">{{ store.selectedNode.id }}</span></p>
        <p v-if="store.selectedNode.category"><span class="text-gray-400">{{ t('xstepAgent.fieldCategory') }}:</span> {{ store.selectedNode.category }}</p>
        <p v-if="store.selectedNode.sap_transaction"><span class="text-gray-400">SAP:</span> {{ store.selectedNode.sap_transaction }}</p>
        <p v-if="store.selectedNode.movement_type"><span class="text-gray-400">{{ t('xstepAgent.fieldMovementType') }}:</span> {{ store.selectedNode.movement_type }}</p>
        <p v-if="store.selectedNode.equipment_type"><span class="text-gray-400">Typ:</span> {{ store.selectedNode.equipment_type }}</p>
        <p v-if="store.selectedNode.location"><span class="text-gray-400">Standort:</span> {{ store.selectedNode.location }}</p>
        <div class="flex gap-2">
          <span v-if="store.selectedNode.gmp_relevant" class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-600">GMP</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useKnowledgeGraphStore } from '../stores/useKnowledgeGraphStore';

const { t } = useI18n();
const store = useKnowledgeGraphStore();

const processTypes = ['Granulierung', 'Tablettierung', 'Coating', 'Verpackung', 'Packaging'];
const edgeTypes = ['FOLLOWS', 'USES_EQUIPMENT', 'REQUIRES', 'APPLIES_TO', 'MAPS_TO_SAP'];

function selectChainNode(id) {
  const node = store.xstepNodes.find((n) => n.id === id);
  if (node) store.selectNode(node);
}

function edgeClass(type) {
  const map = {
    FOLLOWS: 'bg-blue-50 text-blue-600',
    USES_EQUIPMENT: 'bg-green-50 text-green-600',
    REQUIRES: 'bg-amber-50 text-amber-600',
    APPLIES_TO: 'bg-purple-50 text-purple-600',
    MAPS_TO_SAP: 'bg-red-50 text-red-600',
  };
  return map[type] || 'bg-gray-50 text-gray-600';
}
</script>
