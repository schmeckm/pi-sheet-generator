<template>
  <div class="confidence-meter" :class="sizeClass">
    <div v-if="label || showPercent" class="flex justify-between gap-2 text-xs text-[var(--sapContentLabelColor)]">
      <span v-if="label">{{ label }}</span>
      <span v-if="showPercent" class="tabular-nums font-medium text-[var(--sapTextColor)]">{{ percent }}%</span>
    </div>
    <div
      class="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--sapNeutralBorderColor)]"
      :class="compact ? '!mt-0.5 !h-1' : ''"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label || t('preview.confidenceOverall')"
    >
      <div
        class="h-full transition-all duration-500"
        :class="barClass"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <p v-if="hint" class="mt-1 text-[10px] leading-snug text-[var(--sapContentLabelColor)]">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  /** 0–1 or 0–100 */
  value: { type: Number, default: 0 },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  showPercent: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
});

const { t } = useI18n();

const percent = computed(() => {
  const v = props.value ?? 0;
  const n = v > 1 ? v : v * 100;
  return Math.max(0, Math.min(100, Math.round(n)));
});

const barClass = computed(() => {
  if (percent.value >= 80) return 'bg-[var(--sapSuccessColor)]';
  if (percent.value >= 55) return 'bg-[var(--sapBrandColor)]';
  if (percent.value >= 35) return 'bg-amber-500';
  return 'bg-[var(--sapErrorColor)]';
});

const sizeClass = computed(() => (props.compact ? 'confidence-meter--compact' : ''));
</script>
