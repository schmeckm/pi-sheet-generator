<template>
  <!-- Print / offline static table -->
  <table v-if="printMode" class="mt-2 w-full border-collapse text-sm print-table">
    <tbody>
      <tr class="border-b"><td class="py-1 pr-2">{{ t('equipment.targetWeight') }}</td><td>{{ fmt(targetWeight) }} kg</td></tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.tolerance') }}</td>
        <td>± {{ fmt(toleranceAbs) }} kg ({{ tolerancePercent }}%)</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.actualWeight') }}</td>
        <td>{{ confirmed ? fmt(confirmed.net_weight) + ' kg' : '_______________ kg' }}</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.deviation') }}</td>
        <td>{{ confirmed ? fmtSigned(confirmed.deviation) + ' kg' : '_______________ kg' }}</td>
      </tr>
      <tr class="border-b">
        <td class="py-1 pr-2">{{ t('equipment.inTolerance') }}</td>
        <td>{{ confirmed ? (confirmed.in_tolerance ? t('equipment.yes') : t('equipment.no')) : '[ ] Ja  [ ] Nein' }}</td>
      </tr>
      <tr class="border-b"><td class="py-1 pr-2">{{ t('equipment.scaleId') }}</td><td>{{ equipmentId }}</td></tr>
      <tr class="border-b"><td class="py-1 pr-2">{{ t('equipment.weighedBy') }}</td><td>_______ {{ t('equipment.date') }}: _____</td></tr>
      <tr><td class="py-1 pr-2">{{ t('equipment.verifiedBy') }}</td><td>_______ {{ t('equipment.date') }}: _____</td></tr>
    </tbody>
  </table>

  <div v-else-if="readOnly && confirmed">
    <WeighingResult :result="confirmed" :four-eyes="fourEyes" />
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

    <p
      v-if="live.fallback || liveStatus.fallback"
      class="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      {{ t('equipment.fallbackWarning', { id: equipmentId }) }}
    </p>

    <div
      v-if="materialInfo?.number || materialInfo?.batch"
      class="mb-3 grid grid-cols-2 gap-2 rounded border border-[var(--sapNeutralBorderColor)] p-2 text-xs"
    >
      <div><span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.materialNo') }}</span><p class="font-medium">{{ materialInfo.number || '—' }}</p></div>
      <div><span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.batch') }}</span><p class="font-medium">{{ materialInfo.batch || '—' }}</p></div>
      <div><span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.targetWeight') }}</span><p class="font-medium tabular-nums">{{ fmt(targetWeight) }} kg</p></div>
      <div><span class="text-[var(--sapContentLabelColor)]">{{ t('equipment.tolerance') }}</span><p class="font-medium tabular-nums">± {{ fmt(toleranceAbs) }} kg ({{ tolerancePercent }}%)</p></div>
    </div>

    <ScaleDisplay
      :gross="displayGross"
      :net="live.netWeight"
      :tare="live.tareWeight"
      :unit="live.unit"
      :stable="live.stable"
      :equipment-name="meta.name"
      :equipment-id="equipmentId"
    />

    <div v-if="!isConfirmed" class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        class="sap-btn sap-btn--transparent !text-sm"
        :disabled="busy || isTared"
        @click="doTare"
      >
        {{ t('equipment.tare') }}
      </button>
      <button
        v-if="isSimulation"
        type="button"
        class="sap-btn sap-btn--transparent !text-sm"
        :disabled="busy || dosing"
        @click="doAddMaterial"
      >
        {{ dosing ? t('equipment.dosing') : t('equipment.addMaterial') }}
      </button>
      <button
        type="button"
        class="sap-btn sap-btn--emphasized !text-sm"
        :disabled="busy || !canConfirm"
        @click="doConfirm"
      >
        {{ t('equipment.acceptWeight') }}
      </button>
    </div>

    <ToleranceBar
      v-if="live.netWeight > 0"
      :target="targetWeight"
      :tolerance-abs="toleranceAbs"
      :current-value="live.netWeight"
    />

    <p v-if="error" class="mt-2 text-xs text-[var(--sapErrorColor)]">{{ error }}</p>

    <WeighingResult
      v-if="isConfirmed && confirmed"
      :result="confirmed"
      :four-eyes="fourEyes"
      :can-verify="fourEyes && !confirmed.verified_by"
      :verifying="verifying"
      @verify="doVerify"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { get, post, put } from '@/composables/useApi';
