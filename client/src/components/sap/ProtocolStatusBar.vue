<template>
  <div
    class="sap-protocol-bar"
    :class="expanded ? 'sap-protocol-bar--expanded' : ''"
    role="region"
    :aria-label="t('statusBar.protocolBarAria')"
  >
    <div class="sap-protocol-bar__strip">
      <div class="sap-protocol-bar__group">
        <span class="sap-protocol-bar__chip sap-protocol-bar__chip--title">
          <span
            class="sap-protocol-bar__dot"
            :class="summary.online > 0 ? 'sap-protocol-bar__dot--ok' : 'sap-protocol-bar__dot--muted'"
          />
          {{ t('equipment.debugTitle') }}
        </span>

        <span class="sap-protocol-bar__sep" aria-hidden="true">·</span>
        <span class="sap-protocol-bar__chip" :title="t('statusBar.equipmentTooltip')">
          EQ
          <span class="sap-protocol-bar__ok">{{ summary.online }}</span>
          <span class="sap-protocol-bar__muted">/</span>
          <span class="sap-protocol-bar__err">{{ summary.offline }}</span>
          <span v-if="summary.simulation" class="sap-protocol-bar__warn">
            · SIM {{ summary.simulation }}
          </span>
        </span>

        <template v-for="p in protocolChips" :key="p.key">
          <span class="sap-protocol-bar__sep" aria-hidden="true">·</span>
          <span
            class="sap-protocol-bar__chip"
            :class="p.online ? 'sap-protocol-bar__chip--ok' : 'sap-protocol-bar__chip--muted'"
            :title="p.tooltip"
          >
            <span
              class="sap-protocol-bar__dot"
              :class="p.online ? 'sap-protocol-bar__dot--ok' : 'sap-protocol-bar__dot--muted'"
            />
            {{ p.label }}
          </span>
        </template>
      </div>

      <button
        v-if="auth.isAdmin"
        type="button"
        class="sap-protocol-bar__toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span>{{ debugLines }} {{ t('equipment.debugLines') }}</span>
        <span class="sap-protocol-bar__chevron">{{ expanded ? '▾' : '▴' }}</span>
      </button>
    </div>

    <div
      v-if="expanded && auth.isAdmin"
      class="sap-protocol-bar__log"
    >
      <p v-if="!lines.length" class="sap-protocol-bar__log-empty">{{ t('equipment.debugEmpty') }}</p>
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="sap-protocol-bar__log-line"
      >
        <span class="sap-protocol-bar__log-ts">{{ formatTs(line.timestamp) }}</span>
        <span class="sap-protocol-bar__log-eq">{{ line.equipmentId }}</span>
        <span class="sap-protocol-bar__log-proto">[{{ line.protocol || '?' }}/{{ line.direction }}]</span>
        <span v-if="line.topic" class="sap-protocol-bar__log-topic">{{ line.topic }}</span>
        <span v-if="line.field" class="sap-protocol-bar__log-val">{{ line.field }}={{ line.value }}</span>
        <span v-else-if="line.values" class="sap-protocol-bar__log-val">{{ JSON.stringify(line.values) }}</span>
        <span v-if="line.raw" class="sap-protocol-bar__log-raw">raw: {{ truncate(line.raw) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { get } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  equipmentId: { type: String, default: '' },
  pollMs: { type: Number, default: 15000 },
  debugPollMs: { type: Number, default: 1500 },
});

const { t, locale } = useI18n();
const auth = useAuthStore();

const expanded = ref(false);
const summary = ref({ total: 0, online: 0, offline: 0, simulation: 0, protocols: {}, debugLines: 0 });
const lines = ref([]);

let summaryTimer = null;
let debugTimer = null;

const PROTOCOL_ORDER = ['opcua', 'mqtt', 'uns_sparkplug'];

const PROTOCOL_LABELS = {
  opcua: 'OPC UA',
  mqtt: 'MQTT',
  uns_sparkplug: 'UNS',
  simulation: 'SIM',
};

const debugLines = computed(() => lines.value.length || summary.value.debugLines || 0);

const protocolChips = computed(() =>
  PROTOCOL_ORDER.map((key) => {
    const val = summary.value.protocols?.[key] || { total: 0, online: 0 };
    return {
      key,
      label: `${PROTOCOL_LABELS[key] || key.toUpperCase()} ${val.online}/${val.total}`,
      online: val.online > 0,
      tooltip: t('statusBar.protocolTooltip', {
        protocol: PROTOCOL_LABELS[key] || key,
        online: val.online,
        total: val.total,
      }),
    };
  })
);

