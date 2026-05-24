<template>
  <div class="rounded-lg border bg-white p-5 shadow-sm space-y-3">
    <h4 class="text-sm font-semibold uppercase tracking-wider text-gray-500">
      {{ t('xstepAgent.composerEvidence') }}
    </h4>

    <div class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p class="text-xs text-gray-400">{{ t('xstepAgent.composerRetrievalMode') }}</p>
        <p class="font-medium text-gray-800">{{ retrieval.mode || '-' }}</p>
      </div>
      <div>
        <p class="text-xs text-gray-400">{{ t('xstepAgent.composerResultCount') }}</p>
        <p class="font-medium text-gray-800">{{ retrieval.resultCount || 0 }}</p>
      </div>
      <div>
        <p class="text-xs text-gray-400">{{ t('xstepAgent.composerGraphUsed') }}</p>
        <p class="font-medium" :class="retrieval.graphChainUsed ? 'text-green-600' : 'text-gray-400'">
          {{ retrieval.graphChainUsed ? `${t('xstepAgent.yes')} (${retrieval.graphChainLength} steps)` : t('xstepAgent.no') }}
        </p>
      </div>
      <div>
        <p class="text-xs text-gray-400">{{ t('xstepAgent.composerKnowledgeHits') }}</p>
        <p class="font-medium text-gray-800">{{ retrieval.knowledgeHits || 0 }}</p>
      </div>
    </div>

    <div v-if="retrieval.knowledgeTitles?.length" class="space-y-1">
      <p class="text-xs text-gray-400">{{ t('xstepAgent.composerKnowledgeSources') }}</p>
      <div v-for="title in retrieval.knowledgeTitles" :key="title" class="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
        {{ title }}
      </div>
    </div>

    <div v-if="audit.provider" class="border-t pt-3">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="text-xs text-gray-400">LLM Provider</p>
          <p class="font-medium text-gray-800">{{ audit.provider }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Mode</p>
          <p class="font-medium text-gray-800">{{ audit.mode || '-' }}</p>
        </div>
      </div>
      <div class="mt-2 flex gap-2">
        <span v-if="audit.noSapWriteBack" class="rounded bg-green-50 px-2 py-0.5 text-xs text-green-600">
          No SAP Write-Back
        </span>
        <span v-if="audit.humanApprovalRequired" class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
          Human Approval Required
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  retrieval: { type: Object, default: () => ({}) },
  audit: { type: Object, default: () => ({}) },
});
</script>
