<template>
  <div class="rounded-lg border bg-white p-5 shadow-sm space-y-4">
    <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">
      {{ t('xstepAgent.composerPromptTitle') }}
    </h3>

    <textarea
      v-model="store.prompt"
      rows="4"
      class="w-full rounded-lg border px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      :placeholder="t('xstepAgent.composerPromptPlaceholder')"
      @keydown.ctrl.enter="store.generate()"
    />

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldProcessType') }}</label>
        <select v-model="store.processArea" class="w-full rounded border px-3 py-1.5 text-sm">
          <option value="">{{ t('xstepAgent.autoDetect') }}</option>
          <option value="Packaging">Packaging</option>
          <option value="Granulierung">Granulierung</option>
          <option value="Tablettierung">Tablettierung</option>
          <option value="Coating">Coating</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('xstepAgent.fieldPackagingType') }}</label>
        <select v-model="store.packagingType" class="w-full rounded border px-3 py-1.5 text-sm">
          <option value="">{{ t('xstepAgent.autoDetect') }}</option>
          <option value="Blister">Blister</option>
          <option value="Bottle">Bottle</option>
          <option value="Sachet">Sachet</option>
          <option value="Vial">Vial</option>
        </select>
      </div>
      <div class="flex items-end">
        <button
          :disabled="!store.prompt.trim() || store.generating"
          class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          @click="store.generate()"
        >
          <span v-if="store.generating" class="flex items-center justify-center gap-2">
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {{ t('xstepAgent.composerGenerating') }}
          </span>
          <span v-else>{{ t('xstepAgent.composerGenerate') }}</span>
        </button>
      </div>
    </div>

    <p class="text-xs text-gray-400">{{ t('xstepAgent.composerHint') }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useTemplateComposerStore } from '../../stores/useTemplateComposerStore';

const { t } = useI18n();
const store = useTemplateComposerStore();
</script>
