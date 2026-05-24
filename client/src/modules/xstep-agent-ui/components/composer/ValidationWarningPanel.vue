<template>
  <div v-if="warnings.length" class="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
    <h4 class="mb-2 text-sm font-semibold text-amber-800">
      {{ t('xstepAgent.composerWarnings') }} ({{ warnings.length }})
    </h4>
    <ul class="space-y-1.5">
      <li v-for="(w, i) in warnings" :key="i" class="flex items-start gap-2 text-sm">
        <span
          class="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
          :class="w.severity === 'error' ? 'bg-red-500' : 'bg-amber-400'"
        />
        <div>
          <span class="font-medium text-gray-800">{{ w.message }}</span>
          <span v-if="w.ruleId" class="ml-1 text-xs text-gray-400">({{ w.ruleId }})</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({ warnings: { type: Array, default: () => [] } });
</script>
