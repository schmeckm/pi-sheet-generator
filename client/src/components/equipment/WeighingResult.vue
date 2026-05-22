<template>
  <div class="sap-tile mt-4 p-4 !shadow-none">
    <h4 class="mb-3 text-sm font-semibold text-[var(--sapTextColor)]">{{ t('equipment.resultTitle') }}</h4>
    <div class="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.targetWeight') }}</span>
        <p class="font-semibold tabular-nums">{{ fmt(result.target_weight) }} {{ result.unit || 'kg' }}</p>
      </div>
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.actualWeight') }}</span>
        <p
          class="font-semibold tabular-nums"
          :class="result.in_tolerance ? 'text-green-700' : 'text-red-700'"
        >
          {{ fmt(result.net_weight) }} {{ result.unit || 'kg' }}
        </p>
      </div>
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.deviation') }}</span>
        <p class="font-semibold tabular-nums">{{ fmtSigned(result.deviation) }} kg</p>
      </div>
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.assessment') }}</span>
        <span
          class="inline-block rounded px-2 py-0.5 text-xs font-semibold"
          :class="result.in_tolerance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
        >
          {{ result.in_tolerance ? t('equipment.inTolerance') : t('equipment.outTolerance') }}
        </span>
      </div>
    </div>
    <ToleranceBar
      v-if="result.target_weight"
      :target="Number(result.target_weight)"
      :tolerance-abs="Number(result.tolerance_abs || 0)"
      :current-value="Number(result.net_weight)"
      class="mt-3"
    />
    <div class="mt-4 grid gap-2 border-t pt-3 text-xs text-[var(--sapContentLabelColor)] sm:grid-cols-2">
      <p>{{ t('equipment.weighedBy') }}: {{ result.weighed_by_name || '—' }}</p>
      <p>{{ t('equipment.weighedAt') }}: {{ formatTs(result.weighed_at) }}</p>
      <template v-if="fourEyes">
        <p class="sm:col-span-2 font-medium text-[var(--sapTextColor)]">{{ t('equipment.fourEyes') }}</p>
        <template v-if="result.verified_by || result.verified_by_name">
          <p>{{ t('equipment.verifiedBy') }}: {{ result.verified_by_name || '—' }}</p>
          <p>{{ t('equipment.verifiedAt') }}: {{ formatTs(result.verified_at) }}</p>
        </template>
        <template v-else>
          <p class="sm:col-span-2 text-xs text-amber-800">{{ t('equipment.verifyPending') }}</p>
          <button
            v-if="canVerify"
            type="button"
            class="sap-btn sap-btn--emphasized !text-xs sm:col-span-2"
            :disabled="verifying"
            @click="$emit('verify')"
          >
            {{ verifying ? t('equipment.verifying') : t('equipment.verifyNow') }}
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import ToleranceBar from './ToleranceBar.vue';

defineProps({
  result: { type: Object, required: true },
  fourEyes: { type: Boolean, default: false },
  canVerify: { type: Boolean, default: false },
  verifying: { type: Boolean, default: false },
});

defineEmits(['verify']);

const { t, locale } = useI18n();

function fmt(n) {
  return n != null ? Number(n).toFixed(3) : '—';
}

function fmtSigned(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v > 0 ? '+' : '') + v.toFixed(3);
}

function formatTs(ts) {
  if (!ts) return '—';
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  return new Date(ts).toLocaleString(loc);
}
</script>