import { useEquipment } from '@/composables/useEquipment';
import EquipmentConnectionBadge from './EquipmentConnectionBadge.vue';
import ScaleDisplay from './ScaleDisplay.vue';
import ToleranceBar from './ToleranceBar.vue';
import WeighingResult from './WeighingResult.vue';

const props = defineProps({
  equipmentId: { type: String, required: true },
  targetWeight: { type: Number, required: true },
  tolerancePercent: { type: Number, default: 1 },
  toleranceAbs: { type: Number, default: null },
  requiresTare: { type: Boolean, default: true },
  requiresStable: { type: Boolean, default: true },
  minStabilityMs: { type: Number, default: 2000 },
  fourEyes: { type: Boolean, default: false },
  materialInfo: { type: Object, default: null },
  readOnly: { type: Boolean, default: false },
  printMode: { type: Boolean, default: false },
  piSheetId: { type: String, default: null },
  piSheetStepId: { type: String, default: null },
  existingRecord: { type: Object, default: null },
});

const emit = defineEmits(['weighing-confirmed', 'weighing-verified']);

const { t } = useI18n();
const auth = useAuthStore();
const equipment = useEquipment();

const meta = ref({ name: '', connection_type: 'simulation' });
const live = ref({
  grossWeight: 0,
  netWeight: 0,
  tareWeight: 0,
  stable: false,
  unit: 'kg',
  fallback: false,
  source: 'simulation',
});
const liveStatus = ref({ online: false, connection_type: 'simulation', fallback: false });
const rawReadings = ref([]);
const isTared = ref(false);
const isConfirmed = ref(false);
const confirmed = ref(props.existingRecord || null);
const busy = ref(false);
const verifying = ref(false);
const dosing = ref(false);
const error = ref('');
const stableSince = ref(null);
const displayGross = ref(0);
let unsub = null;
let rafId = null;

const toleranceAbs = computed(() => {
  if (props.toleranceAbs != null) return props.toleranceAbs;
  return (props.targetWeight * props.tolerancePercent) / 100;
});

const isSimulation = computed(
  () => live.value.source === 'simulation' || meta.value.connection_type === 'simulation'
);

const canConfirm = computed(() => {
  if (isConfirmed.value) return false;
  if (props.requiresTare && !isTared.value && live.value.tareWeight <= 0) return false;
  if (props.requiresStable && !live.value.stable) return false;
  if (props.minStabilityMs > 0) {
    if (!stableSince.value) return false;
    if (Date.now() - stableSince.value < props.minStabilityMs) return false;
  }
  return live.value.netWeight > 0;
});

watch(
  () => props.existingRecord,
  (r) => {
    if (r) {
      confirmed.value = r;
      isConfirmed.value = true;
    }
  }
);

function fmt(n) {
  return Number(n || 0).toFixed(3);
}

function fmtSigned(n) {
  const v = Number(n || 0);
  return (v > 0 ? '+' : '') + v.toFixed(3);
}

