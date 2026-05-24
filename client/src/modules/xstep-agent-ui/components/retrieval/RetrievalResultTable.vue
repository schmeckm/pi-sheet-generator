<template>
  <div class="rounded-lg border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <h4 class="text-sm font-semibold text-gray-700">{{ title }}</h4>
      <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{{ items.length }}</span>
    </div>
    <div v-if="!items.length" class="px-5 py-6 text-center text-sm text-gray-400">
      {{ t('xstepAgent.noResults') }}
    </div>
    <div v-else class="divide-y max-h-80 overflow-y-auto">
      <div v-for="(item, idx) in items" :key="idx" class="px-5 py-3 hover:bg-gray-50">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 text-sm">{{ item.data?.name || item.data?.title || item.data?.id || '-' }}</p>
            <p class="mt-0.5 text-xs text-gray-400 truncate">
              {{ item.data?.id || item.data?.xstep_id || '' }}
              <span v-if="item.data?.category"> &middot; {{ item.data.category }}</span>
              <span v-if="item.data?.processType"> &middot; {{ item.data.processType }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-3">
            <span
              class="rounded px-2 py-0.5 text-[10px] font-medium"
              :class="typeClass(item.type)"
            >
              {{ item.type }}
            </span>
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" :class="scoreClass(item.score)">
              {{ item.score }}
            </span>
          </div>
        </div>
        <p v-if="item.data?.description" class="mt-1 text-xs text-gray-500 line-clamp-2">
          {{ item.data.description }}
        </p>
        <div v-if="item.data?.similarity != null" class="mt-1">
          <div class="flex items-center gap-2 text-[10px] text-gray-400">
            <span>similarity:</span>
            <div class="h-1.5 w-24 rounded-full bg-gray-100">
              <div class="h-1.5 rounded-full bg-blue-400" :style="{ width: `${Math.round(item.data.similarity * 100)}%` }" />
            </div>
            <span>{{ (item.data.similarity * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  title: { type: String, default: 'Results' },
  items: { type: Array, default: () => [] },
});

function typeClass(type) {
  const map = {
    xstep: 'bg-blue-50 text-blue-600',
    knowledge: 'bg-purple-50 text-purple-600',
    sop: 'bg-purple-50 text-purple-600',
    material: 'bg-amber-50 text-amber-600',
    recipe: 'bg-green-50 text-green-600',
    'pi-sheet-example': 'bg-indigo-50 text-indigo-600',
  };
  return map[type] || 'bg-gray-50 text-gray-600';
}

function scoreClass(score) {
  if (score >= 15) return 'bg-green-100 text-green-700';
  if (score >= 8) return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}
</script>
