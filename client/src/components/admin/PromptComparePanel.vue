<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
    <p class="text-sm text-[var(--sapContentLabelColor)]">{{ t('promptConfig.compareHint') }}</p>

    <div class="grid gap-4 md:grid-cols-2">
      <label class="block">
        <span class="sap-label">{{ t('promptConfig.compareVersionA') }}</span>
        <select v-model="versionAId" class="sap-input mt-1 w-full">
          <option value="">—</option>
          <option v-for="v in versions" :key="v.id" :value="v.id">
            {{ t('promptConfig.versionLabel', { n: v.version_number }) }} — {{ formatDate(v.created_at) }}
          </option>
        </select>
      </label>
      <label class="block">
        <span class="sap-label">{{ t('promptConfig.compareVersionB') }}</span>
        <select v-model="versionBId" class="sap-input mt-1 w-full">
          <option value="">—</option>
          <option v-for="v in versions" :key="v.id" :value="v.id">
            {{ t('promptConfig.versionLabel', { n: v.version_number }) }} — {{ formatDate(v.created_at) }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="stats" class="text-xs text-[var(--sapContentLabelColor)]">
      {{
        t('promptConfig.compareDiffStats', {
          adds: stats.adds,
          removes: stats.removes,
          same: stats.same,
        })
      }}
    </p>

    <div
      v-if="diffRows.length"
      class="max-h-64 overflow-auto rounded-lg border border-[var(--sapNeutralBorderColor)] font-mono text-xs"
    >
      <div
        v-for="(row, i) in diffRows"
        :key="i"
        class="flex gap-2 border-b border-[var(--sapNeutralBorderColor)]/50 px-2 py-0.5"
        :class="{
          'bg-red-50': row.type === 'remove',
          'bg-green-50': row.type === 'add',
        }"
      >
        <span class="w-8 shrink-0 text-[var(--sapContentLabelColor)]">{{ row.oldLine || '·' }}</span>
        <span class="w-8 shrink-0 text-[var(--sapContentLabelColor)]">{{ row.newLine || '·' }}</span>
        <span class="min-w-0 flex-1 whitespace-pre-wrap break-all">{{ row.line || ' ' }}</span>
      </div>
    </div>

    <fieldset class="space-y-2 border-t border-[var(--sapNeutralBorderColor)] pt-4">
      <legend class="sap-label">{{ t('promptConfig.testModeTitle') }}</legend>
      <textarea
        v-model="testPrompt"
        class="sap-textarea min-h-[72px]"
        :placeholder="t('promptConfig.testPlaceholderAuto')"
      />
      <div class="flex flex-wrap gap-3 text-sm">
        <label v-for="opt in testModeOptions" :key="opt.value" class="flex cursor-pointer items-center gap-2">
          <input v-model="testMode" type="radio" class="accent-[var(--sapBrandColor)]" :value="opt.value" />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <button
        type="button"
        class="sap-btn sap-btn--emphasized"
        :disabled="!canRunAb || running"
        @click="runCompareTest"
      >
        {{ running ? t('promptConfig.compareRunning') : t('promptConfig.compareRunAb') }}
      </button>
    </fieldset>

    <div v-if="resultA || resultB" class="grid gap-4 lg:grid-cols-2">
      <div v-if="resultA" class="overflow-hidden rounded-lg border border-[var(--sapNeutralBorderColor)]">
        <div class="border-b bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300">
          {{ t('promptConfig.compareResultA', { n: resultA.version_number }) }}
        </div>
        <pre
          class="max-h-56 overflow-auto p-3 text-xs whitespace-pre-wrap"
          :class="resultA.mode === 'qa' ? 'bg-slate-50' : 'bg-slate-900 text-green-400'"
        >{{ resultA.text }}</pre>
        <TokenUsageLine v-if="resultA.usage" :usage="resultA.usage" class="border-t px-3 py-2" />
      </div>
      <div v-if="resultB" class="overflow-hidden rounded-lg border border-[var(--sapNeutralBorderColor)]">
        <div class="border-b bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300">
          {{ t('promptConfig.compareResultB', { n: resultB.version_number }) }}
        </div>
        <pre
          class="max-h-56 overflow-auto p-3 text-xs whitespace-pre-wrap"
          :class="resultB.mode === 'qa' ? 'bg-slate-50' : 'bg-slate-900 text-green-400'"
        >{{ resultB.text }}</pre>
        <TokenUsageLine v-if="resultB.usage" :usage="resultB.usage" class="border-t px-3 py-2" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { get, post } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import { diffLines } from '@/utils/lineDiff';
