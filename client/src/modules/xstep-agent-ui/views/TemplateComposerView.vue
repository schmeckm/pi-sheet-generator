<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t('xstepAgent.composerTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500">{{ t('xstepAgent.composerSubtitle') }}</p>
      </div>
      <button
        v-if="store.hasTemplate"
        class="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        @click="store.reset()"
      >
        {{ t('xstepAgent.composerReset') }}
      </button>
    </header>

    <!-- Prompt Editor -->
    <PromptEditor />

    <!-- Error -->
    <div v-if="store.error" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm font-medium text-red-700">{{ store.error }}</p>
    </div>

    <!-- Saved confirmation -->
    <div v-if="store.savedProposal" class="rounded-lg border border-green-200 bg-green-50 p-4">
      <p class="text-sm font-medium text-green-700">
        {{ t('xstepAgent.composerSaved') }}
        <span class="font-mono text-xs">{{ store.savedProposal.id }}</span>
      </p>
      <router-link to="/xstep-agent/review" class="mt-1 inline-block text-sm text-green-600 underline">
        {{ t('xstepAgent.composerGoToReview') }}
      </router-link>
    </div>

    <!-- Results -->
    <template v-if="store.hasTemplate">
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-5">
          <!-- Validation Warnings -->
          <ValidationWarningPanel :warnings="store.warnings" />

          <!-- Template Preview -->
          <TemplatePreview :template="store.template" />

          <!-- Action Bar -->
          <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
            <button
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="store.saving"
              @click="store.saveAsDraft()"
            >
              {{ store.saving ? t('xstepAgent.composerSaving') : t('xstepAgent.composerSaveDraft') }}
            </button>
            <button
              class="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              :disabled="store.validating"
              @click="store.validate()"
            >
              {{ t('xstepAgent.composerValidate') }}
            </button>
            <button
              class="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              @click="store.generateXml()"
            >
              {{ t('xstepAgent.composerExportXml') }}
            </button>
          </div>

          <!-- XML Preview -->
          <div v-if="store.xmlPreview" class="rounded-lg border bg-white shadow-sm">
            <div class="flex items-center justify-between border-b px-5 py-3">
              <h4 class="text-sm font-semibold text-gray-500">SAP XML Preview</h4>
              <button class="text-xs text-blue-600 hover:underline" @click="copyXml">
                {{ t('xstepAgent.composerCopyXml') }}
              </button>
            </div>
            <pre class="max-h-64 overflow-auto p-4 text-xs text-gray-600">{{ store.xmlPreview }}</pre>
          </div>
        </div>

        <!-- Evidence Sidebar -->
        <div class="space-y-5">
          <EvidencePanel :retrieval="store.retrieval" :audit="store.audit" />
        </div>
      </div>
    </template>

    <!-- Example Prompt Hint -->
    <div v-if="!store.hasTemplate && !store.generating" class="rounded-lg border bg-gray-50 p-5 text-center">
      <p class="text-sm text-gray-500">{{ t('xstepAgent.composerExampleTitle') }}</p>
      <button
        class="mt-2 rounded bg-white px-4 py-2 text-sm text-blue-600 border hover:bg-blue-50"
        @click="useExample"
      >
        {{ t('xstepAgent.composerExampleBtn') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useTemplateComposerStore } from '../stores/useTemplateComposerStore';
import PromptEditor from '../components/composer/PromptEditor.vue';
import TemplatePreview from '../components/composer/TemplatePreview.vue';
import ValidationWarningPanel from '../components/composer/ValidationWarningPanel.vue';
import EvidencePanel from '../components/composer/EvidencePanel.vue';

const { t } = useI18n();
const store = useTemplateComposerStore();

function useExample() {
  store.prompt = 'Create a pharmaceutical blister packaging PI Sheet template including line clearance, material identification, goods issue, IPC checks, goods receipt and electronic signature.';
  store.processArea = 'Packaging';
  store.packagingType = 'Blister';
}

function copyXml() {
  if (store.xmlPreview) {
    navigator.clipboard.writeText(store.xmlPreview);
  }
}
</script>
