<template>
  <table v-if="printMode" class="mt-2 w-full border-collapse text-sm print-table">
    <tbody>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.targetTemperature') }}</td>
        <td>{{ fmt(targetTemp) }} °C</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.tolerance') }}</td>
        <td>± {{ fmt(toleranceAbs) }} °C</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.actualTemperature') }}</td>
        <td>{{ confirmed ? fmt(confirmed.temperature) + ' °C' : '_______________ °C' }}</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.inTolerance') }}</td>
        <td>{{ confirmed ? (confirmed.in_tolerance ? t('equipment.yes') : t('equipment.no')) : '[ ] Ja  [ ] Nein' }}</td>
      </tr>
      <tr><td class="py-1 pr-2">{{ t('equipment.sensorId') }}</td><td>{{ equipmentId }}</td></tr>
    </tbody>
  </table>

  <div v-else-if="readOnly && confirmed" class="rounded border border-[var(--sapNeutralBorderColor)] p-3 text-sm">
    <p class="font-semibold">{{ t('equipment.temperatureConfirmed') }}</p>
    <p class="tabular-nums">{{ fmt(confirmed.temperature) }} °C · {{ confirmed.in_tolerance ? t('equipment.inTolerance') : t('equipment.outTolerance') }}</p>
  </div>

  <div v-else-if="!readOnly" class="sap-tile mt-2 p-4 !shadow-none">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-sm font-semibold text-[var(--sapTextColor)]">{{ meta.name || equipmentId }}</p>
        <p class="text-xs text-[var(--sapContentLabelColor)]">{{ equipmentId }}</p>
      </div>
      <EquipmentConnectionBadge
        :connection-type="meta.connection_type || liveStatus.connection_type || 'simulation'"
        :is-online="liveStatus.online"
        :is-fallback="live.fallback || liveStatus.fallback"
      />
    </div>

    <div class="mb-3 grid grid-cols-2 gap-2 rounded border border-[var(--sapNeutralBorderColor)] p-2 text-xs">
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.targetTemperature') }}</span>
        <p class="font-medium tabular-nums">{{ fmt(targetTemp) }} °C</p>
      </div>
      <div>
        <span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.tolerance') }}</span>
        <p class="font-medium tabular-nums">± {{ fmt(toleranceAbs) }} °C</p>
      </div>
    </div>

    <div class="text-center">
      <p
        class="text-3xl font-semibold tabular-nums"
        :class="inToleranceNow ? 'text-[var(--sapPositiveTextColor)]' : 'text-[var(--sapTextColor)]'"
      >
        {{ fmt(displayTemp) }} °C
      </p>
      <p class="mt-1 text-xs" :class="live.stable ? 'text-emerald-700' : 'text-amber-700'">
        {{ live.stable ? t('equipment.stable') : t('equipment.unstable') }}
      </p>
    </div>

    <p v-if="error" class="mt-2 text-xs text-[var(--sapErrorColor)]">{{ error }}</p>

    <button
      v-if="!isConfirmed"
      type="button"
      class="sap-btn sap-btn--emphasized mt-3 w-full !text-sm"
      :disabled="!canConfirm"
      @click="confirmReading"
    >
      {{ t('equipment.acceptTemperature') }}
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EquipmentConnectionBadge from '@/components/equipment/EquipmentConnectionBadge.vue';
import { useEquipment } from '@/composables/useEquipment';
import { get } from '@/composables/useApi';

const props = defineProps({
  equipmentId: { type: String, required: true },
  targetTemperature: { type: Number, default: 60 },
  toleranceAbs: { type: Number, default: 2 },
  requiresStable: { type: Boolean, default: true },
  minStabilityMs: { type: Number, default: 3000 },
  readOnly: { type: Boolean, default: false },
  printMode: { type: Boolean, default: false },
  existingRecord: { type: Object, default: null },
});

const emit = defineEmits(['temperature-confirmed']);
const { t } = useI18n();
const equipment = useEquipment();

const meta = ref({});
const live = ref({ temperature: 0, stable: false, fallback: false });
const liveStatus = ref({ online: false, connection_type: null, fallback: false });
const displayTemp = ref(0);
const stableSince = ref(null);
const isConfirmed = ref(false);
const confirmed = ref(null);
const error = ref('');
let unsub = null;

const inToleranceNow = computed(() => {
  const d = Math.abs(displayTemp.value - props.targetTemperature);
  return d <= props.toleranceAbs;
});

const canConfirm = computed(() => {
  if (!liveStatus.value.online && !live.value.fallback) return false;
  if (props.requiresStable && !live.value.stable) return false;
  if (props.minStabilityMs > 0) {
    if (!stableSince.value) return false;
    if (Date.now() - stableSince.value < props.minStabilityMs) return false;
  }
  return inToleranceNow.value;
});

watch(
  () => props.existingRecord,
  (r) => {
    if (r) {
      confirmed.value = r;
      isConfirmed.value = true;
    }
  },
  { immediate: true }
);

function fmt(n) {
  return Number(n || 0).toFixed(1);
}

function applyLive(v) {
  const temp = v.temperature ?? v.grossWeight ?? 0;
  live.value = { temperature: temp, stable: Boolean(v.stable), fallback: Boolean(v.fallback) };
  displayTemp.value = temp;
  if (v.stable) {
    if (!stableSince.value) stableSince.value = Date.now();
  } else {
    stableSince.value = null;
  }
}

async function loadMeta() {
  try {
    const data = await get(`/equipment/${encodeURIComponent(props.equipmentId)}/status`);
    meta.value = { name: data.name, connection_type: data.status?.connection_type };
    liveStatus.value = data.status || liveStatus.value;
  } catch {
    meta.value.name = props.equipmentId;
  }
}

function confirmReading() {
  const record = {
    equipment_id: props.equipmentId,
    temperature: displayTemp.value,
    target_temperature: props.targetTemperature,
    tolerance_abs: props.toleranceAbs,
    in_tolerance: inToleranceNow.value,
    stable: live.value.stable,
    timestamp: new Date().toISOString(),
  };
  confirmed.value = record;
  isConfirmed.value = true;
  emit('temperature-confirmed', { record, temperature: displayTemp.value });
}

onMounted(async () => {
  if (props.existingRecord || props.readOnly || props.printMode) return;
  await loadMeta();
  const sub = equipment.subscribe(props.equipmentId);
  unsub = sub.unsubscribe;
  watch(sub.live, (v) => applyLive(v), { deep: true, immediate: true });
  watch(sub.status, (s) => {
    liveStatus.value = s;
  }, { deep: true, immediate: true });
});

onUnmounted(() => {
  if (unsub) unsub();
});
</script>
