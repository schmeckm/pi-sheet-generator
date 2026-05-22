<template>
  <div
    class="step-card mb-4 rounded-lg border-2 p-4"
    :class="[
      printMode ? 'border-gray-400 bg-white' : matchBorderClass || borderClass,
      step.is_suggestion && !printMode && !matchStatus ? 'border-dashed border-amber-400 bg-amber-50' : '',
    ]"
  >
    <div class="flex items-start gap-3">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        :class="printMode ? 'bg-gray-800' : badgeClass"
      >
        {{ step.step_nr }}
      </span>
      <div class="flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-semibold" :class="printMode ? 'text-black' : ''">{{ localizeText(step.name) }}</h3>
          <span v-if="step.is_suggestion && !printMode" class="rounded bg-amber-200 px-2 text-xs text-amber-900">
            {{ t('preview.aiSuggestion') }}
          </span>
        </div>
        <p class="text-xs text-gray-500">
          {{ step.xstep_id || t('preview.newStep') }} · {{ localizeCategory(step.category) }}
        </p>
        <p v-if="step.instruction" class="mt-2 text-sm" :class="printMode ? 'text-black' : 'text-gray-700'">
          {{ localizeText(step.instruction) }}
        </p>
        <ParamTable
          :params="step.params || []"
          :print-mode="printMode"
          :step="step"
          :pi-sheet-id="piSheetId"
        />
        <p
          v-if="printMode && needsSignature"
          class="mt-3 border-t border-dotted border-gray-400 pt-2 text-xs"
        >
          Durchgeführt: __________ Datum: __________ | Geprüft: __________ Datum: __________
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ParamTable from './ParamTable.vue';
import { usePiSheetDisplay } from '@/composables/usePiSheetDisplay';

const { t } = useI18n();
const { localizeText, localizeCategory } = usePiSheetDisplay();

const props = defineProps({
  step: { type: Object, required: true },
  printMode: { type: Boolean, default: false },
  piSheetId: { type: String, default: null },
  /** matched | possible | new — vision digitalization review borders */
  matchStatus: { type: String, default: null },
});

const categoryColors = {
  Warenbewegung: 'bg-category-warenbewegung',
  Rückmeldung: 'bg-category-rueckmeldung',
  Prozess: 'bg-category-prozess',
  Qualität: 'bg-category-qualitaet',
  Dokumentation: 'bg-category-dokumentation',
};

const badgeClass = computed(
  () => categoryColors[props.step.category] || 'bg-gray-600'
);
const matchBorderClass = computed(() => {
  if (props.printMode || !props.matchStatus) return '';
  const map = {
    matched: 'border-green-500 bg-green-50/40',
    possible: 'border-amber-500 bg-amber-50/40',
    new: 'border-red-500 bg-red-50/40',
  };
  return map[props.matchStatus] || '';
});

const borderClass = computed(() => {
  if (props.printMode || props.matchStatus) return 'border-gray-200';
  const map = {
    Warenbewegung: 'border-green-200',
    Rückmeldung: 'border-blue-200',
    Prozess: 'border-orange-200',
    Qualität: 'border-pink-200',
    Dokumentation: 'border-purple-200',
  };
  return map[props.step.category] || 'border-gray-200';
});
const needsSignature = computed(
  () => props.step.category === 'Qualität' || props.step.gmp_relevant
);
</script>