function formatTs(ts) {
  if (!ts) return '';
  const loc = locale.value === 'en' ? 'en-GB' : 'de-DE';
  return new Date(ts).toLocaleTimeString(loc);
}

function truncate(s, max = 120) {
  const str = String(s);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

async function pollSummary() {
  if (!auth.isAuthenticated) {
    summary.value = { total: 0, online: 0, offline: 0, simulation: 0, protocols: {}, debugLines: 0 };
    return;
  }
  try {
    summary.value = await get('/equipment/status-summary');
  } catch {
    summary.value = { total: 0, online: 0, offline: 0, simulation: 0, protocols: {}, debugLines: 0 };
  }
}

async function pollDebugLog() {
  if (!auth.isAdmin || !expanded.value) {
    lines.value = [];
    return;
  }
  try {
    const params = { limit: 60 };
    if (props.equipmentId) params.equipment_id = props.equipmentId;
    const data = await get('/equipment/debug/log', { params });
    lines.value = data.items || [];
  } catch {
    lines.value = [];
  }
}

function startTimers() {
  stopTimers();
  pollSummary();
  summaryTimer = setInterval(pollSummary, props.pollMs);
  if (auth.isAdmin && expanded.value) {
    pollDebugLog();
    debugTimer = setInterval(pollDebugLog, props.debugPollMs);
  }
}

function stopTimers() {
  if (summaryTimer) {
    clearInterval(summaryTimer);
    summaryTimer = null;
  }
  if (debugTimer) {
    clearInterval(debugTimer);
    debugTimer = null;
  }
}

watch(
  () => auth.isAuthenticated,
  () => startTimers()
);

watch(
  () => auth.isAdmin,
  () => {
    if (!auth.isAdmin) expanded.value = false;
    startTimers();
  }
);

watch(expanded, () => {
  if (expanded.value && auth.isAdmin) {
    pollDebugLog();
    debugTimer = setInterval(pollDebugLog, props.debugPollMs);
  } else if (debugTimer) {
    clearInterval(debugTimer);
    debugTimer = null;
    lines.value = [];
  }
});

onMounted(startTimers);
onUnmounted(stopTimers);

defineExpose({ refresh: pollSummary });
</script>

<style scoped>
.sap-protocol-bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #2d3748;
  color: #e2e8f0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.6875rem;
  line-height: 1;
  user-select: none;
}

.sap-protocol-bar--expanded {
  max-height: min(12rem, 30dvh);
}

.sap-protocol-bar__strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--sapProtocolBar_Height, 2.25rem);
  padding: 0 0.75rem;
}

.sap-protocol-bar__group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
}

.sap-protocol-bar__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
  font-weight: 600;
}

.sap-protocol-bar__chip--title {
  font-weight: 700;
  color: #f7fafc;
}

.sap-protocol-bar__chip--ok {
  color: #c6f6d5;
}

.sap-protocol-bar__chip--muted {
  color: rgba(255, 255, 255, 0.65);
  font-weight: 500;
}

.sap-protocol-bar__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
}

.sap-protocol-bar__dot--ok {
  background: #68d391;
}

.sap-protocol-bar__dot--muted {
  background: #718096;
}

.sap-protocol-bar__sep {
  color: rgba(255, 255, 255, 0.3);
}

.sap-protocol-bar__ok {
  color: #68d391;
}

.sap-protocol-bar__err {
  color: #fc8181;
}

.sap-protocol-bar__warn {
  color: #f6e05e;
}

.sap-protocol-bar__muted {
  color: rgba(255, 255, 255, 0.45);
}

.sap-protocol-bar__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.375rem;
  border-radius: 0.25rem;
}

.sap-protocol-bar__toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sap-protocol-bar__chevron {
  color: rgba(255, 255, 255, 0.45);
}

.sap-protocol-bar__log {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.375rem 0.75rem 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.625rem;
  line-height: 1.45;
}

.sap-protocol-bar__log-empty {
  color: rgba(255, 255, 255, 0.45);
}

.sap-protocol-bar__log-line {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.25rem 0;
}

.sap-protocol-bar__log-ts {
  color: rgba(255, 255, 255, 0.45);
}

.sap-protocol-bar__log-eq {
  margin-left: 0.5rem;
  color: #63b3ed;
}

.sap-protocol-bar__log-proto {
  margin-left: 0.25rem;
  color: #f6e05e;
}

.sap-protocol-bar__log-topic {
  margin-left: 0.25rem;
  color: #68d391;
}

.sap-protocol-bar__log-val {
  margin-left: 0.25rem;
  color: #e2e8f0;
}

.sap-protocol-bar__log-raw {
  display: block;
  color: rgba(255, 255, 255, 0.45);
}
</style>