function smoothDisplay(target) {
  if (rafId) cancelAnimationFrame(rafId);
  const start = displayGross.value;
  const diff = target - start;
  if (Math.abs(diff) < 0.0001) {
    displayGross.value = target;
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 80);
    displayGross.value = start + diff * p;
    if (p < 1) rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

async function loadMeta() {
  try {
    const data = await get(`/equipment/${encodeURIComponent(props.equipmentId)}/status`);
    meta.value = {
      name: data.name,
      connection_type: data.status?.connection_type || data.equipment_type,
    };
    liveStatus.value = data.status || liveStatus.value;
  } catch {
    meta.value.name = props.equipmentId;
  }
}

onMounted(async () => {
  if (props.existingRecord) {
    isConfirmed.value = true;
    return;
  }
  if (props.readOnly || props.printMode) return;

  await loadMeta();
  const sub = equipment.subscribe(props.equipmentId);
  unsub = sub.unsubscribe;

  watch(
    sub.live,
    (v) => {
      live.value = { ...v };
      smoothDisplay(v.grossWeight);
      rawReadings.value.push({
        timestamp: v.timestamp || Date.now(),
        gross: v.grossWeight,
        net: v.netWeight,
        tare: v.tareWeight,
        stable: v.stable,
      });
      if (v.stable) {
        if (!stableSince.value) stableSince.value = Date.now();
      } else {
        stableSince.value = null;
      }
      if (v.tareWeight > 0) isTared.value = true;
    },
    { deep: true, immediate: true }
  );

  watch(sub.status, (s) => {
    liveStatus.value = s;
  }, { deep: true, immediate: true });
});

onUnmounted(() => {
  if (unsub) unsub();
  if (rafId) cancelAnimationFrame(rafId);
});

async function doTare() {
  busy.value = true;
  error.value = '';
  try {
    const res = await equipment.sendCommand(props.equipmentId, 'tare');
    if (res.success) isTared.value = true;
    else error.value = res.message || t('equipment.tareFailed');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function doAddMaterial() {
  busy.value = true;
  dosing.value = true;
  error.value = '';
  try {
    await equipment.sendCommand(props.equipmentId, 'addWeight', { amount: 5 });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    setTimeout(() => {
      dosing.value = false;
    }, 3000);
  }
}

async function doConfirm() {
  busy.value = true;
  error.value = '';
  try {
    const record = await post('/weighing', {
      equipment_id: props.equipmentId,
      pi_sheet_id: props.piSheetId,
      pi_sheet_step_id: props.piSheetStepId,
      gross_weight: live.value.grossWeight,
      tare_weight: live.value.tareWeight,
      net_weight: live.value.netWeight,
      unit: live.value.unit,
      target_weight: props.targetWeight,
      tolerance_abs: toleranceAbs.value,
      tolerance_pct: props.tolerancePercent,
      material_number: props.materialInfo?.number,
      material_name: props.materialInfo?.name,
      batch_number: props.materialInfo?.batch,
      stable_reading: live.value.stable,
      reading_count: rawReadings.value.length,
      stability_duration_ms: stableSince.value ? Date.now() - stableSince.value : 0,
      raw_readings: rawReadings.value.slice(-500),
      connection_source: live.value.source,
    });
    const enriched = {
      ...record,
      weighed_by_name: auth.user?.name,
    };
    confirmed.value = enriched;
    isConfirmed.value = true;
    emit('weighing-confirmed', {
      weighingRecordId: record.id,
      netWeight: record.net_weight,
      grossWeight: record.gross_weight,
      tareWeight: record.tare_weight,
      deviation: record.deviation,
      inTolerance: record.in_tolerance,
      record: enriched,
    });
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('equipment.confirmFailed');
  } finally {
    busy.value = false;
  }
}

async function doVerify() {
  if (!confirmed.value?.id) return;
  verifying.value = true;
  error.value = '';
  try {
    const record = await put(`/weighing/${confirmed.value.id}/verify`, {});
    confirmed.value = {
      ...confirmed.value,
      ...record,
      verified_by_name: record.verifiedBy?.name || auth.user?.name,
    };
    emit('weighing-verified', confirmed.value);
  } catch (e) {
    error.value = e.response?.data?.error || e.message || t('equipment.verifyFailed');
  } finally {
    verifying.value = false;
  }
}
</script>
