<template>
  <div v-if="template" class="rounded-lg border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {{ t('xstepAgent.composerPreviewTitle') }}
      </h3>
      <div class="flex items-center gap-2">
        <span
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="statusClass"
        >
          {{ template.validationStatus }}
        </span>
        <span class="text-xs text-gray-400">
          {{ template.processArea }} {{ template.packagingType ? `/ ${template.packagingType}` : '' }}
        </span>
      </div>
    </div>

    <div class="divide-y">
      <div
        v-for="(step, idx) in template.steps"
        :key="idx"
        class="flex items-center gap-4 px-5 py-3 transition hover:bg-gray-50"
      >
        <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
          {{ step.sequence }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900">{{ step.name }}</p>
          <div class="mt-0.5 flex flex-wrap gap-1.5">
            <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
              {{ step.recommendedXStep }}
            </span>
            <span class="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600">
              {{ step.stepType }}
            </span>
            <span v-if="step.gmpRelevant" class="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-600">
              GMP
            </span>
            <span v-if="step.requiresSignature" class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
              {{ t('xstepAgent.signature') }}
            </span>
          </div>
        </div>
        <span class="flex-shrink-0 rounded px-2 py-0.5 text-[10px]" :class="sourceClass(step.source)">
          {{ step.source }}
        </span>
      </div>
    </div>

    <div v-if="!template.steps?.length" class="px-5 py-8 text-center text-sm text-gray-400">
      {{ t('xstepAgent.noResults') }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({ template: { type: Object, default: null } });

const statusClass = computed(() => {
  const map = {
    DRAFT_REQUIRES_REVIEW: 'bg-amber-100 text-amber-800',
    VALIDATED: 'bg-green-100 text-green-700',
    INVALID: 'bg-red-100 text-red-700',
  };
  return map[props.template?.validationStatus] || 'bg-gray-100 text-gray-600';
});

function sourceClass(source) {
  if (source?.includes('retrieval')) return 'bg-blue-50 text-blue-600';
  if (source?.includes('rule')) return 'bg-amber-50 text-amber-600';
  return 'bg-gray-50 text-gray-500';
}
</script>
