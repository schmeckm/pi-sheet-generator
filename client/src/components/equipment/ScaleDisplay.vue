<template>
  <div class="rounded-lg bg-[#0a1628] p-4 font-mono text-[#4ade80] shadow-inner">
    <p class="mb-3 text-center text-[10px] text-[#6ee7b7]/80">
      {{ equipmentName }} · {{ equipmentId }}
    </p>
    <div class="grid grid-cols-3 items-end gap-2">
      <div class="text-right">
        <p class="text-[10px] text-[#6ee7b7]/70">{{ t('equipment.tare') }}</p>
        <p class="min-h-[1.75rem] text-lg tabular-nums leading-none">{{ fmt(tare) }}</p>
      </div>
      <div class="flex min-h-[5.5rem] flex-col items-center justify-end text-center">
        <div class="mb-1 flex h-4 w-full items-center justify-center">
          <StabilityIndicator :stable="stable" />
        </div>
        <p class="min-h-[2.75rem] text-4xl font-bold leading-none tabular-nums">{{ fmt(gross) }}</p>
        <p class="mt-1 text-sm text-[#6ee7b7]/90">{{ unit }}</p>
      </div>
      <div class="text-left">
        <p class="text-[10px] text-[#6ee7b7]/70">{{ t('equipment.net') }}</p>
        <p class="text-lg tabular-nums">{{ fmt(net) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import StabilityIndicator from './StabilityIndicator.vue';

defineProps({
  gross: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  tare: { type: Number, default: 0 },
  unit: { type: String, default: 'kg' },
  stable: { type: Boolean, default: false },
  equipmentName: { type: String, default: '' },
  equipmentId: { type: String, default: '' },
});

const { t } = useI18n();

function fmt(n) {
  return Number(n || 0).toFixed(3);
}
</script>
