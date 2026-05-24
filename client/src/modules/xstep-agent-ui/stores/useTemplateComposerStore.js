import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { composeTemplate, validateTemplate, exportXml, createProposal } from '../services/xstepAgentApi';

export const useTemplateComposerStore = defineStore('templateComposer', () => {
  const prompt = ref('');
  const processArea = ref('');
  const packagingType = ref('');

  const template = ref(null);
  const xmlPreview = ref(null);
  const generating = ref(false);
  const validating = ref(false);
  const saving = ref(false);
  const error = ref(null);
  const savedProposal = ref(null);

  const hasTemplate = computed(() => !!template.value);
  const steps = computed(() => template.value?.steps || []);
  const warnings = computed(() => template.value?.validationIssues || []);
  const retrieval = computed(() => template.value?.retrievalSummary || {});
  const audit = computed(() => template.value?.audit || {});

  async function generate() {
    if (!prompt.value.trim()) return;
    generating.value = true;
    error.value = null;
    template.value = null;
    xmlPreview.value = null;
    savedProposal.value = null;
    try {
      const payload = { prompt: prompt.value };
      if (processArea.value) payload.processArea = processArea.value;
      if (packagingType.value) payload.packagingType = packagingType.value;
      template.value = await composeTemplate(payload);
    } catch (err) {
      error.value = err?.response?.data?.error || err?.message || 'Template generation failed';
    } finally {
      generating.value = false;
    }
  }

  async function validate() {
    if (!template.value) return;
    validating.value = true;
    try {
      template.value = await validateTemplate(template.value);
    } catch (err) {
      error.value = err?.response?.data?.error || err?.message || 'Validation failed';
    } finally {
      validating.value = false;
    }
  }

  async function generateXml() {
    if (!template.value) return;
    try {
      const xml = await exportXml(template.value);
      xmlPreview.value = typeof xml === 'string' ? xml : null;
    } catch {
      xmlPreview.value = null;
    }
  }

  async function saveAsDraft() {
    if (!prompt.value.trim()) return;
    saving.value = true;
    try {
      const payload = { prompt: prompt.value };
      if (processArea.value) payload.processArea = processArea.value;
      if (packagingType.value) payload.packagingType = packagingType.value;
      savedProposal.value = await createProposal(payload);
    } catch (err) {
      error.value = err?.response?.data?.error || err?.message || 'Save failed';
    } finally {
      saving.value = false;
    }
  }

  function reset() {
    prompt.value = '';
    processArea.value = '';
    packagingType.value = '';
    template.value = null;
    xmlPreview.value = null;
    error.value = null;
    savedProposal.value = null;
  }

  return {
    prompt, processArea, packagingType,
    template, xmlPreview, generating, validating, saving, error, savedProposal,
    hasTemplate, steps, warnings, retrieval, audit,
    generate, validate, generateXml, saveAsDraft, reset,
  };
});