import TokenUsageLine from '@/components/shared/TokenUsageLine.vue';

const props = defineProps({
  promptId: { type: String, required: true },
  versions: { type: Array, default: () => [] },
  locale: { type: String, default: 'de' },
});

const { t } = useI18n();
const toast = useToast();

const versionAId = ref('');
const versionBId = ref('');
const stats = ref(null);
const diffRows = ref([]);
const testPrompt = ref('');
const testMode = ref('auto');
const running = ref(false);
const resultA = ref(null);
const resultB = ref(null);

const testModeOptions = computed(() => [
  { value: 'auto', label: t('promptConfig.testModeAuto') },
  { value: 'pi_sheet', label: t('promptConfig.testModePiSheet') },
  { value: 'qa', label: t('promptConfig.testModeQa') },
]);

const canRunAb = computed(
  () =>
    versionAId.value &&
    versionBId.value &&
    versionAId.value !== versionBId.value &&
    testPrompt.value.trim().length >= 10
);

function formatDate(d) {
  if (!d) return '';
  const loc = props.locale === 'en' ? 'en-GB' : 'de-DE';
  return new Date(d).toLocaleString(loc);
}

function formatResult(payload, versionNumber) {
  if (!payload) return null;
  let text = '';
  if (payload.mode === 'qa') text = payload.message || '';
  else text = JSON.stringify(payload.raw || payload.piSheet?.llm_response || payload, null, 2);
  return {
    version_number: versionNumber,
    mode: payload.mode,
    text,
    usage: payload.usage,
  };
}

async function loadCompare() {
  if (!versionAId.value || !versionBId.value || versionAId.value === versionBId.value) {
    stats.value = null;
    diffRows.value = [];
    return;
  }
  try {
    const data = await get(
      `/admin/prompts/${props.promptId}/compare?left=${versionAId.value}&right=${versionBId.value}`
    );
    stats.value = data.stats;
    diffRows.value = diffLines(data.left?.system_prompt, data.right?.system_prompt);
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
    stats.value = null;
    diffRows.value = [];
  }
}

async function runCompareTest() {
  if (!canRunAb.value) {
    toast.warning(t('promptConfig.compareSelectTwo'));
    return;
  }
  running.value = true;
  resultA.value = null;
  resultB.value = null;
  try {
    const res = await post(`/admin/prompts/${props.promptId}/compare-test`, {
      test_prompt: testPrompt.value.trim(),
      version_a_id: versionAId.value,
      version_b_id: versionBId.value,
      mode: testMode.value,
      locale: props.locale === 'en' ? 'en' : 'de',
    });
    resultA.value = formatResult(res.version_a?.result, res.version_a?.version_number);
    resultB.value = formatResult(res.version_b?.result, res.version_b?.version_number);
  } catch (e) {
    toast.error(e.response?.data?.error || e.message);
  } finally {
    running.value = false;
  }
}

watch([versionAId, versionBId], loadCompare);

watch(
  () => props.versions,
  (list) => {
    if (list?.length >= 2 && !versionAId.value) {
      versionAId.value = list[1]?.id || '';
      versionBId.value = list[0]?.id || '';
    }
  },
  { immediate: true }
);
</script>
