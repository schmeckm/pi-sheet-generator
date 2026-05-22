<template>
  <div v-if="target > 0" class="mt-3">
    <div class="relative h-3 overflow-hidden rounded-full bg-gray-200">
      <div
        class="absolute inset-y-0 bg-green-200"
        :style="{ left: `${minPct}%`, width: `${maxPct - minPct}%` }"
      />
      <div
        class="absolute top-0 h-full w-0.5 bg-[var(--sapBrandColor)]"
        :style="{ left: `${targetPct}%` }"
      />
      <div
        v-if="currentValue > 0"
        class="absolute -top-1 h-5 w-1 rounded bg-gray-800 shadow"
        :style="{ left: `${currentPct}%` }"
      />
    </div>
    <div class="mt-1 flex justify-between text-[10px] text-[var(--sapContentLabelColor)]">
      <span>{{ fmt(minVal) }}</span>
      <span>{{ t('equipment.target') }} {{ fmt(target) }}</span>
      <span>{{ fmt(maxVal) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  target: { type: Number, required: true },
  toleranceAbs: { type: Number, required: true },
  currentValue: { type: Number, default: 0 },
});

const { t } = useI18n();

const minVal = computed(() => props.target - props.toleranceAbs);
const maxVal = computed(() => props.target + props.toleranceAbs);
const span = computed(() => Math.max(maxVal.value - minVal.value, 0.001));

const minPct = computed(() => 5);
const maxPct = computed(() => 95);
const targetPct = computed(() => 50);
const currentPct = computed(() => {
  const p = ((props.currentValue - minVal.value) / span.value) * 90 + 5;
  return Math.min(95, Math.max(5, p));
});

function fmt(n) {
  return `${Number(n).toFixed(3)} kg`;
}
</script>
