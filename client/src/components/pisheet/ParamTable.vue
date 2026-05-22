<template>
  <table class="mt-2 w-full text-sm" :class="printMode ? 'print-table' : ''">
    <thead v-if="!hasScaleParam">
      <tr class="border-b text-left text-xs text-gray-500">
        <th class="py-1">{{ t('preview.paramName') }}</th>
        <th class="py-1">{{ t('preview.paramValue') }}</th>
        <th class="py-1 w-16">{{ t('preview.paramRequired') }}</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(p, i) in params" :key="i">
        <tr v-if="p.type !== 'scale'" class="border-b border-gray-100">
          <td class="py-2 pr-2">{{ p.name }}</td>
          <td class="py-2">
            <span v-if="inputsLocked" class="print-line">{{ displayValue(p) }}</span>
            <span v-else-if="p.type === 'display'" class="text-gray-500">{{ displayValue(p) }}</span>
            <input
              v-else-if="p.type === 'checkbox'"
              v-model="p.checked"
              type="checkbox"
              :disabled="inputsLocked"
              class="rounded"
            />
            <input
              v-else
              v-model="p.value"
              type="text"
              class="w-full rounded border border-gray-200 px-2 py-1 text-sm"
              :placeholder="p.unit || ''"
              :disabled="inputsLocked"
            />
          </td>
          <td class="text-center">{{ p.required ? '●' : '○' }}</td>
        </tr>
        <tr v-else class="border-b border-gray-100">
          <td colspan="3" class="py-2">
            <p class="mb-1 text-xs font-semibold text-[var(--sapTextColor)]">
              {{ p.name }}
              <span v-if="p.required" class="text-[var(--sapErrorColor)]">*</span>
            </p>
            <ScaleWidget
              compact
              :equipment-id="p.equipment_config.equipment_id"
              :target-weight="scaleTarget(p)"
              :tolerance-percent="scaleTolerancePct(p)"
              :requires-tare="p.equipment_config.requires_tare !== false"
              :requires-stable="p.equipment_config.requires_stable !== false"
              :min-stability-ms="p.equipment_config.min_stability_ms || 2000"
              :four-eyes="Boolean(p.equipment_config.four_eyes)"
              :material-info="materialInfo"
              :read-only="inputsLocked"
              :print-mode="printMode"
              :pi-sheet-id="piSheetId"
              :pi-sheet-step-id="step?.id"
              :existing-record="p.weighing_record"
              @weighing-confirmed="onWeighingConfirmed(p, $event)"
            />
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ScaleWidget from '@/components/equipment/ScaleWidget.vue';
import {
  getStepParamValue,
  getMaterialInfo,
  parseTolerancePercent,
} from '@/utils/stepParams';

const props = defineProps({
  params: { type: Array, default: () => [] },
  printMode: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  step: { type: Object, default: null },
  piSheetId: { type: String, default: null },
});

const emit = defineEmits(['param-updated']);
const { t } = useI18n();

const inputsLocked = computed(() => props.printMode || props.readOnly);
const hasScaleParam = computed(() => props.params.some((p) => p.type === 'scale'));
const materialInfo = computed(() => (props.step ? getMaterialInfo(props.step) : null));

function displayValue(p) {
  return p.value ?? p.default_value ?? (p.unit ? `(${p.unit})` : '—');
}

function scaleTarget(p) {
  const field = p.equipment_config?.target_field;
  const fromStep = field && props.step ? getStepParamValue(props.step, field) : null;
  if (fromStep != null) return Number(fromStep);
  return Number(p.equipment_config?.target_weight) || 10;
}

function scaleTolerancePct(p) {
  const field = p.equipment_config?.tolerance_field;
  if (field && props.step) return parseTolerancePercent(props.step, field, 1);
  return Number(p.equipment_config?.tolerance_percent) || 1;
}

function onWeighingConfirmed(param, event) {
  param.weighing_record = event.record;
  param.value = `${event.netWeight} kg`;
  const ist = props.step?.params?.find((x) => /istmenge|actual/i.test(x.name));
  if (ist) ist.value = String(event.netWeight);
  const waage = props.step?.params?.find((x) => /waage/i.test(x.name));
  if (waage) waage.value = param.equipment_config.equipment_id;
  emit('param-updated', { step: props.step, param, event });
}
</script>

